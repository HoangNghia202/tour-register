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
    name: "Đà Lạt",
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

export function getAllTours(): Tour[] {
  return tours;
}

export function getAllRegistrationsWithDetails(): Array<
  Registration & { employee: Employee; tour: Tour }
> {
  return registrations.flatMap((registration) => {
    const employee = findEmployeeById(registration.employeeId);
    const tour = getTourById(registration.tourId);

    if (!employee || !tour) {
      return [];
    }

    return [{ ...registration, employee, tour }];
  });
}

export function updateTourConfig(
  tourId: string,
  changes: Partial<Pick<Tour, "maxCapacity" | "adultPrice" | "childPrice">>,
): void {
  const tour = getTourById(tourId);

  if (!tour) {
    return;
  }

  if (changes.maxCapacity !== undefined) {
    tour.maxCapacity = changes.maxCapacity;
  }
  if (changes.adultPrice !== undefined) {
    tour.adultPrice = changes.adultPrice;
  }
  if (changes.childPrice !== undefined) {
    tour.childPrice = changes.childPrice;
  }
}

export function importEmployees(
  rows: Array<Omit<Employee, never>>,
): { imported: number; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  let imported = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const id = String(row.id ?? "").trim();
    const fullName = String(row.fullName ?? "").trim();
    const department = String(row.department ?? "").trim();
    const store = String(row.store ?? "").trim();
    const destination = row.destination;

    if (!id || !fullName || !department || !store) {
      errors.push({
        row: rowNumber,
        message: "Thiếu thông tin bắt buộc (MSNV/Họ tên/Bộ phận/Siêu thị).",
      });
      return;
    }

    if (destination !== "da_lat" && destination !== "nha_trang") {
      errors.push({
        row: rowNumber,
        message: `Điểm đến không hợp lệ: "${String(destination ?? "")}".`,
      });
      return;
    }

    const employee: Employee = { id, fullName, department, store, destination };
    const existingIndex = employees.findIndex((item) => item.id === id);

    if (existingIndex >= 0) {
      employees[existingIndex] = employee;
    } else {
      employees.push(employee);
    }

    imported += 1;
  });

  return { imported, errors };
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
