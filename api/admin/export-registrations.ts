import type { VercelRequest, VercelResponse } from "@vercel/node";
import ExcelJS from "exceljs";
import { requireAdminSession } from "../_lib/adminSession.js";
import { fetchAllRows } from "../_lib/fetchAllRows.js";
import { supabaseAdmin } from "../../src/lib/supabase/server.js";

type Row = Record<string, unknown>;

interface CompanionRow {
  id: string;
  registrationId: string;
  fullName: string;
  relationship: string;
  dob: string;
  gender: "male" | "female";
  type: "adult" | "child";
}

function countByType(companions: Array<{ type: "adult" | "child" }> | null | undefined, type: "adult" | "child"): number {
  return (companions ?? []).filter((companion) => companion.type === type).length;
}

function countTotalTickets(companions: Array<{ type: "adult" | "child" }> | null | undefined): number {
  return 1 + countByType(companions, "adult");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function pick(row: Row, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

function normalizeRegistration(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    employeeId: asString(pick(row, "employeeId", "employee_id")),
    tourId: asString(pick(row, "tourId", "tour_id")),
    transportMethod: asString(pick(row, "transportMethod", "transport_method")),
    pickupPoint: asString(pick(row, "pickupPoint", "pickup_point")),
    totalPrice: Number(pick(row, "totalPrice", "total_price") ?? 0),
    createdAt: asString(pick(row, "createdAt", "created_at")),
  };
}

function normalizeEmployee(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    fullName: asString(pick(row, "fullName", "full_name")),
  };
}

function normalizeTour(row: Row) {
  return {
    id: asString(pick(row, "id", "id")),
    name: asString(pick(row, "name", "name")),
  };
}

