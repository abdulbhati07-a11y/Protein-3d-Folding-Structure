import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initTheme } from './themes/themes'
import './themes/themes.css'
import { AuthProvider } from './context/AuthProvider'
import './index.css'
import App from './App.jsx'

initTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
