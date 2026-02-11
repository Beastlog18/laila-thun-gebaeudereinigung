(() => {
  "use strict";

  // STORAGE_KEY bleibt als Legacy-Konstante drin, wird aber nicht mehr genutzt (Supabase ist Quelle)
  const STORAGE_KEY = "ltg_jobs_v1";

  // Draft für Reload-Schutz (Form-Zwischenspeicher)
  // sessionStorage = Draft bleibt nur in diesem Tab/Browserfenster (gewollt)
  const DRAFT_KEY = "ltg_jobs_draft_v1";
  const DRAFT_SAVE_DEBOUNCE_MS = 300;

  const els = {};
  const state = {
    editingId: null,
    isDirty: false,
    suppressDirty: false,
    dirtyBannerEl: null,
    toastEl: null,
    toastTimer: null,

    // Draft debounce
    draftTimer: null,

    // Legacy
    api: null
  };

  function qs(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function uid() { return "job_" + Math.random().toString(16).slice(2) + "_" + Date.now(); } // Legacy, nicht mehr genutzt
  function safeText(v) { return (v ?? "").toString().trim(); }

  /* =========================
     Supabase API (NEU)
     ========================= */

  async function ensureDb() {
    if (!window.LTGSupabase || typeof window.LTGSupabase.ensureClient !== "function") {
      throw new Error("Supabase Client nicht verfügbar (LTGSupabase fehlt).");
    }
    return await window.LTGSupabase.ensureClient();
  }

  function mapRowToJob(row) {
    return {
      id: row.id ?? row.job_id ?? row.slug ?? null,
      title: row.title ?? row.job_title ?? row.jobrole ?? "",
      type: row.type ?? row.art ?? row.employment_type ?? "",
      hours: row.hours_per_week ?? row.hours ?? row.stunden_pro_woche ?? "",
      location: row.location ?? row.region ?? row.ort_region ?? "",
      tasks: row.tasks ?? row.aufgaben ?? "",
      requirements: row.requirements ?? row.anforderungen ?? "",
      benefits: row.we_offer ?? row.offer ?? row.wir_bieten ?? row.benefits ?? "",
      contact: row.contact ?? row.contact_email ?? row.kontakt ?? "",
      published: row.is_published ?? row.published ?? row.veroeffentlicht ?? false,
      preview: row.preview ?? "",
      created_at: row.created_at ?? null
    };
  }

  // Hilfsfunktion: versucht nacheinander mehrere Supabase-Operationen (Fallbacks bei abweichendem Schema)
  async function tryOps(ops) {
    let lastErr = null;
    for (const op of ops) {
      const res = await op();
      if (!res || !res.error) return res;
      lastErr = res.error;
    }
    throw new Error(lastErr?.message || "DB-Operation fehlgeschlagen.");
  }

  async function loadJobs() {
    const supa = await ensureDb();

    const res = await tryOps([
      () => supa.from("job_postings").select("*").order("created_at", { ascending: false }),
    ]);

    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapRowToJob);
  }

  async function createJobDb(payload) {
    const supa = await ensureDb();

    const rowPrimary = {
      title: payload.title,
      type: payload.type,
      hours_per_week: payload.hours || null,
      location: payload.location,
      tasks: payload.tasks,
      requirements: payload.requirements,
      we_offer: payload.benefits,
      contact: payload.contact,
      is_published: !!payload.published,
      preview: payload.preview || null,
      created_at: nowIso()
    };

    const rowFallback = {
      title: payload.title,
      type: payload.type,
      hours: payload.hours || null,
      region: payload.location,
      tasks: payload.tasks,
      requirements: payload.requirements,
      benefits: payload.benefits,
      contact: payload.contact,
      published: !!payload.published,
      preview: payload.preview || null,
      created_at: nowIso()
    };

    const res = await tryOps([
      () => supa.from("job_postings").insert([rowPrimary]).select("*").single(),
      () => supa.from("job_postings").insert([rowFallback]).select("*").single(),
    ]);

    return mapRowToJob(res.data || {});
  }

  async function updateJobDb(id, payload) {
    const supa = await ensureDb();
    if (!id) throw new Error("updateJobDb: id fehlt.");

    const patchPrimary = {
      title: payload.title,
      type: payload.type,
      hours_per_week: payload.hours || null,
      location: payload.location,
      tasks: payload.tasks,
      requirements: payload.requirements,
      we_offer: payload.benefits,
      contact: payload.contact,
      is_published: !!payload.published,
      preview: payload.preview || null
    };

    const patchFallback = {
      title: payload.title,
      type: payload.type,
      hours: payload.hours || null,
      region: payload.location,
      tasks: payload.tasks,
      requirements: payload.requirements,
      benefits: payload.benefits,
      contact: payload.contact,
      published: !!payload.published,
      preview: payload.preview || null
    };

    const res = await tryOps([
      () => supa.from("job_postings").update(patchPrimary).eq("id", id).select("*").single(),
      () => supa.from("job_postings").update(patchPrimary).eq("job_id", id).select("*").single(),
      () => supa.from("job_postings").update(patchFallback).eq("id", id).select("*").single(),
      () => supa.from("job_postings").update(patchFallback).eq("job_id", id).select("*").single(),
    ]);

    return mapRowToJob(res.data || {});
  }

  async function deleteJobDb(id) {
    const supa = await ensureDb();
    if (!id) throw new Error("deleteJobDb: id fehlt.");

    await tryOps([
      () => supa.from("job_postings").delete().eq("id", id),
      () => supa.from("job_postings").delete().eq("job_id", id),
    ]);

    return true;
  }

  /* =========================
     Dirty / UI
     ========================= */

  function setDirty(isDirty) {
    if (state.suppressDirty) return;
    state.isDirty = !!isDirty;
    updateDirtyUi();

    // Draft automatisch sichern, sobald dirty gesetzt wird
    if (state.isDirty) scheduleDraftSave();
  }

  function markDirty() { setDirty(true); }

  function clearDirty() {
    state.isDirty = false;
    updateDirtyUi();
  }

  function ensureDirtyBanner() {
    if (state.dirtyBannerEl) return state.dirtyBannerEl;
    if (!els.jobsModule) return null;

    const box = document.createElement("div");
    box.style.display = "none";
    box.style.margin = "10px 0 12px 0";
    box.style.padding = "10px 12px";
    box.style.borderRadius = "10px";
    box.style.border = "1px solid rgba(0,0,0,0.12)";
    box.style.background = "rgba(245,158,11,0.10)";
    box.style.color = "#7c2d12";
    box.style.fontSize = "13px";
    box.style.lineHeight = "1.35";
    box.textContent = "Ungespeicherte Änderungen.";

    els.jobsModule.insertBefore(box, els.jobsModule.firstChild);
    state.dirtyBannerEl = box;
    return box;
  }

  function ensureToast() {
    if (state.toastEl) return state.toastEl;
    if (!els.jobsModule) return null;

    const t = document.createElement("div");
    t.style.position = "sticky";
    t.style.top = "10px";
    t.style.zIndex = "50";
    t.style.display = "none";
    t.style.margin = "0 0 12px 0";
    t.style.padding = "10px 12px";
    t.style.borderRadius = "10px";
    t.style.border = "1px solid rgba(0,0,0,0.12)";
    t.style.background = "rgba(0,80,158,0.08)";
    t.style.color = "#003f7d";
    t.style.fontSize = "13px";
    t.style.lineHeight = "1.35";

    els.jobsModule.insertBefore(t, els.jobsModule.firstChild);
    state.toastEl = t;
    return t;
  }

  function notify(msg, type = "info") {
    const el = ensureToast();
    if (!el) return;

    if (state.toastTimer) window.clearTimeout(state.toastTimer);

    el.style.display = "block";
    el.textContent = msg;

    if (type === "success") {
      el.style.background = "rgba(16,185,129,0.12)";
      el.style.color = "#065f46";
      el.style.borderColor = "rgba(16,185,129,0.35)";
    } else if (type === "error") {
      el.style.background = "rgba(239,68,68,0.10)";
      el.style.color = "#7f1d1d";
      el.style.borderColor = "rgba(239,68,68,0.35)";
    } else if (type === "warn") {
      el.style.background = "rgba(245,158,11,0.10)";
      el.style.color = "#7c2d12";
      el.style.borderColor = "rgba(245,158,11,0.35)";
    } else {
      el.style.background = "rgba(0,80,158,0.08)";
      el.style.color = "#003f7d";
      el.style.borderColor = "rgba(0,0,0,0.12)";
    }

    state.toastTimer = window.setTimeout(() => {
      el.style.display = "none";
    }, 2400);
  }

  function updateDirtyUi() {
    const banner = ensureDirtyBanner();
    if (!banner) return;

    const currentPublished = !!els.jobPublished?.checked;
    if (state.isDirty) {
      banner.style.display = "block";
      banner.textContent = currentPublished
        ? "Achtung: Du bearbeitest gerade einen veröffentlichten Job. Speichere, um die veröffentlichten Daten zu aktualisieren – oder setze ihn auf Entwurf."
        : "Ungespeicherte Änderungen – bitte speichern oder zurücksetzen.";
    } else {
      banner.style.display = "none";
    }

    if (els.jobSaveBtn) {
      const base = state.editingId ? "Änderungen speichern" : "Job speichern";
      els.jobSaveBtn.textContent = state.isDirty ? `${base} *` : base;
    }
  }

  function confirmLeaveIfDirty(actionLabel = "fortfahren") {
    if (!state.isDirty) return true;
    return confirm(`Es gibt ungespeicherte Änderungen.\n\nTrotzdem ${actionLabel}?`);
  }

  function splitLines(text) {
    const t = safeText(text);
    if (!t) return [];
    return t
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^\-\s*/, ""));
  }

  function typeLabel(type) {
    if (type === "minijob") return "Minijob";
    if (type === "teilzeit") return "Teilzeit";
    if (type === "vollzeit") return "Vollzeit";
    return "";
  }

  /* =========================
     Draft (Reload-Schutz)
     ========================= */

  function readDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeDraft(payload) {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function scheduleDraftSave() {
    if (state.draftTimer) window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(() => {
      state.draftTimer = null;
      saveDraftNow();
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }

  function saveDraftNow() {
    try {
      const job = getFormData();
      writeDraft({
        editingId: state.editingId,
        job
      });
    } catch (_) {}
  }

  function restoreDraftIfAvailable() {
    const d = readDraft();
    if (!d || !d.job) return;

    // nur restore, wenn aktuell noch nix eingegeben wurde
    const hasAny =
      safeText(els.jobHours?.value) ||
      safeText(els.jobLocation?.value) ||
      safeText(els.jobTasks?.value) ||
      safeText(els.jobReq?.value) ||
      safeText(els.jobBenefits?.value) ||
      safeText(els.jobContact?.value);

    if (hasAny) return;

    state.suppressDirty = true;
    state.editingId = d.editingId || null;

    setFormData(d.job);

    state.suppressDirty = false;
    setDirty(true);
    notify("Entwurf wiederhergestellt (Reload-Schutz).", "warn");
  }

  /* =========================
     Content helpers
     ========================= */

  function bulletsOrDefault(text, kind) {
    const arr = splitLines(text);
    if (arr.length) return arr;

    if (kind === "tasks") {
      return [
        "Reinigung von Treppenhäusern, Büros oder Objekten nach Plan",
        "Sorgfältiger Umgang mit Material und Ausstattung",
        "Dokumentation nach Bedarf"
      ];
    }
    if (kind === "requirements") {
      return [
        "Zuverlässigkeit und Pünktlichkeit",
        "Sorgfältige Arbeitsweise",
        "Freundliches Auftreten"
      ];
    }
    if (kind === "benefits") {
      return [
        "Feste Absprachen und Einarbeitung",
        "Arbeitszeiten nach Absprache",
        "Langfristige Zusammenarbeit"
      ];
    }
    return ["–"];
  }

  function norm(s) {
    return safeText(s)
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function titleCaseLocation(s) {
    return safeText(s)
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function normalizeLocation(locRaw) {
    const raw = safeText(locRaw);
    if (!raw) return "";
    const n = norm(raw);

    if (n === "kw" || n === "k w" || n === "k.w" || n === "k.w.") {
      return "Königs Wusterhausen";
    }
    if (n === "konigs wusterhausen" || n === "königs wusterhausen") {
      return "Königs Wusterhausen";
    }

    return titleCaseLocation(raw);
  }

  function buildTitle(role, extra) {
    const r = safeText(role);
    const e = safeText(extra);
    if (!r && !e) return "";
    if (!r) return e;
    if (!e) return r;
    return `${r} – ${e}`;
  }

  function getSelectedOrFreeRole() {
    const selected = safeText(els.jobTitle?.value);
    if (selected) return selected;
    return safeText(els.jobTitleFree?.value);
  }

  function buildPreview(job) {
    const title = safeText(job.title);
    const type = typeLabel(job.type);
    const hours = safeText(job.hours);
    const location = safeText(job.location);
    const contact = safeText(job.contact) || "Melde dich gern über unsere Kontaktseite.";

    const tasks = bulletsOrDefault(job.tasks, "tasks");
    const req   = bulletsOrDefault(job.requirements, "requirements");
    const ben   = bulletsOrDefault(job.benefits, "benefits");

    const metaParts = [];
    if (type) metaParts.push(type);
    if (hours) metaParts.push(`${hours} Std./Woche`);
    if (location) metaParts.push(location);

    const meta = metaParts.join(" · ");

    const lines = [];
    lines.push(title || "Stellenangebot");
    if (meta) lines.push(meta);
    lines.push("");

    lines.push("Wir sind ein familiäres Reinigungsunternehmen mit Anspruch an Qualität, Zuverlässigkeit und ein respektvolles Miteinander.");
    lines.push("Zur Verstärkung unseres Teams suchen wir Menschen, die ihre Arbeit sorgfältig erledigen und sich aufeinander verlassen können.");
    lines.push("");

    lines.push("Deine Aufgaben:");
    tasks.forEach(x => lines.push(`• ${x}`));
    lines.push("");

    lines.push("Das wünschen wir uns:");
    req.forEach(x => lines.push(`• ${x}`));
    lines.push("");

    lines.push("Das bieten wir dir:");
    ben.forEach(x => lines.push(`• ${x}`));
    lines.push("");

    lines.push("Wenn du dir vorstellen kannst, Teil unseres Teams zu werden, freuen wir uns auf deine Nachricht.");
    lines.push(`Kontakt: ${contact}`);

    return lines.join("\n");
  }

  function getFormData() {
    const role = getSelectedOrFreeRole();

    return {
      title: buildTitle(role, els.jobTitleExtra?.value),
      type: safeText(els.jobType?.value),
      hours: safeText(els.jobHours?.value),
      location: normalizeLocation(els.jobLocation?.value),
      tasks: safeText(els.jobTasks?.value),
      requirements: safeText(els.jobReq?.value),
      benefits: safeText(els.jobBenefits?.value),
      contact: safeText(els.jobContact?.value),
      published: !!els.jobPublished?.checked
    };
  }

  function setFormData(job) {
    state.suppressDirty = true;
    if (els.jobTitle) els.jobTitle.value = job?.title || "";
    if (els.jobTitleFree) els.jobTitleFree.value = "";
    if (els.jobTitleExtra) els.jobTitleExtra.value = "";

    if (els.jobType) els.jobType.value = job?.type || "";
    if (els.jobHours) els.jobHours.value = job?.hours || "";
    if (els.jobLocation) els.jobLocation.value = job?.location || "";
    if (els.jobTasks) els.jobTasks.value = job?.tasks || "";
    if (els.jobReq) els.jobReq.value = job?.requirements || "";
    if (els.jobBenefits) els.jobBenefits.value = job?.benefits || "";
    if (els.jobContact) els.jobContact.value = job?.contact || "";
    if (els.jobPublished) els.jobPublished.checked = !!job?.published;

    if (els.jobPreview) els.jobPreview.value = buildPreview(getFormData());
    updateFreeRoleUi();
    state.suppressDirty = false;
    clearDirty();
  }

  function validate(job) {
    const roleSelected = safeText(els.jobTitle?.value);
    const roleFree = safeText(els.jobTitleFree?.value);

    if (!roleSelected && !roleFree) return "Bitte Jobrolle wählen oder bei „Sonstiges“ eine Jobrolle eingeben.";
    if (!job.title) return "Bitte Jobrolle eingeben.";
    if (!job.type) return "Bitte Art wählen.";
    if (!job.location) return "Bitte Ort/Region ausfüllen.";
    return null;
  }

  // Export (NEU): aus DB laden und als JSON herunterladen
  async function exportJobsAsJson() {
    try {
      const jobs = await loadJobs();
      const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "jobs.json";
      document.body.appendChild(a);
      a.click();

      notify("jobs.json exportiert.", "success");

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(e?.message || "Export fehlgeschlagen.", "error");
    }
  }

  async function togglePublished(jobId, currentPublished) {
    if (!confirmLeaveIfDirty("den Status ändern")) return;

    try {
      await updateJobDb(jobId, { published: !currentPublished });
      notify(!currentPublished ? "Job veröffentlicht." : "Job deaktiviert (Entwurf).", "success");
      await renderList();
    } catch (e) {
      notify(e?.message || "Status konnte nicht geändert werden.", "error");
    }
  }

  async function renderList() {
    let jobs = [];
    try {
      jobs = await loadJobs();
    } catch (e) {
      els.jobsList.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Jobs konnten nicht geladen werden (DB/Policy).";
      els.jobsList.appendChild(p);
      notify(e?.message || "Jobs laden fehlgeschlagen.", "error");
      return;
    }

    els.jobsList.innerHTML = "";

    if (!jobs.length) {
      const p = document.createElement("p");
      p.textContent = "Noch keine Jobs gespeichert.";
      els.jobsList.appendChild(p);
      return;
    }

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn-secondary";
    exportBtn.textContent = "Jobs als JSON exportieren";
    exportBtn.onclick = exportJobsAsJson;
    els.jobsList.appendChild(exportBtn);

    jobs.forEach(job => {
      const wrap = document.createElement("div");
      wrap.className = "admin-item";

      const title = document.createElement("div");
      title.className = "admin-item-title";
      title.textContent = job.title || "(Ohne Titel)";

      const meta = document.createElement("div");
      meta.className = "admin-item-meta";
      meta.textContent = [
        typeLabel(job.type),
        job.hours ? `${job.hours} Std./Woche` : "",
        job.location || "",
        job.published ? "✅ veröffentlicht" : "⏸️ Entwurf"
      ].filter(Boolean).join(" · ");

      const btnRow = document.createElement("div");
      btnRow.className = "admin-item-actions";

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.textContent = job.published ? "Deaktivieren" : "Veröffentlichen";
      toggleBtn.className = job.published ? "btn-danger" : "btn-success";
      toggleBtn.onclick = () => togglePublished(job.id, !!job.published);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Bearbeiten";
      editBtn.onclick = () => {
        if (!confirmLeaveIfDirty("zum Bearbeiten wechseln")) return;
        state.editingId = job.id;
        setFormData(job);
        if (els.jobSaveBtn) els.jobSaveBtn.textContent = "Änderungen speichern";
        clearDraft();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Löschen";
      delBtn.onclick = async () => {
        if (!confirmLeaveIfDirty("löschen")) return;
        if (!confirm(`Job wirklich löschen?\n\n${job.title}`)) return;

        try {
          await deleteJobDb(job.id);
          if (state.editingId === job.id) resetForm();
          await renderList();
          notify("Job gelöscht.", "success");
        } catch (e) {
          notify(e?.message || "Löschen fehlgeschlagen.", "error");
        }
      };

      btnRow.append(toggleBtn, editBtn, delBtn);
      wrap.append(title, meta, btnRow);
      els.jobsList.appendChild(wrap);
    });
  }

  function resetForm() {
    state.suppressDirty = true;
    state.editingId = null;
    if (els.jobsForm) els.jobsForm.reset();
    if (els.jobPublished) els.jobPublished.checked = false;
    if (els.jobPreview) els.jobPreview.value = buildPreview(getFormData());
    if (els.jobSaveBtn) els.jobSaveBtn.textContent = "Job speichern";
    updateFreeRoleUi();
    state.suppressDirty = false;

    clearDirty();
    clearDraft();
  }

  function updateFreeRoleUi() {
    if (!els.jobTitleFree || !els.jobTitle) return;
    const isFree = safeText(els.jobTitle.value) === "";
    els.jobTitleFree.disabled = !isFree;
    if (!isFree) els.jobTitleFree.value = "";
  }

  function bindEvents() {
    const updatePreview = () => {
      if (!els.jobPreview) return;
      els.jobPreview.value = buildPreview(getFormData());
    };

    if (els.jobTitle) {
      els.jobTitle.addEventListener("change", () => {
        updateFreeRoleUi();
        updatePreview();
        if (!state.suppressDirty) {
          markDirty();
          scheduleDraftSave();
        }
      });
    }

    if (els.jobsForm) {
      ["input","change"].forEach(evt => els.jobsForm.addEventListener(evt, () => {
        updatePreview();
        if (!state.suppressDirty) {
          markDirty();
          scheduleDraftSave();
        }
      }));

      els.jobsForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const job = getFormData();
        const err = validate(job);
        if (err) { notify(err, "error"); return; }

        job.preview = buildPreview(job);

        try {
          if (state.editingId) {
            await updateJobDb(state.editingId, job);
          } else {
            await createJobDb(job);
          }

          await renderList();
          resetForm();
          clearDraft();
          notify("Gespeichert.", "success");
        } catch (ex) {
          notify(ex?.message || "Speichern fehlgeschlagen.", "error");
        }
      });
    }

    if (els.jobResetBtn) {
      els.jobResetBtn.onclick = () => {
        if (!confirmLeaveIfDirty("zurücksetzen")) return;
        resetForm();
        notify("Zurückgesetzt.", "success");
      };
    }
  }

  async function init() {
    els.jobsModule = document.getElementById("jobsModule");
    if (!els.jobsModule) return;

    els.jobsForm = qs("jobsForm");
    els.jobTitle = qs("jobTitle");
    els.jobTitleFree = qs("jobTitleFree");
    els.jobTitleExtra = qs("jobTitleExtra");
    els.jobType = qs("jobType");
    els.jobHours = qs("jobHours");
    els.jobLocation = qs("jobLocation");
    els.jobTasks = qs("jobTasks");
    els.jobReq = qs("jobReq");
    els.jobBenefits = qs("jobBenefits");
    els.jobContact = qs("jobContact");
    els.jobPublished = qs("jobPublished");
    els.jobSaveBtn = qs("jobSaveBtn");
    els.jobResetBtn = qs("jobResetBtn");
    els.jobPreview = qs("jobPreview");
    els.jobsList = qs("jobsList");

    // Standard initialisieren
    setFormData({});
    bindEvents();

    // Draft restore NACH init
    restoreDraftIfAvailable();

    // Liste aus DB laden
    await renderList();

    if (els.jobPreview) els.jobPreview.value = buildPreview(getFormData());
    updateFreeRoleUi();

    // UX-Schutz: Logout abfangen
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        if (!confirmLeaveIfDirty("ausloggen")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
      notify(err?.message || "Init fehlgeschlagen.", "error");
    });
  });
})();
