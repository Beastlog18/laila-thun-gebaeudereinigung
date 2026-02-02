(() => {
  "use strict";

  const STORAGE_KEY = "ltg_jobs_v1";

  const els = {};
  const state = { editingId: null };

  function qs(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function uid() { return "job_" + Math.random().toString(16).slice(2) + "_" + Date.now(); }
  function safeText(v) { return (v ?? "").toString().trim(); }

  function splitLines(text) {
    const t = safeText(text);
    if (!t) return [];
    return t.split("\n").map(s => s.trim()).filter(Boolean).map(s => s.replace(/^\-\s*/, ""));
  }

  function loadJobs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function saveJobs(jobs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }

  function typeLabel(type) {
    if (type === "minijob") return "Minijob";
    if (type === "teilzeit") return "Teilzeit";
    if (type === "vollzeit") return "Vollzeit";
    return type || "-";
  }

  /* =========================
     Text-Defaults
     ========================= */

  const PLACEHOLDERS = new Set([
    "alles","viel","egal","nix","nichts","-","ok","ka","k.a.","kp","n/a","tbd"
  ]);

  const DEFAULTS = {
    tasks: [
      "Unterhaltsreinigung bei Kunden (Böden, Oberflächen, Sanitärbereiche)",
      "Sorgfältiges Arbeiten nach Plan und Absprache",
      "Auffüllen von Verbrauchsmaterial nach Bedarf",
      "Ordnung halten und Hinweise weitergeben"
    ],
    requirements: [
      "Zuverlässigkeit und Pünktlichkeit",
      "Sorgfalt und Blick für Sauberkeit",
      "Freundliches Auftreten",
      "Selbstständige Arbeitsweise und Teamfähigkeit"
    ],
    benefits: [
      "Planbare Arbeitszeiten",
      "Faire Bezahlung",
      "Gründliche Einarbeitung",
      "Familiäres Team",
      "Arbeitskleidung wird gestellt"
    ]
  };

  function norm(s) {
    return safeText(s).toLowerCase().replace(/\s+/g, " ");
  }

  function extractExtra(line) {
    // alles + Führerschein  ->  Führerschein
    const m = line.split("+").slice(1).join("+").trim();
    return m ? m : null;
  }

  function bulletsOrDefault(rawText, kind) {
    const items = splitLines(rawText);
    if (!items.length) return DEFAULTS[kind].slice();

    const first = norm(items[0]);
    const startsWithAlles = first.startsWith("alles");

    // FALL 1: "alles ..." => Defaults + Zusatz
    if (startsWithAlles) {
      const out = DEFAULTS[kind].slice();
      const extra = extractExtra(items[0]);
      if (extra) {
        out.push(
          kind === "requirements"
            ? `${extra} (erforderlich oder wünschenswert)`
            : extra
        );
      }
      return out;
    }

    // FALL 2: normale Stichpunkte, Platzhalter rausfiltern
    const cleaned = items.filter(x => !PLACEHOLDERS.has(norm(x)));
    return cleaned.length ? cleaned : DEFAULTS[kind].slice();
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

    const meta = [ type, hours ? `${hours} Std./Woche` : null, location ]
      .filter(Boolean).join(" · ");

    const lines = [];
    lines.push(title);
    if (meta) lines.push(meta);
    lines.push("");

    lines.push(
      "Wir sind ein familiäres Reinigungsunternehmen mit Anspruch an Qualität, Zuverlässigkeit und ein respektvolles Miteinander."
    );
    lines.push(
      "Zur Verstärkung unseres Teams suchen wir Menschen, die ihre Arbeit sorgfältig erledigen und sich aufeinander verlassen können."
    );
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

    lines.push(
      "Wenn du dir vorstellen kannst, Teil unseres Teams zu werden, freuen wir uns auf deine Nachricht."
    );
    lines.push(`Kontakt: ${contact}`);

    return lines.join("\n");
  }

  function getFormData() {
    return {
      title: safeText(els.jobTitle.value),
      type: safeText(els.jobType.value),
      hours: safeText(els.jobHours.value),
      location: safeText(els.jobLocation.value),
      tasks: safeText(els.jobTasks.value),
      requirements: safeText(els.jobReq.value),
      benefits: safeText(els.jobBenefits.value),
      contact: safeText(els.jobContact.value),
      published: !!els.jobPublished.checked
    };
  }

  function setFormData(job) {
    els.jobTitle.value = job?.title || "";
    els.jobType.value = job?.type || "";
    els.jobHours.value = job?.hours || "";
    els.jobLocation.value = job?.location || "";
    els.jobTasks.value = job?.tasks || "";
    els.jobReq.value = job?.requirements || "";
    els.jobBenefits.value = job?.benefits || "";
    els.jobContact.value = job?.contact || "";
    els.jobPublished.checked = !!job?.published;
    els.jobPreview.value = buildPreview(getFormData());
  }

  function validate(job) {
    if (!job.title) return "Bitte Titel ausfüllen.";
    if (!job.type) return "Bitte Art wählen.";
    if (!job.location) return "Bitte Ort/Region ausfüllen.";
    return null;
  }

  function renderList() {
    const jobs = loadJobs().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
    els.jobsList.innerHTML = "";
    if (!jobs.length) {
      const p = document.createElement("p");
      p.textContent = "Noch keine Jobs gespeichert.";
      els.jobsList.appendChild(p);
      return;
    }

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

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Bearbeiten";
      editBtn.onclick = () => {
        state.editingId = job.id;
        setFormData(job);
        els.jobSaveBtn.textContent = "Änderungen speichern";
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Text kopieren";
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(buildPreview(job));
        alert("Textvorschlag kopiert.");
      };

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Löschen";
      delBtn.onclick = () => {
        if (!confirm(`Job wirklich löschen?\n\n${job.title}`)) return;
        saveJobs(loadJobs().filter(x => x.id !== job.id));
        if (state.editingId === job.id) resetForm();
        renderList();
      };

      btnRow.append(editBtn, copyBtn, delBtn);
      wrap.append(title, meta, btnRow);
      els.jobsList.appendChild(wrap);
    });
  }

  function resetForm() {
    state.editingId = null;
    els.jobsForm.reset();
    els.jobPublished.checked = false;
    els.jobPreview.value = buildPreview(getFormData());
    els.jobSaveBtn.textContent = "Job speichern";
  }

  function bindEvents() {
    const updatePreview = () => {
      els.jobPreview.value = buildPreview(getFormData());
    };
    ["input","change"].forEach(evt => els.jobsForm.addEventListener(evt, updatePreview));

    els.jobsForm.addEventListener("submit", e => {
      e.preventDefault();
      const job = getFormData();
      const err = validate(job);
      if (err) return alert(err);

      job.preview = buildPreview(job);

      const jobs = loadJobs();
      if (state.editingId) {
        const i = jobs.findIndex(x => x.id === state.editingId);
        if (i >= 0) jobs[i] = { ...jobs[i], ...job, updatedAt: nowIso() };
      } else {
        jobs.push({ id: uid(), ...job, createdAt: nowIso(), updatedAt: nowIso() });
      }
      saveJobs(jobs);
      renderList();
      resetForm();
      alert("Gespeichert.");
    });

    els.jobResetBtn.onclick = resetForm;
  }

  function init() {
    els.jobsModule = document.getElementById("jobsModule");
    if (!els.jobsModule) return;

    els.jobsForm = qs("jobsForm");
    els.jobTitle = qs("jobTitle");
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

    setFormData({});
    bindEvents();
    renderList();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
