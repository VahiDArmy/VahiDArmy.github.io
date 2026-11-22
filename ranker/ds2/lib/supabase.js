import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nvmevqkaovazhmoznusf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
