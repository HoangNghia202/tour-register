import { useState } from 'react'
import type { Employee, Registration, Tour } from '../types/domain'
import WizardLayout from '../components/wizard/WizardLayout'

export type WizardStep = 'welcome' | 'tours' | 'register' | 'ticket'

export interface WizardStepProps {
  currentStep: WizardStep
  employee: Employee | null
  selectedTour: Tour | null
  registration: Registration | null
  onEmployeeVerified: (employee: Employee) => void
  onTourSelected: (tour: Tour) => void
  onRegistrationSubmitted: (registration: Registration) => void
  onStepChange: (step: WizardStep) => void
}

const stepLabels: Record<WizardStep, string> = {
  welcome: 'welcome',
  tours: 'tours',
  register: 'register',
  ticket: 'ticket',
}

function WizardPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)

  const handleEmployeeVerified = (nextEmployee: Employee) => {
    setEmployee(nextEmployee)
  }

  const handleTourSelected = (tour: Tour) => {
    setSelectedTour(tour)
  }

  const handleRegistrationSubmitted = (nextRegistration: Registration) => {
    setRegistration(nextRegistration)
  }

  const handleStepChange = (step: WizardStep) => {
    setCurrentStep(step)
  }

  const wizardStepProps: WizardStepProps = {
    currentStep,
    employee,
    selectedTour,
    registration,
    onEmployeeVerified: handleEmployeeVerified,
    onTourSelected: handleTourSelected,
    onRegistrationSubmitted: handleRegistrationSubmitted,
    onStepChange: handleStepChange,
  }

  void wizardStepProps

  return (
    <WizardLayout>
      <p className="text-center text-lg font-medium capitalize text-foreground">
        {stepLabels[currentStep]} step
      </p>
    </WizardLayout>
  )
}

export default WizardPage
