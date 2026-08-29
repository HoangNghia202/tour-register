import { Controller, useWatch, type Control } from 'react-hook-form'
import type { RegistrationFormValues } from './RegistrationFormScreen'
import type { PickupPoint } from '../../types/domain'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface TransportSectionProps {
  control: Control<RegistrationFormValues>
}

const pickupPoints: PickupPoint[] = [
  'Hà Tĩnh',
  'Quảng Bình',
  'Quảng Trị',
  'TP. Huế',
  'Đà Nẵng',
  'Quảng Nam',
  'Quảng Ngãi',
]

function TransportSection({ control }: TransportSectionProps) {
  const transportMethod = useWatch({ control, name: 'transportMethod' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Phương tiện di chuyển</h3>
      </div>

      <Controller
        control={control}
        name="transportMethod"
        render={({ field }) => (
          <RadioGroup
            className="flex flex-col gap-3"
            value={field.value}
            onValueChange={field.onChange}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="self" id="transport-self" />
              <Label htmlFor="transport-self" className="font-normal">
                Tự túc
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="tour_bus" id="transport-bus" />
              <Label htmlFor="transport-bus" className="font-normal">
                Di chuyển theo Xe Tour
              </Label>
            </div>
          </RadioGroup>
        )}
      />

      {transportMethod === 'tour_bus' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pickup-point" required>Điểm đón</Label>
          <Controller
            control={control}
            name="pickupPoint"
            render={({ field, fieldState }) => (
              <>
                <Select
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="pickup-point" className="w-full">
                    <SelectValue placeholder="Chọn điểm đón" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupPoints.map((point) => (
                      <SelectItem key={point} value={point}>
                        {point}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && (
                  <p className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      )}
    </div>
  )
}

export default TransportSection
