import React, { lazy, Suspense, useContext, useState, useEffect, useRef } from 'react';
import { Tabs, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined, TrophyOutlined } from '@ant-design/icons';
import AddSongForm from '../components/Playlist/AddSongForm';
import PlaylistView from '../components/Playlist/PlaylistView';
import NowPlayingBar from '../components/Home/NowPlayingBar';
import LiveActivityFeed from '../components/Home/LiveActivityFeed';
import WeatherHeader from '../components/Weather/WeatherHeader';
import UserMenu from '../components/Auth/UserMenu';
import SidebarNav from '../components/Layout/SidebarNav';
import ChohanPanel from '../components/Chohan/ChohanPanel';
import TetCountdown from '../components/TetCountdown/TetCountdown';
import DailyIdiom from '../components/DailyIdiom/DailyIdiom';
import { PlaylistContext } from '../contexts/PlaylistContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { warmupTTS } from '../services/api';
import '../components/WealthLeaderboard/wealth-leaderboard.css';

const ChibiOverlay = lazy(() => import('../components/Chibi/ChibiOverlay'))
const NesGame = lazy(() => import('../components/NesGame/NesGame'))
const TechNewsWidget = lazy(() => import('../components/TechNews/TechNewsWidget'))
const VnExpressNewsView = lazy(() => import('../components/VnExpressNews/VnExpressNewsView'))
const WealthLeaderboardModal = lazy(
  () => import('../components/WealthLeaderboard/WealthLeaderboardModal'),
)

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

