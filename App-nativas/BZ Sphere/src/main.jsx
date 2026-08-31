import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BezhasAuthProvider subscribePlan={{ amountBEZ: 50, label: 'Sphere Member' }} appName="BeZhas Sphere" accent="#00e5ff">
      <App />
    </BezhasAuthProvider>
  </React.StrictMode>,
)
