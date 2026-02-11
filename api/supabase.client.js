// api/supabase.client.js
// Zentraler Supabase-Client (einzige Stelle für Backend-Zugriffe)
// - Lädt supabase-js per CDN (kein Bundler nötig)
// - Stellt window.LTGSupabase.getClient() bereit

(function () {
  "use strict";

  // TODO: HIER eintragen (aus Supabase Project Settings -> API)
  const SUPABASE_URL = "https://wzwxokdcvibfgjxtkydo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_fpDSnsXiqztuByiJmlJaZA_cjbYeIfi";

  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  function assertConfig() {
    const okUrl = SUPABASE_URL && !SUPABASE_URL.includes("___") && SUPABASE_URL.startsWith("http");
    const okKey = SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("___") && SUPABASE_ANON_KEY.length > 40;
    if (!okUrl || !okKey) {
      throw new Error(
        "Supabase ist nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_ANON_KEY in api/supabase.client.js eintragen."
      );
    }
  }

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

  let _client = null;

  async function ensureClient() {
    assertConfig();
    await loadScriptOnce(SUPABASE_CDN);

    // supabase-js@2 stellt global i.d.R. window.supabase.createClient bereit
    const createClient =
      (window.supabase && window.supabase.createClient) ||
      window.createClient;

    if (typeof createClient !== "function") {
      throw new Error("Supabase SDK nicht verfügbar (createClient fehlt). CDN geladen?");
    }

    if (!_client) {
      _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _client;
  }

  window.LTGSupabase = {
    ensureClient,
    getClient: () => _client
  };
})();
