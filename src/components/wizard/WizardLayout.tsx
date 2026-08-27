import type { ReactNode } from 'react'
import { Plane } from 'lucide-react'
import WizardStepper from './WizardStepper'
import type { WizardStep } from '@/pages/WizardPage'

interface WizardLayoutProps {
  children: ReactNode
  currentStep?: WizardStep
}

function WizardLayout({ children, currentStep }: WizardLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground"
         style={{background: 'linear-gradient(to top, #30cfd0 0%, #330867 100%)'}}

    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-br from-teal-600 via-cyan-600 to-sky-500"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-4rem] -z-10 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-[-6rem] -z-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8"
        style={{backgroundImage:'linear-gradient(to top, #30cfd0 0%, #330867 100%)'}}
      >
        <header className="rounded-3xl bg-black px-5 py-6 text-white shadow-lg shadow-teal-900/20 backdrop-blur-sm sm:px-8 sm:py-8">
          <img
            src="/logo.png"
            alt="Logo"
            className="mb-4 h-12 w-auto rounded-lg object-contain"
          />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
              <Plane className="h-5 w-5 rotate-45" />
            </span>
            <div>
              <p className="bg-gradient-to-r from-amber-200 via-white to-cyan-100 bg-clip-text text-xs font-medium uppercase tracking-[0.24em] text-transparent">
                Tour Du Lịch Vùng Trung Bộ 2026
              </p>
              <h1 className="mt-1 bg-gradient-to-r from-amber-200 via-white to-cyan-100 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
                Đăng ký Tour Du Lịch
              </h1>
            </div>
          </div>

          {currentStep && (
            <div className="mt-6 rounded-2xl px-4 py-4 text-foreground shadow-sm sm:px-6">
              <WizardStepper currentStep={currentStep} />
            </div>
          )}
        </header>

        <main className="flex flex-1 items-start justify-center py-4 sm:py-6">
          <section className="w-full max-w-3xl rounded-3xl border border-white/20 bg-card/40 px-5 py-6 shadow-lg shadow-teal-900/5 backdrop-blur-sm sm:px-8 sm:py-10"
          >
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}

export default WizardLayout
