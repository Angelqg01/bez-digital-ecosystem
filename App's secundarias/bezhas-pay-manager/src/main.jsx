import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BezhasAuthProvider subscribePlan={{ amountBEZ: 10, label: 'Merchant Plan' }} appName="BeZhas Pay Manager" accent="#FFD700">
        <App />
      </BezhasAuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
