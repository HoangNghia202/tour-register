import { useEffect, useState } from 'react'
import { AlertCircle, Calendar, FileText, MapPin, Users } from 'lucide-react'
import type { Employee, Tour } from '../../types/domain'
import { getToursByDestination } from '../../lib/api'
import { createClient } from '../../lib/supabase/client'
import { Alert, AlertDescription } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card'

interface TourSelectionScreenProps {
  employee: Employee
  onTourSelected: (tour: Tour) => void
}

const destinationLabels: Record<Tour['destination'], string> = {
  da_lat: 'Đà Lạt',
  nha_trang: 'Nha Trang',
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function TourCard({
  tour,
  onSelect,
}: {
  tour: Tour
  onSelect: (tour: Tour) => void
}) {
  const remaining = tour.maxCapacity - tour.registeredCount
  const isFull = tour.registeredCount >= tour.maxCapacity

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <img
          src={tour.imageUrl}
          alt={tour.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <Badge
          variant={isFull ? 'destructive' : 'default'}
          className="absolute right-3 top-3 shadow"
        >
          {`Còn lại ${remaining}/${tour.maxCapacity} chỗ`}
        </Badge>
      </div>

      <CardHeader className="gap-2 pb-3">
        <CardTitle className="text-lg">{tour.name}</CardTitle>
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            {destinationLabels[tour.destination]}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            {`${formatDate(tour.startDate)} – ${formatDate(tour.endDate)}`}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <a
          href={tour.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <FileText className="h-4 w-4 shrink-0" />
          Xem lịch trình Tour / Địa điểm du lịch (PDF)
        </a>
      </CardContent>

      <CardFooter className="mt-auto pt-0">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={isFull}
          onClick={() => onSelect(tour)}
        >
          <Users className="h-4 w-4" />
          {isFull ? 'Đã hết chỗ' : 'Đăng ký'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function TourSelectionScreen({ employee, onTourSelected }: TourSelectionScreenProps) {
  const [tours, setTours] = useState<Tour[] | null>(null)
  const [error, setError] = useState(false)

  const load = async () => {
    setError(false)
    setTours(null)
    try {
      const data = await getToursByDestination(employee.destination)
      setTours(data)
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.destination])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`tours-${employee.destination}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tours',
          filter: `destination=eq.${employee.destination}`,
        },
        (payload) => {
          const updated = payload.new as Tour
          setTours((prev) =>
            prev ? prev.map((tour) => (tour.id === updated.id ? { ...tour, ...updated } : tour)) : prev,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employee.destination])

  if (error) {
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Chọn tour du lịch</h2>
        <p className="text-sm text-muted-foreground">
          {`Điểm đến của bạn: ${destinationLabels[employee.destination]}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tours.map((tour) => (
          <TourCard key={tour.id} tour={tour} onSelect={onTourSelected} />
        ))}
      </div>
    </div>
  )
}

export default TourSelectionScreen
