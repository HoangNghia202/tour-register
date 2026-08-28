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

  const body = (req.body ?? {}) as Record<string, unknown>;

  // --- Route price patch: { destination, pickupPoint, price } ---
  if (typeof body.destination === "string" && typeof body.pickupPoint === "string") {
    const destination = body.destination;
    const pickupPoint = body.pickupPoint;
    const price = Number(body.price);

    if (destination !== "da_lat" && destination !== "nha_trang") {
      return res.status(400).json({ ok: false, error: "Điểm đến không hợp lệ." });
    }
    if (!pickupPoint.trim() || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ ok: false, error: "Giá trị không hợp lệ." });
    }

    const { error } = await supabaseAdmin
      .from("destination_pricing")
      .upsert(
        { destination, pickup_point: pickupPoint, price },
        { onConflict: "destination,pickup_point" },
      );

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  // --- Tour meta patch: { tourId, changes: { name?, startDate?, endDate?, maxCapacity? } } ---
  const { tourId, changes } = body as {
    tourId?: unknown;
    changes?: Record<string, unknown>;
  };

  if (typeof tourId !== "string" || !tourId.trim() || !changes || typeof changes !== "object") {
    return res.status(400).json({ ok: false, error: "Dữ liệu không hợp lệ." });
  }

  const update: Record<string, unknown> = {};

  if (changes.name !== undefined) {
    const name = String(changes.name).trim();
    if (!name) return res.status(400).json({ ok: false, error: "Tên tour không hợp lệ." });
    update.name = name;
  }
  if (changes.startDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(changes.startDate))) {
      return res.status(400).json({ ok: false, error: "Ngày bắt đầu không hợp lệ." });
    }
    update.start_date = String(changes.startDate);
  }
  if (changes.endDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(changes.endDate))) {
      return res.status(400).json({ ok: false, error: "Ngày kết thúc không hợp lệ." });
    }
    update.end_date = String(changes.endDate);
  }
  if (changes.maxCapacity !== undefined) {
    const maxCapacity = Number(changes.maxCapacity);
    if (!Number.isFinite(maxCapacity) || maxCapacity < 0) {
      return res.status(400).json({ ok: false, error: "Sức chứa không hợp lệ." });
    }
    update.max_capacity = maxCapacity;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ ok: false, error: "Không có thay đổi nào." });
  }

  const { error } = await supabaseAdmin
    .from("tours")
    .update(update)
    .eq("id", normalizeTourId(tourId));

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}

