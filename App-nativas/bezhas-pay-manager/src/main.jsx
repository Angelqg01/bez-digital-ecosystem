import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { BezhasAuthProvider } from '../../_shared/BezhasAuthProvider.jsx'

/**
 * En desarrollo, vite.config proxya `/api` a la API local (localhost:3001): base vacía = mismo origen, sin CORS y sin
 * tocar producción. Antes, `pnpm dev` apuntaba al API real (login SIWE y pedidos incluidos). En el build manda
 * VITE_API_URL y, si no está, el valor por defecto del proveedor compartido.
 */
// Sin `subscribePlan`: en Pay no hace falta ningún plan para comprar BEZ. Los planes son opcionales y dan ventajas, no un requisito.
const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : undefined)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BezhasAuthProvider apiBase={API_BASE} appName="BeZhas Pay Manager" accent="#FFD700">
        <App />
      </BezhasAuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
