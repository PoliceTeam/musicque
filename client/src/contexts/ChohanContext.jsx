import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { getChohanState, getChohanHistory, placeChohanBet } from '../services/api'

export const ChohanContext = createContext()

export const useChohan = () => {
  const context = useContext(ChohanContext)
  if (!context) throw new Error('useChohan must be used within ChohanProvider')
  return context
}

const SIDE_LABEL = { cho: 'Chẵn', han: 'Lẻ' }

export const ChohanProvider = ({ children }) => {
  // Dùng chung socket của PlaylistContext, không mở kết nối thứ hai
  const { socket, currentSession } = useContext(PlaylistContext)
  const { setBalance, refreshBalance, requireAuth } = useAuth()

  const [round, setRound] = useState(null) // vòng hiện tại (đã serialize, giấu xúc xắc tới reveal)
  const [config, setConfig] = useState({ minBet: 5, maxBet: 15 })
  const [history, setHistory] = useState([])
  const [active, setActive] = useState(false)
  const [myBet, setMyBet] = useState(null) // { roundId, side, amount }
  const [lastResult, setLastResult] = useState(null)

  // Ref để listener socket đọc được myBet mới nhất mà không cần re-subscribe
  const myBetRef = useRef(null)
  useEffect(() => {
    myBetRef.current = myBet
  }, [myBet])

  const loadState = useCallback(async () => {
    try {
      const [{ data: state }, { data: hist }] = await Promise.all([
        getChohanState(),
        getChohanHistory(20),
      ])
      setActive(state.active)
      setRound(state.round)
      if (state.config) setConfig(state.config)
      setHistory(hist.history || [])
    } catch {
      /* để lần socket/broadcast kế tiếp đồng bộ lại */
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState, currentSession])

  useEffect(() => {
    if (!socket) return undefined

    const onRound = (r) => {
      setActive(true)
      setRound(r)
      // Sang vòng mới thì bỏ cược cũ
      if (myBetRef.current && r && myBetRef.current.roundId !== r._id) {
        setMyBet(null)
      }
    }

    const onResult = (r) => {
      setRound(r)
      setLastResult(r)
      setHistory((prev) =>
        [
          {
            roundNumber: r.roundNumber,
            die1: r.die1,
            die2: r.die2,
            result: r.result,
            tallies: r.tallies,
          },
          ...prev,
        ].slice(0, 20),
      )

      const mine = myBetRef.current
      if (mine && mine.roundId === r._id) {
        if (mine.side === r.result) {
          // Stake đã bị trừ khi đặt cược; thắng được server trả 2× stake.
          // Cập nhật ngay toàn bộ UI, rồi gọi API bên dưới để đối soát.
          setBalance((current) => current + mine.amount * 2)
          message.success(`🎉 Thắng! +${mine.amount} PC (cửa ${SIDE_LABEL[mine.side]})`)
        } else {
          message.error(`😢 Thua ${mine.amount} PC (ra ${SIDE_LABEL[r.result]})`)
        }
      }
      // Số dư đã được cộng ở server khi settle → lấy lại cho chắc
      refreshBalance()
    }

    const onStopped = (payload) => {
      const mine = myBetRef.current
      if (
        payload?.round?.status === 'voided'
        && mine
        && payload.round._id === mine.roundId
      ) {
        setBalance((current) => current + mine.amount)
      }
      setActive(false)
      setRound(null)
      setMyBet(null)
      // Session có thể kết thúc giữa vòng và server vừa hoàn stake.
      refreshBalance()
    }

    socket.on('chohan_round', onRound)
    socket.on('chohan_result', onResult)
    socket.on('chohan_stopped', onStopped)

    return () => {
      socket.off('chohan_round', onRound)
      socket.off('chohan_result', onResult)
      socket.off('chohan_stopped', onStopped)
    }
  }, [socket, refreshBalance, setBalance])

  const placeBet = useCallback(
    async (side, amount) => {
      if (!requireAuth('Đăng nhập để chơi Cho-Han.')) return false
      try {
        const { data } = await placeChohanBet(side, amount)
        setBalance(data.balance)
        setMyBet({ roundId: data.round._id, side, amount })
        setRound(data.round)
        message.success(`Đã cược ${amount} PC cửa ${SIDE_LABEL[side]}`)
        return true
      } catch (error) {
        message.error(error.response?.data?.message || 'Không đặt được cược')
        return false
      }
    },
    [requireAuth, setBalance],
  )

  return (
    <ChohanContext.Provider
      value={{ round, config, history, active, myBet, lastResult, placeBet }}
    >
      {children}
    </ChohanContext.Provider>
  )
}
