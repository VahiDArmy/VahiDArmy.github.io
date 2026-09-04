const SUPABASE_URL = "https://cjviykekxphmpsgyzdrj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3FB5Y7X-On5KCkDm_l2pxg_-5P4X_XU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);