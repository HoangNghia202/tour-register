import { MapPinned, ClipboardList } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EmployeeImportPanel from './EmployeeImportPanel'
import TourConfigTable from './TourConfigTable'
import RegistrationsTable from './RegistrationsTable'

interface AdminLayoutProps {
  onSessionExpired: () => void
}

function AdminLayout({ onSessionExpired }: AdminLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground"
         style={{background: 'linear-gradient(to top, #30cfd0 0%, #330867 100%)'}}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-br from-teal-700 via-cyan-700 to-sky-600"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-4rem] -z-10 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8"
      >
        {/*<header className="rounded-3xl bg-white/10 px-5 py-6 text-white shadow-lg shadow-teal-900/20 backdrop-blur-sm sm:px-8 sm:py-8">*/}
        {/*  <div className="flex items-center gap-3">*/}
        {/*    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">*/}
        {/*      <Compass className="h-5 w-5" />*/}
        {/*    </span>*/}
        {/*    <div>*/}
        {/*      <p className="bg-gradient-to-r from-amber-200 via-white to-cyan-100 bg-clip-text text-xs font-medium uppercase tracking-[0.24em] text-transparent">*/}
        {/*        Tour Du Lịch Vùng Trung Bộ 2026*/}
        {/*      </p>*/}
        {/*      <h1 className="mt-1 bg-gradient-to-r from-amber-200 via-white to-cyan-100 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">*/}
        {/*        Trang quản trị*/}
        {/*      </h1>*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*</header>*/}

        <main className="flex flex-1 py-4 sm:py-6">
          <section className=" w-full rounded-3xl border border-border bg-card px-5 py-6 shadow-lg shadow-teal-900/5 sm:px-8 sm:py-8">
            <Tabs defaultValue="tours">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-muted p-1 sm:grid-cols-3">
                {/*<TabsTrigger value="employees" className="gap-2 py-2 data-[state=active]:text-teal-700">*/}
                {/*  <Users className="h-4 w-4" />*/}
                {/*  Nhân viên*/}
                {/*</TabsTrigger>*/}
                <TabsTrigger value="tours" className="gap-2 py-2 data-[state=active]:text-teal-700">
                  <MapPinned className="h-4 w-4" />
                  Cấu hình Tour
                </TabsTrigger>
                <TabsTrigger value="registrations" className="gap-2 py-2 data-[state=active]:text-teal-700">
                  <ClipboardList className="h-4 w-4" />
                  Danh sách đăng ký
                </TabsTrigger>
              </TabsList>

              <TabsContent value="employees" className="mt-6">
                <EmployeeImportPanel onSessionExpired={onSessionExpired} />
              </TabsContent>
              <TabsContent value="tours" className="mt-6">
                <TourConfigTable onSessionExpired={onSessionExpired} />
              </TabsContent>
              <TabsContent value="registrations" className="mt-6">
                <RegistrationsTable onSessionExpired={onSessionExpired} />
              </TabsContent>
            </Tabs>
          </section>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
