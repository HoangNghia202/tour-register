import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download } from 'lucide-react'
import type { Employee, Registration } from '../../types/domain'
import { getTourById } from '../../lib/mockData'
import { Button } from '../ui/button'
import EventTicket from '../ticket/EventTicket'

interface TicketScreenProps {
  employee: Employee
  registration: Registration
}

function TicketScreen({ employee, registration }: TicketScreenProps) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const tour = getTourById(registration.tourId)

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
        backgroundColor: '#ffffff',
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
    </div>
  )
}

export default TicketScreen
