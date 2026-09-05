// Import createClient از CDN (برای استفاده در ماژول)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// کلیدهای پروژه‌ی خود را جایگزین کنید
export const SUPABASE_URL = 'https://tmjctucdptckeuwguzdm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_S9skokNcDPidkoEdtZe_0g_jPHh_b4l';

// ساخت کلاینت و صادرات آن
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);