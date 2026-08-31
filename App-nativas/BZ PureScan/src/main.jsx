import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 25, label: 'PureScan Pro' }} appName="BZ PureScan" accent="#00D4AA">
      <App />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
