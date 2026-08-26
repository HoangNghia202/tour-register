import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Tour } from '@/types/domain'
import { getAllTours, updateTourConfig, SessionExpiredError } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RowState {
  maxCapacity: string
  adultPrice: string
  childPrice: string
}

function toRowState(tour: Tour): RowState {
  return {
    maxCapacity: String(tour.maxCapacity),
    adultPrice: String(tour.adultPrice),
    childPrice: String(tour.childPrice),
  }
}

interface TourConfigTableProps {
  onSessionExpired: () => void
}

function TourConfigTable({ onSessionExpired }: TourConfigTableProps) {
  const [tours, setTours] = useState<Tour[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = async () => {
    setLoadError(false)
    try {
      const data = await getAllTours()
      setTours(data)
      setRows(Object.fromEntries(data.map((tour) => [tour.id, toRowState(tour)])))
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateField = (tourId: string, field: keyof RowState, value: string) => {
    setRows((prev) => ({ ...prev, [tourId]: { ...prev[tourId], [field]: value } }))
    if (savedId === tourId) setSavedId(null)
  }

  const handleSave = async (tour: Tour) => {
    const row = rows[tour.id]
    setSavingId(tour.id)
    setRowError(null)

    try {
      await updateTourConfig(tour.id, {
        maxCapacity: Number(row.maxCapacity),
        adultPrice: Number(row.adultPrice),
        childPrice: Number(row.childPrice),
      })
      setSavedId(tour.id)
      await load()
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        onSessionExpired()
        return
      }
      setRowError('Không thể lưu cấu hình tour. Vui lòng thử lại.')
    } finally {
      setSavingId(null)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Không thể tải danh sách tour. Vui lòng thử lại.</AlertDescription>
        </Alert>
        <Button type="button" onClick={load} className="self-start">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!tours) {
    return <p className="text-sm text-muted-foreground">Đang tải...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Cấu hình Tour</h2>
        <p className="text-sm text-muted-foreground">
          Chỉnh sức chứa và giá vé cho từng tour, sau đó nhấn Lưu.
        </p>
      </div>

      {rowError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{rowError}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Tour</TableHead>
              <TableHead className="min-w-[120px]">Sức chứa</TableHead>
              <TableHead className="min-w-[140px]">Giá người lớn</TableHead>
              <TableHead className="min-w-[140px]">Giá trẻ em</TableHead>
              <TableHead className="min-w-[120px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tours.map((tour) => {
              const row = rows[tour.id]
              return (
                <TableRow key={tour.id}>
                  <TableCell className="font-medium">{tour.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.maxCapacity}
                      onChange={(event) => updateField(tour.id, 'maxCapacity', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.adultPrice}
                      onChange={(event) => updateField(tour.id, 'adultPrice', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.childPrice}
                      onChange={(event) => updateField(tour.id, 'childPrice', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSave(tour)}
                        disabled={savingId === tour.id}
                      >
                        {savingId === tour.id ? 'Đang lưu...' : 'Lưu'}
                      </Button>
                      {savedId === tour.id && (
                        <span className="text-xs font-medium text-emerald-600">Đã lưu</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default TourConfigTable
