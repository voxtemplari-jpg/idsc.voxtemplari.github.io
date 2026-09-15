(() => {
  const cfg = window.VT_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('YOUR_PROJECT');
  window.VT = window.VT || {};
  window.VT.configured = !!configured;
  window.VT.supabase = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
})();
