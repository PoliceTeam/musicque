import React, { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { Row, Col, message } from 'antd'

import {
  addLunchOption,
  getLunchTeams,
  createLunchTeam,
  deleteLunchTeam,
  getTodayLunchOptions,
  voteLunchOption,
} from './services/api'

import { formatCountdown, getPhaseInfo, STORAGE_TEAM, STORAGE_USERNAME } from './components/LunchVote/utils'
import { styles } from './components/LunchVote/styles'
import SetupCard from './components/LunchVote/SetupCard'
import LunchHeader from './components/LunchVote/LunchHeader'
import AddOptionCard from './components/LunchVote/AddOptionCard'
import StatsCard from './components/LunchVote/StatsCard'
import WinnerCard from './components/LunchVote/WinnerCard'
import OptionList from './components/LunchVote/OptionList'
import LunchWheelModal from './components/LunchVote/LunchWheelModal'

export default function LunchVoteApp({ username, isDark }) {
  const [step, setStep] = useState('setup')
  const [teamName, setTeamName] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_TEAM) || '' : ''
    } catch {
      return ''
    }
  })
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [usernameInput, setUsernameInput] = useState(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_USERNAME) : null
      return stored || username || ''
    } catch {
      return username || ''
    }
  })
  const [availableTeams, setAvailableTeams] = useState([])
  const [dateKey, setDateKey] = useState('')
  const [options, setOptions] = useState([])
  const [newMapsUrl, setNewMapsUrl] = useState('')
  const [detectedName, setDetectedName] = useState('')
  const [manualName, setManualName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [randoming, setRandoming] = useState(false)
  const [{ phase, target, label }, setPhaseState] = useState(getPhaseInfo)
  const [countdownText, setCountdownText] = useState(formatCountdown(getPhaseInfo().target))
  const [socket, setSocket] = useState(null)
  const [showWheel, setShowWheel] = useState(false)
  const [wheelOptions, setWheelOptions] = useState([])
  const [wheelRotation, setWheelRotation] = useState(0)
  const [wheelWinner, setWheelWinner] = useState(null)

  const displayName = (usernameInput || username || '').trim() || 'Guest'

  const totalVotes = useMemo(
    () => options.reduce((sum, o) => sum + (o.votes || 0), 0),
    [options],
  )

  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) => {
        if ((b.votes || 0) !== (a.votes || 0)) {
          return (b.votes || 0) - (a.votes || 0)
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }),
    [options],
  )

  const currentVoteOptionId = useMemo(() => {
    const todayHistory = sortedOptions.find((o) => o.voters?.includes(displayName))
    return todayHistory?._id || null
  }, [sortedOptions, displayName])

  const [winnerId, setWinnerId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)

  const handleBackToMusic = () => {
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/'
      }
    } catch {
      // ignore
    }
  }

  const handleSetupSubmit = async () => {
    const team = (teamName || '').trim()
    const name = (usernameInput || '').trim()
    if (!name) {
      message.warning('Vui lòng nhập tên của bạn')
      return
    }
    if (!team) {
      message.warning('Vui lòng nhập tên team')
      return
    }

    if (isCreatingTeam) {
      try {
        setSubmitting(true)
        await createLunchTeam(team, name)
        message.success('Tạo team thành công')
        const res = await getLunchTeams()
        setAvailableTeams(Array.isArray(res.data?.data) ? res.data.data : [])
        setIsCreatingTeam(false)
      } catch (error) {
        console.error(error)
        message.error(error.response?.data?.message || 'Không thể tạo team')
        setSubmitting(false)
        return
      } finally {
        setSubmitting(false)
      }
    }

    try {
      localStorage.setItem(STORAGE_TEAM, team)
      localStorage.setItem(STORAGE_USERNAME, name)
    } catch {
      // ignore
    }
    setStep('vote')
  }

  const handleDeleteTeam = async (e, teamToDelete) => {
    e.stopPropagation()
    const name = (usernameInput || '').trim()
    if (!name) {
      message.warning('Vui lòng nhập tên của bạn để xác nhận quyền xóa')
      return
    }
    try {
      setSubmitting(true)
      await deleteLunchTeam(teamToDelete, name)
      message.success('Đã xóa team')
      if (teamName === teamToDelete) {
        setTeamName('')
      }
      const res = await getLunchTeams()
      setAvailableTeams(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Không thể xóa team')
    } finally {
      setSubmitting(false)
    }
  }

  const loadTeams = async () => {
    try {
      const res = await getLunchTeams()
      const list = Array.isArray(res.data?.data) ? res.data.data : []
      setAvailableTeams(list)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    let intervalId = null

    function tick() {
      const info = getPhaseInfo()
      setPhaseState(info)
      setCountdownText(formatCountdown(info.target))
    }

    tick()
    intervalId = setInterval(tick, 1000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const url = newMapsUrl.trim()
    if (!url) {
      setDetectedName('')
      return
    }
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/')
      const placeIndex = parts.findIndex((p) => p === 'place')
      if (placeIndex !== -1 && parts[placeIndex + 1]) {
        const raw = decodeURIComponent(parts[placeIndex + 1])
        const name = raw.replace(/\+/g, ' ')
        setDetectedName(name)
        return
      }
      const q = u.searchParams.get('q')
      if (q) {
        setDetectedName(decodeURIComponent(q.replace(/\+/g, ' ')))
        return
      }
      setDetectedName('')
    } catch {
      setDetectedName('')
    }
  }, [newMapsUrl])

  useEffect(() => {
    if (step !== 'vote' || !(teamName || '').trim()) return
    const team = (teamName || '').trim()
    async function loadAll() {
      try {
        setLoading(true)
        const todayRes = await getTodayLunchOptions(team)
        setDateKey(todayRes.data?.data?.dateKey || '')
        setOptions(todayRes.data?.data?.options || [])
      } catch (error) {
        console.error(error)
        message.error('Không thể tải dữ liệu Lunch Vote')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [step, teamName])

  // Socket.io realtime updates
  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== 'undefined' && window.__SOCKET_URL__) ||
      ''
    if (!socketUrl) {
      return
    }

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    setSocket(newSocket)

    newSocket.on('lunch_vote_updated', (payload) => {
      if (!payload) return
      const currentTeam = (teamName || '').trim()
      if (payload.team !== currentTeam) return
      if (payload.dateKey) setDateKey(payload.dateKey)
      if (Array.isArray(payload.options)) setOptions(payload.options)
    })
    
    newSocket.on('lunch_team_created', () => {
      loadTeams()
    })
    
    newSocket.on('lunch_team_deleted', (payload) => {
      loadTeams()
      if (payload && payload.name === (teamName || '').trim()) {
        message.warning(`Team ${payload.name} đã bị người tạo xóa`)
        setStep('setup')
        setTeamName('')
      }
    })

    return () => {
      newSocket.off('lunch_vote_updated')
      newSocket.off('lunch_team_created')
      newSocket.off('lunch_team_deleted')
      newSocket.disconnect()
    }
  }, [teamName])

  const handleAddOption = async () => {
    if (!newMapsUrl.trim()) {
      message.warning('Hãy dán link Google Maps của quán ăn')
      return
    }
    const team = (teamName || '').trim()
    if (!team) return
    try {
      setSubmitting(true)
      const finalName = detectedName || manualName.trim()
      const res = await addLunchOption(
        newMapsUrl.trim(),
        displayName,
        finalName || undefined,
        team
      )
      const option = res.data?.data
      if (option) {
        setOptions((prev) => {
          const exists = prev.find((o) => o._id === option._id)
          if (exists) return prev
          return [...prev, option]
        })
      }
      setNewMapsUrl('')
      setManualName('')
      message.success('Đã thêm quán ăn mới')
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Không thể thêm quán ăn')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (optionId) => {
    if (phase === 'randomWindow') {
      message.info('Trong khung random 12h–14h chỉ được quay, không thể vote')
      return
    }
    const team = (teamName || '').trim()
    if (!team) return
    try {
      setSubmitting(true)
      const res = await voteLunchOption(optionId, displayName, team)
      const payload = res.data?.data
      if (payload?.options) setOptions(payload.options)
      message.success(res.data?.message || 'Đã ghi nhận vote')
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Không thể vote')
    } finally {
      setSubmitting(false)
    }
  }

  const winnerOption = useMemo(() => {
    if (winnerId) {
      return sortedOptions.find((o) => o._id === winnerId) || null
    }
    if (!sortedOptions.length) return null
    if (!sortedOptions[0].votes) return null
    return sortedOptions[0]
  }, [sortedOptions, winnerId])

  const handleRandom = () => {
    const eligible = sortedOptions.filter((o) => (o.votes || 0) > 0)
    if (!eligible.length) {
      message.warning('Cần ít nhất 1 quán có vote để quay')
      return
    }

    const chosenIndex = Math.floor(Math.random() * eligible.length)
    const chosen = eligible[chosenIndex]

    const n = eligible.length
    const segmentAngle = 360 / n
    const targetAngle = chosenIndex * segmentAngle + segmentAngle / 2
    const spins = 5 + Math.floor(Math.random() * 3)
    const finalRotation = spins * 360 - targetAngle

    setWheelOptions(eligible)
    setWheelRotation(0)
    setWheelWinner(null)
    setShowWheel(true)
    setRandoming(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWheelRotation(finalRotation)
      })
    })

    setTimeout(() => {
      setWinnerId(chosen._id)
      setHighlightedId(chosen._id)
      setWheelWinner(chosen)
      message.success(`Hôm nay ăn: ${chosen.placeName}`)
      setRandoming(false)
    }, 4200)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <style>{styles}</style>

      {step === 'setup' && (
        <SetupCard
          usernameInput={usernameInput}
          setUsernameInput={setUsernameInput}
          teamName={teamName}
          setTeamName={setTeamName}
          isCreatingTeam={isCreatingTeam}
          setIsCreatingTeam={setIsCreatingTeam}
          availableTeams={availableTeams}
          displayName={displayName}
          handleSetupSubmit={handleSetupSubmit}
          handleDeleteTeam={handleDeleteTeam}
          handleBackToMusic={handleBackToMusic}
          submitting={submitting}
        />
      )}

      {step !== 'setup' && (
        <>
          <LunchHeader
            teamName={teamName}
            displayName={displayName}
            phase={phase}
            label={label}
            countdownText={countdownText}
            handleBackToMusic={handleBackToMusic}
            setStep={setStep}
          />

          <Row gutter={[20, 20]}>
            <Col xs={24} lg={10}>
              <AddOptionCard
                newMapsUrl={newMapsUrl}
                setNewMapsUrl={setNewMapsUrl}
                detectedName={detectedName}
                manualName={manualName}
                setManualName={setManualName}
                submitting={submitting}
                handleAddOption={handleAddOption}
              />

              <StatsCard
                optionsLength={options.length}
                totalVotes={totalVotes}
                phase={phase}
                handleRandom={handleRandom}
                randoming={randoming}
              />

              <WinnerCard winnerOption={winnerOption} />
            </Col>

            <Col xs={24} lg={14}>
              <OptionList
                sortedOptions={sortedOptions}
                dateKey={dateKey}
                loading={loading}
                totalVotes={totalVotes}
                currentVoteOptionId={currentVoteOptionId}
                highlightedId={highlightedId}
                phase={phase}
                submitting={submitting}
                handleVote={handleVote}
                isDark={isDark}
              />
            </Col>
          </Row>

          <LunchWheelModal
            showWheel={showWheel}
            wheelOptions={wheelOptions}
            wheelRotation={wheelRotation}
            wheelWinner={wheelWinner}
            randoming={randoming}
            setShowWheel={setShowWheel}
            setWheelWinner={setWheelWinner}
          />

          <div
            style={{
              marginTop: 32,
              padding: '12px 0 4px',
              textAlign: 'center',
              fontSize: 12,
              color: '#94a3b8',
            }}
          >
            Polite Lunch Vote ©2026 - Iced Tea Team -{' '}
            <span style={{ fontWeight: 600, color: '#64748b' }}>100% Made with AI</span>
          </div>
        </>
      )}
    </div>
  )
}
