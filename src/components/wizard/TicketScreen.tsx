import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useNavigate } from 'react-router-dom'
import { Download, RotateCcw } from 'lucide-react'
import type { Employee, Registration, Tour } from '../../types/domain'
import { getTourById } from '../../lib/api'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import EventTicket from '../ticket/EventTicket'

interface TicketScreenProps {
  employee: Employee
  registration: Registration
}

function TicketScreen({ employee, registration }: TicketScreenProps) {
  const navigate = useNavigate()
  const ticketRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [confirmingResubmit, setConfirmingResubmit] = useState(false)
  const [tour, setTour] = useState<Tour | null | undefined>(undefined)

  const canResubmit = registration.resubmitCount < 1

  useEffect(() => {
    let cancelled = false

    getTourById(registration.tourId)
      .then((result) => {
        if (!cancelled) setTour(result ?? null)
      })
      .catch(() => {
        if (!cancelled) setTour(null)
      })

    return () => {
      cancelled = true
    }
  }, [registration.tourId])

  if (tour === undefined) {
    return <p className="text-center text-sm text-muted-foreground">Đang tải...</p>
  }

  if (!tour) {
    return (
      <p className="text-center text-sm text-destructive">
        Không tìm thấy thông tin tour cho vé mời này.
      </p>
    )
  }

  const handleDownload = async () => {
    if (!ticketRef.current) return
    setIsDownloading(true)
    try {
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0b1f2e',
      })
      const link = document.createElement('a')
      link.download = `ve-moi-${employee.id}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <EventTicket
        ref={ticketRef}
        employee={employee}
        tour={tour}
        registration={registration}
      />

      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        <Download className="h-4 w-4" />
        {isDownloading ? 'Đang tạo ảnh...' : 'Tải ảnh vé (.png)'}
      </Button>

      {canResubmit && (
        <Dialog open={confirmingResubmit} onOpenChange={setConfirmingResubmit}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4" />
              Đăng ký lại
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Đăng ký lại thông tin?</DialogTitle>
              <DialogDescription>
                Bạn chỉ được đăng ký lại <strong>1 lần duy nhất</strong>. Toàn bộ thông tin đăng ký
                hiện tại sẽ bị xóa và thay bằng thông tin bạn nhập lại.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Huỷ
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={() => navigate(`/select-tour/${employee.id}?resubmit=1`)}
              >
                Tiếp tục đăng ký lại
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default TicketScreen
