import { useState } from 'react'
import type { Tour } from '@/types/domain'
import { getAllTours, updateTourConfig } from '@/lib/mockData'
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

function TourConfigTable() {
  const tours = getAllTours()
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(tours.map((tour) => [tour.id, toRowState(tour)])),
  )
  const [savedId, setSavedId] = useState<string | null>(null)

  const updateField = (tourId: string, field: keyof RowState, value: string) => {
    setRows((prev) => ({ ...prev, [tourId]: { ...prev[tourId], [field]: value } }))
    if (savedId === tourId) setSavedId(null)
  }

  const handleSave = (tour: Tour) => {
    const row = rows[tour.id]
    updateTourConfig(tour.id, {
      maxCapacity: Number(row.maxCapacity),
      adultPrice: Number(row.adultPrice),
      childPrice: Number(row.childPrice),
    })
    setSavedId(tour.id)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Cấu hình Tour</h2>
        <p className="text-sm text-muted-foreground">
          Chỉnh sức chứa và giá vé cho từng tour, sau đó nhấn Lưu.
        </p>
      </div>

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
                      <Button type="button" size="sm" onClick={() => handleSave(tour)}>
                        Lưu
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
