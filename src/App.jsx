import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Gallery from './components/Gallery.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import SuperAdminPanel from './components/SuperAdminPanel.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/superadmin" element={<SuperAdminPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
