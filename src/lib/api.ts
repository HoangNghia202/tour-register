import { createClient } from "@/lib/supabase/client";
import type { Companion, Destination, Employee, Registration, Tour } from "@/types/domain";

export class SessionExpiredError extends Error {
  constructor() {
    super("Phiên đăng nhập đã hết hạn");
    this.name = "SessionExpiredError";
  }
}

const supabase = createClient();

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" ? (value as RawRecord) : null;
}

function getFirstRpcRecord(data: unknown): RawRecord | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const record = asRecord(item);
      if (record) return record;
    }
    return null;
  }

  return asRecord(data);
}

function getValue(raw: RawRecord, camelKey: string, snakeKey: string): unknown {
  return raw[camelKey] ?? raw[snakeKey];
}

function mapDestination(value: unknown): Destination {
  return value === "da_lat" ? "da_lat" : "nha_trang";
}

function mapEmployee(raw: RawRecord): Employee {
  return {
    id: String(getValue(raw, "id", "id") ?? ""),
    fullName: String(getValue(raw, "fullName", "full_name") ?? ""),
    department: String(getValue(raw, "department", "department") ?? ""),
    store: String(getValue(raw, "store", "store") ?? ""),
    destination: mapDestination(getValue(raw, "destination", "destination")),
  };
}

function mapTour(raw: RawRecord): Tour {
  return {
    id: String(getValue(raw, "id", "id") ?? ""),
    destination: mapDestination(getValue(raw, "destination", "destination")),
    name: String(getValue(raw, "name", "name") ?? ""),
    startDate: String(getValue(raw, "startDate", "start_date") ?? ""),
    endDate: String(getValue(raw, "endDate", "end_date") ?? ""),
    maxCapacity: Number(getValue(raw, "maxCapacity", "max_capacity") ?? 0),
    registeredCount: Number(getValue(raw, "registeredCount", "registered_count") ?? 0),
    adultPrice: Number(getValue(raw, "adultPrice", "adult_price") ?? 0),
    childPrice: Number(getValue(raw, "childPrice", "child_price") ?? 0),
    pdfUrl: String(getValue(raw, "pdfUrl", "pdf_url") ?? ""),
    imageUrl: String(getValue(raw, "imageUrl", "image_url") ?? "/placeholder-tour.svg"),
  };
}

function mapCompanion(raw: RawRecord): Companion {
  return {
    id: String(getValue(raw, "id", "id") ?? crypto.randomUUID()),
    fullName: String(getValue(raw, "fullName", "full_name") ?? ""),
    dob: String(getValue(raw, "dob", "dob") ?? ""),
    gender: getValue(raw, "gender", "gender") === "female" ? "female" : "male",
    relationship: String(getValue(raw, "relationship", "relationship") ?? ""),
    type: getValue(raw, "type", "type") === "child" ? "child" : "adult",
  };
}

function mapRegistration(raw: RawRecord): Registration {
  const companionsValue = getValue(raw, "companions", "companions");
  let companionsRaw: unknown[] = [];

  if (Array.isArray(companionsValue)) {
    companionsRaw = companionsValue;
  } else if (typeof companionsValue === "string") {
    try {
      const parsed = JSON.parse(companionsValue);
      companionsRaw = Array.isArray(parsed) ? parsed : [];
    } catch {
      companionsRaw = [];
    }
  }

  return {
    id: String(
      getValue(raw, "id", "id") ??
        getValue(raw, "registrationId", "registration_id") ??
        "",
    ),
    employeeId: String(getValue(raw, "employeeId", "employee_id") ?? ""),
    tourId: String(getValue(raw, "tourId", "tour_id") ?? ""),
    transportMethod: getValue(raw, "transportMethod", "transport_method") === "tour_bus" ? "tour_bus" : "self",
    pickupPoint: (getValue(raw, "pickupPoint", "pickup_point") as Registration["pickupPoint"]) ?? null,
    companions: companionsRaw.filter(Boolean).map((item) => mapCompanion(item as RawRecord)),
    totalPrice: Number(getValue(raw, "totalPrice", "total_price") ?? 0),
    createdAt: String(getValue(raw, "createdAt", "created_at") ?? ""),
  };
}

export async function findEmployeeById(id: string): Promise<Employee | undefined> {
  const { data, error } = await supabase.rpc("find_employee_by_id", { p_id: id });
  if (error) throw new Error(error.message);
  const row = getFirstRpcRecord(data);
  return row ? mapEmployee(row) : undefined;
}

export async function findRegistrationByEmployeeId(
  employeeId: string,
): Promise<Registration | undefined> {
  const { data, error } = await supabase.rpc("get_registration_by_employee", {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(error.message);

  const row = getFirstRpcRecord(data);
  if (!row) return undefined;

  // Some DB versions return { registration: {...} } instead of a table row.
  const nestedRegistration = asRecord(row.registration);
  if (nestedRegistration) {
    return mapRegistration(nestedRegistration);
  }

  return mapRegistration(row);
}

export async function getToursByDestination(destination: Destination): Promise<Tour[]> {
  const { data, error } = await supabase
    .from("tours")
    .select("*")
    .eq("destination", destination)
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as RawRecord[] | null) ?? []).map(mapTour);
}

export async function getTourById(id: string): Promise<Tour | undefined> {
  const { data, error } = await supabase.from("tours").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTour(data as RawRecord) : undefined;
}

export async function getAllTours(): Promise<Tour[]> {
  const { data, error } = await supabase.from("tours").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as RawRecord[] | null) ?? []).map(mapTour);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) throw new SessionExpiredError();

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
  }

  return response.json();
}

export async function getAllRegistrationsWithDetails(): Promise<
  Array<Registration & { employee: Employee; tour: Tour }>
> {
  const response = await fetch("/api/admin/registrations", { credentials: "include" });
  const body = await parseJsonResponse<{ registrations: RawRecord[] }>(response);

  return (body.registrations ?? []).map((item) => ({
    ...mapRegistration(item),
    employee: mapEmployee((item.employee as RawRecord) ?? {}),
    tour: mapTour((item.tour as RawRecord) ?? {}),
  }));
}

export async function updateTourConfig(
  tourId: string,
  changes: Partial<Pick<Tour, "maxCapacity" | "adultPrice" | "childPrice">>,
): Promise<void> {
  const response = await fetch("/api/admin/tour-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tourId, changes }),
  });
  await parseJsonResponse(response);
}

export async function importEmployees(
  rows: Array<Omit<Employee, never>>,
): Promise<{ imported: number; errors: Array<{ row: number; message: string }> }> {
  const response = await fetch("/api/admin/import-employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ rows }),
  });
  return parseJsonResponse(response);
}

export async function submitRegistration(
  input: Omit<Registration, "id" | "createdAt" | "totalPrice">,
): Promise<{ ok: true; registration: Registration } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? "Có lỗi xảy ra, vui lòng thử lại." };
    }

    return { ok: true, registration: mapRegistration((body.registration ?? {}) as RawRecord) };
  } catch {
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại." };
  }
}
