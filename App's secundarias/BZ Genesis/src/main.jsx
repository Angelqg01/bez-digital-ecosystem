import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 75, label: 'Bio-Agent Access' }} appName="BZ Genesis" accent="#7c3aed">
      <App />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
