import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAnniversary,
  getNationalDayState,
  INDEPENDENCE_YEAR,
  NATIONAL_DAY_YEAR,
  pad2,
} from '../../utils/nationalDay';
import './national-day.css';

const DUST_COUNT = 12;
const SPARK_COUNT = 20;

/** Lá cờ đỏ sao vàng — sao vàng năm cánh dựng bằng hình học, luôn trên nền đỏ. */
const FLAG_STAR_POINTS =
  '45,10 49.49,23.82 64.02,23.82 52.27,32.36 56.76,46.18 45,37.64 33.24,46.18 37.73,32.36 25.98,23.82 40.51,23.82';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Đường chân trời Ba Đình: cột cờ, Lăng Chủ tịch Hồ Chí Minh, Hội trường Ba Đình. */
const BaDinhSkyline = () => (
  <svg viewBox="0 0 900 62" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g fill="#000">
      {/* Cột cờ Hà Nội */}
      <rect x="86" y="46" width="72" height="16" />
      <rect x="98" y="34" width="48" height="14" />
      <rect x="110" y="20" width="24" height="16" />
      <rect x="120" y="2" width="4" height="20" />
      <polygon points="124,3 142,8 124,13" />
      {/* Hàng cây hai bên */}
      <circle cx="196" cy="50" r="11" />
      <circle cx="216" cy="53" r="9" />
      <circle cx="676" cy="52" r="10" />
      <circle cx="698" cy="55" r="8" />
      {/* Lăng Chủ tịch Hồ Chí Minh */}
      <rect x="336" y="54" width="248" height="8" />
      <rect x="352" y="46" width="216" height="9" />
      <rect x="374" y="24" width="172" height="23" />
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <rect key={index} x={388 + index * 22} y="26" width="7" height="20" fill="#fff" opacity="0.25" />
      ))}
      <rect x="366" y="16" width="188" height="9" />
      <rect x="386" y="9" width="148" height="8" />
      {/* Hội trường Ba Đình và khối nhà lân cận */}
      <rect x="628" y="52" width="196" height="10" />
      <rect x="646" y="30" width="160" height="23" />
      <rect x="670" y="22" width="112" height="9" />
      <rect x="24" y="44" width="46" height="18" />
      <rect x="838" y="38" width="44" height="24" />
      <rect x="252" y="50" width="56" height="12" />
    </g>
  </svg>
);

