/* api/jobs.api.js
   Public Jobs API + Bewerbung absenden (Edge Function)

   - Lädt veröffentlichte Jobs aus Supabase (Table: public.jobs)
   - Sendet Bewerbungen an Edge Function: send-application
   - Keine Service-Keys im Frontend! (nur anon-key über supabase.client.js)
*/
(() => {
  "use strict";

  function requireSupabase() {
    if (!window.LTGSupabase || typeof window.LTGSupabase.ensureClient !== "function") {
      throw new Error("Supabase client missing. Prüfe: supabase.client.js ist geladen.");
    }
    return window.LTGSupabase.ensureClient();
  }

  function normalizeJob(row) {
    return {
      id: row.id ?? null,
      title: row.title ?? "",
      type: row.type ?? "",
      hours: row.hours ?? null,
      location: row.location ?? "",
      tasks: row.tasks ?? "",
      requirements: row.requirements ?? "",
      benefits: row.benefits ?? "",
      contact: row.contact ?? "",
      published: row.published ?? false,
      created_at: row.created_at ?? null
    };
  }

  async function getPublishedJobs() {
    const supa = await requireSupabase();

    const { data, error } = await supa
      .from("jobs")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map(normalizeJob);
  }

  async function submitApplication(payload) {
    const supa = await requireSupabase();

    const { data, error } = await supa.functions.invoke("send-application", {
      body: payload
    });

    if (error) {
      throw new Error(error.message || "Bewerbung konnte nicht gesendet werden.");
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  window.JobsAPI = {
    getPublishedJobs,
    submitApplication
  };
})();
