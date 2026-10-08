import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
// Link mời cũ /thirteen?room=XXXX vẫn phải vào được bàn: giữ nguyên query string.
export default function ThirteenRedirect() {
  return <Navigate to={`/card-games/thirteen${useLocation().search}`} replace />
}
