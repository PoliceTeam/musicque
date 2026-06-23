"""VieNeu-TTS v3 Turbo – FastAPI microservice."""

import io
import logging
import os
import threading
import wave

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from vieneu import Vieneu

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SAMPLE_RATE = 48000
APPLY_WATERMARK = os.getenv("VIENEU_APPLY_WATERMARK", "false").lower() == "true"
INFER_MAX_CHARS = int(os.getenv("VIENEU_INFER_MAX_CHARS", "220"))
INFER_TEMPERATURE = float(os.getenv("VIENEU_INFER_TEMPERATURE", "0.75"))
INFER_TOP_K = int(os.getenv("VIENEU_INFER_TOP_K", "20"))
INFER_TOP_P = float(os.getenv("VIENEU_INFER_TOP_P", "0.92"))
INFER_REPETITION_PENALTY = float(os.getenv("VIENEU_INFER_REPETITION_PENALTY", "1.15"))

app = FastAPI(title="VieNeu-TTS Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tts = None
infer_lock = threading.Lock()


def _normalize(value: str) -> str:
    return value.strip().casefold()


def _resolve_voice(voice: str | None) -> str | None:
    if voice is None or tts is None:
        return voice

    requested = _normalize(voice)
    for label, voice_id in tts.list_preset_voices():
        if requested in {_normalize(label), _normalize(voice_id)}:
            return voice_id

    logger.warning("Unknown voice '%s'; available voices: %s", voice, tts.list_preset_voices())
    return voice


@app.on_event("startup")
async def _load_model() -> None:
    global tts
    try:
        logger.info("Loading VieNeu v3turbo model …")
        tts = Vieneu()
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
        "apply_watermark": APPLY_WATERMARK,
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
        with infer_lock:
            audio: np.ndarray = tts.infer(text, voice=_resolve_voice(voice), temperature=0.7)
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


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("VIENEU_HOST", "0.0.0.0"),
        port=int(os.getenv("VIENEU_PORT", "8100")),
    )
