import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { getAllRegistrationsWithDetails } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

function RegistrationsTable() {
  const registrations = getAllRegistrationsWithDetails()

  const handleExport = () => {
    const rows = registrations.map((registration) => ({
      MSNV: registration.employee.id,
      'Họ tên': registration.employee.fullName,
      Tour: registration.tour.name,
      'Số người lớn đi kèm': countByType(registration.companions, 'adult'),
      'Số trẻ em đi kèm': countByType(registration.companions, 'child'),
      'Tổng tiền': registration.totalPrice,
      'Ngày đăng ký': formatDate(registration.createdAt),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Đăng ký')
    XLSX.writeFile(workbook, 'danh-sach-dang-ky.xlsx')
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
        <Button type="button" onClick={handleExport} disabled={registrations.length === 0}>
          <Download className="h-4 w-4" />
          Xuất Excel
        </Button>
      </div>

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
