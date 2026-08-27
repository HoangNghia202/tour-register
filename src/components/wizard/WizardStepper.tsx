import { Check, ClipboardList, MapPin, Ticket, Plane } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WizardStep } from '@/pages/WizardPage'

const steps: Array<{ key: WizardStep; label: string; icon: typeof Plane }> = [
  { key: 'welcome', label: 'Xác thực', icon: Plane },
  { key: 'tours', label: 'Chọn tour', icon: MapPin },
  { key: 'register', label: 'Đăng ký', icon: ClipboardList },
  { key: 'ticket', label: 'Vé mời', icon: Ticket },
]

interface WizardStepperProps {
  currentStep: WizardStep
}

function WizardStepper({ currentStep }: WizardStepperProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentStep)

  return (
    <ol className="flex w-full items-center">
      {steps.map((step, index) => {
        const isDone = index < currentIndex
        const isActive = index === currentIndex
        const Icon = step.icon

        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors sm:h-10 sm:w-10',
                  isDone && 'border-teal-500 bg-teal-500 text-white',
                  isActive && 'border-teal-500 bg-white text-teal-600 shadow-sm ring-4 ring-teal-100',
                  !isDone && !isActive && 'border-border bg-white/70 text-muted-foreground',
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'hidden text-[11px] font-medium uppercase tracking-wide sm:block',
                  isActive ? 'text-teal-700' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <span
                className={cn(
                  'mx-2 h-0.5 flex-1 rounded-full transition-colors sm:mx-3',
                  isDone ? 'bg-teal-500' : 'bg-border',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default WizardStepper
