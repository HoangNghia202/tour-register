import { useRef, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Destination, Employee } from '@/types/domain'
import { importEmployees } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ImportResult {
  imported: number
  errors: Array<{ row: number; message: string }>
}

type SheetRow = Record<string, unknown>

function toEmployeeRow(row: SheetRow): Omit<Employee, never> {
  return {
    id: String(row['MSNV'] ?? '').trim(),
    fullName: String(row['Họ tên'] ?? '').trim(),
    department: String(row['Bộ phận'] ?? '').trim(),
    store: String(row['Siêu thị'] ?? '').trim(),
    destination: String(row['Điểm đến'] ?? '').trim() as Destination,
  }
}

function EmployeeImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [pendingRows, setPendingRows] = useState<Array<Omit<Employee, never>> | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setResult(null)
    setParseError(null)
    setPendingRows(null)

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<SheetRow>(firstSheet)
      setPendingRows(rows.map(toEmployeeRow))
    } catch {
      setParseError('Không thể đọc file. Vui lòng chọn file .xlsx hợp lệ.')
    }
  }

  const handleImport = () => {
    if (!pendingRows) return
    setResult(importEmployees(pendingRows))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Import nhân viên</h2>
        <p className="text-sm text-muted-foreground">
          Chọn file Excel (.xlsx) với các cột: MSNV, Họ tên, Bộ phận, Siêu thị, Điểm đến.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="sm:max-w-sm"
        />
        <Button type="button" onClick={handleImport} disabled={!pendingRows}>
          Import
        </Button>
      </div>

      {fileName && !parseError && (
        <p className="text-sm text-muted-foreground">Đã chọn: {fileName}</p>
      )}

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Đã import {result.imported} nhân viên</AlertDescription>
          </Alert>

          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Có {result.errors.length} dòng lỗi:</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.errors.map((error) => (
                    <li key={error.row}>
                      Dòng {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

export default EmployeeImportPanel
