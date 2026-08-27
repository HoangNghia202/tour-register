import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSessionToken, setSessionCookie } from "../_lib/adminSession.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ ok: false, error: "Server chưa được cấu hình." });
  }

  const { password } = req.body ?? {};

  if (typeof password !== "string" || password !== adminPassword) {
    return res.status(401).json({ ok: false, error: "Mật khẩu không đúng, vui lòng thử lại." });
  }

  setSessionCookie(res, createSessionToken());
  return res.status(200).json({ ok: true });
}

