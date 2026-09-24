import React, { useEffect, useRef, useState } from 'react'
import UserAvatar from '../Avatar/UserAvatar'
import { CHANNEL_META, chatChannelFor } from '../../utils/werewolf'

const FeedEntry = ({ entry, myId }) => {
  const channel = CHANNEL_META[entry.channel] || CHANNEL_META.public
  const tag = entry.channel !== 'public' && <span className={`ww-feed__tag ${channel.className}`}>{channel.label}</span>

  if (entry.kind === 'chat') {
    const mine = entry.author?.userId === myId
    return (
      <li className={`ww-feed__chat ${channel.className}${mine ? ' is-mine' : ''}`}>
        <UserAvatar user={entry.author} name={entry.author?.displayName} avatarId={entry.author?.avatarId} size={24} />
        <div>
          <div className='ww-feed__author'>{entry.author?.displayName} {tag}</div>
          <p>{entry.text}</p>
        </div>
      </li>
    )
  }
  return (
    <li className={`ww-feed__system ${channel.className}`}>
      {tag}
      <p>{entry.text}</p>
    </li>
  )
}

const GameFeed = ({ state, onSend }) => {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const stickRef = useRef(true)
  const { channel, reason } = chatChannelFor(state)
  const lastId = state.log[state.log.length - 1]?.id

  useEffect(() => {
    const list = listRef.current
    if (list && stickRef.current) list.scrollTop = list.scrollHeight
  }, [lastId])

  const onScroll = () => {
    const list = listRef.current
    if (list) stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60
  }

  const submit = async (event) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !channel || sending) return
    setSending(true)
    const sent = await onSend(content)
    setSending(false)
    if (sent) {
      setDraft('')
      stickRef.current = true
    }
  }

  return (
    <section className='ww-feed sp-panel' aria-label='Diễn biến và trò chuyện'>
      <header className='ww-feed__head'>
        <strong>Diễn biến làng</strong>
        <span>{state.log.length} dòng</span>
      </header>
      <ol className='ww-feed__list' ref={listRef} onScroll={onScroll}>
        {state.log.map((entry) => <FeedEntry key={entry.id} entry={entry} myId={state.me?.userId} />)}
        {!state.log.length && <li className='ww-feed__empty'>Chưa có gì xảy ra…</li>}
      </ol>
      <form className='ww-feed__form' onSubmit={submit}>
        {channel && <span className={`ww-feed__tag ${CHANNEL_META[channel].className}`}>{CHANNEL_META[channel].label}</span>}
        <input
          value={draft}
          maxLength={240}
          disabled={!channel || sending}
          placeholder={channel ? (channel === 'wolves' ? 'Thì thầm với bầy sói…' : 'Nói gì đó với mọi người…') : reason}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type='submit' className='sp-btn sp-btn--primary sp-btn--sm' disabled={!channel || !draft.trim() || sending}>
          Gửi
        </button>
      </form>
    </section>
  )
}

export default GameFeed
