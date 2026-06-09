import React, { useEffect, useRef, useState } from 'react';

const START_DATE = new Date('2026-06-09T00:00:00Z');
const END_DATE = new Date('2026-06-23T23:59:59Z');

const BASE_KISS_SIZE = 22; 
const MAGNETIC_DIST_SQ = 150 * 150; 

const createEmojiCanvas = (emoji, size, glowColor) => {
  const canvas = document.createElement('canvas');
  canvas.width = size * 2.5; 
  canvas.height = size * 2.5;
  const ctx = canvas.getContext('2d');
  
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = size * 0.4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  ctx.font = `${size}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0; 
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);
  return canvas;
};

let kissImg, tornadoImg, heartImg;
if (typeof document !== 'undefined') {
  kissImg = createEmojiCanvas('💋', 60, 'rgba(255, 105, 180, 0.8)'); 
  tornadoImg = createEmojiCanvas('🌪️', 80, 'rgba(150, 150, 255, 0.9)'); 
  heartImg = createEmojiCanvas('💖', 40, 'rgba(255, 20, 147, 0.9)'); 
}

class Shockwave {
  constructor() {
    this.active = false;
  }
  spawn(x, y) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.thickness = 15;
    this.age = 0;
    this.maxAge = 40;
  }
  update() {
    if (!this.active) return;
    this.radius += 4; 
    this.thickness *= 0.9; 
    this.age++;
    if (this.age > this.maxAge) this.active = false;
  }
  draw(ctx) {
    if (!this.active) return;
    const alpha = Math.max(0, 1 - this.age / this.maxAge);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 105, 180, ${alpha})`;
    ctx.lineWidth = Math.max(0.1, this.thickness);
    ctx.stroke();
    ctx.restore();
  }
}

class HeartParticle {
  constructor() {
    this.active = false;
  }
  spawn(x, y) {
    this.active = true;
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.age = 0;
    this.maxAge = 50 + Math.random() * 40; 
    this.scale = (6 + Math.random() * 8) / 40; 
  }
  update() {
    if (!this.active) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; 
    this.vx *= 0.96; 
    this.age++;
    if (this.age > this.maxAge) this.active = false;
  }
  draw(ctx) {
    if (!this.active) return;
    const alpha = Math.max(0, 1 - this.age / this.maxAge);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(heartImg, -heartImg.width / 2, -heartImg.height / 2);
    ctx.restore();
  }
}

class Kiss {
  constructor() {
    this.active = false;
  }
  spawn(canvasWidth, canvasHeight) {
    this.active = true;
    this.scale = 0.5 + Math.random() * 1.2; 
    this.size = BASE_KISS_SIZE * this.scale;
    this.renderScale = this.size / 60; 
    
    this.x = Math.random() * canvasWidth;
    this.y = -this.size - Math.random() * 100;
    
    this.fallingStyle = Math.random() < 0.6 ? 0 : 1;
    this.time = Math.random() * 100;
    
    this.flutterFreq = 0.01 + Math.random() * 0.015;
    this.flutterAmp = 0.4 + Math.random() * 0.4;
    this.driftFactor = 0.6 + Math.random() * 1.0;
    this.spinSpeed = (Math.random() < 0.5 ? 1 : -1) * (0.015 + Math.random() * 0.02);
    
    this.vy0 = (0.7 + Math.random() * 1.0) * this.scale; 
    this.vy = this.vy0;
    this.vx = 0;
    this.angle = 0;
    
    this.opacity = this.scale < 0.8 ? 0.6 : 1;
  }

  update(height) {
    if (!this.active) return;
    this.time++;
    if (this.fallingStyle === 0) {
      this.angle = Math.sin(this.time * this.flutterFreq) * this.flutterAmp;
      this.vx = Math.sin(this.time * this.flutterFreq) * this.driftFactor;
      this.vy = this.vy0 * (1 - Math.abs(this.angle) * 0.2); 
    } else {
      this.angle += this.spinSpeed;
      this.vx = Math.cos(this.time * this.flutterFreq) * this.driftFactor;
      this.vy = this.vy0;
    }
    this.y += this.vy;
    this.x += this.vx;

    // Thay vì filter/splice mảng, ta chỉ cần tắt cờ active
    if (this.y > height + this.size) this.active = false;
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(this.renderScale, this.renderScale);
    ctx.drawImage(kissImg, -kissImg.width / 2, -kissImg.height / 2);
    ctx.restore();
  }
}

class Tornado {
  constructor() {
    this.active = false;
  }
  spawn(x, y) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vy = 0.8 + Math.random() * 0.8;
    this.age = 0;
    this.maxAge = 250; 
    this.scale = 0.1;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  update(height) {
    if (!this.active) return;
    this.age++;
    this.y += this.vy; 
    
    if (this.scale < 3.5) {
      this.scale += 0.05; 
    }
    if (this.age > this.maxAge || this.y > height + 200) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    const alpha = this.age > 180 ? Math.max(0, 1 - (this.age - 180) / 70) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    
    const wobbleX = Math.sin(this.age * 0.05 + this.wobblePhase) * 15; 
    ctx.translate(this.x + wobbleX, this.y);
    
    const renderScale = (BASE_KISS_SIZE * this.scale) / 80;
    ctx.scale(renderScale, renderScale);
    ctx.drawImage(tornadoImg, -tornadoImg.width / 2, -tornadoImg.height / 2);
    ctx.restore();
  }
}

