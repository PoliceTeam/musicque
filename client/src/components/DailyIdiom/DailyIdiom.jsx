import React, { useState, useEffect, useRef, useLayoutEffect, useContext } from 'react';
import { message } from 'antd';
import { LikeOutlined, LikeFilled, DislikeOutlined, DislikeFilled } from '@ant-design/icons';
import { getDailyIdioms, voteIdiom } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { AuthContext } from '../../contexts/AuthContext';
import './DailyIdiom.css';

// Nhãn ngắn hiển thị bên trái thanh chạy chữ
const BADGE_LABEL = 'Chân lý ngày mới';

// Tốc độ chạy chữ (pixel / giây) — càng lớn càng nhanh
const SCROLL_SPEED = 90;

const DailyIdiom = () => {
  const { isDark } = useTheme();
  const { username } = useContext(AuthContext);
  // idiom = 1 câu (object {id,text,likes,dislikes,myVote}) chọn ngẫu nhiên trong 8 câu của ngày
  const [idiom, setIdiom] = useState(null);
  const [date, setDate] = useState('');
  const [failed, setFailed] = useState(false);
  const [voting, setVoting] = useState(false);
  const [motion, setMotion] = useState({ start: 400, end: -400, duration: 20 });

  const viewportRef = useRef(null);
  const itemRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    getDailyIdioms(username)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data.idioms) ? data.idioms : [];
        if (list.length === 0) {
          setFailed(true);
          return;
        }
        // Random 1 trong 8 câu mỗi lượt truy cập trang
        setIdiom(list[Math.floor(Math.random() * list.length)]);
        setDate(data.date || '');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Chỉ random 1 lần mỗi lượt truy cập; không đổi câu khi user gõ tên
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVote = (value) => {
    if (!idiom || voting) return;
    if (!username) {
      message.info('Nhập tên của bạn để đánh giá câu này');
      return;
    }
    // Bấm lại đúng nút đang chọn = bỏ vote
    const nextValue = idiom.myVote === value ? 0 : value;

    setVoting(true);
    voteIdiom(idiom.id, username, nextValue)
      .then(({ data }) => {
        setIdiom((prev) => ({
          ...prev,
          likes: data.likes,
          dislikes: data.dislikes,
          myVote: data.myVote,
        }));
      })
      .catch(() => message.error('Không lưu được đánh giá'))
      .finally(() => setVoting(false));
  };

  // Đo khung nhìn + chiều rộng câu để tính điểm đầu/cuối và thời lượng chạy
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const item = itemRef.current;
    if (!viewport || !item) return undefined;

    const measure = () => {
      const viewportW = viewport.offsetWidth;
      const textW = item.scrollWidth;
      // Vào từ mép phải (start = +viewportW), khuất hẳn bên trái (end = -textW)
      const start = viewportW;
      const end = -textW;
      const duration = Math.max(6, Math.round((viewportW + textW) / SCROLL_SPEED));
      setMotion({ start, end, duration });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [idiom]);

  // Chưa có dữ liệu hoặc API lỗi → không render gì, không làm vỡ trang chủ
  if (failed || !idiom) return null;

  // Câu trong data có thể xuống dòng (\n). Với banner 1 dòng: thay bằng dấu phẩy,
  // nhưng bỏ qua nếu vế trước đã kết thúc bằng dấu câu để tránh "ai., Uống".
  const text = (idiom.text || '')
    .replace(/\s*\n\s*/g, (m, offset, str) =>
      /[.,;:!?…]/.test(str[offset - 1]) ? ' ' : ', '
    )
    .replace(/\s+/g, ' ')
    .trim();

  const themeVars = {
    '--di-bg': isDark
      ? 'linear-gradient(90deg, #2e2216 0%, #1f1f1f 100%)'
      : 'linear-gradient(90deg, #fff3d6 0%, #fffdf8 100%)',
    '--di-border': isDark ? '#5c4326' : '#ffe0a3',
    '--di-badge': isDark ? '#e8a13a' : '#ad6800',
    '--di-text': isDark ? '#f0e6d6' : '#4a3617',
    '--di-date': isDark ? '#b89b6e' : '#a68a5b',
    '--di-start': `${motion.start}px`,
    '--di-end': `${motion.end}px`,
    '--di-duration': `${motion.duration}s`,
  };

  return (
    <div
      className='daily-idiom'
      style={themeVars}
    >
      <span className='daily-idiom__badge'>
        <span className='daily-idiom__badge-dot'>✨</span>
        {BADGE_LABEL}
      </span>
      <span className='daily-idiom__divider' />
      <div
        className='daily-idiom__viewport'
        ref={viewportRef}
      >
        <div className='daily-idiom__track'>
          <span
            className='daily-idiom__item'
            ref={itemRef}
          >
            {text}
          </span>
        </div>
      </div>
      <span className='daily-idiom__date'>{date}</span>
      <div className='daily-idiom__vote'>
        <button
          type='button'
          className={`daily-idiom__vote-btn${idiom.myVote === 1 ? ' is-active' : ''}`}
          onClick={() => handleVote(1)}
          disabled={voting}
          title={username ? 'Thích câu này' : 'Nhập tên để đánh giá'}
          aria-label='Thích'
        >
          {idiom.myVote === 1 ? <LikeFilled /> : <LikeOutlined />}
          <span className='daily-idiom__vote-count'>{idiom.likes}</span>
        </button>
        <button
          type='button'
          className={`daily-idiom__vote-btn${idiom.myVote === -1 ? ' is-active-down' : ''}`}
          onClick={() => handleVote(-1)}
          disabled={voting}
          title={username ? 'Không thích câu này' : 'Nhập tên để đánh giá'}
          aria-label='Không thích'
        >
          {idiom.myVote === -1 ? <DislikeFilled /> : <DislikeOutlined />}
          <span className='daily-idiom__vote-count'>{idiom.dislikes}</span>
        </button>
      </div>
    </div>
  );
};

export default DailyIdiom;