const HomePage = () => {
  const { currentSession, currentSong } = useContext(PlaylistContext);
  const { displayName } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showNesGame, setShowNesGame] = useState(false);
  const [currentGame, setCurrentGame] = useState({ file: null, name: '' });
  const [showSnowEffect, setShowSnowEffect] = useState(false);
  const [showChibi, setShowChibi] = useState(false);
  const [showWealthLeaderboard, setShowWealthLeaderboard] = useState(false);
  const [newsTab, setNewsTab] = useState('1');
  const snowCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const handlePlayNesGame = (gameFile, gameName) => {
    setCurrentGame({ file: gameFile, name: gameName });
    setShowNesGame(true);
  };

  const handleCloseNesGame = () => {
    setShowNesGame(false);
    setCurrentGame({ file: null, name: '' });
  };

  useEffect(() => {
    const show = () => setShowChibi(true)

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(show, { timeout: 4000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(show, 2500)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('vieneuTTSWarmupStarted') === 'true') {
      return undefined;
    }

    const controller = new AbortController();
    let retryTimeoutId;

    const requestWarmup = (attempt = 0) => {
      warmupTTS({ signal: controller.signal })
        .then(() => {
          sessionStorage.setItem('vieneuTTSWarmupStarted', 'true');
        })
        .catch((error) => {
          if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
          if (attempt < 1) {
            retryTimeoutId = window.setTimeout(() => requestWarmup(attempt + 1), 5000);
            return;
          }
          console.warn('[TTS] warmup request failed:', error.message);
        });
    };

    const timeoutId = window.setTimeout(() => requestWarmup(), 800);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(retryTimeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!showSnowEffect || !snowCanvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return undefined;
    }

    const canvas = snowCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const googleColors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FFFFFF'];

    let width = window.innerWidth;
    let height = window.innerHeight;
    let snowflakes = [];

    class Snowflake {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height - height;
        this.radius = Math.random() * 2.5 + 1;
        this.speedY = Math.random() * 1 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.3;
        this.color = googleColors[Math.floor(Math.random() * googleColors.length)];
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;

        if (this.y > height) {
          this.reset();
          this.y = -10;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
      }
    }

    function init() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      snowflakes = [];
      for (let i = 0; i < 150; i++) {
        snowflakes.push(new Snowflake());
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      snowflakes.forEach((s) => {
        s.update();
        s.draw();
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    const handleResize = () => {
      init();
    };

    window.addEventListener('resize', handleResize);
    init();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [showSnowEffect]);

  const hasPlayer = Boolean(currentSession && currentSong);

  return (
    <>
      {showSnowEffect && <canvas ref={snowCanvasRef} className="easter-egg" id="snowCanvas" />}
      <style>
        {`
          canvas.easter-egg {
            opacity: 0.7;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
          }
        `}
      </style>

      {showChibi && (
        <Suspense fallback={null}>
          <ChibiOverlay />
        </Suspense>
      )}

      <div className={`sp-shell${hasPlayer ? '' : ' sp-shell--no-player'}`}>
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="sp-sidebar">
          <SidebarNav>
            {/* Easter egg gói gọn thành hàng icon để chừa chỗ cho form thêm bài */}
            <div className="sp-quicktoys">
              <Tooltip title="Contra">
                <button
                  type="button"
                  className="sp-quicktoys__btn"
                  aria-label="Chơi Contra"
                  onClick={() => handlePlayNesGame('/nes/contra.nes', 'Contra')}
                >
                  🎮
                </button>
              </Tooltip>
              <Tooltip title="Super Mario">
                <button
                  type="button"
                  className="sp-quicktoys__btn"
                  aria-label="Chơi Super Mario"
                  onClick={() => handlePlayNesGame('/nes/super_mario.nes', 'Super Mario')}
                >
                  🍄
                </button>
              </Tooltip>
              <Tooltip title={showSnowEffect ? 'Tắt tuyết' : 'Bật tuyết'}>
                <button
                  type="button"
                  className={`sp-quicktoys__btn${showSnowEffect ? ' is-active' : ''}`}
                  aria-label="Bật/tắt hiệu ứng tuyết"
                  onClick={() => setShowSnowEffect((prev) => !prev)}
                >
                  ❄️
                </button>
              </Tooltip>
            </div>
          </SidebarNav>

          <section className="sp-panel sp-panel--grow">
            <div className="sp-panel__head">
              <h2 className="sp-panel__title">
                <span aria-hidden="true">➕</span>
                Thêm bài hát
              </h2>
            </div>
            <div className="sp-panel__body" style={{ padding: '0 20px 20px' }}>
              <AddSongForm />
            </div>
          </section>
        </aside>

        {/* ── Nội dung chính ──────────────────────────────────────── */}
        <main className="sp-main">
          <header className="sp-topbar">
            <h1 className="sp-topbar__greeting">
              {getGreeting()}
              {displayName ? `, ${displayName}` : ''}
            </h1>
            <div className="sp-topbar__actions">
              <WeatherHeader />
              <button
                type="button"
                className="wealth-trigger"
                onClick={() => setShowWealthLeaderboard(true)}
              >
                <TrophyOutlined />
                <span>Top đại phú</span>
              </button>
              <Tooltip title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
                <button
                  type="button"
                  className="sp-btn sp-btn--ghost sp-btn--icon"
                  onClick={toggleTheme}
                  aria-label="Đổi giao diện sáng/tối"
                >
                  {isDark ? <SunOutlined /> : <MoonOutlined />}
                </button>
              </Tooltip>
              <UserMenu />
            </div>
          </header>

          <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TetCountdown />
            <DailyIdiom />
            <PlaylistView />
          </div>
        </main>

        {/* ── Cột phải ────────────────────────────────────────────── */}
        <aside className="sp-rail">
          <ChohanPanel />

          <LiveActivityFeed className="sp-rail-activity" />

          <section className="sp-panel sp-panel--grow sp-rail-news">
            <div className="sp-panel__head">
              <h2 className="sp-panel__title">
                <span aria-hidden="true">🌍</span>
                Thế giới có gì mới?
              </h2>
            </div>
            <div
              className="sp-panel__body sp-newsdock"
              style={{ padding: '0 16px 12px', overflowY: 'hidden' }}
            >
              <Tabs
                activeKey={newsTab}
                onChange={setNewsTab}
                items={[
                  {
                    label: 'VnExpress',
                    key: '1',
                    children: newsTab === '1' ? (
                      <Suspense fallback={null}>
                        <VnExpressNewsView />
                      </Suspense>
                    ) : null,
                  },
                  {
                    label: 'Tech News',
                    key: '2',
                    children: newsTab === '2' ? (
                      <Suspense fallback={null}>
                        <TechNewsWidget />
                      </Suspense>
                    ) : null,
                  },
                ]}
              />
            </div>
          </section>
        </aside>

        {/* ── Thanh phát nhạc ─────────────────────────────────────── */}
        {hasPlayer && (
          <div className="sp-player">
            <NowPlayingBar />
          </div>
        )}
      </div>

      {showNesGame && currentGame.file && (
        <Suspense fallback={null}>
          <NesGame
            gameFile={currentGame.file}
            gameName={currentGame.name}
            onClose={handleCloseNesGame}
          />
        </Suspense>
      )}

      {showWealthLeaderboard && (
        <Suspense fallback={null}>
          <WealthLeaderboardModal
            open={showWealthLeaderboard}
            onClose={() => setShowWealthLeaderboard(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default HomePage;
