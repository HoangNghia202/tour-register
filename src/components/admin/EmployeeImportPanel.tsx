import { useRef, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Destination, Employee } from '@/types/domain'
import { importEmployees, SessionExpiredError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

type EmployeeRow = Omit<Employee, never>

interface RowError {
  row: number
  message: string
}

interface ParseOutcome {
  rows: EmployeeRow[]
  skipped: number
  errors: RowError[]
}

interface ImportResult {
  imported: number
  errors: RowError[]
}

// DS1 template: headers on row 4, data from row 5. Columns are read by position.
const HEADER_ROWS = 4
const COL = {
  storeId: 3, // D — Mã Siêu Thị
  store: 4, // E — Tên Siêu Thị
  id: 5, // F — Mã Nhân Viên
  fullName: 6, // G — Tên Nhân Viên
  destination: 9, // J — ĐIỂM ĐẾN
} as const

function cell(row: unknown[], index: number): string {
  const value = row[index]
  return value == null ? '' : String(value).trim()
}

function mapDestination(raw: string): Destination | null {
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ')
  if (normalized.includes('đà lạt')) return 'da_lat'
  if (normalized.includes('nha trang')) return 'nha_trang'
  return null
}

function parseSheet(rows: unknown[][]): ParseOutcome {
  const outcome: ParseOutcome = { rows: [], skipped: 0, errors: [] }

  for (let i = HEADER_ROWS; i < rows.length; i += 1) {
    const raw = rows[i] ?? []
    const excelRow = i + 1

    const storeId = cell(raw, COL.storeId)
    const store = cell(raw, COL.store)
    const id = cell(raw, COL.id)
    const fullName = cell(raw, COL.fullName)
    const destinationRaw = cell(raw, COL.destination)

    // Blank row — ignore entirely.
    if (!storeId && !store && !id && !fullName && !destinationRaw) continue

    // No destination = nhân viên không tham gia du lịch — skip, don't flag as error.
    if (!destinationRaw) {
      outcome.skipped += 1
      continue
    }

    const destination = mapDestination(destinationRaw)
    if (!destination) {
      outcome.errors.push({ row: excelRow, message: `ĐIỂM ĐẾN không hợp lệ: "${destinationRaw}"` })
      continue
    }

    const missing: string[] = []
    if (!id) missing.push('Mã Nhân Viên')
    if (!fullName) missing.push('Tên Nhân Viên')
    if (!storeId) missing.push('Mã Siêu Thị')
    if (!store) missing.push('Tên Siêu Thị')
    if (missing.length > 0) {
      outcome.errors.push({ row: excelRow, message: `Thiếu ${missing.join(', ')}` })
      continue
    }

    outcome.rows.push({ id, fullName, storeId, store, destination })
  }

  return outcome
}

interface EmployeeImportPanelProps {
  onSessionExpired: () => void
}

function EmployeeImportPanel({ onSessionExpired }: EmployeeImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parse, setParse] = useState<ParseOutcome | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setResult(null)
    setParseError(null)
    setImportError(null)
    setParse(null)

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!firstSheet) {
        setParseError('File không có sheet dữ liệu nào.')
        return
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: '',
        raw: false,
      })
      const outcome = parseSheet(rows)

      if (outcome.rows.length === 0) {
        setParseError(
          'Không tìm thấy nhân viên hợp lệ trong file. Kiểm tra lại template (tên cột ở hàng 4, dữ liệu từ hàng 5).',
        )
        return
      }

      setParse(outcome)
    } catch {
      setParseError('Không thể đọc file. Vui lòng chọn file .xlsx hợp lệ.')
    }
  }

  const handleImport = async () => {
    if (!parse || isImporting) return

    setIsImporting(true)
    setImportError(null)

    try {
      const res = await importEmployees(parse.rows)
      setResult({ imported: res.imported, errors: [...parse.errors, ...res.errors] })
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        onSessionExpired()
        return
      }
      setImportError('Không thể import nhân viên. Vui lòng thử lại.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Import nhân viên</h2>
        <p className="text-sm text-muted-foreground">
          Chọn file Excel (.xlsx) theo template DS1. Tên cột ở hàng 4, dữ liệu từ hàng 5. Các cột
          được dùng: Mã Siêu Thị (D), Tên Siêu Thị (E), Mã Nhân Viên (F), Tên Nhân Viên (G), ĐIỂM
          ĐẾN (J). Dòng không có điểm đến sẽ được bỏ qua. Nhân viên đã có sẽ được cập nhật, chưa có
          thì thêm mới.
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
        <Button type="button" onClick={handleImport} disabled={!parse || isImporting}>
          {isImporting ? 'Đang import...' : 'Import'}
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

      {importError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      {parse && !result && (
        <div className="flex flex-col gap-3">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Đọc được {parse.rows.length} nhân viên
              {parse.skipped > 0 && ` · Bỏ qua ${parse.skipped} dòng không tham gia`}
              {parse.errors.length > 0 && ` · ${parse.errors.length} dòng lỗi`}
            </AlertDescription>
          </Alert>

          {parse.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Các dòng lỗi sẽ bị bỏ qua khi import:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parse.errors.slice(0, 50).map((error, index) => (
                    <li key={`${error.row}-${index}`}>
                      Dòng {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
                {parse.errors.length > 50 && (
                  <p className="mt-1">… và {parse.errors.length - 50} dòng lỗi khác.</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
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
                  {result.errors.slice(0, 50).map((error, index) => (
                    <li key={`${error.row}-${index}`}>
                      Dòng {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
                {result.errors.length > 50 && (
                  <p className="mt-1">… và {result.errors.length - 50} dòng lỗi khác.</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

export default EmployeeImportPanel
