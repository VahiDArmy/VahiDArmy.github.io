import {CONFIG} from '../config.js';
export const configured=CONFIG.SUPABASE_URL.startsWith('https://');
export const sb=configured?window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
