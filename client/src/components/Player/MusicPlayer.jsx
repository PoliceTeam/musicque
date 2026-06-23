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
  generateTTS,
} from '../../services/api';

const { Title, Text } = Typography;

const TTS_LOG_PREFIX = '[MusicPlayer][TTS]';

const MusicPlayer = () => {
  const { isDark } = useTheme();
  const { playlist, refreshPlaylist, currentSession } =
    useContext(PlaylistContext);
  const [currentSong, setCurrentSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsPreparing, setTtsPreparing] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const playerRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const wasMessageSpokenRef = useRef(false);
  const ttsRef = useRef(null);
  const ttsAudioUrlCacheRef = useRef(new Map());

  const getFullAudioUrl = useCallback((audioUrl) => {
    if (!audioUrl) return null;
    if (/^https?:\/\//i.test(audioUrl)) return audioUrl;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    return `${apiUrl}${audioUrl}`;
  }, []);

  const getVieneuAudioUrl = useCallback(
    async (songId, signal) => {
      const cachedAudioUrl = ttsAudioUrlCacheRef.current.get(songId);
      if (cachedAudioUrl) return cachedAudioUrl;

      const response = await generateTTS(songId, { signal });
      const { audioUrl, fallback, fallbackReason } = response.data;

      if (fallback || !audioUrl) {
        throw new Error(fallbackReason || 'VieNeu-TTS unavailable');
      }

      const fullAudioUrl = getFullAudioUrl(audioUrl);
      ttsAudioUrlCacheRef.current.set(songId, fullAudioUrl);
      return fullAudioUrl;
    },
    [getFullAudioUrl]
  );

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
      ttsRef.current?.cancel(false);
    };
  }, []);

  // ======== VieNeu-TTS (AI voice) ========
  const playVieneuTTS = useCallback(
    (songId) => {
      return new Promise(async (resolve, reject) => {
        const startedAt = performance.now();
        const controller = new AbortController();
        const ttsState = {
          audio: null,
          controller,
          done: false,
          cancel: null,
        };

        const finishTTS = (completed = true, reason = 'completed') => {
          if (ttsState.done) return;

          ttsState.done = true;
          ttsState.controller.abort();

          if (ttsState.audio) {
            ttsState.audio.pause();
            ttsState.audio.src = '';
            ttsState.audio.load();
          }

          if (ttsRef.current === ttsState) {
            ttsRef.current = null;
          }

          setSpeaking(false);

          console.log(`${TTS_LOG_PREFIX} finish AI speech`, {
            completed,
            reason,
            elapsedMs: Math.round(performance.now() - startedAt),
          });

          resolve(completed);
        };

        ttsState.cancel = (completed = false) => {
          console.warn(`${TTS_LOG_PREFIX} AI speech cancelled`, {
            completed,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
          finishTTS(completed, 'cancelled');
        };

        ttsRef.current?.cancel(false);
        ttsRef.current = ttsState;

        try {
          console.log(`${TTS_LOG_PREFIX} Requesting VieNeu-TTS for song:`, songId);
          const fullAudioUrl = await getVieneuAudioUrl(songId, controller.signal);
          if (ttsState.done) return;
          console.log(`${TTS_LOG_PREFIX} Playing AI audio:`, fullAudioUrl);

          const audio = new Audio(fullAudioUrl);
          ttsState.audio = audio;

          audio.onended = () => {
            console.log(`${TTS_LOG_PREFIX} AI audio playback finished`);
            finishTTS(true, 'onended');
          };

          audio.onerror = (err) => {
            if (ttsState.done) return;
            console.error(`${TTS_LOG_PREFIX} AI audio playback error:`, err);
            if (ttsRef.current === ttsState) {
              ttsRef.current = null;
            }
            reject(new Error('Audio playback failed'));
          };

          audio.play().catch((err) => {
            if (ttsState.done) return;
            console.error(`${TTS_LOG_PREFIX} AI audio play() rejected:`, err);
            if (ttsRef.current === ttsState) {
              ttsRef.current = null;
            }
            reject(err);
          });
        } catch (error) {
          if (ttsState.done) return;
          if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
            finishTTS(false, 'cancelled');
            return;
          }
          console.error(`${TTS_LOG_PREFIX} VieNeu-TTS API error:`, error);
          if (ttsRef.current === ttsState) {
            ttsRef.current = null;
          }
          reject(error);
        }
      });
    },
    [getVieneuAudioUrl]
  );

  useEffect(() => {
    if (!currentSong?._id || !currentSong.message || wasMessageSpokenRef.current) {
      setTtsPreparing(false);
      return;
    }

    const controller = new AbortController();
    const cachedAudioUrl = ttsAudioUrlCacheRef.current.get(currentSong._id);

    if (cachedAudioUrl) {
      setTtsPreparing(false);
      return;
    }

    setTtsPreparing(true);

    getVieneuAudioUrl(currentSong._id, controller.signal)
      .then((audioUrl) => {
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.load();
        setTtsPreparing(false);
      })
      .catch((error) => {
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
        console.warn(`${TTS_LOG_PREFIX} preload failed`, error.message);
        setTtsPreparing(false);
      });

    return () => {
      controller.abort();
      setTtsPreparing(false);
    };
  }, [currentSong?._id, currentSong?.message, getVieneuAudioUrl]);

  // Preload NEXT song in the background for 0ms latency
  useEffect(() => {
    const nextSong = playlist?.[0];
    if (!nextSong?._id || !nextSong.message) return;

    const controller = new AbortController();
    const cachedAudioUrl = ttsAudioUrlCacheRef.current.get(nextSong._id);

    if (!cachedAudioUrl) {
      console.log(`${TTS_LOG_PREFIX} Preloading NEXT song TTS background:`, nextSong._id);
      getVieneuAudioUrl(nextSong._id, controller.signal)
        .then((audioUrl) => {
          const audio = new Audio(audioUrl);
          audio.preload = 'auto';
          audio.load();
        })
        .catch((error) => {
          if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
          console.warn(`${TTS_LOG_PREFIX} next song preload failed`, error.message);
        });
    }

    return () => controller.abort();
  }, [playlist, getVieneuAudioUrl]);

  // ======== Main playSpeech: VieNeu-TTS only for playlist songs ========
  const playSpeech = useCallback(
    async (text, title, username, songId) => {
      console.log(`${TTS_LOG_PREFIX} playSpeech called`, {
        songId,
        hasText: Boolean(text),
        textLength: text?.length || 0,
      });

      if (!text) return true;

      // Try VieNeu-TTS (AI voice) first
      if (songId) {
        try {
          setSpeaking(true);
          const completed = await playVieneuTTS(songId);
          if (completed) {
            wasMessageSpokenRef.current = true;
          }
          setSpeaking(false);
          console.log(`${TTS_LOG_PREFIX} VieNeu-TTS succeeded`);
          return completed;
        } catch (err) {
          console.warn(`${TTS_LOG_PREFIX} VieNeu-TTS failed, blocking music start:`, err.message);
          setSpeaking(false);
          message.warning('Chưa phát được lời nhắn AI, vui lòng thử lại');
          return false;
        }
      }

      console.warn(`${TTS_LOG_PREFIX} missing song id, cannot generate VieNeu-TTS`);
      return false;
    },
    [playVieneuTTS]
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

    if (currentSong.message && !wasMessageSpokenRef.current && ttsPreparing) {
      message.info('Đang chuẩn bị giọng AI, vui lòng đợi một chút');
      return;
    }

    try {
      if (currentSong.message && !wasMessageSpokenRef.current && !speaking) {
        console.log(`${TTS_LOG_PREFIX} message should be spoken before play`);
        setSpeaking(true);
        try {
          const speechCompleted = await playSpeech(
            currentSong.message,
            currentSong.title,
            currentSong.addedBy.username,
            currentSong._id
          );
          console.log(`${TTS_LOG_PREFIX} playSpeech resolved`);
          setSpeaking(false);

          if (!speechCompleted) {
            console.log(`${TTS_LOG_PREFIX} play cancelled before music start`);
            return;
          }
        } catch (error) {
          console.error(`${TTS_LOG_PREFIX} playSpeech threw`, error);
          setSpeaking(false);
          return;
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
  }, [currentSong, speaking, ttsPreparing, playSpeech]);

  const handlePause = () => {
    setPlaying(false);
    ttsRef.current?.cancel(false);
  };

  const handleSkipMessage = () => {
    if (speaking) {
      ttsRef.current?.cancel(true);
      setSpeaking(false);
      wasMessageSpokenRef.current = true;
      setPlaying(true);
    }
  };

  const handleNext = async () => {
    setNextLoading(true);
    const wasPlaying = playing; // Lưu tạm trạng thái playing
    wasPlayingRef.current = true; // Luôn đặt thành true để đảm bảo bài mới sẽ phát

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
                if (ttsPreparing) return;
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
                style={{ minWidth: 168 }}
                loading={speaking || ttsPreparing}
                disabled={ttsPreparing}
              >
                {ttsPreparing ? 'Chuẩn bị giọng AI...' : speaking ? 'Đang đọc lời nhắn...' : 'Phát'}
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
