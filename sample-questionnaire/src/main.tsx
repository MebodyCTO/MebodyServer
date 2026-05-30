import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LOCAL_CHARACTER } from './assets/localMedia'
import './index.css'

if (typeof document !== 'undefined') {
  const preload = (href: string, as: string) => {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = as
    link.href = href
    document.head.appendChild(link)
  }
  preload(LOCAL_CHARACTER.png, 'image')
  preload(LOCAL_CHARACTER.gif, 'image')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
