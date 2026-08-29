import { Plus, Trash2 } from 'lucide-react'
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
} from 'react-hook-form'
import type { RegistrationFormValues } from './RegistrationFormScreen'
import { classifyAge } from '../../lib/pricing'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface CompanionFieldArrayProps {
  control: Control<RegistrationFormValues>
}

const relationshipOptions = ['Vợ/Chồng', 'Con', 'Bố/Mẹ', 'Khác']

function CompanionFieldArray({ control }: CompanionFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'companions',
  })

  const companions = useWatch({ control, name: 'companions' }) ?? []

  let childCount = 0
  let adultCount = 0
  const overCapIndices = new Set<number>()
  companions.forEach((companion, index) => {
    if (!companion?.dob) return
    if (classifyAge(companion.dob) === 'child') {
      childCount += 1
      if (childCount > 2) overCapIndices.add(index)
    } else {
      adultCount += 1
      if (adultCount > 4) overCapIndices.add(index)
    }
  })

  const capsReached =
    fields.length >= 6 || (childCount >= 2 && adultCount >= 4)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Người thân đi cùng</h3>
        <p className="text-sm text-muted-foreground">
          Tối đa 4 người lớn (từ 10 tuổi) và 2 trẻ em (dưới 10 tuổi).
        </p>
      </div>

      {fields.map((field, index) => {
        const dob = companions[index]?.dob
        const type = dob ? classifyAge(dob) : null
        const isOverCap = overCapIndices.has(index)
        const overCapMessage =
          type === 'child'
            ? 'Đã đủ số lượng trẻ em tối đa (2)'
            : 'Đã đủ số lượng người lớn tối đa (4)'

        return (
          <div
            key={field.id}
            className="flex flex-col gap-4 rounded-lg border p-4 bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {`Người thân ${index + 1}`}
                {type && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {type === 'child' ? '(Trẻ em)' : '(Người lớn)'}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Xóa người thân"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`companions.${index}.fullName`} required>Họ và tên</Label>
                <Controller
                  control={control}
                  name={`companions.${index}.fullName`}
                  render={({ field: nameField }) => (
                    <Input
                      id={`companions.${index}.fullName`}
                      placeholder="Nguyễn Văn A"
                      {...nameField}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`companions.${index}.dob`} required>Ngày sinh</Label>
                <Controller
                  control={control}
                  name={`companions.${index}.dob`}
                  render={({ field: dobField }) => (
                    <Input
                      id={`companions.${index}.dob`}
                      type="date"
                      aria-invalid={isOverCap}
                      {...dobField}
                      className={!dobField.value ? 'text-muted-foreground/45' : undefined}
                    />
                  )}
                />
                {isOverCap && (
                  <p className="text-sm text-destructive">{overCapMessage}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label required>Giới tính</Label>
                <Controller
                  control={control}
                  name={`companions.${index}.gender`}
                  render={({ field: genderField }) => (
                    <RadioGroup
                      className="flex gap-6"
                      value={genderField.value}
                      onValueChange={genderField.onChange}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="male"
                          id={`companions.${index}.gender.male`}
                        />
                        <Label
                          htmlFor={`companions.${index}.gender.male`}
                          className="font-normal"
                        >
                          Nam
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="female"
                          id={`companions.${index}.gender.female`}
                        />
                        <Label
                          htmlFor={`companions.${index}.gender.female`}
                          className="font-normal"
                        >
                          Nữ
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`companions.${index}.relationship`} required>
                  Mối quan hệ
                </Label>
                <Controller
                  control={control}
                  name={`companions.${index}.relationship`}
                  render={({ field: relField }) => (
                    <Select
                      value={relField.value || undefined}
                      onValueChange={relField.onChange}
                    >
                      <SelectTrigger id={`companions.${index}.relationship`}>
                        <SelectValue placeholder="Chọn mối quan hệ" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationshipOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto sm:self-start"
        disabled={capsReached}
        onClick={() =>
          append({
            fullName: '',
            dob: '',
            gender: 'male',
            relationship: '',
          })
        }
      >
        <Plus className="h-4 w-4" />Thêm người thân
      </Button>
    </div>
  )
}

export default CompanionFieldArray
