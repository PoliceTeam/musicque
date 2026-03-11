export const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes celebrate {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .lunch-vote-option-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  .lunch-vote-option-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15) !important;
  }
  .lunch-vote-winner-card {
    animation: celebrate 2s ease-in-out infinite;
  }
  .countdown-number {
    font-variant-numeric: tabular-nums;
    background: linear-gradient(135deg, #fff 0%, #f0f0ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gradient-btn {
    background: #4285F4 !important;
    border: none !important;
    box-shadow: 0 4px 10px rgba(66, 133, 244, 0.35) !important;
  }
  .gradient-btn:hover {
    background: #3367D6 !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(66, 133, 244, 0.45) !important;
  }
  .random-btn {
    background: #EA4335 !important;
    border: none !important;
    box-shadow: 0 4px 10px rgba(234, 67, 53, 0.35) !important;
  }
  .random-btn:hover:not(:disabled) {
    background: #C5221F !important;
    box-shadow: 0 6px 16px rgba(234, 67, 53, 0.45) !important;
  }
  .random-btn:disabled {
    opacity: 0.5;
  }
  .lunch-wheel-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    z-index: 1300;
    backdrop-filter: blur(6px);
  }
  .lunch-wheel-modal {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 24px;
    padding: 28px 24px 32px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.4);
    max-width: 420px;
    width: 95%;
    border: 1px solid rgba(66, 133, 244, 0.2);
  }
  .lunch-wheel-wrapper {
    position: relative;
    width: 300px;
    height: 300px;
    margin: 0 auto;
  }
  .lunch-wheel-circle {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    box-shadow: 0 8px 32px rgba(66, 133, 244, 0.3), 0 0 0 6px #fff, 0 0 0 10px #4285F4;
    overflow: hidden;
  }
  .lunch-wheel-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    position: relative;
    transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
  }
  .lunch-wheel-pointer {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 16px solid transparent;
    border-right: 16px solid transparent;
    border-top: 28px solid #EA4335;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
    z-index: 20;
  }
  .lunch-wheel-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ffffff, #f1f5f9);
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    z-index: 5;
    border: 5px solid #4285F4;
  }
  .lunch-wheel-segment {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%);
    transform-origin: 50% 50%;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 20px 8px 0 0;
  }
  .lunch-wheel-segment-content {
    background: rgba(255,255,255,0.95);
    padding: 4px 8px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    text-align: center;
    transform: rotate(45deg);
    max-width: 80px;
  }
  .lunch-wheel-result {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #fbbf24;
    border-radius: 16px;
    padding: 16px 24px;
    text-align: center;
    animation: celebrate 1s ease-in-out infinite;
    margin: 12px auto 0;
    max-width: 260px;
  }
  .lunch-wheel-result-title {
    font-size: 20px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 4px;
  }
  .lunch-wheel-result-votes {
    font-size: 14px;
    color: #a16207;
  }
  .team-card {
    position: relative;
    background: #fff;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    padding: 16px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100px;
  }
  .team-card:hover {
    border-color: #93c5fd;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(66, 133, 244, 0.12);
  }
  .team-card.active {
    border-color: #4285F4;
    background: #eff6ff;
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.15);
  }
  .team-card .team-icon {
    font-size: 28px;
    color: #94a3b8;
    transition: all 0.3s ease;
  }
  .team-card.active .team-icon {
    color: #4285F4;
  }
  .team-card .team-name {
    font-weight: 600;
    color: #334155;
    font-size: 14px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .team-card-create {
    border: 2px dashed #cbd5e1;
    background: #f8fafc;
  }
  .team-card-create:hover {
    border-color: #4285F4;
    background: #fff;
  }
  .team-card-create.active {
    border: 2px solid #4285F4;
    background: #eff6ff;
  }
  @keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`
