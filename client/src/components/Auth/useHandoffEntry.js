import { message } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { handoff } from '../../services/api'
import { useSso } from './useSso'

// Sang nền tảng khác đã đăng nhập sẵn; khách thì mở form đăng nhập trước.
export const useHandoffEntry = () => {
  const { user, openAuthModal } = useAuth()
  const sso = useSso()
  const enter = (target) => {
    if (!user) { openAuthModal('login'); return }
    // Mở đồng bộ trong click để trình duyệt cho phép popup trước khi gọi API.
    const tabName = `musicque-handoff-${crypto.randomUUID()}`
    let tab = null
    try { tab = window.open('', tabName) } catch { /* Popup bị chặn: chuyển cùng tab. */ }
    if (tab) tab.opener = null
    void handoff(target, tab ? tabName : '_self').catch(() => {
      tab?.close()
      message.error('Chưa thể chuyển nền tảng. Vui lòng đăng nhập lại.')
    })
  }
  return { targets: sso.handoffTargets, available: (target) => sso.handoffTargets.includes(target), enter }
}
