/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { getWordChainState, submitWordChainAnswer } from '../services/api'

export const WordChainContext = createContext(null)

export const useWordChain = () => {
  const context = useContext(WordChainContext)
  if (!context) throw new Error('useWordChain must be used within WordChainProvider')
  return context
}

const DEFAULT_CONFIG = {
  turnMs: 8000,
  idleMs: 30000,
  answerCost: 1,
  payoutMultiplier: 3,
  roundPayoutCap: 60,
  dailyPayoutCap: 250,
  minTurnsForReward: 3,
  minPlayersForReward: 2,
}

export const WordChainProvider = ({ children }) => {
  const { socket, currentSession } = useContext(PlaylistContext)
  const { user, requireAuth, setBalance, refreshBalance } = useAuth()
  const [active, setActive] = useState(false)
  const [round, setRound] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [lastResult, setLastResult] = useState(null)
  const userRef = useRef(user)

  useEffect(() => { userRef.current = user }, [user])

  const loadState = useCallback(async () => {
    try {
      const { data } = await getWordChainState()
      setActive(data.active)
      setRound(data.round)
      if (data.config) setConfig(data.config)
    } catch {
      /* socket broadcast kế tiếp sẽ đồng bộ lại */
    }
  }, [])

  useEffect(() => { loadState() }, [loadState, currentSession])

  useEffect(() => {
    if (!socket) return undefined

    const onRound = (nextRound) => {
      setActive(true)
      setRound(nextRound)
      setLastResult(null)
    }
    const onResult = (result) => {
      setRound(result)
      setLastResult(result)
      const currentUser = userRef.current
      if (result?.winner?.userId?.toString() === currentUser?._id?.toString()) {
        if (result.payout > 0) message.success(`🏆 Bạn thắng ván nối từ: +${result.payout} PC`)
        else message.info(result.rewardReason || 'Bạn thắng nhưng đã chạm trần thưởng hôm nay')
      } else if (result?.rewardReason?.includes('hoàn')) {
        message.info(result.rewardReason)
      }
      refreshBalance()
    }
    const onStopped = ({ round: finalRound } = {}) => {
      setActive(false)
      setRound(finalRound || null)
      if (finalRound) setLastResult(finalRound)
      refreshBalance()
    }

    socket.on('wordchain_round', onRound)
    socket.on('wordchain_result', onResult)
    socket.on('wordchain_stopped', onStopped)
    return () => {
      socket.off('wordchain_round', onRound)
      socket.off('wordchain_result', onResult)
      socket.off('wordchain_stopped', onStopped)
    }
  }, [socket, refreshBalance])

  const submitAnswer = useCallback(async (phrase) => {
    if (!requireAuth('Đăng nhập để tham gia nối từ.')) return false
    try {
      const requestKey = crypto.randomUUID()
      const { data } = await submitWordChainAnswer(phrase, requestKey)
      setRound(data.round)
      setBalance(data.balance)
      return true
    } catch (error) {
      message.error(error.response?.data?.message || 'Không nối được từ')
      if (error.response?.data?.code === 'ANSWER_RACE') refreshBalance()
      return false
    }
  }, [requireAuth, refreshBalance, setBalance])

  return (
    <WordChainContext.Provider value={{ active, round, config, lastResult, submitAnswer }}>
      {children}
    </WordChainContext.Provider>
  )
}
