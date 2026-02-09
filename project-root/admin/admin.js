// admin.js – Bootstrap (KEINE Business-Logik)
// Phase 1.0 Start: Supabase-Client + Auth (statt sessionStorage/SHA256)

(function () {
  "use strict";

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).some(s => (s.getAttribute("src") || "") === src);
      if (existing) return resolve();

      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Konnte Script nicht laden: " + src));
      document.head.appendChild(s);
    });
  }

  async function ensureCoreLoaded() {
    // 1) Supabase Client bereitstellen
    await loadScriptOnce("../api/supabase.client.js");
    if (!window.LTGSupabase || !window.LTGSupabase.ensureClient) {
      throw new Error("Supabase Client nicht geladen (LTGSupabase fehlt).");
    }

    // 2) Auth Module bereitstellen
    await loadScriptOnce("auth/auth.service.js");
    await loadScriptOnce("auth/auth.guard.js");

    if (!window.LTGAuthService || !window.LTGAuthGuard) {
      throw new Error("Auth-Module wurden nicht korrekt geladen (LTGAuthService/LTGAuthGuard fehlen).");
    }
  }

  async function init() {
    await ensureCoreLoaded();

    // Guard ist jetzt async (Supabase Session)
    await window.LTGAuthGuard.guardDashboardIfNeeded();

    // Login/Logout binden
    await window.LTGAuthService.bindLoginIfPresent();
    await window.LTGAuthService.bindLogoutIfPresent();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
      alert("Admin konnte nicht initialisiert werden. Details in der Konsole (F12).");
    });
  });
})();
