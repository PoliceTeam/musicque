// Nội suy theo thời gian server, thay vì kéo vị trí một tỉ lệ cố định mỗi frame.
export const sampleMotion = (samples, time) => {
  if (!samples.length) return null
  if (time <= samples[0].time) return samples[0]
  for (let i = 1; i < samples.length; i++) {
    const next = samples[i]; const previous = samples[i - 1]
    if (time > next.time) continue
    // Dịch chuyển khi họp/reconnect phải nhảy ngay, không lướt xuyên map.
    if (Math.hypot(next.x - previous.x, next.y - previous.y) > 100) return next
    const amount = Math.min(1, Math.max(0, (time - previous.time) / Math.max(1, next.time - previous.time)))
    return { x: previous.x + (next.x - previous.x) * amount, y: previous.y + (next.y - previous.y) * amount }
  }
  // Thiếu gói tin thì giữ vị trí: không đoán đi xuyên tường hoặc lộ người ngoài tầm nhìn.
  return samples[samples.length - 1]
}
