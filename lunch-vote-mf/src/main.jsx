import React from 'react'
import ReactDOM from 'react-dom/client'
import LunchVoteApp from './LunchVoteApp'
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LunchVoteApp username="DevUser" />
    </BrowserRouter>
  </React.StrictMode>,
)
