/* api/jobs.api.js
   Public Jobs API + Bewerbung absenden (Edge Function)

   - Lädt veröffentlichte Jobs aus Supabase (Table: public.job_postings)
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
    // Wir lassen bewusst viele mögliche Feldnamen zu, weil dein Schema variieren kann.
    // jobs.html rendert defensiv.
    return {
      id: row.id ?? row.job_id ?? row.slug ?? null,
      title: row.title ?? row.job_title ?? row.jobrole ?? "",
      type: row.type ?? row.art ?? row.employment_type ?? "",
      hours: row.hours_per_week ?? row.hours ?? row.stunden_pro_woche ?? null,
      region: row.region ?? row.location ?? row.ort_region ?? "",
      tasks: row.tasks ?? row.aufgaben ?? "",
      requirements: row.requirements ?? row.anforderungen ?? "",
      weOffer: row.we_offer ?? row.offer ?? row.wir_bieten ?? "",
      contact: row.contact ?? row.contact_email ?? row.kontakt ?? "",
      published: row.published ?? row.is_published ?? row.veroeffentlicht ?? false,
      created_at: row.created_at ?? null
    };
  }

  async function getPublishedJobs() {
    const supa = await requireSupabase();

    // Wichtig: Table heißt bei dir sehr wahrscheinlich "job_postings"
    // published-Flag kann heißen: published / is_published / veroeffentlicht
    // -> wir versuchen erst "is_published", dann fallback "published".
    let res = await supa
      .from("job_postings")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (res.error) {
      // fallback: anderes published-field
      res = await supa
        .from("job_postings")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
    }

    if (res.error) throw new Error(res.error.message);

    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(normalizeJob);
  }

  async function submitApplication(payload) {
    const supa = await requireSupabase();

    // Edge Function Invoke (Supabase kümmert sich um URL + apikey Header)
    const { data, error } = await supa.functions.invoke("send-application", {
      body: payload
    });

    if (error) {
      // Supabase liefert oft nur "FunctionsHttpError" -> wir geben sinnvoller zurück
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
