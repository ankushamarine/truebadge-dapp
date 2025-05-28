import React, { StrictMode } from 'react' // IMPORTANT: Added 'React' import here
import { createRoot } from 'react-dom/client'
import './index.css' // Your global CSS file
import App from './App.jsx' // Your main App component

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)