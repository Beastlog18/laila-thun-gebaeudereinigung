// api/jobs.api.js
// Klassisches Browser-Script (kein ESM), stellt window.JobsAPI bereit
"use strict";

(() => {
  async function requireClient() {
    const supa = window.LTGSupabase;
    if (!supa || typeof supa.ensureClient !== "function") {
      throw new Error("Supabase client not initialized (LTGSupabase.ensureClient missing)");
    }

    // WICHTIG: immer ensureClient() verwenden (Race-Condition vermeiden)
    const client = await supa.ensureClient();
    if (!client) throw new Error("Supabase client not initialized (client missing)");
    return client;
  }

  async function getPublishedJobs() {
    const client = await requireClient();
    const { data, error } = await client
      .from("jobs")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function listPublishedJobs() {
    // Alias (falls irgendwo noch der alte Name genutzt wird)
    return getPublishedJobs();
  }

  async function listAllJobsAdmin() {
    const client = await requireClient();
    const { data, error } = await client
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function createJob(payload) {
    const client = await requireClient();
    const { data, error } = await client
      .from("jobs")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function updateJob(id, payload) {
    const client = await requireClient();
    const { data, error } = await client
      .from("jobs")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function deleteJob(id) {
    const client = await requireClient();
    const { error } = await client
      .from("jobs")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }

  // Global API (wird von jobs.html erwartet)
  window.JobsAPI = {
    // öffentlich (jobs.html)
    getPublishedJobs,

    // Aliase / kompatibel
    listPublishedJobs,

    // admin-nah
    listAllJobsAdmin,
    createJob,
    updateJob,
    deleteJob,
  };
})();
