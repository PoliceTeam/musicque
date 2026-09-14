import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import {
  getLotteryState,
  getLotteryResults,
  getLotteryMyBets,
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

export const LotteryProvider = ({ children }) => {
  // Dùng chung socket của PlaylistContext, không mở kết nối thứ hai
  const { socket } = useContext(PlaylistContext)
  const { setBalance, refreshBalance, requireAuth, isAuthenticated } = useAuth()

  const [draw, setDraw] = useState(null) // { dateKey, status, bettingOpen, cutoffAt, result }
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [results, setResults] = useState([]) // kết quả các ngày gần đây
  const [myBets, setMyBets] = useState([])

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
      /* im lặng, socket/lần load sau sẽ đồng bộ lại */
    }
  }, [])

  const loadMyBets = useCallback(async () => {
    if (!isAuthenticated) {
      setMyBets([])
      return
    }
    try {
      const { data } = await getLotteryMyBets()
      setMyBets(data.bets || [])
    } catch {
      /* bỏ qua */
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadState()
  }, [loadState])

  useEffect(() => {
    loadMyBets()
  }, [loadMyBets])

  useEffect(() => {
    if (!socket) return undefined

    const onClosed = (payload) => {
      setDraw((prev) =>
        prev && prev.dateKey === payload.dateKey
          ? { ...prev, status: 'closed', bettingOpen: false }
          : prev,
      )
    }

    const onSettled = (payload) => {
      // Kết quả về → cập nhật bảng kết quả và số dư (server đã cộng thưởng)
      if (payload.result) {
        setResults((prev) => {
          const withoutDay = prev.filter((r) => r.dateKey !== payload.result.dateKey)
          return [payload.result, ...withoutDay].slice(0, 10)
        })
      }
      loadMyBets()
      refreshBalance()
    }

    socket.on('lottery_closed', onClosed)
    socket.on('lottery_settled', onSettled)

    return () => {
      socket.off('lottery_closed', onClosed)
      socket.off('lottery_settled', onSettled)
    }
  }, [socket, loadMyBets, refreshBalance])

  const placeBet = useCallback(
    async (betType, numbers, amount) => {
      if (!requireAuth('Đăng nhập để đi lê đồ.')) return false
      try {
        const { data } = await placeLotteryBet(betType, numbers, amount)
        setBalance(data.balance)
        setMyBets((prev) => [data.bet, ...prev])
        message.success(`Đã đặt ${amount} PC · ${numbers.join('-')}`)
        return true
      } catch (error) {
        message.error(error.response?.data?.message || 'Không đặt được cược')
        return false
      }
    },
    [requireAuth, setBalance],
  )

  return (
    <LotteryContext.Provider
      value={{ draw, config, results, myBets, placeBet, refresh: loadState }}
    >
      {children}
    </LotteryContext.Provider>
  )
}
