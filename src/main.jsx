import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource/inter";
import "./index.css";
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
/**
Added actual flyover points to the Dashboard maps for accurate marker placement.
Implemented zoom-based marker details to show information when zooming in and hide it when zooming out.
Matched the flyover marker colors in Dashboard with the colors used in the main HomeMap
Added zoom tracking to control the marker details based on the current zoom level
Configured minimum and maximum zoom levels for better map navigation
Set a consistent initial zoom level for all four Flyover Card maps
Fixed flyover marker data, color, and index passing between the Dashboard map components
Tested marker clicks, zoom behavior, and overall map functionality
*/