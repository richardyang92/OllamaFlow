import React from 'react'
import ReactDOM from 'react-dom/client'
import { enableMapSet } from 'immer'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

enableMapSet()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultMode="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
