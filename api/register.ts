import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../src/lib/supabase/server.js";

const PICKUP_POINTS = [
  "Hà Tĩnh",
  "Quảng Bình",
  "Quảng Trị",
  "TP. Huế",
  "Đà Nẵng",
  "Quảng Nam",
  "Quảng Ngãi",
];

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_REGISTERED: "Nhân viên này đã đăng ký tour.",
  TOUR_NOT_FOUND: "Không tìm thấy tour.",
  TOUR_FULL: "Tour đã đầy, vui lòng chọn tour khác.",
  EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên trong danh sách import.",
  INVALID_TOUR_ID: "Mã tour không hợp lệ.",
  INVALID_FUNCTION_SIGNATURE: "Cấu hình backend chưa đồng bộ (submit_registration).",
  TOO_MANY_ADULTS: "Tối đa 4 người lớn đi kèm.",
  TOO_MANY_CHILDREN: "Tối đa 2 trẻ em đi kèm.",
  ROUTE_PRICE_NOT_FOUND:
    "Chưa có cấu hình giá cho lộ trình này, vui lòng liên hệ quản trị.",
};

interface CompanionInput {
  id?: unknown;
  fullName?: unknown;
  dob?: unknown;
  gender?: unknown;
  relationship?: unknown;
  type?: unknown;
}

interface RpcErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

interface RpcRegistrationLike {
  id?: unknown;
  registration_id?: unknown;
  registrationId?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  total_price?: unknown;
}

function isValidCompanion(companion: CompanionInput): boolean {
  return (
    typeof companion?.fullName === "string" &&
    companion.fullName.trim().length > 0 &&
    typeof companion?.dob === "string" &&
    companion.dob.trim().length > 0 &&
    (companion?.gender === "male" || companion?.gender === "female") &&
    typeof companion?.relationship === "string" &&
    companion.relationship.trim().length > 0 &&
    (companion?.type === "adult" || companion?.type === "child")
  );
}

function extractPgErrorCode(message: string): string {
  const match = Object.keys(ERROR_MESSAGES).find((code) => message.includes(code));
  return match ?? message;
}

function mapDbErrorToUserMessage(source: string, code?: string): string {
  const normalized = source.toLowerCase();
  if (code === "23503") {
    if (normalized.includes("employee")) return ERROR_MESSAGES.EMPLOYEE_NOT_FOUND;
    if (normalized.includes("tour")) return ERROR_MESSAGES.TOUR_NOT_FOUND;
  }
  if (code === "23505") return ERROR_MESSAGES.ALREADY_REGISTERED;
  if (code === "22P02") return ERROR_MESSAGES.INVALID_TOUR_ID;

  if (normalized.includes("employee") && normalized.includes("foreign key")) {
    return ERROR_MESSAGES.EMPLOYEE_NOT_FOUND;
  }
  if (normalized.includes("tour") && normalized.includes("foreign key")) {
    return ERROR_MESSAGES.TOUR_NOT_FOUND;
  }
  if (normalized.includes("duplicate key") || normalized.includes("unique")) {
    return ERROR_MESSAGES.ALREADY_REGISTERED;
  }
  if (normalized.includes("function public.submit_registration") && normalized.includes("does not exist")) {
    return ERROR_MESSAGES.INVALID_FUNCTION_SIGNATURE;
  }
  if (normalized.includes("invalid input syntax") && normalized.includes("integer")) {
    return ERROR_MESSAGES.INVALID_TOUR_ID;
  }
  if (normalized.includes("operator does not exist") && normalized.includes("integer = text")) {
    return ERROR_MESSAGES.INVALID_FUNCTION_SIGNATURE;
  }
  return "Có lỗi xảy ra, vui lòng thử lại.";
}

