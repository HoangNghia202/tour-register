import { useState, type FormEvent } from 'react'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AdminLoginFormProps {
  onLoginSuccess: () => void
  initialError?: string | null
}

function AdminLoginForm({ onLoginSuccess, initialError = null }: AdminLoginFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: value }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.ok) {
        setError(body?.error ?? 'Mật khẩu không đúng, vui lòng thử lại.')
        return
      }

      onLoginSuccess()
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-br from-teal-700 via-cyan-700 to-sky-600"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-4rem] -z-10 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
      />
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-border bg-card px-5 py-8 shadow-xl shadow-teal-900/10 sm:px-8 sm:py-10">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-600/10 text-teal-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Quản trị
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Đăng nhập quản trị</h1>
            </div>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Mật khẩu</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                placeholder="Nhập mật khẩu"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default AdminLoginForm
