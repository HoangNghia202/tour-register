import { forwardRef } from 'react'
import type { Employee, Registration, Tour } from '../../types/domain'
import './ticket.less'

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export interface EventTicketProps {
  employee: Employee
  tour: Tour
  registration: Registration
}

const infoRows = (
  employee: Employee,
  tour: Tour,
  registration: Registration,
): Array<{ label: string; value: string }> => [
  { label: 'Mã số Nhân viên', value: employee.id },
  { label: 'Mã siêu thị', value: employee.storeId },
  { label: 'Siêu thị', value: employee.store },
  { label: 'Tên Tour', value: tour.name },
  { label: 'Ngày khởi hành', value: formatDate(tour.startDate) },
  { label: 'Địa điểm đón', value: registration.pickupPoint ?? 'Tự túc' },
]

const EventTicket = forwardRef<HTMLDivElement, EventTicketProps>(
  ({ employee, tour, registration }, ref) => {
    return (
      <div ref={ref} className="event-ticket">
        <div className="event-ticket__logos">
          <img
            src="/logo.png"
            alt="Logo HNO+"
            className="event-ticket__logo event-ticket__logo--hno"
          />
        </div>

        <div className="event-ticket__title">
          <p className="event-ticket__title-main">VÉ MỜI SỰ KIỆN 2026</p>
          <p className="event-ticket__title-sub">Tour Du Lịch Vùng Trung Bộ 2026</p>
        </div>

        <p className="event-ticket__name">{employee.fullName}</p>

        <dl className="event-ticket__info-table">
          {infoRows(employee, tour, registration).map((row) => (
            <div key={row.label} className="event-ticket__info-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="event-ticket__tagline">
          <p className="event-ticket__tagline-line">VƯỢT ĐỈNH IPO VƯƠN TẦM KHU VỰC</p>
          <p className="event-ticket__tagline-line">MỖI NĂM VƯỢT TRỘI</p>
          <p className="event-ticket__tagline-line">5 NĂM NHÂN ĐÔI GIÁ TRỊ</p>
        </div>

        <div className="event-ticket__welcome">
          <p>Hãy cùng chúng tôi tạo nên những khoảnh khắc đáng nhớ!</p>
          <p>Chào mừng bạn đến với siêu sự kiện du lịch 2026 vùng HNO+</p>
        </div>
      </div>
    )
  },
)

EventTicket.displayName = 'EventTicket'

export default EventTicket
