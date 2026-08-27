import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionCookie, verifySessionToken } from "../_lib/adminSession.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const authenticated = verifySessionToken(getSessionCookie(req));
  return res.status(200).json({ authenticated });
}

