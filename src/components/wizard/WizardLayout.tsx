import type { ReactNode } from 'react'

interface WizardLayoutProps {
  children: ReactNode
}

function WizardLayout({ children }: WizardLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Tour Du Lịch Vùng Trung Bộ 2026
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Tour registration
          </h1>
        </header>

        <main className="flex flex-1 items-start justify-center py-4 sm:py-6">
          <section className="w-full max-w-3xl rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-10">
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}

export default WizardLayout
