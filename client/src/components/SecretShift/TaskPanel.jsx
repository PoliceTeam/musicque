import { useEffect, useState } from 'react'
import TaskGame from './TaskGame'

const LABELS = { wiring: 'Nối dây', code: 'Nhập mã', restart: 'Khởi động thiết bị', navigation: 'Chỉnh hướng', garbage: 'Đổ rác', fuel: 'Cấp nhiên liệu' }
const HINTS = { wiring: 'Kéo mỗi dây bên trái đến đầu cùng màu và ký hiệu bên phải.',
  code: 'Nhập mã hiển thị bằng bàn phím trên thiết bị hoặc phím số trên máy tính.',
  navigation: 'Kéo tâm ngắm về vòng tròn giữa màn hình.', garbage: 'Giữ cần gạt để xả hết rác.', fuel: 'Giữ nút nạp đến khi bình đầy.',
  restart: 'Bật đủ ba cầu dao, bấm khởi động và chờ thiết bị ổn định.' }
const TaskPanel = ({ challenge, now, act, online }) => {
  const [answer, setAnswer] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setAnswer(null); setBusy(false); setMessage('') }, [challenge.id])
  const elapsed = now - challenge.startedAt
  const complete = challenge.kind === 'wiring' ? Array.isArray(answer) && answer.length === 4
    : challenge.kind === 'code' ? typeof answer === 'string' && answer.length === 4 : answer === true
  const ready = elapsed >= 3000 && complete
  const submit = async () => {
    if (busy || !ready || !online) return
    setBusy(true)
    const ok = await act({ kind: 'taskComplete', challengeId: challenge.id,
      answer: challenge.kind === 'restart' ? '' : answer })
    if (!ok) setMessage('Đáp án chưa đúng hoặc bạn đã rời thiết bị. Hãy thử lại.')
    setBusy(false)
  }
  return <div className='shift-modal-backdrop'>
    <section className='shift-modal sp-panel' role='dialog' aria-modal='true' aria-labelledby='shift-task-title'>
      <h2 id='shift-task-title'>{LABELS[challenge.kind]}</h2>
      <p>{HINTS[challenge.kind]}</p>
      <TaskGame challenge={challenge} enabled={online && !busy} onAnswer={setAnswer} onMessage={setMessage} />
      <p aria-live='polite'>{message || (ready ? 'Hoàn tất thao tác. Bấm xác nhận để gửi kết quả.' : 'Hoàn thành thao tác trên thiết bị để xác nhận.')}</p>
      <div className='shift-buttons'>
        <button className='sp-btn sp-btn--primary' onClick={submit} disabled={!ready || busy || !online}>Xác nhận</button>
        <button className='sp-btn' onClick={() => act({ kind: 'taskCancel' })} disabled={busy}>Đóng</button>
      </div>
    </section>
  </div>
}
export default TaskPanel
