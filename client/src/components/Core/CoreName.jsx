import React from 'react'
import { getCoreClassName, isCoreActive } from './coreIdentity'
import './core.css'

const CoreName = ({ user, name, className = '', showBadge = true }) => {
  const core = user?.core
  const active = isCoreActive(core)

  return (
    <span className={getCoreClassName(core, `core-name-wrap ${className}`)}>
      <span className={active ? 'core-name' : ''}>{name}</span>
      {active && showBadge && <span className='core-badge'>CORE</span>}
    </span>
  )
}

export default CoreName
