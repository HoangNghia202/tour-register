import { useEffect, useState } from 'react'
import { AlertCircle, Download } from 'lucide-react'
import { getRegistrationsPage, SessionExpiredError, type RegistrationsPage } from '@/lib/api'
import type { Registration } from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE_OPTIONS = [20, 50, 100]
const DEFAULT_PAGE_SIZE = 50

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

function countTotalTickets(companions: Array<{ type: 'adult' | 'child' }>): number {
  return 1 + countByType(companions, 'adult')
}

function formatCompanionType(type: 'adult' | 'child'): string {
  return type === 'adult' ? 'Người lớn' : 'Trẻ em'
}

function formatGender(gender: 'male' | 'female'): string {
  return gender === 'male' ? 'Nam' : 'Nữ'
}

function formatTransport(registration: Registration): string {
  if (registration.transportMethod === 'self') return 'Tự túc'
  return registration.pickupPoint ? `Xe tour - ${registration.pickupPoint}` : 'Xe tour'
}

type PageToken = number | 'ellipsis-left' | 'ellipsis-right'

// 1 … 4 5 6 … 40  — always show first/last, a window around the current page.
function getPageWindow(current: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const tokens: PageToken[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)

  if (start > 2) tokens.push('ellipsis-left')
  for (let page = start; page <= end; page += 1) tokens.push(page)
  if (end < totalPages - 1) tokens.push('ellipsis-right')

  tokens.push(totalPages)
  return tokens
}

interface RegistrationsTableProps {
  onSessionExpired: () => void
}

function RegistrationsTable({ onSessionExpired }: RegistrationsTableProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [data, setData] = useState<RegistrationsPage | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(false)

    getRegistrationsPage(page, pageSize)
      .then((result) => {
        if (cancelled) return
        setData(result)
        // Clamp if we ran past the last page (e.g. after page-size change).
        const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
        if (page > totalPages) setPage(totalPages)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof SessionExpiredError) {
          onSessionExpired()
          return
        }
        setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, pageSize, onSessionExpired])

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
        <Button type="button" onClick={() => setPage((current) => current)} className="self-start">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Đang tải...</p>
  }

  const { registrations, total } = data
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)
  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    if (clamped !== page) setPage(clamped)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Danh sách đăng ký</h2>
          <p className="text-sm text-muted-foreground">
            Tổng cộng {total} lượt đăng ký
            {total > 0 && ` · đang xem ${rangeStart}–${rangeEnd}`}.
          </p>
        </div>
        <Button type="button" onClick={handleExport} disabled={total === 0 || isExporting}>
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

      <div className="relative overflow-hidden rounded-lg border border-border">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-background/60 pt-6 text-sm text-muted-foreground">
            Đang tải...
          </div>
        )}
        <Table containerClassName="max-h-[600px]">
          <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
            <TableRow>
              <TableHead className="min-w-[80px]">MSNV</TableHead>
              <TableHead className="min-w-[160px]">Họ tên</TableHead>
              <TableHead className="min-w-[120px]">Tour</TableHead>
              <TableHead className="min-w-[180px]">Di chuyển / Điểm đón</TableHead>
              <TableHead className="min-w-[280px]">Người thân đi cùng</TableHead>
              <TableHead className="min-w-[140px]">Số người lớn đi kèm</TableHead>
              <TableHead className="min-w-[130px]">Số trẻ em đi kèm</TableHead>
              <TableHead className="min-w-[120px]">Tổng số vé</TableHead>
              <TableHead className="min-w-[130px]">Tổng tiền</TableHead>
              <TableHead className="min-w-[120px]">Ngày đăng ký</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Chưa có lượt đăng ký nào.
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell className="font-medium">{registration.employee.id}</TableCell>
                  <TableCell>{registration.employee.fullName}</TableCell>
                  <TableCell>{registration.tour.name}</TableCell>
                  <TableCell>{formatTransport(registration)}</TableCell>
                  <TableCell className="text-sm">
                    {registration.companions.length === 0 ? (
                      <span className="text-muted-foreground">Không có</span>
                    ) : (
                      <div className="space-y-2">
                        {registration.companions.map((companion) => (
                          <div key={companion.id} className="rounded border border-border/70 p-2 leading-relaxed">
                            <p className="font-medium">{companion.fullName}</p>
                            <p className="text-muted-foreground">Quan hệ: {companion.relationship}</p>
                            <p className="text-muted-foreground">Giới tính: {formatGender(companion.gender)}</p>
                            <p className="text-muted-foreground">Ngày sinh: {formatDate(companion.dob)}</p>
                            <p className="text-muted-foreground">Loại: {formatCompanionType(companion.type)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{countByType(registration.companions, 'adult')}</TableCell>
                  <TableCell>{countByType(registration.companions, 'child')}</TableCell>
                  <TableCell className="font-medium">{countTotalTickets(registration.companions)}</TableCell>
                  <TableCell>{currencyFormatter.format(registration.totalPrice)}</TableCell>
                  <TableCell>{formatDate(registration.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Số dòng mỗi trang</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-[84px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {totalPages > 1 && (
          <Pagination className={`sm:mx-0 sm:w-auto ${isLoading ? 'pointer-events-none opacity-60' : ''}`}>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    goToPage(page - 1)
                  }}
                />
              </PaginationItem>

              {getPageWindow(page, totalPages).map((token) =>
                typeof token === 'number' ? (
                  <PaginationItem key={token}>
                    <PaginationLink
                      href="#"
                      isActive={token === page}
                      onClick={(event) => {
                        event.preventDefault()
                        goToPage(token)
                      }}
                    >
                      {token}
                    </PaginationLink>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={token}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    goToPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}

export default RegistrationsTable
