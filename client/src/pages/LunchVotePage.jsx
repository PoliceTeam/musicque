import React, { Suspense, useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const LunchVoteApp = React.lazy(() => import('lunchVote/LunchVoteApp'))

export default function LunchVotePage() {
  const { username } = useContext(AuthContext)
  const { isDark } = useTheme()

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: isDark ? '#141414' : '#fff' }}>
      <Suspense fallback={<div style={{ color: isDark ? '#fff' : '#000' }}>Đang tải Lunch Vote...</div>}>
        <LunchVoteApp username={username || 'Guest'} isDark={isDark} />
      </Suspense>
    </div>
  )
}

