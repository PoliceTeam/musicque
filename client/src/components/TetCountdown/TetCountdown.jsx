import React, { useState, useEffect } from 'react';

const TetCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    const tetDate = new Date('Feb 17, 2026 00:00:00').getTime();
    const endDate = new Date('Feb 17, 2026 00:00:00');
    endDate.setDate(endDate.getDate() + 15);
    const endDateTimestamp = endDate.getTime();

    const countdown = setInterval(() => {
      const now = new Date().getTime();
      const distanceFromEnd = endDateTimestamp - now;

      if (distanceFromEnd < 0) {
        clearInterval(countdown);
        setShouldHide(true);
        return;
      }

      const distance = tetDate - now;

      if (distance < 0) {
        setIsExpired(true);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  const formatNumber = (num) => (num < 10 ? `0${num}` : num);

  if (shouldHide) {
    return null;
  }

  if (isExpired) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #8b0000, #d32f2f)',
          color: '#ffd700',
          padding: '40px 20px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '5px solid #ffd700',
        }}
      >
        <div
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: '2rem',
            marginBottom: '10px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          Chúc Mừng Năm Mới!
        </div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Noto+Serif+Vietnamese:wght@400;700&display=swap');
          
          @keyframes swing {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg); }
          }
          
          @media (max-width: 600px) {
            .tet-countdown-container {
              gap: 10px !important;
            }
            .tet-time-box {
              min-width: 60px !important;
              padding: 10px !important;
            }
            .tet-time-box span {
              font-size: 1.5rem !important;
            }
            .tet-title {
              font-size: 2rem !important;
            }
          }
        `}
      </style>
      <div
        style={{
          background: 'linear-gradient(135deg, #8b0000, #d32f2f)',
          color: '#ffd700',
          padding: '20px 20px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '5px solid #ffd700',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "url('https://www.transparenttextures.com/patterns/clouds-zoro.png')",
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '5%',
            width: '50px',
            height: '60px',
            background: '#ff4d4d',
            borderRadius: '50% 50% 45% 45%',
            border: '2px solid #ffd700',
            animation: 'swing 3s ease-in-out infinite',
            transformOrigin: 'top center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '5%',
            width: '50px',
            height: '60px',
            background: '#ff4d4d',
            borderRadius: '50% 50% 45% 45%',
            border: '2px solid #ffd700',
            animation: 'swing 3s ease-in-out infinite',
            transformOrigin: 'top center',
          }}
        />
        <div
          className='tet-title'
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: '2rem',
            marginBottom: '10px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Đếm ngược Tết Bính Ngọ 2026
        </div>
        <p style={{ position: 'relative', zIndex: 1 }}>
          Chỉ còn vài ngày nữa là đến Tết Nguyên Đán!
        </p>
        <div
          className='tet-countdown-container'
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '20px',
            position: 'relative',
            zIndex: 1,
            flexWrap: 'wrap',
          }}
        >
          <div
            className='tet-time-box'
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '2px solid #ffd700',
              padding: '15px',
              borderRadius: '10px',
              minWidth: '80px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '2.5rem',
                fontWeight: 'bold',
              }}
            >
              {formatNumber(timeLeft.days)}
            </span>
            <label
              style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Ngày
            </label>
          </div>
          <div
            className='tet-time-box'
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '2px solid #ffd700',
              padding: '15px',
              borderRadius: '10px',
              minWidth: '80px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '2.5rem',
                fontWeight: 'bold',
              }}
            >
              {formatNumber(timeLeft.hours)}
            </span>
            <label
              style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Giờ
            </label>
          </div>
          <div
            className='tet-time-box'
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '2px solid #ffd700',
              padding: '15px',
              borderRadius: '10px',
              minWidth: '80px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '2.5rem',
                fontWeight: 'bold',
              }}
            >
              {formatNumber(timeLeft.minutes)}
            </span>
            <label
              style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Phút
            </label>
          </div>
          <div
            className='tet-time-box'
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '2px solid #ffd700',
              padding: '15px',
              borderRadius: '10px',
              minWidth: '80px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '2.5rem',
                fontWeight: 'bold',
              }}
            >
              {formatNumber(timeLeft.seconds)}
            </span>
            <label
              style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Giây
            </label>
          </div>
        </div>
      </div>
    </>
  );
};

export default TetCountdown;
