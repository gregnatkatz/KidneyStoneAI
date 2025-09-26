/**
 * Kidney Stone Research Platform - Application Entry Point
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: React application bootstrap and root rendering
 * Dependencies: React DOM, StrictMode
 * Last Updated: September 26, 2025
 */


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
