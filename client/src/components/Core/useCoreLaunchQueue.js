import { useEffect, useRef, useState } from 'react'
import { markCoreLaunchSeen, shouldShowCoreLaunch } from './coreLaunch'
import { isCoreActive } from './coreIdentity'

// Popup Core chờ intro ICE City/form đăng nhập đóng rồi mới đến lượt.
export function useCoreLaunchQueue(user, blocked) {
  const userId = user?._id
  const eligible = Boolean(userId && !isCoreActive(user.core))
  const presented = useRef(new Set())
  const [state, setState] = useState({ userId: null, open: false })

  useEffect(() => {
    if (!eligible || blocked || presented.current.has(userId)) return undefined
    if (!shouldShowCoreLaunch({ _id: userId })) return undefined
    const timer = window.setTimeout(() => {
      if (!shouldShowCoreLaunch({ _id: userId })) return
      presented.current.add(userId)
      markCoreLaunchSeen(userId)
      setState({ userId, open: true })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [userId, eligible, blocked])

  return {
    open: state.userId === userId && state.open && eligible && !blocked,
    dismiss: () => setState((current) => ({ ...current, open: false })),
  }
}
