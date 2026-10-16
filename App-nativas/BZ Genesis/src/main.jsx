import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 75, label: 'Bio-Agent Access' }} appName="BZ Genesis" accent="#7c3aed">
      <App />
      {/* Chat de la plataforma (el mismo de www.bezhas.com) */}
      <AIWorkspaceBar bottomOffset={12} />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
