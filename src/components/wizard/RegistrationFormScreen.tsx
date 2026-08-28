import { useState } from 'react'
import { AlertCircle, ClipboardList } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Companion, Employee, Registration, Tour } from '../../types/domain'
import { classifyAge } from '../../lib/pricing'
import { submitRegistration } from '../../lib/api'
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
}

function RegistrationFormScreen({ tour, employee, onSubmitted }: RegistrationFormScreenProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)

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

    const result = await submitRegistration({
      employeeId: employee.id,
      tourId: tour.id,
      transportMethod: values.transportMethod,
      pickupPoint: values.pickupPoint,
      companions,
    })

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
          Thông tin đăng ký
        </h2>
        <p className="text-sm text-muted-foreground">{tour.name}</p>
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Trường bắt buộc
        </p>
      </div>

      <CompanionFieldArray control={control} />

      <TransportSection control={control} />

      <PricingSummary companions={displayCompanions} tour={tour} />

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
