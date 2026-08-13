import React from 'react'
import { getAvatarColor, getInitials } from '../../utils/avatar'
import { getAvatarUrl, getStableAnimalAvatarId } from '../../constants/animalAvatars'

const UserAvatar = ({ user, name, avatarId, size = 28, className = '' }) => {
  const displayName = name || user?.displayName || user?.username || ''
  const resolvedAvatarId =
    avatarId || user?.avatarId || getStableAnimalAvatarId(user?._id || user?.userId || displayName)

  return (
    <span
      className={`sp-avatar sp-avatar--image ${className}`.trim()}
      style={{
        width: size,
        height: size,
        background: user?.color || getAvatarColor(displayName),
      }}
      aria-hidden="true"
    >
      <img src={getAvatarUrl(resolvedAvatarId)} alt="" draggable={false} />
      <span className="sp-avatar__fallback">{getInitials(displayName)}</span>
    </span>
  )
}

export default UserAvatar
