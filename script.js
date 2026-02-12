document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const form = document.querySelector("#anfrageForm");
  if (!form) return; // script.js wird siteweit geladen – nur auf Anfrage-Seite aktiv werden

  const requestType = document.querySelector("#requestType");
  const offerFields = document.querySelector("#offerFields");
  const offerUploads = document.querySelector("#offerUploads");

  const serviceType = document.querySelector("#serviceType");
  const locationEl = document.querySelector("#location");

  const nameEl = document.querySelector("#name");
  const emailEl = document.querySelector("#email");
  const phoneEl = document.querySelector("#phone");
  const messageEl = document.querySelector("#message");

  const filesEl = document.querySelector("#files");
  const privacyEl = document.querySelector("#privacy");

  const statusEl = document.querySelector("#formStatus");
  const submitBtn = document.querySelector("#submitBtn");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function setBusy(isBusy) {
    if (submitBtn) submitBtn.disabled = !!isBusy;
  }

  function updateOfferVisibility() {
    const isOffer = requestType && requestType.value === "angebot";
    if (offerFields) offerFields.style.display = isOffer ? "block" : "none";
    if (offerUploads) offerUploads.style.display = isOffer ? "block" : "none";
  }

  if (requestType) {
    requestType.addEventListener("change", updateOfferVisibility);
    updateOfferVisibility();
  }

  function safeTrim(v) {
    return String(v ?? "").trim();
  }

  function requireSupabase() {
    if (!window.LTGSupabase || typeof window.LTGSupabase.ensureClient !== "function") {
      throw new Error("Supabase client missing. Prüfe: api/supabase.client.js ist geladen.");
    }
    return window.LTGSupabase;
  }

  function getExt(name) {
    const i = String(name || "").lastIndexOf(".");
    return i >= 0 ? name.slice(i) : "";
  }

  function sanitizeFilename(name) {
    return String(name || "datei")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  async function uploadFilesIfAny(client, requestId, files) {
    // Wir nutzen den bestehenden Bucket aus dem Bewerbungsflow, um keine neue Storage-Infrastruktur anzulegen.
    // Pfad: anfragen/YYYY-MM/<requestId>/<filename>
    const BUCKET = "job-applications";

    if (!files || files.length === 0) return [];

    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const uploadedPaths = [];

    for (const f of files) {
      const orig = sanitizeFilename(f.name);
      const ext = getExt(orig);
      const base = ext ? orig.slice(0, -ext.length) : orig;
      const filename = `${base}${ext}`;

      const path = `anfragen/${ym}/${requestId}/${filename}`;

      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type || "application/octet-stream",
        });

      if (error) {
        throw new Error(`Upload fehlgeschlagen (${filename}): ${error.message}`);
      }

      uploadedPaths.push(path);
    }

    return uploadedPaths;
  }

  async function sendRequest(payload) {
    const supa = requireSupabase();
    const client = await supa.ensureClient();

    // Edge Function Invoke (supabase-js)
    const { data, error } = await client.functions.invoke("send-anfrage", {
      body: payload,
    });

    if (error) {
      throw new Error(error.message || "Edge Function Fehler");
    }

    if (!data || data.ok !== true) {
      throw new Error((data && data.error) ? String(data.error) : "Unbekannter Fehler beim Versand");
    }

    return data;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      setStatus("");
      setBusy(true);

      const type = safeTrim(requestType && requestType.value);
      if (!type) throw new Error("Bitte wähle aus, worum es geht.");

      const name = safeTrim(nameEl && nameEl.value);
      const email = safeTrim(emailEl && emailEl.value);
      const phone = safeTrim(phoneEl && phoneEl.value);
      const message = safeTrim(messageEl && messageEl.value);

      if (!name || !email || !message) {
        throw new Error("Bitte Name, E-Mail und Nachricht ausfüllen.");
      }

      if (!privacyEl || privacyEl.checked !== true) {
        throw new Error("Bitte Datenschutz-Einwilligung bestätigen.");
      }

      const isOffer = type === "angebot";
      const service = safeTrim(serviceType && serviceType.value);
      const location = safeTrim(locationEl && locationEl.value);

      // Uploads nur bei Angebot (UI blendet das auch so ein)
      const fileList = (isOffer && filesEl && filesEl.files) ? Array.from(filesEl.files) : [];
      const requestId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

      setStatus("Sende Anfrage…");

      // 1) Uploads (optional)
      let file_paths = [];
      if (fileList.length > 0) {
        setStatus("Lade Dateien hoch…");
        const supa = requireSupabase();
        const client = await supa.ensureClient();
        file_paths = await uploadFilesIfAny(client, requestId, fileList);
      }

      // 2) Mail via Edge Function
      setStatus("Versende Mail…");

      const payload = {
        request_id: requestId,
        type, // "kontakt" | "angebot"
        name,
        email,
        phone: phone || null,
        message,
        consent: true,
        source: "anfrage.html",

        // Angebotsfelder
        service_type: isOffer ? (service || null) : null,
        location: isOffer ? (location || null) : null,

        // Uploads
        file_paths,
      };

      await sendRequest(payload);

      setStatus("✅ Anfrage wurde gesendet. Danke! Wir melden uns zeitnah zurück.");
      form.reset();
      updateOfferVisibility();
    } catch (err) {
      console.error(err);
      setStatus("❌ " + String(err && err.message ? err.message : err));
    } finally {
      setBusy(false);
    }
  });
});
