import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import ReactPlayer from 'react-player';
import { Card, Button, Typography, Space, message } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  markSongAsPlayed,
  removeSongFromPlaylist,
  getCurrentSong,
} from '../../services/api';

const { Title, Text } = Typography;

const TTS_LOG_PREFIX = '[MusicPlayer][WebSpeech]';
const WEB_SPEECH_LANG = 'vi-VN';
const WEB_SPEECH_RATE = 1.1;
const WEB_SPEECH_PITCH = 1;
const WEB_SPEECH_MIN_TIMEOUT = 7000;
const WEB_SPEECH_VOICE_WAIT_TIMEOUT = 1500;

const getVietnameseVoice = () => {
  const voices = window.speechSynthesis?.getVoices?.() || [];

  return (
    voices.find((voice) => voice.lang === WEB_SPEECH_LANG) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith('vi')) ||
    null
  );
};

const waitForVietnameseVoice = () =>
  new Promise((resolve) => {
    const voice = getVietnameseVoice();

    if (voice || !window.speechSynthesis) {
      resolve(voice);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(getVietnameseVoice());
    }, WEB_SPEECH_VOICE_WAIT_TIMEOUT);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeoutId);
      window.speechSynthesis.onvoiceschanged = null;
      resolve(getVietnameseVoice());
    };
  });

