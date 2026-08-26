import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as XLSX from "xlsx";
import { requireAdminSession } from "../_lib/adminSession";
import { supabaseAdmin } from "../../src/lib/supabase/server";

interface CompanionRow {
  type: "adult" | "child";
}

function countByType(companions: CompanionRow[] | null | undefined, type: "adult" | "child"): number {
  return (companions ?? []).filter((companion) => companion.type === type).length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select(
      `"totalPrice", "createdAt",
       employee:employeeId ( "id", "fullName" ),
       tour:tourId ( "name" ),
       companions ( "type" )`,
    )
    .order("createdAt", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []).map((row: any) => ({
    MSNV: row.employee?.id ?? "",
    "Họ tên": row.employee?.fullName ?? "",
    Tour: row.tour?.name ?? "",
    "Số người lớn đi kèm": countByType(row.companions, "adult"),
    "Số trẻ em đi kèm": countByType(row.companions, "child"),
    "Tổng tiền": row.totalPrice,
    "Ngày đăng ký": new Date(row.createdAt).toLocaleDateString("vi-VN"),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Đăng ký");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="danh-sach-dang-ky.xlsx"');
  return res.status(200).send(buffer);
}