function normalizeTourId(rawTourId: string): string | number {
  const trimmed = rawTourId.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function toSnakeCaseCompanions(companions: CompanionInput[]) {
  return companions.map((companion) => ({
    id: companion.id,
    full_name: companion.fullName,
    fullName: companion.fullName,
    dob: companion.dob,
    gender: companion.gender,
    relationship: companion.relationship,
    type: companion.type,
  }));
}

function toRegistrationCompanions(companions: CompanionInput[]) {
  return companions.map((companion, index) => ({
    id: typeof companion.id === "string" ? companion.id : `companion-${index + 1}`,
    fullName: String(companion.fullName ?? ""),
    dob: String(companion.dob ?? ""),
    gender: companion.gender === "female" ? "female" : "male",
    relationship: String(companion.relationship ?? ""),
    type: companion.type === "child" ? "child" : "adult",
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const { employeeId, tourId, transportMethod, pickupPoint, companions } = req.body ?? {};
  const normalizedCompanions = Array.isArray(companions) ? (companions as CompanionInput[]) : [];

  if (typeof employeeId !== "string" || !employeeId.trim()) {
    return res.status(400).json({ ok: false, error: "MSNV không hợp lệ." });
  }
  if (typeof tourId !== "string" || !tourId.trim()) {
    return res.status(400).json({ ok: false, error: "Tour không hợp lệ." });
  }
  if (transportMethod !== "self" && transportMethod !== "tour_bus") {
    return res.status(400).json({ ok: false, error: "Phương thức di chuyển không hợp lệ." });
  }
  if (transportMethod === "tour_bus" && !PICKUP_POINTS.includes(pickupPoint)) {
    return res.status(400).json({ ok: false, error: "Điểm đón không hợp lệ." });
  }
  if (
    normalizedCompanions.length > 6 ||
    !normalizedCompanions.every((item) => isValidCompanion(item))
  ) {
    return res.status(400).json({ ok: false, error: "Thông tin người đi kèm không hợp lệ." });
  }

  try {
    const normalizedTourId = normalizeTourId(tourId);

    // Query full row to avoid column-name mismatch errors across snake_case/camelCase schemas.
    const { data: tourData, error: tourError } = await supabaseAdmin
      .from("tours")
      .select("*")
      .eq("id", normalizedTourId)
      .maybeSingle();

    if (tourError || !tourData) {
      return res.status(400).json({ ok: false, error: "Không tìm thấy tour." });
    }

    const rpcPayload = {
      p_employee_id: employeeId,
      p_tour_id: normalizedTourId,
      p_transport_method: transportMethod,
      p_pickup_point: transportMethod === "tour_bus" ? pickupPoint : null,
      p_companions: toSnakeCaseCompanions(normalizedCompanions),
      p_total_price: 0,
    };

    let { data, error } = await supabaseAdmin.rpc("submit_registration", rpcPayload);

    // Backward compatibility: some DB versions define submit_registration without p_total_price.
    if (error && (error.message ?? "").includes("submit_registration") && (error.message ?? "").includes("does not exist")) {
      ({ data, error } = await supabaseAdmin.rpc("submit_registration", {
        p_employee_id: employeeId,
        p_tour_id: normalizedTourId,
        p_transport_method: transportMethod,
        p_pickup_point: transportMethod === "tour_bus" ? pickupPoint : null,
        p_companions: toSnakeCaseCompanions(normalizedCompanions),
      }));
    }

    if (error) {
      const errorLike = error as RpcErrorLike;
      const source = `${errorLike.message ?? ""} ${errorLike.details ?? ""} ${errorLike.hint ?? ""}`;
      const code = extractPgErrorCode(source);
      const message = ERROR_MESSAGES[code] ?? mapDbErrorToUserMessage(source, errorLike.code);

      console.error("[register] rpc error", {
        message: errorLike.message,
        details: errorLike.details,
        hint: errorLike.hint,
        code: errorLike.code,
      });

      return res.status(400).json({ ok: false, error: message });
    }

    const rpcRegistration = (data ?? {}) as RpcRegistrationLike;
    const rpcTotalPrice = Number(
      (data as Record<string, unknown> | null)?.total_price ?? 0,
    );
    const registration = {
      id: String(rpcRegistration.id ?? rpcRegistration.registration_id ?? rpcRegistration.registrationId ?? ""),
      employeeId,
      tourId,
      transportMethod,
      pickupPoint: transportMethod === "tour_bus" ? pickupPoint : null,
      companions: toRegistrationCompanions(normalizedCompanions),
      totalPrice: rpcTotalPrice,
      createdAt: String(rpcRegistration.created_at ?? rpcRegistration.createdAt ?? new Date().toISOString()),
    };

    return res.status(200).json({ ok: true, registration });
  } catch (err) {
    console.error("[register] unexpected error", err);
    return res.status(500).json({ ok: false, error: "Có lỗi xảy ra, vui lòng thử lại." });
  }
}