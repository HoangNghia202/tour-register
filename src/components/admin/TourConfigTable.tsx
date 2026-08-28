import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Destination, DestinationPricing, RouteKey, Tour } from '@/types/domain'
import {
  getAllDestinationPricing,
  getAllTours,
  updateDestinationPrice,
  updateTourConfig,
  SessionExpiredError,
} from '@/lib/api'
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

const ROUTES: Array<{ key: RouteKey; label: string }> = [
  { key: 'self', label: 'Tự túc' },
  { key: 'Hà Tĩnh', label: 'Hà Tĩnh' },
  { key: 'Quảng Bình', label: 'Quảng Bình' },
  { key: 'Quảng Trị', label: 'Quảng Trị' },
  { key: 'TP. Huế', label: 'TP. Huế' },
  { key: 'Đà Nẵng', label: 'Đà Nẵng' },
  { key: 'Quảng Nam', label: 'Quảng Nam' },
  { key: 'Quảng Ngãi', label: 'Quảng Ngãi' },
]

interface TourMetaState {
  name: string
  startDate: string
  endDate: string
  maxCapacity: string
}

function toMetaState(tour: Tour): TourMetaState {
  return {
    name: tour.name,
    startDate: tour.startDate,
    endDate: tour.endDate,
    maxCapacity: String(tour.maxCapacity),
  }
}

function priceKey(destination: Destination, route: string): string {
  return `${destination}::${route}`
}

interface TourConfigTableProps {
  onSessionExpired: () => void
}

function TourConfigTable({ onSessionExpired }: TourConfigTableProps) {
  const [tours, setTours] = useState<Tour[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [meta, setMeta] = useState<Record<string, TourMetaState>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = async () => {
    setLoadError(false)
    try {
      const [tourData, priceData] = await Promise.all([
        getAllTours(),
        getAllDestinationPricing(),
      ])
      setTours(tourData)
      setMeta(Object.fromEntries(tourData.map((tour) => [tour.id, toMetaState(tour)])))
      setPrices(
        Object.fromEntries(
          priceData.map((row: DestinationPricing) => [
            priceKey(row.destination, row.pickupPoint),
            String(row.price),
          ]),
        ),
      )
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleError = (err: unknown, fallbackMsg: string): boolean => {
    if (err instanceof SessionExpiredError) {
      onSessionExpired()
      return true
    }
    setRowError(fallbackMsg)
    return false
  }

  const updateMetaField = (tourId: string, field: keyof TourMetaState, value: string) => {
    setMeta((prev) => ({ ...prev, [tourId]: { ...prev[tourId], [field]: value } }))
    if (savedId === tourId) setSavedId(null)
  }

  const updatePriceField = (key: string, value: string) => {
    setPrices((prev) => ({ ...prev, [key]: value }))
    if (savedId === key) setSavedId(null)
  }

  const handleSaveMeta = async (tour: Tour) => {
    const row = meta[tour.id]
    setSavingId(tour.id)
    setRowError(null)
    try {
      await updateTourConfig(tour.id, {
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        maxCapacity: Number(row.maxCapacity),
      })
      setSavedId(tour.id)
      await load()
    } catch (err) {
      handleError(err, 'Không thể lưu cấu hình tour. Vui lòng thử lại.')
    } finally {
      setSavingId(null)
    }
  }

  const handleSavePrice = async (destination: Destination, route: RouteKey) => {
    const key = priceKey(destination, route)
    const raw = prices[key]
    if (raw === undefined || raw.trim() === '') {
      setRowError('Vui lòng nhập giá hợp lệ.')
      return
    }
    setSavingId(key)
    setRowError(null)
    try {
      await updateDestinationPrice(destination, route, Number(raw))
      setSavedId(key)
      await load()
    } catch (err) {
      handleError(err, 'Không thể lưu giá lộ trình. Vui lòng thử lại.')
    } finally {
      setSavingId(null)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Không thể tải cấu hình. Vui lòng thử lại.</AlertDescription>
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
          Chỉnh thông tin tour (tên, ngày, sức chứa) và giá vé theo lộ trình đón. Giá lộ
          trình áp dụng chung cho tất cả tour cùng điểm đến.
        </p>
      </div>

      {rowError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{rowError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        {tours.map((tour) => {
          const row = meta[tour.id]
          if (!row) return null
          return (
            <div key={tour.id} className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Tour / Lộ trình</TableHead>
                    <TableHead className="min-w-[320px]">Cấu hình</TableHead>
                    <TableHead className="min-w-[120px]">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell className="align-top font-semibold">
                      {tour.name}
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        Đã đăng ký: {tour.registeredCount}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Tên tour
                          <Input
                            value={row.name}
                            onChange={(e) => updateMetaField(tour.id, 'name', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Sức chứa
                          <Input
                            type="number"
                            min={0}
                            value={row.maxCapacity}
                            onChange={(e) => updateMetaField(tour.id, 'maxCapacity', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Ngày bắt đầu
                          <Input
                            type="date"
                            value={row.startDate}
                            onChange={(e) => updateMetaField(tour.id, 'startDate', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Ngày kết thúc
                          <Input
                            type="date"
                            value={row.endDate}
                            onChange={(e) => updateMetaField(tour.id, 'endDate', e.target.value)}
                          />
                        </label>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveMeta(tour)}
                          disabled={savingId === tour.id}
                        >
                          {savingId === tour.id ? 'Đang lưu...' : 'Lưu tour'}
                        </Button>
                        {savedId === tour.id && (
                          <span className="text-xs font-medium text-emerald-600">Đã lưu</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {ROUTES.map((route) => {
                    const key = priceKey(tour.destination, route.key)
                    return (
                      <TableRow key={key}>
                        <TableCell className="pl-8 text-sm text-muted-foreground">
                          {route.label}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={prices[key] ?? ''}
                            onChange={(e) => updatePriceField(key, e.target.value)}
                            className="max-w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSavePrice(tour.destination, route.key)}
                              disabled={savingId === key}
                            >
                              {savingId === key ? 'Đang lưu...' : 'Lưu giá'}
                            </Button>
                            {savedId === key && (
                              <span className="text-xs font-medium text-emerald-600">Đã lưu</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {tour.destination === 'nha_trang' && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Giá áp dụng chung cho tất cả tour Nha Trang.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TourConfigTable
