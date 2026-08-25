import { useState } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminLayout from '@/components/admin/AdminLayout'

// MOCK-ONLY: hardcoded password check for the UI-only plan. This is replaced by
// the real ADMIN_PASSWORD env-var-backed serverless check in the backend-wiring plan.
const MOCK_ADMIN_PASSWORD = 'admin123'

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (!isAuthenticated) {
    return (
      <AdminLoginForm
        password={MOCK_ADMIN_PASSWORD}
        onLoginSuccess={() => setIsAuthenticated(true)}
      />
    )
  }

  return <AdminLayout />
}

export default AdminPage
