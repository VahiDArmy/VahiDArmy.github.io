import {sb} from './supabase.js';
const T='lies',ok=({data,error})=>{if(error)throw error;return data};
export const list=()=>sb.from(T).select('*').order('created_at',{ascending:false}).then(ok);
export const create=v=>sb.from(T).insert(v).select().single().then(ok); // user_id is set by the DB (auth.uid())
export const update=(id,v)=>sb.from(T).update(v).eq('id',id).select().single().then(ok);
export const remove=ids=>sb.from(T).delete().in('id',ids).then(ok);
