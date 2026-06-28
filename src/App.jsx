// Composant racine : définit les routes / et /admin
// / → galerie publique accessible à tous les invités
// /admin → panel de gestion protégé par mot de passe
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Gallery from './components/Gallery.jsx'
import AdminPanel from './components/AdminPanel.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Galerie publique — les invités uploadent et voient les médias */}
        <Route path="/" element={<Gallery />} />
        {/* Panel admin — protégé par VITE_ADMIN_PASSWORD */}
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
