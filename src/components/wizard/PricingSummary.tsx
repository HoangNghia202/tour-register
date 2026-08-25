import type { Companion, Tour } from '../../types/domain'
import { calculateTotal, classifyAge } from '../../lib/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface PricingSummaryProps {
  companions: Companion[]
  tour: Tour
}

function formatVnd(value: number): string {
  return value.toLocaleString('vi-VN')
}

const typeLabels: Record<Companion['type'], string> = {
  adult: 'adult',
  child: 'child',
}

function PricingSummary({ companions, tour }: PricingSummaryProps) {
  const total = calculateTotal(companions, tour)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Chi phí dự kiến</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Chi phí Nhân viên:</span>
          <span className="font-medium">0 VNĐ</span>
        </div>

        {companions.map((companion) => {
          const type = classifyAge(companion.dob)
          const price = type === 'adult' ? tour.adultPrice : tour.childPrice
          const name = companion.fullName.trim() || 'Người thân'
          return (
            <div key={companion.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">
                {`${name} (${typeLabels[type]}):`}
              </span>
              <span className="shrink-0 font-medium">{`${formatVnd(price)} VNĐ`}</span>
            </div>
          )
        })}

        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <span className="font-semibold">TỔNG TIỀN DỰ KIẾN:</span>
          <span className="text-lg font-bold text-primary">{`${formatVnd(total)} VNĐ`}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default PricingSummary
