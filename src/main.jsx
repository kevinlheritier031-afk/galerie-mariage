// Point d'entrée de l'application React
// Monte le composant App dans le div#root de l'index.html
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initGlobalErrorHandlers } from './lib/logger.js'

initGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
