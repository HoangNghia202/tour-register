import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../_lib/adminSession";
import { supabaseAdmin } from "../../src/lib/supabase/server";

interface EmployeeRowInput {
  id?: unknown;
  fullName?: unknown;
  department?: unknown;
  store?: unknown;
  destination?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const rows: EmployeeRowInput[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const errors: Array<{ row: number; message: string }> = [];
  const validRows: Array<{
    id: string;
    fullName: string;
    department: string;
    store: string;
    destination: string;
  }> = [];

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

    validRows.push({ id, fullName, department, store, destination });
  });

  let imported = 0;

  if (validRows.length > 0) {
    const { error } = await supabaseAdmin.from("employees").upsert(validRows, { onConflict: "id" });

    if (error) {
      return res.status(500).json({ imported: 0, errors: [{ row: 0, message: error.message }] });
    }

    imported = validRows.length;
  }

  return res.status(200).json({ imported, errors });
}