const MusicPlayer = () => {
  const { isDark } = useTheme();
  const { playlist, refreshPlaylist, currentSession } =
    useContext(PlaylistContext);
  const [currentSong, setCurrentSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const playerRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const wasMessageSpokenRef = useRef(false);
  const speechRef = useRef(null);

  // Fetch current song
  const fetchCurrentSong = async () => {
    try {
      const response = await getCurrentSong();
      setCurrentSong(response.data.currentSong);
      await refreshPlaylist();
      return response.data.currentSong;
    } catch (error) {
      console.error('Error fetching current song:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchCurrentSong();
    return () => {
      speechRef.current?.cancel(false);
    };
  }, []);

  const playSpeech = useCallback(
    (text, title, username) => {
      console.log(`${TTS_LOG_PREFIX} playSpeech called`, {
        hasText: Boolean(text),
        textLength: text?.length || 0,
        title,
        username,
        speaking,
        alreadySpeakingRef: Boolean(speechRef.current),
      });

      if (!text || speaking) {
        console.warn(`${TTS_LOG_PREFIX} playSpeech skipped`, {
          reason: !text ? 'empty_text' : 'already_speaking',
          speaking,
        });
        return Promise.resolve();
      }

      return new Promise(async (resolve) => {
        speechRef.current?.cancel(false);

        const speechMessage = `Tới từ ${username} với lời nhắn: ${text}`;
        const startedAt = performance.now();
        const speechState = {
          done: false,
          timeoutId: null,
          utterance: null,
          cancel: null,
        };

        const finishSpeech = (completed = true, reason = 'completed') => {
          if (speechState.done) return;

          speechState.done = true;
          window.clearTimeout(speechState.timeoutId);
          window.speechSynthesis?.cancel?.();

          setSpeaking(false);

          if (completed) {
            wasMessageSpokenRef.current = true;
          }

          if (speechRef.current === speechState) {
            speechRef.current = null;
          }

          console.log(`${TTS_LOG_PREFIX} finish speech`, {
            completed,
            reason,
            elapsedMs: Math.round(performance.now() - startedAt),
          });

          resolve();
        };

        speechState.cancel = (completed = false) => {
          console.warn(`${TTS_LOG_PREFIX} speech cancelled`, {
            completed,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
          finishSpeech(completed, 'cancelled');
        };

        speechRef.current = speechState;

        setSpeaking(true);

        try {
          if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            console.warn(`${TTS_LOG_PREFIX} unsupported, continuing to music`);
            finishSpeech(true, 'unsupported');
            return;
          }

          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(speechMessage);
          const voice = await waitForVietnameseVoice();

          if (speechState.done) return;

          const timeoutMs = Math.max(
            WEB_SPEECH_MIN_TIMEOUT,
            speechMessage.length * 180
          );

          utterance.lang = WEB_SPEECH_LANG;
          utterance.rate = WEB_SPEECH_RATE;
          utterance.pitch = WEB_SPEECH_PITCH;

          if (voice) {
            utterance.voice = voice;
          }

          speechState.utterance = utterance;

          console.log(`${TTS_LOG_PREFIX} speak`, {
            messageLength: speechMessage.length,
            language: utterance.lang,
            voiceName: voice?.name,
            voiceLang: voice?.lang,
            rate: utterance.rate,
            pitch: utterance.pitch,
            elapsedMs: Math.round(performance.now() - startedAt),
          });

          speechState.timeoutId = window.setTimeout(() => {
            if (speechState.done) return;

            console.warn(`${TTS_LOG_PREFIX} timeout, continuing to music`, {
              timeoutMs,
              elapsedMs: Math.round(performance.now() - startedAt),
            });
            finishSpeech(true, 'timeout');
          }, timeoutMs);

          utterance.onstart = () => {
            console.log(`${TTS_LOG_PREFIX} onstart`, {
              elapsedMs: Math.round(performance.now() - startedAt),
            });
          };

          utterance.onend = () => finishSpeech(true, 'onend');

          utterance.onerror = (error) => {
            console.error(`${TTS_LOG_PREFIX} onerror`, {
              error,
              elapsedMs: Math.round(performance.now() - startedAt),
            });
            finishSpeech(true, 'onerror');
          };

          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.warn(`${TTS_LOG_PREFIX} speak failed, continuing to music`, {
            error,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
          finishSpeech(true, 'speak_failed');
        }
      });
    },
    [speaking]
  );

  const handlePlay = useCallback(async () => {
    console.log(`${TTS_LOG_PREFIX} handlePlay called`, {
      hasCurrentSong: Boolean(currentSong),
      songId: currentSong?._id,
      title: currentSong?.title,
      hasMessage: Boolean(currentSong?.message),
      messageLength: currentSong?.message?.length || 0,
      addedBy: currentSong?.addedBy?.username,
      speaking,
      wasMessageSpoken: wasMessageSpokenRef.current,
      playing,
    });

    if (!currentSong) {
      message.error('Không có bài hát nào trong playlist');
      return;
    }

    try {
      if (currentSong.message && !wasMessageSpokenRef.current && !speaking) {
        console.log(`${TTS_LOG_PREFIX} message should be spoken before play`);
        setSpeaking(true);
        try {
          await playSpeech(
            currentSong.message,
            currentSong.title,
            currentSong.addedBy.username
          );
          console.log(`${TTS_LOG_PREFIX} playSpeech resolved`);
          setSpeaking(false);
        } catch (error) {
          console.error(`${TTS_LOG_PREFIX} playSpeech threw`, error);
          setSpeaking(false);
        }
      } else {
        console.log(`${TTS_LOG_PREFIX} message speech not required`, {
          hasMessage: Boolean(currentSong.message),
          wasMessageSpoken: wasMessageSpokenRef.current,
          speaking,
        });
      }

      // Đảm bảo player đã sẵn sàng với timeout
      if (playerRef.current) {
        const internalPlayer = playerRef.current.getInternalPlayer();

        console.log(`${TTS_LOG_PREFIX} checking player readiness`, {
          hasInternalPlayer: Boolean(internalPlayer),
          hasPlayVideo: typeof internalPlayer?.playVideo === 'function',
        });

        // Kiểm tra xem player đã thực sự sẵn sàng chưa
        if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
          wasPlayingRef.current = true;
          // Thêm timeout nhỏ trước khi phát
          setTimeout(() => {
            console.log(`${TTS_LOG_PREFIX} setPlaying(true) after speech`);
            setPlaying(true);
          }, 100);
        } else {
          console.warn('Player not fully ready, waiting...');
          // Đợi player hoàn toàn sẵn sàng
          setTimeout(() => {
            if (playerRef.current) {
              wasPlayingRef.current = true;
              console.log(`${TTS_LOG_PREFIX} setPlaying(true) after player wait`);
              setPlaying(true);
            }
          }, 1000);
        }
      } else {
        console.warn('Player not ready');
        message.warning('Đang tải player, vui lòng thử lại');
      }
    } catch (error) {
      setPlaying(false);
      console.error('Error playing:', error);
      message.error('Có lỗi xảy ra khi phát bài hát');
    }
  }, [currentSong, speaking, playSpeech]);

  const handlePause = () => {
    setPlaying(false);
    speechRef.current?.cancel(false);
  };

  const handleSkipMessage = () => {
    if (speaking) {
      speechRef.current?.cancel(true);
      setPlaying(true);
    }
  };

  const handleNext = async () => {
    setNextLoading(true);
    const wasPlaying = playing; // Lưu tạm trạng thái playing
    wasPlayingRef.current = true; // Luôn đặt thành true để đảm bảo bài mới sẽ phát

    speechRef.current?.cancel(false);
    handlePause();

    if (currentSong) {
      try {
        await markSongAsPlayed(currentSong._id);
        await removeSongFromPlaylist(currentSong._id);
        wasMessageSpokenRef.current = false;

        // Chỉ set currentSong = null và fetch bài mới
        setCurrentSong(null);
        await refreshPlaylist();

        // Đảm bảo wasPlayingRef.current vẫn là true trước khi fetch bài mới
        wasPlayingRef.current = true;
        await fetchCurrentSong();

        message.success('Đã phát xong và xóa bài hát khỏi playlist');
      } catch (error) {
        console.error('Error handling song completion:', error);
        message.error('Có lỗi xảy ra khi xóa bài hát');
      } finally {
        setNextLoading(false);
      }
    } else {
      setNextLoading(false);
    }

    if (playlist.length === 0) {
      message.info('Đã hết playlist');
    }
  };

  const handleEnded = () => {
    handleNext();
  };

  useEffect(() => {
    if (currentSong && wasPlayingRef.current) {
      handlePlay();
      refreshPlaylist();
      wasPlayingRef.current = false;
    }
  }, [currentSong, handlePlay]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const nextSong = await fetchCurrentSong();
      if (nextSong) {
        message.success('Đã làm mới thông tin bài hát');
      } else {
        message.info('Không có bài hát nào trong playlist');
      }
    } catch (error) {
      console.error('Error refreshing current song:', error);
      message.error('Có lỗi xảy ra khi làm mới');
    } finally {
      setRefreshing(false);
    }
  };

  if (!currentSong || !currentSession) {
    return (
      <Card
        title='Music Player'
        style={{
          background: isDark ? '#1f1f1f' : undefined,
        }}
      >
        <Space
          direction='vertical'
          align='center'
          style={{ width: '100%' }}
        >
          <Text>Không có bài hát nào đang phát</Text>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            Làm mới
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      title='Music Player'
      style={{
        background: isDark ? '#1f1f1f' : undefined,
      }}
    >
      {currentSong && (
        <>
          <Title level={4}>{currentSong.title}</Title>
          <Text type='secondary'>Thêm bởi: {currentSong.addedBy.username}</Text>

          <div
            style={{ marginTop: 16, marginBottom: 16, position: 'relative' }}
          >
            <ReactPlayer
              ref={playerRef}
              url={currentSong.youtubeUrl}
              playing={playing && !speaking}
              controls={false}
              width='100%'
              height='240px'
              onReady={() => {
                if (wasPlayingRef.current) {
                  setPlaying(true);
                }
                const internalPlayer = playerRef.current?.getInternalPlayer();
                if (internalPlayer && internalPlayer.addEventListener) {
                  internalPlayer.addEventListener('onStateChange', (event) => {
                    if (event.data === 0) handleEnded();
                  });
                }
              }}
              onError={(error) => {
                console.error('Player error:', error);
                message.error('Có lỗi khi tải video');
              }}
              playsinline
              config={{
                youtube: {
                  playerVars: {
                    playsinline: 1,
                    background: 1,
                    disablekb: 1,
                    autoplay: 0,
                    origin: window.location.origin, // Thêm origin
                    enablejsapi: 1, // Bật JS API,
                    hl: 'vi',
                    cc_lang_pref: 'vi',
                    modestbranding: 1, // Ẩn YouTube branding
                    rel: 0, // Không show related videos
                  },
                  onUnstarted: () => {
                    console.log('YouTube player unstarted');
                  },
                },
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'default',
                zIndex: 10,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!playing) {
                  handlePlay();
                } else {
                  handlePause();
                }
              }}
            />
          </div>

          <Space>
            {playing ? (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={handlePause}
                type='primary'
                size='large'
                disabled={speaking}
              >
                Tạm dừng
              </Button>
            ) : (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handlePlay}
                type='primary'
                size='large'
                style={{ width: 120 }}
                loading={speaking}
              >
                {speaking ? 'Đang đọc lời nhắn...' : 'Phát'}
              </Button>
            )}

            {speaking && (
              <Button
                icon={<CloseOutlined />}
                onClick={handleSkipMessage}
                size='large'
                type='default'
                danger
              >
                Skip lời nhắn
              </Button>
            )}

            {!speaking && (
              <>
                <Button
                  icon={<StepForwardOutlined />}
                  onClick={handleNext}
                  size='large'
                  loading={nextLoading}
                >
                  Bài tiếp theo
                </Button>
              </>
            )}
          </Space>

          {currentSong.message && (
            <div style={{ marginTop: 16 }}>
              <Text strong>Lời nhắn:</Text>
              <Text italic> "{currentSong.message}"</Text>
              {wasMessageSpokenRef.current && (
                <Text type='success'> (Đã đọc)</Text>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default MusicPlayer;
