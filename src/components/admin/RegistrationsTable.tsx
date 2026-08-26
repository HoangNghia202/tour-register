import { useEffect, useState } from 'react'
import { AlertCircle, Download } from 'lucide-react'
import { getAllRegistrationsWithDetails, SessionExpiredError } from '@/lib/api'
import type { Employee, Registration, Tour } from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type RegistrationWithDetails = Registration & { employee: Employee; tour: Tour }

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('vi-VN')
}

function countByType(companions: Array<{ type: 'adult' | 'child' }>, type: 'adult' | 'child') {
  return companions.filter((companion) => companion.type === type).length
}

interface RegistrationsTableProps {
  onSessionExpired: () => void
}

function RegistrationsTable({ onSessionExpired }: RegistrationsTableProps) {
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const load = async () => {
    setLoadError(false)
    try {
      const data = await getAllRegistrationsWithDetails()
      setRegistrations(data)
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        onSessionExpired()
        return
      }
      setLoadError(true)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const response = await fetch('/api/admin/export-registrations', { credentials: 'include' })

      if (response.status === 401) {
        onSessionExpired()
        return
      }
      if (!response.ok) throw new Error('export failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'danh-sach-dang-ky.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Không thể xuất file Excel. Vui lòng thử lại.')
    } finally {
      setIsExporting(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Không thể tải danh sách đăng ký. Vui lòng thử lại.</AlertDescription>
        </Alert>
        <Button type="button" onClick={load} className="self-start">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!registrations) {
    return <p className="text-sm text-muted-foreground">Đang tải...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Danh sách đăng ký</h2>
          <p className="text-sm text-muted-foreground">
            Tổng cộng {registrations.length} lượt đăng ký.
          </p>
        </div>
        <Button type="button" onClick={handleExport} disabled={registrations.length === 0 || isExporting}>
          <Download className="h-4 w-4" />
          {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
        </Button>
      </div>

      {exportError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[80px]">MSNV</TableHead>
              <TableHead className="min-w-[160px]">Họ tên</TableHead>
              <TableHead className="min-w-[120px]">Tour</TableHead>
              <TableHead className="min-w-[140px]">Số người lớn đi kèm</TableHead>
              <TableHead className="min-w-[130px]">Số trẻ em đi kèm</TableHead>
              <TableHead className="min-w-[130px]">Tổng tiền</TableHead>
              <TableHead className="min-w-[120px]">Ngày đăng ký</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Chưa có lượt đăng ký nào.
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell className="font-medium">{registration.employee.id}</TableCell>
                  <TableCell>{registration.employee.fullName}</TableCell>
                  <TableCell>{registration.tour.name}</TableCell>
                  <TableCell>{countByType(registration.companions, 'adult')}</TableCell>
                  <TableCell>{countByType(registration.companions, 'child')}</TableCell>
                  <TableCell>{currencyFormatter.format(registration.totalPrice)}</TableCell>
                  <TableCell>{formatDate(registration.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default RegistrationsTable
