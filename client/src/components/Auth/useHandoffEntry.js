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
    void handoff(target).catch(() => message.error('Chưa thể chuyển nền tảng. Vui lòng đăng nhập lại.'))
  }
  return { targets: sso.handoffTargets, available: (target) => sso.handoffTargets.includes(target), enter }
}
