import {sb} from './supabase.js';
const run=async p=>{const{data,error}=await p;if(error)throw error;return data};
export const signIn=(email,password)=>run(sb.auth.signInWithPassword({email,password}));
export const signUp=(email,password)=>run(sb.auth.signUp({email,password}));
export const signOut=()=>run(sb.auth.signOut());
export const onChange=cb=>sb.auth.onAuthStateChange((_e,s)=>cb(s));
