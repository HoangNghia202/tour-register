import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Employee, Registration } from '../../types/domain'
import { findEmployeeById, findRegistrationByEmployeeId } from '../../lib/mockData'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'

const NOT_FOUND_MESSAGE =
  'User nhân viên không nằm trong danh sách đăng ký tham gia Du Lịch, vui lòng liên hệ Hoàng DM - 24776 để được hỗ trợ.'

interface WelcomeScreenProps {
  onVerified: (employee: Employee, existingRegistration: Registration | null) => void
}

function WelcomeScreen({ onVerified }: WelcomeScreenProps) {
  const [msnv, setMsnv] = useState('')
  const [notFound, setNotFound] = useState(false)

  const trimmedMsnv = msnv.trim()
  const isEmpty = trimmedMsnv.length === 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isEmpty) return

    const employee = findEmployeeById(trimmedMsnv)
    if (!employee) {
      setNotFound(true)
      return
    }

    setNotFound(false)
    const existingRegistration = findRegistrationByEmployeeId(employee.id) ?? null
    onVerified(employee, existingRegistration)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Chào mừng bạn đến với chương trình Du Lịch 2026
        </h2>
        <p className="text-sm text-muted-foreground">
          Vui lòng nhập Mã số nhân viên (MSNV) để bắt đầu đăng ký.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="msnv">Mã số nhân viên (MSNV)</Label>
          <Input
            id="msnv"
            name="msnv"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="Ví dụ: 8830"
            value={msnv}
            onChange={(event) => {
              setMsnv(event.target.value)
              if (notFound) setNotFound(false)
            }}
          />
        </div>

        {notFound && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{NOT_FOUND_MESSAGE}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start" disabled={isEmpty}>
          Kiểm tra
        </Button>
      </form>
    </div>
  )
}

export default WelcomeScreen
