import { Route, Routes } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import WizardPage from './pages/WizardPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WizardPage />} />
      <Route path="/select-tour/:employeeId" element={<WizardPage />} />
      <Route path="/register/:employeeId/:tourId" element={<WizardPage />} />
      <Route path="/ticket/:employeeId" element={<WizardPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}

export default App