const TornadoKissEvent = () => {
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const now = new Date();
    if (now >= START_DATE && now <= END_DATE) {
      setIsActive(true);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    // SIÊU TỐI ƯU 2: HIỂN THỊ NÉT CĂNG TRÊN MÀN HÌNH RETINA (Macbook, iPhone, iPad)
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1; // Lấy tỉ lệ mật độ điểm ảnh của thiết bị
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    setupCanvas();

    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener('resize', handleResize);

    // Khởi tạo Object Pools (Cấp phát bộ nhớ 1 lần duy nhất)
    const kissPool = Array.from({ length: 100 }, () => new Kiss());
    const tornadoPool = Array.from({ length: 20 }, () => new Tornado());
    const particlePool = Array.from({ length: 200 }, () => new HeartParticle());
    const shockwavePool = Array.from({ length: 20 }, () => new Shockwave());
    
    let animationFrameId;

    const animate = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);

      // 1. Sinh Nụ hôn mới bằng cách tìm object đang rảnh rỗi trong Pool
      if (Math.random() < 0.03) {
        let activeKisses = 0;
        let freeKiss = null;
        for (let i = 0; i < kissPool.length; i++) {
          if (kissPool[i].active) activeKisses++;
          else if (!freeKiss) freeKiss = kissPool[i];
        }
        if (activeKisses < 50 && freeKiss) {
          freeKiss.spawn(width, height);
        }
      }

      // 2. Cập nhật Kisses
      for (let i = 0; i < kissPool.length; i++) {
        kissPool[i].update(height);
      }

      // 3. Vật lý: Lốc xoáy hút Kisses
      for (let i = 0; i < tornadoPool.length; i++) {
        const t = tornadoPool[i];
        if (!t.active) continue;
        
        for (let j = 0; j < kissPool.length; j++) {
          const k = kissPool[j];
          if (!k.active) continue;

          const dx = t.x - k.x;
          const dy = t.y - k.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 300 * 300) {
            const dist = Math.sqrt(distSq);
            const force = (300 - dist) / 300;
            k.x += (dx / dist) * 1.5 * force;
            k.y += (dy / dist) * 1.5 * force;
            k.x += (dy / dist) * 3 * force;
            k.y -= (dx / dist) * 3 * force;
          }
        }
      }

      // 4. Va chạm giữa Kisses
      for (let i = 0; i < kissPool.length; i++) {
        const k1 = kissPool[i];
        if (!k1.active) continue;
        
        for (let j = i + 1; j < kissPool.length; j++) {
          const k2 = kissPool[j];
          if (!k2.active) continue;

          const dx = k2.x - k1.x;
          const dy = k2.y - k1.y;
          const distSq = dx * dx + dy * dy; 

          if (distSq < MAGNETIC_DIST_SQ) {
            const dist = Math.sqrt(distSq); 
            const force = (150 - dist) / 150; 
            k1.x += dx * 0.015 * force; 
            k1.y += dy * 0.015 * force;
            k2.x -= dx * 0.015 * force;
            k2.y -= dy * 0.015 * force;
          }

          const collisionThreshold = Math.max(k1.size, k2.size) * 0.7;
          if (distSq < collisionThreshold * collisionThreshold) {
            // Tắt active thay vì phải xóa khỏi mảng
            k1.active = false;
            k2.active = false;
            const mx = (k1.x + k2.x) / 2;
            const my = (k1.y + k2.y) / 2;
            
            const freeTornado = tornadoPool.find(t => !t.active);
            if (freeTornado) freeTornado.spawn(mx, my);
            
            const freeShockwave = shockwavePool.find(s => !s.active);
            if (freeShockwave) freeShockwave.spawn(mx, my);
            
            let spawnedParticles = 0;
            for (let p = 0; p < particlePool.length; p++) {
              if (!particlePool[p].active) {
                particlePool[p].spawn(mx, my);
                spawnedParticles++;
                if (spawnedParticles >= 12) break; // Spawn đủ 12 hạt tim thì dừng
              }
            }
          }
        }
      }

      // 5. Render toàn bộ
      for (let i = 0; i < kissPool.length; i++) kissPool[i].draw(ctx);
      for (let i = 0; i < tornadoPool.length; i++) {
        tornadoPool[i].update(height);
        tornadoPool[i].draw(ctx);
      }
      for (let i = 0; i < shockwavePool.length; i++) {
        shockwavePool[i].update();
        shockwavePool[i].draw(ctx);
      }
      for (let i = 0; i < particlePool.length; i++) {
        particlePool[i].update();
        particlePool[i].draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
};

export default TornadoKissEvent;
