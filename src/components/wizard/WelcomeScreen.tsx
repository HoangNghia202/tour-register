import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Employee, Registration } from '../../types/domain'
import { findEmployeeById, findRegistrationByEmployeeId } from '../../lib/api'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'

const NOT_FOUND_MESSAGE =
  'User nhân viên không nằm trong danh sách đăng ký tham gia Du Lịch, vui lòng liên hệ Hoàng DM - 24776 để được hỗ trợ.'
const NETWORK_ERROR_MESSAGE = 'Có lỗi xảy ra, vui lòng thử lại.'

interface WelcomeScreenProps {
  onVerified: (employee: Employee, existingRegistration: Registration | null) => void
}

function WelcomeScreen({ onVerified }: WelcomeScreenProps) {
  const [msnv, setMsnv] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [networkError, setNetworkError] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  const trimmedMsnv = msnv.trim()
  const isEmpty = trimmedMsnv.length === 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isEmpty || isChecking) return

    setIsChecking(true)
    setNotFound(false)
    setNetworkError(false)

    try {
      const employee = await findEmployeeById(trimmedMsnv)
      if (!employee) {
        setNotFound(true)
        return
      }

      const existingRegistration = (await findRegistrationByEmployeeId(employee.id)) ?? null
      onVerified(employee, existingRegistration)
    } catch {
      setNetworkError(true)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
              if (networkError) setNetworkError(false)
            }}
          />
        </div>

        {notFound && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{NOT_FOUND_MESSAGE}</AlertDescription>
          </Alert>
        )}

        {networkError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{NETWORK_ERROR_MESSAGE}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          disabled={isEmpty || isChecking}
        >
          {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
        </Button>
      </form>
    </div>
  )
}

export default WelcomeScreen
