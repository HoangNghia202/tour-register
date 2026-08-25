import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AdminLoginFormProps {
  password: string
  onLoginSuccess: () => void
}

function AdminLoginForm({ password, onLoginSuccess }: AdminLoginFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (value === password) {
      setError(false)
      onLoginSuccess()
      return
    }

    setError(true)
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-border bg-card px-5 py-8 shadow-sm sm:px-8 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Quản trị
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Đăng nhập quản trị</h1>

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
                  if (error) setError(false)
                }}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Mật khẩu không đúng, vui lòng thử lại.</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full">
              Đăng nhập
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default AdminLoginForm
