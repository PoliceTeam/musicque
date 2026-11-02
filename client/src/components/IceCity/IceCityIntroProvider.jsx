import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { claimIceCityIntro } from '../../services/api'
import { useHandoffEntry } from '../Auth/useHandoffEntry'
import { IceCityIntroContext } from './intro-context'
import { claimGuestIntro, markGuestIntroSeen } from './intro-state'
import IceCityIntroModal from './IceCityIntroModal'

export default function IceCityIntroProvider({ children }) {
  const { user, loading, authModal } = useAuth()
  const farm = useHandoffEntry()
  const { pathname } = useLocation()
  const identity = user?._id || 'guest'
  const available = farm.available('musicque-farm')
  const eligible = !/^\/(login|register|admin|dev)(\/|$)/.test(pathname)
  const requests = useRef(new Map())
  const handled = useRef(new Set())
  const guestPresented = useRef(false)
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  const [state, setState] = useState({ identity: null, open: false })

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    if (loading || farm.loading || !available || !eligible || !visible || authModal || handled.current.has(identity)) return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      // Giữ cùng một promise qua effect replay/đổi route, không gửi hai lần claim.
      if (!requests.current.has(identity)) {
        requests.current.set(identity, identity === 'guest'
          ? claimGuestIntro()
          : claimIceCityIntro().then(({ data }) => data.show === true))
      }
      try {
        const firstView = await requests.current.get(identity)
        if (!active) return
        handled.current.add(identity)
        const open = firstView && !(identity !== 'guest' && guestPresented.current)
        if (open) {
          if (identity === 'guest') guestPresented.current = true
          // Đăng xuất trong cùng trình duyệt cũng không bật thêm một intro khách.
          markGuestIntroSeen()
        }
        setState({ identity, open })
      } catch {
        if (!active) return
        // Không hiện khi chưa xác nhận được biên nhận trên server; lần vào sau có thể thử lại.
        handled.current.add(identity)
        setState({ identity, open: false })
      }
    }, 450)
    return () => { active = false; window.clearTimeout(timer) }
  }, [loading, farm.loading, available, eligible, visible, authModal, identity])

  const open = state.identity === identity && state.open && eligible && !authModal
  const pending = Boolean(loading || farm.loading || (available && eligible && !handled.current.has(identity)))
  const close = () => setState({ identity, open: false })
  const play = () => {
    close()
    farm.enter('musicque-farm')
  }

  return (
    <IceCityIntroContext.Provider value={{ pending: pending || open }}>
      {children}
      {open && <IceCityIntroModal open onClose={close} onPlay={play} playHref={!user ? '/farm' : undefined} />}
    </IceCityIntroContext.Provider>
  )
}
