import React, { Suspense, useContext } from 'react'
import { Typography } from 'antd'
import { AuthContext } from '../contexts/AuthContext'

const LunchVoteApp = React.lazy(() => import('lunchVote/LunchVoteApp'))

export default function LunchVotePage() {
  const { username } = useContext(AuthContext)

  return (
    <div style={{ padding: 24 }}>
      <Suspense fallback={<div>Đang tải Lunch Vote...</div>}>
        <LunchVoteApp username={username || 'Guest'} />
      </Suspense>
    </div>
  )
}

