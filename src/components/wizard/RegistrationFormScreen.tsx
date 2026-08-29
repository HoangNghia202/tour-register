import { useEffect, useState } from 'react'
import { AlertCircle, ClipboardList } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Companion, Employee, Registration, Tour } from '../../types/domain'
import { classifyAge, countAdults, resolveRouteKey } from '../../lib/pricing'
import { getDestinationPricing, submitRegistration } from '../../lib/api'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import CompanionFieldArray from './CompanionFieldArray'
import TransportSection from './TransportSection'
import PricingSummary from './PricingSummary'

const companionSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  dob: z.string().min(1, 'Vui lòng nhập ngày sinh'),
  gender: z.enum(['male', 'female']),
  relationship: z.string().min(1, 'Vui lòng nhập mối quan hệ'),
})

export const registrationFormSchema = z
  .object({
    companions: z
      .array(companionSchema)
      .max(6)
      .superRefine((companions, ctx) => {
        let childCount = 0
        let adultCount = 0
        companions.forEach((companion, index) => {
          if (!companion?.dob) return
          if (classifyAge(companion.dob) === 'child') {
            childCount += 1
            if (childCount > 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Đã đủ số lượng trẻ em tối đa (2)',
                path: [index, 'dob'],
              })
            }
          } else {
            adultCount += 1
            if (adultCount > 4) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Đã đủ số lượng người lớn tối đa (4)',
                path: [index, 'dob'],
              })
            }
          }
        })
      }),
    transportMethod: z.enum(['self', 'tour_bus']),
    pickupPoint: z
      .enum(['Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'TP. Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi'])
      .nullable(),
    confirmed: z.literal(true, { errorMap: () => ({ message: 'Vui lòng xác nhận thông tin' }) }),
  })
  .refine((data) => data.transportMethod !== 'tour_bus' || data.pickupPoint !== null, {
    message: 'Vui lòng chọn điểm đón',
    path: ['pickupPoint'],
  })

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>

interface RegistrationFormScreenProps {
  employee: Employee
  tour: Tour
  onSubmitted: (registration: Registration) => void
  /** true khi nhân viên đang dùng lượt "đăng ký lại" — sẽ ghi đè đăng ký cũ. */
  resubmit?: boolean
}

function RegistrationFormScreen({ tour, employee, onSubmitted, resubmit = false }: RegistrationFormScreenProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<Record<string, number> | null>(null)
  const [pricingError, setPricingError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPricingError(false)
    getDestinationPricing(tour.destination)
      .then((result) => {
        if (!cancelled) setPricing(result)
      })
      .catch(() => {
        if (!cancelled) setPricingError(true)
      })
    return () => {
      cancelled = true
    }
  }, [tour.destination])

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    mode: 'onChange',
    defaultValues: {
      companions: [],
      transportMethod: 'self',
      pickupPoint: null,
      confirmed: false as unknown as true,
    },
  })

  const watchedCompanions = useWatch({ control, name: 'companions' }) ?? []

  const displayCompanions: Companion[] = watchedCompanions
    .filter((companion) => Boolean(companion?.dob))
    .map((companion, index) => ({
      id: `preview-${index}`,
      fullName: companion.fullName,
      dob: companion.dob,
      gender: companion.gender,
      relationship: companion.relationship,
      type: classifyAge(companion.dob),
    }))

  const adultCount = countAdults(displayCompanions)
  const hasChild = displayCompanions.some((companion) => companion.type === 'child')

  const transportMethod = useWatch({ control, name: 'transportMethod' }) ?? 'self'
  const pickupPoint = useWatch({ control, name: 'pickupPoint' }) ?? null
  const routeKey = resolveRouteKey(transportMethod, pickupPoint)
  const routePrice = routeKey && pricing ? pricing[routeKey] : undefined
  const pricingLoading = pricing === null && !pricingError

  const onValidSubmit = async (values: RegistrationFormValues) => {
    setSubmitError(null)

    const companions: Companion[] = values.companions.map((companion) => ({
      id: crypto.randomUUID(),
      fullName: companion.fullName,
      dob: companion.dob,
      gender: companion.gender,
      relationship: companion.relationship,
      type: classifyAge(companion.dob),
    }))

    const result = await submitRegistration(
      {
        employeeId: employee.id,
        tourId: tour.id,
        transportMethod: values.transportMethod,
        pickupPoint: values.pickupPoint,
        companions,
      },
      { resubmit },
    )

    if (!result.ok) {
      setSubmitError(result.error)
      return
    }

    onSubmitted(result.registration)
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit(onValidSubmit)} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ClipboardList className="h-5 w-5 text-teal-900" />
          Thông tin đăng ký tour {tour.name}
        </h2>

      </div>

      {resubmit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Đây là lượt đăng ký lại. Khi bạn xác nhận, thông tin đăng ký trước đó sẽ bị thay thế
            hoàn toàn và bạn sẽ không thể đăng ký lại thêm lần nữa.
          </AlertDescription>
        </Alert>
      )}

      <CompanionFieldArray control={control} />

      <TransportSection control={control} />

      {pricingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Không tải được bảng giá, vui lòng tải lại trang.
          </AlertDescription>
        </Alert>
      )}

      <PricingSummary
        routePrice={routePrice}
        transportMethod={transportMethod}
        pickupPoint={pickupPoint}
        adultCount={adultCount}
        hasChild={hasChild}
        isLoading={pricingLoading}
      />

      <div className="flex items-start gap-3">
        <Controller
          control={control}
          name="confirmed"
          render={({ field }) => (
            <Checkbox
              id="confirmed"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="mt-0.5"
            />
          )}
        />
        <Label htmlFor="confirmed" required className="text-sm font-normal leading-snug">
          Tôi đã kiểm tra đầy đủ và xác nhận thông tin chính xác.
        </Label>
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? 'Đang xử lý...' : 'Xác nhận thông tin chính xác'}
      </Button>
    </form>
  )
}

export default RegistrationFormScreen
