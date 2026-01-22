import React, { useContext, useState, useEffect, useRef } from 'react';
import { Layout, Typography, Row, Col, Card, Button, Input, Space } from 'antd';
import {
  UserOutlined,
  LoginOutlined,
  DropboxOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import AddSongForm from '../components/Playlist/AddSongForm';
import PlaylistView from '../components/Playlist/PlaylistView';
import GoldPriceView from '../components/GoldPrice/GoldPriceView';
import BTCPriceView from '../components/BTCPrice/BTCPriceView';
import OilPriceView from '../components/OilPrice/OilPriceView';
// import ChatBox from '../components/Chat/ChatBox'
import DiceGame from '../games/dice/DiceGame';
import TetCountdown from '../components/TetCountdown/TetCountdown';
import NesGame from '../components/NesGame/NesGame';
import { PlaylistContext } from '../contexts/PlaylistContext';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const HomePage = () => {
  const { currentSession } = useContext(PlaylistContext);
  const { isAdmin, username, setUserName, logoutAdmin } =
    useContext(AuthContext);
  const { isDark, toggleTheme } = useTheme();
  const [showDiceGame, setShowDiceGame] = useState(false);
  const [finalValue, setFinalValue] = useState(null);
  const [showNesGame, setShowNesGame] = useState(false);
  const [currentGame, setCurrentGame] = useState({ file: null, name: '' });
  const [showSnowEffect, setShowSnowEffect] = useState(true);
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
          background: isDark ? '#141414' : '#fff',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title
          level={3}
          style={{ margin: '16px 0' }}
        >
          Music Order App
        </Title>
        <Space>
          {!isAdmin && (
            <Input
              prefix={<UserOutlined />}
              placeholder='Tên của bạn'
              value={username}
              onChange={handleUsernameChange}
              style={{ width: 200 }}
            />
          )}

          {isAdmin ? (
            <Space>
              <Button
                onClick={toggleTheme}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                type='default'
              >
                {isDark ? 'Sáng' : 'Tối'}
              </Button>
              <Button
                onClick={toggleSnowEffect}
                type={showSnowEffect ? 'default' : 'primary'}
              >
                {showSnowEffect ? '❄️ Tắt Tuyết' : '❄️ Bật Tuyết'}
              </Button>
              <Link to='/admin'>
                <Button type='primary'>Admin Dashboard</Button>
              </Link>
              <Button
                onClick={logoutAdmin}
                icon={<LoginOutlined />}
              >
                Đăng xuất
              </Button>
            </Space>
          ) : (
            <Space>
              <Button
                onClick={toggleTheme}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                type='default'
              >
                {isDark ? 'Sáng' : 'Tối'}
              </Button>
              <Button
                onClick={toggleSnowEffect}
                type={showSnowEffect ? 'default' : 'primary'}
              >
                {showSnowEffect ? '❄️ Tắt Tuyết' : '❄️ Bật Tuyết'}
              </Button>
              <Button
                type='primary'
                onClick={() => handlePlayNesGame('/nes/contra.nes', 'Contra')}
              >
                Contra
              </Button>
              <Button
                type='primary'
                onClick={() => handlePlayNesGame('/nes/super_mario.nes', 'Super Mario')}
              >
                Mario
              </Button>
              <Link to='/login'>
                <Button
                  type='primary'
                  icon={<LoginOutlined />}
                >
                  Admin Login
                </Button>
              </Link>
            </Space>
          )}
        </Space>
      </Header>

      <TetCountdown />

      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col
            xs={24}
            md={6}
          >
            <Card title={currentSession ? 'Thêm bài hát' : 'Thông báo'}>
              {currentSession ? (
                <AddSongForm />
              ) : (
                <div>
                  <Text>
                    Hiện tại không có phiên phát nhạc nào đang diễn ra.
                  </Text>
                  <br />
                  <Text type='secondary'>
                    Phiên phát nhạc chỉ nên được mở từ 15:00 đến 18:00 hàng
                    ngày.
                  </Text>
                </div>
              )}
            </Card>
          </Col>

          <Col
            xs={24}
            md={12}
          >
            <PlaylistView />
          </Col>

          <Col
            xs={24}
            md={6}
          >
            <div
              style={{
                textAlign: 'center',
                marginBottom: '20px',
                padding: '16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  animation: 'float 6s ease-in-out infinite',
                }}
              />
              <Title
                level={3}
                style={{
                  margin: 0,
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                🌍 Thế giới có gì mới?
              </Title>
            </div>
            <GoldPriceView />
            <div style={{ marginTop: '16px' }}>
              <BTCPriceView />
            </div>
            <div style={{ marginTop: '16px' }}>
              <OilPriceView />
            </div>
          </Col>

          {/* <Col xs={24} md={8}>
            <ChatBox />
          </Col> */}
        </Row>
      </Content>

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
