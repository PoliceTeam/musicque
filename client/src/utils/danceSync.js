// Đồng bộ animation nhảy với nhịp nhạc (Dance Lab).
//
// Mỗi clip có tempo gốc riêng (đo offline từ chuyển động: tổng tốc độ các khớp + nhún hông),
// kèm `beatOffset` = thời điểm trong clip mà hông xuống thấp nhất (nhún đúng phách).
// Bài nhạc có `bpm` + `offset` (giây của phách đầu tiên). Thời gian clip được tính thẳng từ
// đồng hồ của <audio> nên không bao giờ trôi lệch nhịp, kể cả khi tua hay tạm dừng.

// Làm tròn số phách trong một vòng clip để lặp lại vẫn đúng phách (không lệch dần sau mỗi vòng).
export const loopTempo = ({ bpm, dur }) => {
  const beats = Math.max(1, Math.round((dur * bpm) / 60))
  return { beats, bpm: (beats * 60) / dur }
}

// Chọn bội/ước của tempo nhạc (½×, 1×, 2×, 4×) gần tempo clip nhất (theo tỉ lệ), để tốc độ
// nhảy thay đổi ít nhất: clip 98 BPM trên nhạc 168 sẽ nhảy theo 84 (half-time), clip 135 theo 168.
export const pickTargetBpm = (clipBpm, musicBpm) => {
  const candidates = [musicBpm / 2, musicBpm, musicBpm * 2, musicBpm / 4]
  return candidates.reduce((best, c) =>
    Math.abs(Math.log(c / clipBpm)) < Math.abs(Math.log(best / clipBpm)) ? c : best
  )
}

// Số phách (ở nhịp `targetBpm`) đã trôi qua tại thời điểm `audioTime` của bài.
// Nhịp chậm hơn nhịp gốc của bài thì đếm từ `halfOffset` (phách mạnh), nếu bài có.
export const beatsAt = (audioTime, track, targetBpm) => {
  const offset = targetBpm < track.bpm * 0.75 && track.halfOffset != null ? track.halfOffset : track.offset
  return ((audioTime - offset) * targetBpm) / 60
}

// Thời điểm trong clip (giây) ứng với `audioTime` của bài: phách thứ n của nhạc rơi đúng
// phách thứ n của clip. `loop = false` thì giữ ở khung cuối sau khi hết clip.
export const clipTimeAt = (audioTime, track, tempo, { loop = true, nudge = 0 } = {}) => {
  const { bpm: clipBpm } = loopTempo(tempo)
  const target = pickTargetBpm(clipBpm, track.bpm)
  const t = tempo.beatOffset + (beatsAt(audioTime + nudge, track, target) * 60) / clipBpm
  if (!loop) return Math.min(Math.max(t, 0), tempo.dur)
  return ((t % tempo.dur) + tempo.dur) % tempo.dur
}

// Hệ số tốc độ thực tế so với clip gốc (để hiển thị).
export const syncRatio = (track, tempo) => {
  const { bpm: clipBpm } = loopTempo(tempo)
  const target = pickTargetBpm(clipBpm, track.bpm)
  return { clipBpm, target, ratio: target / clipBpm }
}
