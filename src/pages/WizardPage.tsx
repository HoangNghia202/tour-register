import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { findEmployeeById, findRegistrationByEmployeeId, getTourById } from '../lib/api'
import type { Employee, Registration, Tour } from '../types/domain'
import WizardLayout from '../components/wizard/WizardLayout'
import WelcomeScreen from '../components/wizard/WelcomeScreen'
import TourSelectionScreen from '../components/wizard/TourSelectionScreen'
import RegistrationFormScreen from '../components/wizard/RegistrationFormScreen'
import TicketScreen from '../components/wizard/TicketScreen'

export type WizardStep = 'welcome' | 'tours' | 'register' | 'ticket'

const stepLabels: Record<WizardStep, string> = {
  welcome: 'welcome',
  tours: 'tours',
  register: 'register',
  ticket: 'ticket',
}

function WizardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { employeeId, tourId } = useParams<{ employeeId?: string; tourId?: string }>()

  const [isLoadingRouteData, setIsLoadingRouteData] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)

  const currentStep = useMemo<WizardStep>(() => {
    if (location.pathname.startsWith('/select-tour/')) return 'tours'
    if (location.pathname.startsWith('/register/')) return 'register'
    if (location.pathname.startsWith('/ticket/')) return 'ticket'
    return 'welcome'
  }, [location.pathname])

  useEffect(() => {
    setSelectedTour(null)
    setRegistration(null)
  }, [employeeId])

  useEffect(() => {
    if (currentStep === 'welcome') {
      setEmployee(null)
      setSelectedTour(null)
      setRegistration(null)
      setRouteError(null)
      return
    }

    if (!employeeId) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false
    setRouteError(null)
    setIsLoadingRouteData(true)

    findEmployeeById(employeeId)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setRouteError('Không tìm thấy nhân viên tương ứng với đường dẫn này.')
          return
        }
        setEmployee(result)
      })
      .catch(() => {
        if (!cancelled) setRouteError('Có lỗi xảy ra, vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRouteData(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentStep, employeeId, navigate])

  useEffect(() => {
    if (currentStep !== 'register') return
    if (!tourId) {
      navigate(employee ? `/select-tour/${employee.id}` : '/', { replace: true })
      return
    }

    let cancelled = false
    setRouteError(null)
    setIsLoadingRouteData(true)

    getTourById(tourId)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setRouteError('Không tìm thấy tour tương ứng với đường dẫn này.')
          return
        }
        setSelectedTour(result)
      })
      .catch(() => {
        if (!cancelled) setRouteError('Có lỗi xảy ra, vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRouteData(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentStep, employee, navigate, tourId])

  useEffect(() => {
    if (currentStep !== 'ticket') return
    if (!employee) return
    if (registration) return

    let cancelled = false
    setRouteError(null)
    setIsLoadingRouteData(true)

    findRegistrationByEmployeeId(employee.id)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          navigate(`/select-tour/${employee.id}`, { replace: true })
          return
        }
        setRegistration(result)
      })
      .catch(() => {
        if (!cancelled) setRouteError('Có lỗi xảy ra, vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRouteData(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentStep, employee, navigate, registration])

  if (routeError) {
    return (
      <WizardLayout currentStep={currentStep}>
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-destructive">{routeError}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => navigate('/', { replace: true })}
          >
            Quay lại nhập MSNV
          </button>
        </div>
      </WizardLayout>
    )
  }

  if (isLoadingRouteData) {
    return (
      <WizardLayout currentStep={currentStep}>
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </WizardLayout>
    )
  }

  return (
    <WizardLayout currentStep={currentStep}>
      {currentStep === 'welcome' ? (
        <WelcomeScreen
          onVerified={(nextEmployee, existingRegistration) => {
            setEmployee(nextEmployee)
            if (existingRegistration) {
              setRegistration(existingRegistration)
              navigate(`/ticket/${nextEmployee.id}`)
            } else {
              setRegistration(null)
              navigate(`/select-tour/${nextEmployee.id}`)
            }
          }}
        />
      ) : currentStep === 'tours' && employee ? (
        <TourSelectionScreen
          employee={employee}
          onTourSelected={(tour) => {
            setSelectedTour(tour)
            navigate(`/register/${employee.id}/${tour.id}`)
          }}
        />
      ) : currentStep === 'register' && employee && selectedTour ? (
        <RegistrationFormScreen
          employee={employee}
          tour={selectedTour}
          onSubmitted={(nextRegistration) => {
            setRegistration(nextRegistration)
            navigate(`/ticket/${employee.id}`)
          }}
        />
      ) : currentStep === 'ticket' && employee && registration ? (
        <TicketScreen employee={employee} registration={registration} />
      ) : (
        <p className="text-center text-lg font-medium capitalize text-foreground">
          {stepLabels[currentStep]} step
        </p>
      )}
    </WizardLayout>
  )
}

export default WizardPage
