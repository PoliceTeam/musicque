import React from 'react'
import { useParams } from 'react-router-dom'
import AuditionLobby from '../components/Audition/AuditionLobby'
import AuditionRoom from '../components/Audition/AuditionRoom'
import '../styles/audition.css'

const AuditionPage = () => {
  const { roomId } = useParams()
  return roomId ? <AuditionRoom key={roomId} roomId={roomId} /> : <AuditionLobby />
}

export default AuditionPage
