import { useState } from 'react'
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
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)

  return (
    <WizardLayout>
      {currentStep === 'welcome' ? (
        <WelcomeScreen
          onVerified={(nextEmployee, existingRegistration) => {
            setEmployee(nextEmployee)
            if (existingRegistration) {
              setRegistration(existingRegistration)
              setCurrentStep('ticket')
            } else {
              setCurrentStep('tours')
            }
          }}
        />
      ) : currentStep === 'tours' && employee ? (
        <TourSelectionScreen
          employee={employee}
          onTourSelected={(tour) => {
            setSelectedTour(tour)
            setCurrentStep('register')
          }}
        />
      ) : currentStep === 'register' && employee && selectedTour ? (
        <RegistrationFormScreen
          employee={employee}
          tour={selectedTour}
          onSubmitted={(nextRegistration) => {
            setRegistration(nextRegistration)
            setCurrentStep('ticket')
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
