import { useEffect, useState } from 'react'
import { fetchSsoStatus } from '../../services/api'
export const useSso = () => {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let active = true
    fetchSsoStatus().then(({ data }) => { if (active) setStatus(data) }).catch(() => { if (active) setStatus({ enabled: false }) })
    return () => { active = false }
  }, [])
  return { loading: status === null, enabled: status?.enabled === true, handoffTargets: status?.handoffTargets || [] }
}
