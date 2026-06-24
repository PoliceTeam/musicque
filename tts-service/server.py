"""VieNeu-TTS v3 Turbo – FastAPI microservice."""

import io
import logging
import os
import threading
import time
import wave

import edge_tts
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from vieneu import Vieneu

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SAMPLE_RATE = 48000
DEFAULT_VOICE = os.getenv("VIENEU_DEFAULT_VOICE")
APPLY_WATERMARK = os.getenv("VIENEU_APPLY_WATERMARK", "false").lower() == "true"
INFER_MAX_CHARS = int(os.getenv("VIENEU_INFER_MAX_CHARS", "220"))
INFER_TEMPERATURE = float(os.getenv("VIENEU_INFER_TEMPERATURE", "0.75"))
INFER_TOP_K = int(os.getenv("VIENEU_INFER_TOP_K", "20"))
INFER_TOP_P = float(os.getenv("VIENEU_INFER_TOP_P", "0.92"))
INFER_REPETITION_PENALTY = float(os.getenv("VIENEU_INFER_REPETITION_PENALTY", "1.15"))
INFER_MAX_NEW_FRAMES = int(os.getenv("VIENEU_INFER_MAX_NEW_FRAMES", "300"))
WARMUP_ENABLED = os.getenv("VIENEU_WARMUP_ENABLED", "true").lower() == "true"
WARMUP_TEXT = os.getenv("VIENEU_WARMUP_TEXT", "Xin chào")
EDGE_TTS_VOICE = os.getenv("EDGE_TTS_VOICE", "vi-VN-NamMinhNeural")
EDGE_TTS_RATE = os.getenv("EDGE_TTS_RATE", "+0%")
EDGE_TTS_VOLUME = os.getenv("EDGE_TTS_VOLUME", "+0%")
EDGE_TTS_PITCH = os.getenv("EDGE_TTS_PITCH", "+0Hz")

app = FastAPI(title="VieNeu-TTS Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tts = None
voice_map = {}
infer_lock = threading.Lock()
model_warmed = False


def _normalize(value: str) -> str:
    return value.strip().casefold()


def _resolve_voice(voice: str | None) -> str | None:
    if voice is None or tts is None:
        return voice

    requested = _normalize(voice)
    resolved_voice = voice_map.get(requested)
    if resolved_voice:
        return resolved_voice

    logger.warning("Unknown voice '%s'; available voices: %s", voice, list(voice_map.keys()))
    return voice


def _load_voice_map() -> dict:
    voices = {}
    for label, voice_id in tts.list_preset_voices():
        voices[_normalize(label)] = voice_id
        voices[_normalize(voice_id)] = voice_id
    return voices


def _infer_options() -> dict:
    return {
        "apply_watermark": APPLY_WATERMARK,
        "max_chars": INFER_MAX_CHARS,
        "temperature": INFER_TEMPERATURE,
        "top_k": INFER_TOP_K,
        "top_p": INFER_TOP_P,
        "repetition_penalty": INFER_REPETITION_PENALTY,
        "max_new_frames": INFER_MAX_NEW_FRAMES,
    }


def _infer_sync(text: str, voice: str | None) -> np.ndarray:
    selected_voice = _resolve_voice(voice or DEFAULT_VOICE)
    started_at = time.perf_counter()

    with infer_lock:
        audio = tts.infer(text, voice=selected_voice, **_infer_options())

    logger.info(
        "Synthesized text_len=%d voice=%s duration_ms=%d audio_samples=%d",
        len(text),
        selected_voice,
        int((time.perf_counter() - started_at) * 1000),
        int(audio.size),
    )
    return audio


def _warmup_model() -> None:
    global model_warmed

    if not WARMUP_ENABLED:
        logger.info("VieNeu warmup disabled")
        return

    try:
        logger.info("Warming VieNeu model with preset voice=%s …", DEFAULT_VOICE or "default")
        _infer_sync(WARMUP_TEXT, DEFAULT_VOICE)
        model_warmed = True
        logger.info("VieNeu model warmup completed")
    except Exception:
        logger.exception("VieNeu model warmup failed")


@app.on_event("startup")
async def _load_model() -> None:
    global tts, voice_map
    try:
        logger.info("Loading VieNeu v3turbo model …")
        tts = Vieneu()
        voice_map = _load_voice_map()
        await run_in_threadpool(_warmup_model)
        logger.info("Model loaded – sample_rate=%d", SAMPLE_RATE)
    except Exception:
        logger.exception("Failed to load VieNeu model")
        raise


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mode": "v3turbo",
        "sample_rate": SAMPLE_RATE,
        "voice_mode": "preset",
        "default_voice": DEFAULT_VOICE,
        "warmup_enabled": WARMUP_ENABLED,
        "model_warmed": model_warmed,
        "apply_watermark": APPLY_WATERMARK,
        "max_new_frames": INFER_MAX_NEW_FRAMES,
    }


@app.get("/voices")
async def voices():
    if tts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    preset = tts.list_preset_voices()
    return [{"id": vid, "name": label} for label, vid in preset]


@app.get("/synthesize")
async def synthesize(
    text: str = Query(..., min_length=1, description="Text to synthesise"),
    voice: str | None = Query(default=None, description="Preset voice ID"),
):
    if tts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        audio: np.ndarray = await run_in_threadpool(_infer_sync, text, voice)
    except Exception as exc:
        logger.exception("Inference failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    pcm16 = (audio * 32767).clip(-32768, 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm16.tobytes())

    return Response(content=buf.getvalue(), media_type="audio/wav")


@app.get("/edge-synthesize")
async def edge_synthesize(
    text: str = Query(..., min_length=1, description="Text to synthesise"),
    voice: str | None = Query(default=None, description="Microsoft Edge TTS voice"),
    rate: str = Query(default=EDGE_TTS_RATE, description="Speech rate adjustment"),
    volume: str = Query(default=EDGE_TTS_VOLUME, description="Speech volume adjustment"),
    pitch: str = Query(default=EDGE_TTS_PITCH, description="Speech pitch adjustment"),
):
    selected_voice = voice or EDGE_TTS_VOICE
    started_at = time.perf_counter()

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=selected_voice,
            rate=rate,
            volume=volume,
            pitch=pitch,
        )
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
    except Exception as exc:
        logger.exception("Edge TTS fallback failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    audio = b"".join(audio_chunks)
    logger.info(
        "Edge synthesized text_len=%d voice=%s duration_ms=%d audio_bytes=%d",
        len(text),
        selected_voice,
        int((time.perf_counter() - started_at) * 1000),
        len(audio),
    )
    return Response(content=audio, media_type="audio/mpeg")


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("VIENEU_HOST", "0.0.0.0"),
        port=int(os.getenv("VIENEU_PORT", "8100")),
    )
