import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 25, label: 'PureScan Pro' }} appName="BZ PureScan" accent="#00D4AA">
      <App />
      {/* Chat de la plataforma (el mismo de www.bezhas.com) */}
      <AIWorkspaceBar hideAppId="app_purescan" bottomOffset={92} />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
