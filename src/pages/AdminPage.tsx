import { useEffect, useState } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminLayout from '@/components/admin/AdminLayout'

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/session', { credentials: 'include' })
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setIsAuthenticated(Boolean(body?.authenticated))
      })
      .catch(() => {
        // Treat a network failure the same as "not authenticated" — the
        // login form will surface further errors on submit.
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSessionExpired = () => {
    setIsAuthenticated(false)
    setSessionMessage('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <AdminLoginForm
        initialError={sessionMessage}
        onLoginSuccess={() => {
          setSessionMessage(null)
          setIsAuthenticated(true)
        }}
      />
    )
  }

  return <AdminLayout onSessionExpired={handleSessionExpired} />
}

export default AdminPage