const NationalDayBanner = () => {
  const [state, setState] = useState(() => getNationalDayState());
  const [sparks, setSparks] = useState([]);
  const [parallax, setParallax] = useState(0);
  const bannerRef = useRef(null);
  const previousRef = useRef({});
  const tickedRef = useRef({});
  const sparkIdRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setState(getNationalDayState()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { visible, phase, timeLeft } = state;

  // Ô nào vừa đổi số thì nảy nhẹ một nhịp.
  const cells = useMemo(() => {
    if (phase !== 'countdown') return [];

    const next = [
      { key: 'days', unit: 'ngày', value: pad2(timeLeft.days) },
      { key: 'hours', unit: 'giờ', value: pad2(timeLeft.hours) },
      { key: 'minutes', unit: 'phút', value: pad2(timeLeft.minutes) },
      { key: 'seconds', unit: 'giây', value: pad2(timeLeft.seconds) },
    ];

    return next.map((cell) => {
      const changed = previousRef.current[cell.key] !== cell.value;
      if (changed) {
        previousRef.current[cell.key] = cell.value;
        tickedRef.current[cell.key] = (tickedRef.current[cell.key] || 0) + 1;
      }
      return { ...cell, tick: tickedRef.current[cell.key] || 0 };
    });
  }, [phase, timeLeft]);

  const dust = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, (_, index) => ({
        left: `${6 + index * 7.4 + (index % 3) * 2}%`,
        duration: `${(4.2 + (index % 5) * 0.9).toFixed(1)}s`,
        delay: `${(index * 0.62).toFixed(1)}s`,
      })),
    [],
  );

  const burst = useCallback((originX) => {
    if (prefersReducedMotion()) return;

    const created = Array.from({ length: SPARK_COUNT }, (_, index) => {
      const angle = (Math.PI / (SPARK_COUNT - 1)) * index + Math.PI;
      const distance = 46 + (index % 5) * 16;
      sparkIdRef.current += 1;
      return {
        id: sparkIdRef.current,
        x: originX,
        dx: `${Math.round(Math.cos(angle) * distance * 1.9)}px`,
        dy: `${Math.round(Math.sin(angle) * distance)}px`,
        size: `${8 + (index % 4) * 3}px`,
        duration: `${1000 + (index % 5) * 220}ms`,
      };
    });

    setSparks((current) => [...current, ...created]);
    const ids = new Set(created.map((spark) => spark.id));
    setTimeout(() => {
      setSparks((current) => current.filter((spark) => !ids.has(spark.id)));
    }, 2400);
  }, []);

  const handleParallax = useCallback((event) => {
    if (prefersReducedMotion() || !bannerRef.current) return;
    const { left, width } = bannerRef.current.getBoundingClientRect();
    const ratio = (event.clientX - left) / (width || 1);
    setParallax(Math.round((ratio - 0.5) * -22));
  }, []);

  const resetParallax = useCallback(() => setParallax(0), []);

  // Nút chỉ bắn hiệu ứng, không điều hướng và không chạm vào playlist —
  // tránh mọi ảnh hưởng tới phiên phát nhạc của admin.
  const handleCta = useCallback(
    (event) => {
      const bannerLeft = bannerRef.current?.getBoundingClientRect().left ?? 0;
      burst(`${Math.round(event.clientX - bannerLeft)}px`);
    },
    [burst],
  );

  if (!visible) return null;

  const anniversary = getAnniversary();
  const isDay = phase === 'day';

  return (
    <section
      ref={bannerRef}
      className="nd-banner"
      style={{ '--nd-parallax': `${parallax}px` }}
      onMouseMove={handleParallax}
      onMouseLeave={resetParallax}
      aria-label={`Mừng Quốc khánh 2 tháng 9 năm ${NATIONAL_DAY_YEAR}`}
    >
      <div className="nd-banner__skyline">
        <BaDinhSkyline />
      </div>
      <div className="nd-banner__glow" aria-hidden="true" />
      <div className="nd-banner__sweep" aria-hidden="true" />
      <div className="nd-banner__dust" aria-hidden="true">
        {dust.map((particle, index) => (
          <span
            key={index}
            style={{
              left: particle.left,
              animationDuration: particle.duration,
              animationDelay: particle.delay,
            }}
          >
            ★
          </span>
        ))}
      </div>

      <div className="nd-banner__flag">
        <svg viewBox="0 0 90 60" aria-hidden="true" focusable="false">
          <rect width="90" height="60" fill="#da251d" />
          <polygon points={FLAG_STAR_POINTS} fill="#ffcd00" />
        </svg>
        <span className="nd-banner__silk" aria-hidden="true" />
      </div>

      <div className="nd-banner__body">
        <p className="nd-banner__title">
          Chúc mừng ngày Quốc khánh nước Cộng hòa xã hội chủ nghĩa Việt Nam
        </p>
        <p className="nd-banner__subtitle">
          {isDay
            ? `Kỷ niệm ${anniversary} năm · ${INDEPENDENCE_YEAR} — ${NATIONAL_DAY_YEAR} · chúc cả team một ngày lễ rực rỡ`
            : `Kỷ niệm ${anniversary} năm · 2/9/${INDEPENDENCE_YEAR} — 2/9/${NATIONAL_DAY_YEAR}`}
        </p>
      </div>

      {!isDay && (
        <div className="nd-banner__countdown">
          {cells.map((cell) => (
            <span key={cell.key} className="nd-banner__cell">
              <b key={cell.tick} className="nd-banner__num nd-banner__num--tick">
                {cell.value}
              </b>
              <span className="nd-banner__unit">{cell.unit}</span>
            </span>
          ))}
        </div>
      )}

      <button type="button" className="nd-banner__cta" onClick={handleCta}>
        Chúc mừng
      </button>

      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="nd-banner__spark"
          aria-hidden="true"
          style={{
            '--nd-spark-x': spark.x,
            '--nd-spark-dx': spark.dx,
            '--nd-spark-dy': spark.dy,
            '--nd-spark-size': spark.size,
            '--nd-spark-dur': spark.duration,
          }}
        >
          ★
        </span>
      ))}
    </section>
  );
};

export default NationalDayBanner;
