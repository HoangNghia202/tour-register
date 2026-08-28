import type { PickupPoint, TransportMethod } from '../../types/domain'
import { calculateTotal } from '../../lib/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {InfoIcon} from "lucide-react";

interface PricingSummaryProps {
  routePrice: number | undefined
  transportMethod: TransportMethod
  pickupPoint: PickupPoint | null
  adultCount: number
  hasChild: boolean
  isLoading: boolean
}

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')} VNĐ`
}

function PricingSummary({
  routePrice,
  transportMethod,
  pickupPoint,
  adultCount,
  hasChild,
  isLoading,
}: PricingSummaryProps) {
  const routeLabel = transportMethod === 'self' ? 'Tự túc' : pickupPoint ?? 'Chưa chọn điểm đón'
  const ticketCount = 1 + adultCount
  const total = routePrice === undefined ? undefined : calculateTotal(routePrice, adultCount)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Chi phí dự kiến</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Lộ trình đón:</span>
          <span className="font-medium">{routeLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Đơn giá / vé:</span>
          <span className="font-medium">
            {routePrice === undefined ? '—' : formatVnd(routePrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Số vé (nhân viên + người lớn):</span>
          <span className="font-medium">{ticketCount}</span>
        </div>
        {hasChild && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trẻ em:</span>
            <span className="font-medium">Không tính phí</span>
          </div>
        )}

        <div className="mt-2  items-center justify-between border-t pt-3">
          <div className="flex items-start text-xs text-blue-600 mb-4">
            <InfoIcon size={14} className="mr-2" />
            <span>Đây là Số Tiền Chi Phí TOUR tam tính, chưa bao gồm: Chi Phí cho Trẻ Em trên 5 tuổi (50% giá vé)  và Khấu trừ Tiền hỗ hỗ trừ Công Ty.</span>
          </div>

          <div className="flex items-center justify-between">

            <span className="font-semibold">TỔNG TIỀN DỰ KIẾN:</span>
            <span className="text-lg font-bold text-primary">
            {total === undefined ? '—' : formatVnd(total)}
          </span>
          </div>
        </div>


        {isLoading ? (
          <p className="text-xs text-muted-foreground">Đang tải bảng giá...</p>
        ) : routePrice === undefined ? (
          <p className="text-xs text-muted-foreground">
            {transportMethod === 'tour_bus' && !pickupPoint
              ? 'Chọn điểm đón để xem giá.'
              : 'Chưa có giá cho lộ trình này, vui lòng liên hệ quản trị.'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default PricingSummary
