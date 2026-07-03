import React, { useContext, useState, useEffect, useRef } from 'react';
import { Layout, Typography, Row, Col, Card, Button, Input, Space, Modal, Tabs, Dropdown, Menu } from 'antd';
import {
  UserOutlined,
  LoginOutlined,
  DropboxOutlined,
  MoonOutlined,
  SunOutlined,
  TrophyOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import AddSongForm from '../components/Playlist/AddSongForm';
import PlaylistView from '../components/Playlist/PlaylistView';
import VnExpressNewsView from '../components/VnExpressNews/VnExpressNewsView';
import TechNewsWidget from '../components/TechNews/TechNewsWidget';
import NowPlayingBar from '../components/Home/NowPlayingBar';
import LiveActivityFeed from '../components/Home/LiveActivityFeed';
import WorldCupHeaderChip from '../components/WorldCup/WorldCupHeaderChip';
import WorldCupWidget from '../components/WorldCup/WorldCupWidget';
import WeatherHeader from '../components/Weather/WeatherHeader';
import DiceGame from '../games/dice/DiceGame';
import TetCountdown from '../components/TetCountdown/TetCountdown';
import NesGame from '../components/NesGame/NesGame';
import { PlaylistContext } from '../contexts/PlaylistContext';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { warmupTTS } from '../services/api';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const HomePage = () => {
  const { currentSession } = useContext(PlaylistContext);
  const { isAdmin, username, setUserName, logoutAdmin } =
    useContext(AuthContext);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showDiceGame, setShowDiceGame] = useState(false);
  const [finalValue, setFinalValue] = useState(null);
  const [showNesGame, setShowNesGame] = useState(false);
  const [currentGame, setCurrentGame] = useState({ file: null, name: '' });
  const [showSnowEffect, setShowSnowEffect] = useState(true);
  const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false);
  const snowCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const handleUsernameChange = (e) => {
    setUserName(e.target.value);
  };

  const handlePlayDice = () => {
    const randomValue = Math.floor(Math.random() * 6) + 1;
    setFinalValue(randomValue);
    setShowDiceGame(true);
  };

  const handlePlayNesGame = (gameFile, gameName) => {
    setCurrentGame({ file: gameFile, name: gameName });
    setShowNesGame(true);
  };

  const handleCloseNesGame = () => {
    setShowNesGame(false);
    setCurrentGame({ file: null, name: '' });
  };

  const toggleSnowEffect = () => {
    setShowSnowEffect((prev) => !prev);
  };

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

  const handleAppSelect = (app) => {
    setIsAppSwitcherOpen(false);
    if (app === 'music') {
      navigate('/');
    } else if (app === 'lunch-vote') {
      navigate('/lunch-vote');
    } else if (app === 'poliboard') {
      navigate('/poliboard');
    } else if (app === 'world-cup') {
      navigate('/world-cup');
    }
  };

  useEffect(() => {
    if (!showSnowEffect || !snowCanvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {showSnowEffect && (
        <canvas
          ref={snowCanvasRef}
          className="easter-egg"
          id="snowCanvas"
        />
      )}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(180deg); }
          }
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
      <Header
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title
            level={3}
            style={{ margin: '16px 0', cursor: 'pointer', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
            onClick={() => setIsAppSwitcherOpen(true)}
          >
            Music Order App
          </Title>
          <WeatherHeader />
          <div style={{ marginLeft: 20 }}>
            <WorldCupHeaderChip />
          </div>
        </div>
        <Space>
          {!isAdmin &&                <Input
                  prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder='Tên của bạn'
                  value={username}
                  onChange={handleUsernameChange}
                  bordered={false}
                  style={{ width: 140, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 12 }}
                />
          }

          {isAdmin ? (
            <Space size="small">
              <Button
                onClick={toggleTheme}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                type='text'
              />
              <Dropdown
                menu={{
                  items: [
                    { key: 'snow', label: showSnowEffect ? '❄️ Tắt Tuyết' : '❄️ Bật Tuyết', onClick: toggleSnowEffect },
                    { key: 'admin', label: 'Admin Dashboard', onClick: () => navigate('/admin') }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button type="text" icon={<AppstoreOutlined />} />
              </Dropdown>
              <Button
                onClick={logoutAdmin}
                icon={<LoginOutlined />}
                type="text"
              >
                Thoát
              </Button>
            </Space>
          ) : (
            <Space size="small">
              <Button
                onClick={toggleTheme}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                type='text'
              />
              <Dropdown
                menu={{
                  items: [
                    { key: 'snow', label: showSnowEffect ? '❄️ Tắt Tuyết' : '❄️ Bật Tuyết', onClick: toggleSnowEffect },
                    { key: 'contra', label: '🎮 Contra', onClick: () => handlePlayNesGame('/nes/contra.nes', 'Contra') },
                    { key: 'mario', label: '🍄 Mario', onClick: () => handlePlayNesGame('/nes/super_mario.nes', 'Super Mario') }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button type="text" icon={<AppstoreOutlined />} />
              </Dropdown>
              <Link to='/login'>
                <Button
                  type='primary'
                  icon={<LoginOutlined />}
                >
                  Admin
                </Button>
              </Link>
            </Space>
          )}
        </Space>
      </Header>

      <NowPlayingBar />

      <TetCountdown />

      <Content style={{ padding: '32px 24px 60px 24px' }}>
        <div className="bento-grid">
          <div className="bento-col-main">
            <div className="bento-stack">
              <Card 
                title={
                  <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    {currentSession ? 'Thêm bài hát' : 'Thông báo'}
                  </span>
                } 
                bordered={false}
                style={{ background: 'var(--bg-card)', borderRadius: 24 }}
                headStyle={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}
                bodyStyle={{ padding: '24px' }}
              >
                {currentSession ? (
                  <AddSongForm />
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <div style={{ fontSize: 64, marginBottom: 24, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
                      ⏰
                    </div>
                    <Text strong style={{ fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                      Chưa tới giờ phát nhạc
                    </Text>
                    <br />
                    <Text type='secondary' style={{ display: 'block', marginTop: 12, fontSize: 14 }}>
                      Hệ thống nhận order từ 15:00 đến 18:00 hàng ngày.
                    </Text>
                  </div>
                )}
              </Card>
              <div style={{ flex: 1 }}>
                <LiveActivityFeed />
              </div>
            </div>

            <div className="bento-stack">
              <PlaylistView />
            </div>
          </div>

          <div className="bento-col-sidebar">
            <WorldCupWidget />
            <div style={{
                textAlign: 'left',
                padding: '24px',
                background: 'transparent',
                position: 'relative',
              }}>
                <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <span style={{ fontSize: '28px' }}>🌍</span> Thế giới
                </Title>
                <Text type="secondary" style={{ fontSize: '14px', marginTop: '4px', display: 'block' }}>
                  Tin tức & Cập nhật
                </Text>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Tabs
                className="segmented-tabs"
                defaultActiveKey="1"
                items={[
                  {
                    label: 'VnExpress',
                    key: '1',
                    children: <VnExpressNewsView />,
                  },
                  {
                    label: 'Tech News',
                    key: '2',
                    children: <TechNewsWidget />,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </Content>

      <Modal
        title={null}
        open={isAppSwitcherOpen}
        onCancel={() => setIsAppSwitcherOpen(false)}
        footer={null}
        width={480}
        closeIcon={null}
        styles={{ 
          mask: { backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' },
          content: { 
            background: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)', 
            backdropFilter: 'blur(32px)', 
            WebkitBackdropFilter: 'blur(32px)',
            borderRadius: 32, 
            padding: '32px 24px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)'}`
          } 
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, paddingBottom: 24, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Chọn Ứng Dụng</div>
        <div className="app-launcher-grid">
          <button className="app-launcher-item" onClick={() => handleAppSelect('music')}>
            <div className="app-launcher-icon" style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)' }}>🎵</div>
            <span className="app-launcher-label">Music</span>
          </button>
          <button className="app-launcher-item" onClick={() => handleAppSelect('lunch-vote')}>
            <div className="app-launcher-icon" style={{ background: 'linear-gradient(135deg, #ff4d4f, #cf1322)' }}>🍔</div>
            <span className="app-launcher-label">Lunch Vote</span>
          </button>
          <button className="app-launcher-item" onClick={() => handleAppSelect('poliboard')}>
            <div className="app-launcher-icon" style={{ background: 'linear-gradient(135deg, #52c41a, #389e0d)' }}>📊</div>
            <span className="app-launcher-label">PoliBoard</span>
          </button>
          <button className="app-launcher-item" onClick={() => handleAppSelect('world-cup')}>
            <div className="app-launcher-icon" style={{ background: 'linear-gradient(135deg, #faad14, #d48806)' }}>⚽</div>
            <span className="app-launcher-label">World Cup</span>
          </button>
        </div>
      </Modal>


      <Footer style={{ textAlign: 'center' }}>
        Polite Music Order ©{new Date().getFullYear()} - Iced Tea Team -{' '}
        <span
          style={{
            fontSize: '12px',
            color: isDark ? '#8c8c8c' : '#e0c9c8',
            fontWeight: 'bold',
          }}
        >
          100% Made with AI
        </span>
      </Footer>

      {/* Dice Game Modal */}
      {showDiceGame && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '500px',
              height: '500px',
              backgroundColor: isDark ? '#1f1f1f' : '#fff',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <Title
                level={4}
                style={{ margin: 0 }}
              >
                Cùng xoay nào
              </Title>
              <Button
                type='text'
                onClick={() => {
                  setShowDiceGame(false);
                  setFinalValue(null);
                }}
                style={{ fontSize: '20px' }}
              >
                ×
              </Button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <DiceGame finalValue={finalValue} />
            </div>
          </div>
        </div>
      )}

      {/* NES Game Modal */}
      {showNesGame && currentGame.file && (
        <NesGame
          gameFile={currentGame.file}
          gameName={currentGame.name}
          onClose={handleCloseNesGame}
        />
      )}
    </Layout>
  );
};

export default HomePage;
