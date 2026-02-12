// supabase/functions/send-anfrage/index.ts
// Edge Function: Kundenanfrage (Kontakt & Angebot)
// - optional Signed-Links für Uploads (aus Bucket "job-applications")
// - Mail an Laila + Mayk (wie Jobs)
// Provider: Resend

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  request_id?: string;

  // Typ
  type: "kontakt" | "angebot";

  // Absender
  name: string;
  email: string;
  phone?: string | null;

  // Inhalt
  message: string;

  // Angebotsfelder
  service_type?: string | null;
  location?: string | null;

  // Uploads (Pfad im privaten Bucket)
  file_paths?: string[]; // z.B. ["anfragen/2026-02/<id>/bild1.jpg"]

  // Meta
  source?: string;
  consent?: boolean;
};

function corsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

function esc(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

function isEmailLikely(v: string) {
  // simple check (keine RFC-Validierung)
  return v.includes("@") && v.includes(".") && v.length >= 6;
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") return json(200, { ok: true });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return json(400, { error: "Invalid content-type (expected application/json)" });
    }

    const payload = (await req.json()) as Payload;

    const type = safeTrim(payload.type) as Payload["type"];
    const name = safeTrim(payload.name);
    const email = safeTrim(payload.email);
    const phone = safeTrim(payload.phone);
    const message = safeTrim(payload.message);

    const service_type = safeTrim(payload.service_type);
    const location = safeTrim(payload.location);
    const source = safeTrim(payload.source || "anfrage.html");

    if (!type || (type !== "kontakt" && type !== "angebot")) {
      return json(400, { error: "Invalid type" });
    }
    if (!name || !email || !message) {
      return json(400, { error: "Missing required fields" });
    }
    if (!isEmailLikely(email)) {
      return json(400, { error: "Invalid email" });
    }
    if (payload.consent !== true) {
      return json(400, { error: "Consent missing" });
    }

    // ---- 1) Supabase (Service Role) für Signed URLs ----
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Supabase env missing (URL / SERVICE_ROLE_KEY)" });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- 2) Signed URLs für Uploads (falls vorhanden) ----
    // Wir nutzen denselben Bucket wie beim Bewerbungs-Flow, um keine neue Storage-Infrastruktur aufzubauen.
    const BUCKET = "job-applications";
    const SIGN_SECONDS = 60 * 60 * 24 * 7; // 7 Tage

    const file_paths = Array.isArray(payload.file_paths) ? payload.file_paths : [];
    const signedLinks: { path: string; url: string }[] = [];

    for (const p of file_paths) {
      const path = safeTrim(p);
      if (!path) continue;

      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, SIGN_SECONDS);
      if (error) return json(500, { error: "Signed URL failed: " + error.message });

      if (data?.signedUrl) {
        signedLinks.push({ path, url: data.signedUrl });
      }
    }

    // ---- 3) Mail senden (Resend) ----
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "no-reply@laila-thun-gebaeudereinigung.de";

    // Empfänger wie bei Jobs: an beide
    const TO_1 = "laila.thun@web.de";
    const TO_2 = "mayk-fuhrmann@web.de";

    if (!RESEND_API_KEY) {
      return json(500, { error: "Mail not configured (RESEND_API_KEY missing)" });
    }

    const subject =
      type === "angebot"
        ? "Neue Angebotsanfrage – Laila Thun Gebäudereinigung"
        : "Neue Kontaktanfrage – Laila Thun Gebäudereinigung";

    const offerBlock =
      type === "angebot"
        ? (
            `<h3>Details (Angebot)</h3>` +
            `<ul>` +
            `<li><strong>Art der Reinigung:</strong> ${esc(service_type || "-")}</li>` +
            `<li><strong>Adresse / Ort:</strong> ${esc(location || "-")}</li>` +
            `</ul>`
          )
        : "";

    const filesBlock =
      signedLinks.length > 0
        ? (
            `<h3>Dateien (Download 7 Tage)</h3>` +
            `<ul>` +
            signedLinks.map(x => `<li><a href="${esc(x.url)}">${esc(x.path)}</a></li>`).join("") +
            `</ul>`
          )
        : `<p><em>Keine Dateien angehängt.</em></p>`;

    const html =
      `<h2>${type === "angebot" ? "Neue Angebotsanfrage" : "Neue Kontaktanfrage"}</h2>` +
      `<p>` +
      `<strong>Name:</strong> ${esc(name)}<br>` +
      `<strong>E-Mail:</strong> ${esc(email)}<br>` +
      `<strong>Telefon:</strong> ${esc(phone || "-")}` +
      `</p>` +
      `<hr>` +
      offerBlock +
      `<hr>` +
      `<h3>Nachricht</h3>` +
      `<p style="white-space:pre-wrap;">${esc(message)}</p>` +
      `<hr>` +
      filesBlock +
      `<hr>` +
      `<p><small>Quelle: ${esc(source)}</small></p>`;

    // Zusätzlich eine Text-Variante (hilft bei Mail-Clients / Forwarding)
    const text =
      `${type === "angebot" ? "Neue Angebotsanfrage" : "Neue Kontaktanfrage"}\n\n` +
      `Name: ${name}\n` +
      `E-Mail: ${email}\n` +
      `Telefon: ${phone || "-"}\n\n` +
      (type === "angebot"
        ? `Details (Angebot)\n- Art der Reinigung: ${service_type || "-"}\n- Adresse/Ort: ${location || "-"}\n\n`
        : "") +
      `Nachricht:\n${message}\n\n` +
      (signedLinks.length
        ? `Dateien (Download 7 Tage):\n` + signedLinks.map(x => `- ${x.path}: ${x.url}`).join("\n") + `\n\n`
        : `Dateien: keine\n\n`) +
      `Quelle: ${source}`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_1, TO_2],
        subject,
        html,
        text,
        // wichtig: direkt antwortbar auf Kundenadresse
        reply_to: email,
      }),
    });

    if (!resendResp.ok) {
      const t = await resendResp.text();
      return json(500, { error: "Mail send failed: " + t });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String((e as any)?.message || e) });
  }
});
