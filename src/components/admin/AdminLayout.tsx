import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EmployeeImportPanel from './EmployeeImportPanel'
import TourConfigTable from './TourConfigTable'
import RegistrationsTable from './RegistrationsTable'

function AdminLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Tour Du Lịch Vùng Trung Bộ 2026
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Trang quản trị
          </h1>
        </header>

        <main className="flex flex-1 py-4 sm:py-6">
          <section className="w-full rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <Tabs defaultValue="employees">
              <TabsList className="w-full">
                <TabsTrigger value="employees">Nhân viên</TabsTrigger>
                <TabsTrigger value="tours">Cấu hình Tour</TabsTrigger>
                <TabsTrigger value="registrations">Danh sách đăng ký</TabsTrigger>
              </TabsList>

              <TabsContent value="employees" className="mt-6">
                <EmployeeImportPanel />
              </TabsContent>
              <TabsContent value="tours" className="mt-6">
                <TourConfigTable />
              </TabsContent>
              <TabsContent value="registrations" className="mt-6">
                <RegistrationsTable />
              </TabsContent>
            </Tabs>
          </section>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
