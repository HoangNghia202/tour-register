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

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function pick(row: Row, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
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
    department: asString(pick(row, "department", "department")),
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
    adultPrice: Number(pick(row, "adultPrice", "adult_price") ?? 0),
    childPrice: Number(pick(row, "childPrice", "child_price") ?? 0),
    pdfUrl: asString(pick(row, "pdfUrl", "pdf_url")),
    imageUrl: asString(pick(row, "imageUrl", "image_url")),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const { data: registrationRows, error: registrationsError } = await supabaseAdmin
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (registrationsError) {
    // Fallback for camelCase schema variants.
    const fallback = await supabaseAdmin
      .from("registrations")
      .select("*")
      .order("createdAt", { ascending: false });

    if (fallback.error) return res.status(500).json({ error: fallback.error.message });

    const fallbackRows = ((fallback.data as Row[] | null) ?? []).map(normalizeRegistration);
    if (fallbackRows.length === 0) return res.status(200).json({ registrations: [] });

    const employeeIds = [...new Set(fallbackRows.map((r) => r.employeeId))];
    const tourIds = [...new Set(fallbackRows.map((r) => r.tourId))];
    const registrationIds = [...new Set(fallbackRows.map((r) => r.id))];

    const [employeesResult, toursResult, companionsResult] = await Promise.all([
      supabaseAdmin.from("employees").select("*").in("id", employeeIds),
      supabaseAdmin.from("tours").select("*").in("id", tourIds),
      supabaseAdmin.from("companions").select("*").in("registration_id", registrationIds),
    ]);

    if (companionsResult.error) {
      const fallbackCompanions = await supabaseAdmin.from("companions").select("*").in("registrationId", registrationIds);
      if (fallbackCompanions.error) return res.status(500).json({ error: fallbackCompanions.error.message });

      const employees = ((employeesResult.data as Row[] | null) ?? []).map(normalizeEmployee);
      const tours = ((toursResult.data as Row[] | null) ?? []).map(normalizeTour);
      const companions = ((fallbackCompanions.data as Row[] | null) ?? []).map(normalizeCompanion);

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

      const registrations = fallbackRows.map((row) => ({
        ...row,
        employee: employeeMap.get(row.employeeId) ?? null,
        tour: tourMap.get(row.tourId) ?? null,
        companions: companionsByRegistration.get(row.id) ?? [],
      }));

      return res.status(200).json({ registrations });
    }

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

    const registrations = fallbackRows.map((row) => ({
      ...row,
      employee: employeeMap.get(row.employeeId) ?? null,
      tour: tourMap.get(row.tourId) ?? null,
      companions: companionsByRegistration.get(row.id) ?? [],
    }));

    return res.status(200).json({ registrations });
  }

  const rows = ((registrationRows as Row[] | null) ?? []).map(normalizeRegistration);
  if (rows.length === 0) return res.status(200).json({ registrations: [] });

  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const tourIds = [...new Set(rows.map((r) => r.tourId))];
  const registrationIds = [...new Set(rows.map((r) => r.id))];

  const [employeesResult, toursResult, companionsResult] = await Promise.all([
    supabaseAdmin.from("employees").select("*").in("id", employeeIds),
    supabaseAdmin.from("tours").select("*").in("id", tourIds),
    supabaseAdmin.from("companions").select("*").in("registration_id", registrationIds),
  ]);

  if (companionsResult.error) {
    const fallbackCompanions = await supabaseAdmin.from("companions").select("*").in("registrationId", registrationIds);
    if (fallbackCompanions.error) return res.status(500).json({ error: fallbackCompanions.error.message });

    const employees = ((employeesResult.data as Row[] | null) ?? []).map(normalizeEmployee);
    const tours = ((toursResult.data as Row[] | null) ?? []).map(normalizeTour);
    const companions = ((fallbackCompanions.data as Row[] | null) ?? []).map(normalizeCompanion);

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

    return res.status(200).json({ registrations });
  }

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

  return res.status(200).json({ registrations });
}

