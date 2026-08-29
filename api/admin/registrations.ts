import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../_lib/adminSession.js";
import { supabaseAdmin } from "../../src/lib/supabase/server.js";

type Row = Record<string, unknown>;

type CompanionView = {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  relationship: string;
  type: string;
};

const ALLOWED_PAGE_SIZES = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function pick(row: Row, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRegistration(row: Row) {
  return {
    ...row,
    id: asString(pick(row, "id", "id")),
    employeeId: asString(pick(row, "employeeId", "employee_id")),
    tourId: asString(pick(row, "tourId", "tour_id")),
    transportMethod: asString(pick(row, "transportMethod", "transport_method")),
    pickupPoint: (pick(row, "pickupPoint", "pickup_point") as string | null) ?? null,
    totalPrice: Number(pick(row, "totalPrice", "total_price") ?? 0),
    createdAt: asString(pick(row, "createdAt", "created_at")),
  };
}

function normalizeCompanion(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    registrationId: asString(pick(row, "registrationId", "registration_id")),
    fullName: asString(pick(row, "fullName", "full_name")),
    dob: asString(pick(row, "dob", "dob")),
    gender: asString(pick(row, "gender", "gender")),
    relationship: asString(pick(row, "relationship", "relationship")),
    type: asString(pick(row, "type", "type")),
  };
}

function normalizeEmployee(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    fullName: asString(pick(row, "fullName", "full_name")),
    storeId: asString(pick(row, "storeId", "store_id")),
    store: asString(pick(row, "store", "store")),
    destination: asString(pick(row, "destination", "destination")),
  };
}

function normalizeTour(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    destination: asString(pick(row, "destination", "destination")),
    name: asString(pick(row, "name", "name")),
    startDate: asString(pick(row, "startDate", "start_date")),
    endDate: asString(pick(row, "endDate", "end_date")),
    maxCapacity: Number(pick(row, "maxCapacity", "max_capacity") ?? 0),
    registeredCount: Number(pick(row, "registeredCount", "registered_count") ?? 0),
    pdfUrl: asString(pick(row, "pdfUrl", "pdf_url")),
    imageUrl: asString(pick(row, "imageUrl", "image_url")),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const requestedPageSize = Number(firstQueryValue(req.query.pageSize));
  const pageSize = ALLOWED_PAGE_SIZES.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;

  const requestedPage = Math.trunc(Number(firstQueryValue(req.query.page)));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // One page of registrations + the exact total. snake_case ordering, falling
  // back to camelCase column names for older schema variants.
  let pageResult = await supabaseAdmin
    .from("registrations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (pageResult.error) {
    pageResult = await supabaseAdmin
      .from("registrations")
      .select("*", { count: "exact" })
      .order("createdAt", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
  }

  // Range past the last row (e.g. rows were deleted while the admin sat on a
  // high page): report an empty page with the real total so the client clamps.
  if (pageResult.error?.code === "PGRST103") {
    const countOnly = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true });
    return res
      .status(200)
      .json({ registrations: [], total: countOnly.count ?? 0, page, pageSize });
  }

  if (pageResult.error) {
    return res.status(500).json({ error: pageResult.error.message });
  }

  const total = pageResult.count ?? 0;
  const rows = ((pageResult.data as Row[] | null) ?? []).map(normalizeRegistration);

  if (rows.length === 0) {
    return res.status(200).json({ registrations: [], total, page, pageSize });
  }

  // Only the lookups needed for this page (<= pageSize rows) — small id lists.
  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const tourIds = [...new Set(rows.map((r) => r.tourId))];
  const registrationIds = [...new Set(rows.map((r) => r.id))];

  const [employeesResult, toursResult, companionsBase] = await Promise.all([
    supabaseAdmin.from("employees").select("*").in("id", employeeIds),
    supabaseAdmin.from("tours").select("*").in("id", tourIds),
    supabaseAdmin.from("companions").select("*").in("registration_id", registrationIds),
  ]);

  const companionsResult = companionsBase.error
    ? await supabaseAdmin.from("companions").select("*").in("registrationId", registrationIds)
    : companionsBase;

  if (employeesResult.error) return res.status(500).json({ error: employeesResult.error.message });
  if (toursResult.error) return res.status(500).json({ error: toursResult.error.message });
  if (companionsResult.error) return res.status(500).json({ error: companionsResult.error.message });

  const employees = ((employeesResult.data as Row[] | null) ?? []).map(normalizeEmployee);
  const tours = ((toursResult.data as Row[] | null) ?? []).map(normalizeTour);
  const companions = ((companionsResult.data as Row[] | null) ?? []).map(normalizeCompanion);

  const employeeMap = new Map(employees.map((item) => [item.id, item]));
  const tourMap = new Map(tours.map((item) => [item.id, item]));
  const companionsByRegistration = new Map<string, CompanionView[]>();

  for (const item of companions) {
    const bucket = companionsByRegistration.get(item.registrationId) ?? [];
    bucket.push({
      id: item.id,
      fullName: item.fullName,
      dob: item.dob,
      gender: item.gender,
      relationship: item.relationship,
      type: item.type,
    });
    companionsByRegistration.set(item.registrationId, bucket);
  }

  const registrations = rows.map((row) => ({
    ...row,
    employee: employeeMap.get(row.employeeId) ?? null,
    tour: tourMap.get(row.tourId) ?? null,
    companions: companionsByRegistration.get(row.id) ?? [],
  }));

  return res.status(200).json({ registrations, total, page, pageSize });
}
