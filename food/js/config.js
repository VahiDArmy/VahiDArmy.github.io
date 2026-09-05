// کلیدهای پروژه‌ی خود را جایگزین کنید
export const SUPABASE_URL = 'https://tmjctucdptckeuwguzdm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_S9skokNcDPidkoEdtZe_0g_jPHh_b4l';

// از شیء سراسری supabase که توسط اسکریپت CDN ساخته شده استفاده می‌کنیم
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);