function normalizeCompanion(row: Row): CompanionRow {
  return {
    id: asString(pick(row, "id", "id")),
    registrationId: asString(pick(row, "registrationId", "registration_id")),
    fullName: asString(pick(row, "fullName", "full_name")),
    relationship: asString(pick(row, "relationship", "relationship")),
    dob: asString(pick(row, "dob", "dob")),
    gender: pick(row, "gender", "gender") === "female" ? "female" : "male",
    type: pick(row, "type", "type") === "child" ? "child" : "adult",
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function formatCompanionType(type: "adult" | "child"): string {
  return type === "adult" ? "Người lớn" : "Trẻ em";
}

function formatGender(gender: "male" | "female"): string {
  return gender === "male" ? "Nam" : "Nữ";
}

function formatTransport(transportMethod: string, pickupPoint: string): string {
  if (transportMethod === "tour_bus") {
    return pickupPoint ? `Di chuyển theo Xe Tour (Điểm đón: ${pickupPoint})` : "Di chuyển theo Xe Tour";
  }
  if (transportMethod === "self") return "Tự túc";
  return transportMethod || "-";
}

function formatCompanionDetails(companions: CompanionRow[]): string {
  if (companions.length === 0) return "Không có";
  return companions
    .map(
      (item, index) =>
        `${index + 1}. ${item.fullName || "-"} | ${item.relationship || "-"} | ${formatGender(item.gender)} | ${formatDate(item.dob)} | ${formatCompanionType(item.type)}`,
    )
    .join("\n");
}

function applySheetStyle(worksheet: ExcelJS.Worksheet): void {
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD9D9D9" } },
    left: { style: "thin", color: { argb: "FFD9D9D9" } },
    bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
    right: { style: "thin", color: { argb: "FFD9D9D9" } },
  };

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = border;
      if (row.number > 1 && typeof cell.value === "string") {
        cell.alignment = { vertical: "top", wrapText: true };
      }
    });
  });

  worksheet.getColumn("totalPrice").numFmt = "#,##0";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  let registrationsResult = await fetchAllRows(() =>
    supabaseAdmin
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  );

  if (registrationsResult.error) {
    registrationsResult = await fetchAllRows(() =>
      supabaseAdmin
        .from("registrations")
        .select("*")
        .order("createdAt", { ascending: false })
        .order("id", { ascending: false }),
    );
  }

  if (registrationsResult.error) {
    return res.status(500).json({ error: registrationsResult.error.message });
  }

  const registrations = registrationsResult.data.map(normalizeRegistration);
  if (registrations.length === 0) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Đăng ký");
    worksheet.columns = [
      { header: "MSNV", key: "msnv", width: 12 },
      { header: "Họ tên", key: "fullName", width: 24 },
      { header: "Tour", key: "tour", width: 24 },
      { header: "Phương thức di chuyển", key: "transport", width: 32 },
      { header: "Người thân đi cùng", key: "companions", width: 52 },
      { header: "Số người lớn", key: "adultCount", width: 14 },
      { header: "Số trẻ em", key: "childCount", width: 12 },
      { header: "Tổng số vé", key: "totalTickets", width: 12 },
      { header: "Tổng tiền", key: "totalPrice", width: 16 },
      { header: "Ngày đăng ký", key: "createdAt", width: 14 },
    ];
    applySheetStyle(worksheet);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="danh-sach-dang-ky.xlsx"');
    return res.status(200).send(buffer);
  }

  // Full lookup tables, paged past the 1000-row cap.
  const [employeesResult, toursResult, companionsResult] = await Promise.all([
    fetchAllRows(() => supabaseAdmin.from("employees").select("*").order("id", { ascending: true })),
    fetchAllRows(() => supabaseAdmin.from("tours").select("*").order("id", { ascending: true })),
    fetchAllRows(() => supabaseAdmin.from("companions").select("*").order("id", { ascending: true })),
  ]);

  if (employeesResult.error) return res.status(500).json({ error: employeesResult.error.message });
  if (toursResult.error) return res.status(500).json({ error: toursResult.error.message });
  if (companionsResult.error) return res.status(500).json({ error: companionsResult.error.message });

  const employees = employeesResult.data.map(normalizeEmployee);
  const tours = toursResult.data.map(normalizeTour);
  const companions = companionsResult.data.map(normalizeCompanion);

  const employeeMap = new Map(employees.map((item) => [item.id, item]));
  const tourMap = new Map(tours.map((item) => [item.id, item]));
  const companionsByRegistration = new Map<string, CompanionRow[]>();

  for (const item of companions) {
    const bucket = companionsByRegistration.get(item.registrationId) ?? [];
    bucket.push(item);
    companionsByRegistration.set(item.registrationId, bucket);
  }

  const rows = registrations.map((registration) => {
    const employee = employeeMap.get(registration.employeeId);
    const tour = tourMap.get(registration.tourId);
    const companionRows = companionsByRegistration.get(registration.id) ?? [];

    return {
      msnv: employee?.id ?? "",
      fullName: employee?.fullName ?? "",
      tour: tour?.name ?? "",
      transport: formatTransport(registration.transportMethod, registration.pickupPoint),
      companions: formatCompanionDetails(companionRows),
      adultCount: countByType(companionRows, "adult"),
      childCount: countByType(companionRows, "child"),
      totalTickets: countTotalTickets(companionRows),
      totalPrice: registration.totalPrice,
      createdAt: formatDate(registration.createdAt),
    };
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Đăng ký");
  worksheet.columns = [
    { header: "MSNV", key: "msnv", width: 12 },
    { header: "Họ tên", key: "fullName", width: 24 },
    { header: "Tour", key: "tour", width: 24 },
    { header: "Phương thức di chuyển", key: "transport", width: 32 },
    { header: "Người thân đi cùng", key: "companions", width: 52 },
    { header: "Số người lớn", key: "adultCount", width: 14 },
    { header: "Số trẻ em", key: "childCount", width: 12 },
    { header: "Tổng số vé", key: "totalTickets", width: 12 },
    { header: "Tổng tiền", key: "totalPrice", width: 16 },
    { header: "Ngày đăng ký", key: "createdAt", width: 14 },
  ];
  worksheet.addRows(rows);
  applySheetStyle(worksheet);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="danh-sach-dang-ky.xlsx"');
  return res.status(200).send(buffer);
}

