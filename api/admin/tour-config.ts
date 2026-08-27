import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../_lib/adminSession.js";
import { supabaseAdmin } from "../../src/lib/supabase/server.js";

function normalizeTourId(rawTourId: string): string | number {
  const trimmed = rawTourId.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const { tourId, changes } = req.body ?? {};

  if (typeof tourId !== "string" || !tourId.trim() || !changes || typeof changes !== "object") {
    return res.status(400).json({ ok: false, error: "Dữ liệu không hợp lệ." });
  }

  const updateSnakeCase: Record<string, number> = {};
  if (changes.maxCapacity !== undefined) updateSnakeCase.max_capacity = Number(changes.maxCapacity);
  if (changes.adultPrice !== undefined) updateSnakeCase.adult_price = Number(changes.adultPrice);
  if (changes.childPrice !== undefined) updateSnakeCase.child_price = Number(changes.childPrice);

  if (Object.values(updateSnakeCase).some((value) => !Number.isFinite(value) || value < 0)) {
    return res.status(400).json({ ok: false, error: "Giá trị không hợp lệ." });
  }

  const normalizedTourId = normalizeTourId(tourId);
  let { error } = await supabaseAdmin
    .from("tours")
    .update(updateSnakeCase)
    .eq("id", normalizedTourId);

  // Backward compatibility for camelCase schema variants.
  if (error && error.message.includes("schema cache")) {
    const updateCamelCase: Record<string, number> = {};
    if (changes.maxCapacity !== undefined) updateCamelCase.maxCapacity = Number(changes.maxCapacity);
    if (changes.adultPrice !== undefined) updateCamelCase.adultPrice = Number(changes.adultPrice);
    if (changes.childPrice !== undefined) updateCamelCase.childPrice = Number(changes.childPrice);

    ({ error } = await supabaseAdmin
      .from("tours")
      .update(updateCamelCase)
      .eq("id", normalizedTourId));
  }

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.status(200).json({ ok: true });
}

