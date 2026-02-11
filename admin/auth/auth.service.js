// auth.service.js – Supabase Auth (Login/Logout)
// Phase 1.0: ersetzt sessionStorage+SHA256 durch Supabase Auth

(function () {
  "use strict";

  async function getClientOrThrow() {
    if (!window.LTGSupabase || !window.LTGSupabase.ensureClient) {
      throw new Error("LTGSupabase fehlt. Prüfe Einbindung von api/supabase.client.js");
    }
    return await window.LTGSupabase.ensureClient();
  }

  function normalizeEmail(v) {
    return (v || "").trim().toLowerCase();
  }

  async function bindLoginIfPresent() {
    const loginForm = document.querySelector("#loginForm");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailEl = document.querySelector("#email");
      const passEl = document.querySelector("#password");

      const email = normalizeEmail(emailEl?.value);
      const password = passEl?.value || "";

      if (!email || !password) {
        alert("Bitte E-Mail und Passwort eingeben.");
        return;
      }

      try {
        const client = await getClientOrThrow();
        const { data, error } = await client.auth.signInWithPassword({ email, password });

        if (error || !data?.session) {
          alert("Login fehlgeschlagen.");
          return;
        }

        // Optional: merken für UX (nicht für Security)
        try { sessionStorage.setItem("ltg_admin_email", email); } catch { /* ignore */ }

        window.location.href = "dashboard.html";
      } catch (err) {
        console.error(err);
        alert("Login fehlgeschlagen (Konfiguration prüfen).");
      }
    });
  }

  async function bindLogoutIfPresent() {
    const logoutBtn = document.querySelector("#logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
      try {
        const client = await getClientOrThrow();
        await client.auth.signOut();
      } catch (err) {
        // Auch wenn SignOut scheitert, lassen wir den User raus
        console.error(err);
      } finally {
        try { sessionStorage.removeItem("ltg_admin_email"); } catch { /* ignore */ }
        window.location.href = "login.html";
      }
    });
  }

  window.LTGAuthService = {
    bindLoginIfPresent,
    bindLogoutIfPresent
  };
})();
