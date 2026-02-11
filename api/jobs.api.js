// api/jobs.api.js
"use strict";

async function requireClient() {
  const supa = window.LTGSupabase;
  if (!supa || typeof supa.ensureClient !== "function") {
    throw new Error("Supabase client not initialized");
  }

  // WICHTIG: immer ensureClient() verwenden (Race-Condition vermeiden)
  const client = await supa.ensureClient();
  if (!client) throw new Error("Supabase client not initialized");
  return client;
}

export async function listPublishedJobs() {
  const client = await requireClient();
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function listAllJobsAdmin() {
  const client = await requireClient();
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createJob(payload) {
  const client = await requireClient();
  const { data, error } = await client
    .from("jobs")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJob(id, payload) {
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

export async function deleteJob(id) {
  const client = await requireClient();
  const { error } = await client
    .from("jobs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
