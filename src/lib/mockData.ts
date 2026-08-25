import { calculateTotal } from "@/lib/pricing";
import type { Destination, Employee, Registration, Tour } from "@/types/domain";

const employees: Employee[] = [
  {
    id: "8830",
    fullName: "Nguyễn Thị Phương Linh",
    department: "BP Quản Lý Siêu Thị - ĐMX",
    store: "TGD_NAN_VIN - 180 Nguyễn Du",
    destination: "da_lat",
  },
  {
    id: "9001",
    fullName: "Trần Văn Bình",
    department: "BP Kho Vận",
    store: "TGD_HCM_Q1 - 12 Lê Lợi",
    destination: "nha_trang",
  },
];

const tours: Tour[] = [
  {
    id: "dalat-1",
    destination: "da_lat",
    name: "Đà Lạt 1",
    startDate: "2026-09-28",
    endDate: "2026-09-30",
    maxCapacity: 750,
    registeredCount: 430,
    adultPrice: 2500000,
    childPrice: 1200000,
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    imageUrl: "/placeholder-tour.svg",
  },
  {
    id: "nha-trang-1",
    destination: "nha_trang",
    name: "Nha Trang 1",
    startDate: "2026-09-28",
    endDate: "2026-09-30",
    maxCapacity: 450,
    registeredCount: 120,
    adultPrice: 2850000,
    childPrice: 1400000,
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    imageUrl: "/placeholder-tour.svg",
  },
  {
    id: "nha-trang-2",
    destination: "nha_trang",
    name: "Nha Trang 2",
    startDate: "2026-10-07",
    endDate: "2026-10-09",
    maxCapacity: 450,
    registeredCount: 300,
    adultPrice: 2950000,
    childPrice: 1500000,
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    imageUrl: "/placeholder-tour.svg",
  },
  {
    id: "nha-trang-3",
    destination: "nha_trang",
    name: "Nha Trang 3",
    startDate: "2026-10-19",
    endDate: "2026-10-21",
    maxCapacity: 450,
    registeredCount: 449,
    adultPrice: 3050000,
    childPrice: 1550000,
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    imageUrl: "/placeholder-tour.svg",
  },
  {
    id: "nha-trang-4",
    destination: "nha_trang",
    name: "Nha Trang 4",
    startDate: "2026-10-21",
    endDate: "2026-10-23",
    maxCapacity: 450,
    registeredCount: 450,
    adultPrice: 3150000,
    childPrice: 1600000,
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    imageUrl: "/placeholder-tour.svg",
  },
];

const registrations: Registration[] = [];

export function findEmployeeById(id: string): Employee | undefined {
  return employees.find((employee) => employee.id === id);
}

export function findRegistrationByEmployeeId(employeeId: string): Registration | undefined {
  return registrations.find((registration) => registration.employeeId === employeeId);
}

export function getToursByDestination(destination: Destination): Tour[] {
  return tours.filter((tour) => tour.destination === destination);
}

export function getTourById(id: string): Tour | undefined {
  return tours.find((tour) => tour.id === id);
}

export function submitRegistration(
  input: Omit<Registration, "id" | "createdAt" | "totalPrice">,
): Promise<{ ok: true; registration: Registration } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
    const tour = getTourById(input.tourId);

    if (!tour) {
      resolve({ ok: false, error: "Tour not found." });
        return;
      }

    if (tour.registeredCount >= tour.maxCapacity) {
      resolve({ ok: false, error: "Tour đã đầy, vui lòng chọn tour khác." });
      return;
    }

      tour.registeredCount += 1;

      const totalPrice = calculateTotal(input.companions, tour);
      const registration: Registration = {
        ...input,
        id: `reg-${String(registrations.length + 1).padStart(3, "0")}`,
        totalPrice,
        createdAt: new Date().toISOString(),
      };

      registrations.push(registration);

      resolve({ ok: true, registration });
    }, 300);
  });
}
