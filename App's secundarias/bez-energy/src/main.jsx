import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 100, label: 'VPP Operator' }} appName="BeZhas Energy VPP" accent="#34d399">
      <App />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
