import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Sin <BrowserRouter> aquí: el AppWrapper de App.jsx ya monta el suyo, y react-router
// lanza si se anidan dos, así que la app no llegaba a renderizar nada.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
