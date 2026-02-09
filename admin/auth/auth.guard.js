// auth.guard.js – Supabase Session Guard
// Phase 1.0: schützt dashboard.html per Supabase Session

(function () {
  "use strict";

  function redirectToLogin() {
    window.location.href = "login.html";
  }

  async function guardDashboardIfNeeded() {
    const isDashboard = document.body.classList.contains("admin-dashboard");
    if (!isDashboard) return;

    if (!window.LTGSupabase || !window.LTGSupabase.ensureClient) {
      redirectToLogin();
      return;
    }

    try {
      const client = await window.LTGSupabase.ensureClient();
      const { data, error } = await client.auth.getSession();

      if (error || !data?.session) {
        redirectToLogin();
      }
    } catch (err) {
      console.error(err);
      redirectToLogin();
    }
  }

  window.LTGAuthGuard = {
    redirectToLogin,
    guardDashboardIfNeeded
  };
})();
