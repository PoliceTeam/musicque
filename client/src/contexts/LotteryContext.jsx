import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import {
  getLotteryState,
  getLotteryResults,
  getLotteryPublicBets,
  placeLotteryBet,
} from '../services/api'

export const LotteryContext = createContext()

export const useLottery = () => {
  const context = useContext(LotteryContext)
  if (!context) throw new Error('useLottery must be used within LotteryProvider')
  return context
}

const DEFAULT_CONFIG = {
  maxStake: 50,
  cutoffHour: 18,
  multipliers: {},
  labels: {},
}

const upsertBet = (list, bet) => {
  if (!bet?._id) return list
  const without = list.filter((item) => item._id !== bet._id)
  return [bet, ...without]
}

export const LotteryProvider = ({ children }) => {
  const { socket } = useContext(PlaylistContext)
  const { user, setBalance, refreshBalance, requireAuth } = useAuth()

  const [draw, setDraw] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [results, setResults] = useState([])
  const [publicBets, setPublicBets] = useState([])

  const loadState = useCallback(async () => {
    try {
      const [{ data: state }, { data: res }] = await Promise.all([
        getLotteryState(),
        getLotteryResults(10),
      ])
      setDraw(state.draw)
      if (state.config) setConfig({ ...DEFAULT_CONFIG, ...state.config })
      setResults(res.results || [])
    } catch {
      /* keep last known state */
    }
  }, [])

  const loadPublicBets = useCallback(async () => {
    try {
      const { data } = await getLotteryPublicBets({ days: 7, limit: 300 })
      setPublicBets(data.bets || [])
    } catch {
      /* keep last known board */
    }
  }, [])

  useEffect(() => {
    loadState()
    loadPublicBets()
  }, [loadState, loadPublicBets])

  useEffect(() => {
    if (!socket) return undefined

    const onClosed = (payload) => {
      setDraw((prev) =>
        prev && prev.dateKey === payload.dateKey
          ? { ...prev, status: 'closed', bettingOpen: false }
          : prev,
      )
    }

    const onBet = (payload) => {
      if (payload?.bet) setPublicBets((prev) => upsertBet(prev, payload.bet))
    }

    const onSettled = (payload) => {
      if (payload.result) {
        setResults((prev) => {
          const withoutDay = prev.filter((r) => r.dateKey !== payload.result.dateKey)
          return [payload.result, ...withoutDay].slice(0, 10)
        })
      }
      loadPublicBets()
      refreshBalance()
    }

    socket.on('lottery_closed', onClosed)
    socket.on('lottery_bet', onBet)
    socket.on('lottery_settled', onSettled)

    return () => {
      socket.off('lottery_closed', onClosed)
      socket.off('lottery_bet', onBet)
      socket.off('lottery_settled', onSettled)
    }
  }, [socket, loadPublicBets, refreshBalance])

  const placeBet = useCallback(
    async (betType, numbers, amount) => {
      if (!requireAuth('Đăng nhập để đi lê đồ.')) return false
      try {
        const { data } = await placeLotteryBet(betType, numbers, amount)
        setBalance(data.balance)
        setPublicBets((prev) => upsertBet(prev, data.bet))
        message.success(`Đã đặt ${amount} PC · ${numbers.join('-')}`)
        return true
      } catch (error) {
        message.error(error.response?.data?.message || 'Không đặt được cược')
        return false
      }
    },
    [requireAuth, setBalance],
  )

  const todayKey = draw?.dateKey
  const todayBets = useMemo(
    () => (todayKey ? publicBets.filter((bet) => bet.dateKey === todayKey) : publicBets),
    [publicBets, todayKey],
  )
  const myBets = useMemo(() => {
    if (!user?._id) return []
    const mine = String(user._id)
    return todayBets.filter((bet) => String(bet.userId) === mine)
  }, [todayBets, user?._id])

  return (
    <LotteryContext.Provider
      value={{
        draw,
        config,
        results,
        publicBets,
        todayBets,
        myBets,
        placeBet,
        refresh: loadState,
      }}
    >
      {children}
    </LotteryContext.Provider>
  )
}
