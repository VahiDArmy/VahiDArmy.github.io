import { CFG } from './config.js';

export const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
  auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
});

function chk(res){
  if(res.error) throw new Error(res.error.message || 'Database error');
  return res.data;
}
const uidOf = async () => {
  const { data } = await sb.auth.getUser();
  if(!data?.user) throw new Error('Not signed in');
  return data.user.id;
};

/* ---------------- AUTH ---------------- */
export const Auth = {
  async session(){ const { data } = await sb.auth.getSession(); return data.session; },
  onChange(cb){ sb.auth.onAuthStateChange((evt, session)=>cb(evt, session)); },
  async signUp(email, password, name){
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ display_name:name||'' }, emailRedirectTo: location.origin + location.pathname } });
    if(error) throw error; return data;
  },
  async signIn(email, password){
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error) throw error; return data;
  },
  async magic(email){
    const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.origin + location.pathname } });
    if(error) throw error;
  },
  async resend(email){
    const { error } = await sb.auth.resend({ type:'signup', email, options:{ emailRedirectTo: location.origin + location.pathname } });
    if(error) throw error;
  },
  async resetRequest(email){
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if(error) throw error;
  },
  async updatePassword(pw){
    const { error } = await sb.auth.updateUser({ password: pw });
    if(error) throw error;
  },
  async signOut(){ await sb.auth.signOut(); }
};

/* ---------------- DATABASE ---------------- */
export const DB = {
  async getProfile(){
    const uid = await uidOf();
    const row = chk(await sb.from('profiles').select('*').eq('id',uid).maybeSingle());
    if(row) return row;
    return chk(await sb.from('profiles').upsert({ id:uid }).select().single());
  },
  async saveProfile(patch){
    const uid = await uidOf();
    chk(await sb.from('profiles').upsert({ id:uid, ...patch, updated_at:new Date().toISOString() }));
  },
  async listConversations(){
    return chk(await sb.from('conversations').select('*').order('updated_at',{ascending:false}).limit(500));
  },
  async createConversation(obj){
    const user_id = await uidOf();
    return chk(await sb.from('conversations').insert({ user_id, ...obj }).select().single());
  },
  async updateConversation(id, patch){
    return chk(await sb.from('conversations').update({ ...patch, updated_at:new Date().toISOString() }).eq('id',id).select().single());
  },
  async deleteConversation(id){ chk(await sb.from('conversations').delete().eq('id',id)); },
  async convMessages(id){
    return chk(await sb.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:true}).limit(4000));
  },
  async createMessage(obj){
    const user_id = await uidOf();
    return chk(await sb.from('messages').insert({ user_id, ...obj }).select().single());
  },
  async updateMessage(id, patch){
    return chk(await sb.from('messages').update(patch).eq('id',id).select().single());
  },
  async deleteMessage(id){ chk(await sb.from('messages').delete().eq('id',id)); },
  async searchMessages(q){
    return chk(await sb.from('messages').select('id,conversation_id,content,role,created_at').ilike('content','%'+q+'%').order('created_at',{ascending:false}).limit(25));
  },
  async markOrphansStopped(){
    const uid = await uidOf();
    chk(await sb.from('messages').update({ status:'stopped' }).eq('user_id',uid).eq('status','streaming'));
  },
  async listModels(){ return chk(await sb.from('models').select('*')); },
  /* merge fetched models: upsert info only — active/pinned survive, no duplicates */
  async mergeModels(fetched){
    const user_id = await uidOf();
    const existing = await DB.listModels();
    const fetchedIds = new Set(fetched.map(m=>m.id));
    const now = new Date().toISOString();
    const rows = fetched.map(m=>({ user_id, id:m.id, info:m, stale:false, last_seen:now }));
    if(rows.length) chk(await sb.from('models').upsert(rows, { onConflict:'user_id,id' }));
    const missing = existing.filter(r=>!fetchedIds.has(r.id) && !r.stale).map(r=>r.id);
    if(missing.length) chk(await sb.from('models').update({ stale:true }).eq('user_id',user_id).in('id',missing));
    return { rows: await DB.listModels(), staleCount: missing.length };
  },
  async setModelFlag(id, patch){
    const user_id = await uidOf();
    chk(await sb.from('models').update(patch).eq('user_id',user_id).eq('id',id));
  },
  async deleteModels(ids){
    const user_id = await uidOf();
    if(ids.length) chk(await sb.from('models').delete().eq('user_id',user_id).in('id',ids));
  },
  async listPrompts(){ return chk(await sb.from('prompts').select('*').order('created_at',{ascending:true})); },
  async savePrompt(p){
    const user_id = await uidOf();
    if(p.id) return chk(await sb.from('prompts').update({ title:p.title, body:p.body }).eq('id',p.id).select().single());
    return chk(await sb.from('prompts').insert({ user_id, title:p.title, body:p.body }).select().single());
  },
  async deletePrompt(id){ chk(await sb.from('prompts').delete().eq('id',id)); },
  async listProjects(){ return chk(await sb.from('projects').select('*').order('created_at',{ascending:true})); },
  async saveProject(p){
    const user_id = await uidOf();
    const fields = { name:p.name, emoji:p.emoji, instructions:p.instructions, model_id:p.model_id };
    if(p.id) return chk(await sb.from('projects').update({ ...fields, updated_at:new Date().toISOString() }).eq('id',p.id).select().single());
    return chk(await sb.from('projects').insert({ user_id, ...fields }).select().single());
  },
  async deleteProject(id){ chk(await sb.from('projects').delete().eq('id',id)); },
  async wipeChats(){
    const uid = await uidOf();
    chk(await sb.from('conversations').delete().eq('user_id',uid));
  },
  async wipeAll(){
    const uid = await uidOf();
    chk(await sb.from('conversations').delete().eq('user_id',uid));
    chk(await sb.from('prompts').delete().eq('user_id',uid));
    chk(await sb.from('projects').delete().eq('user_id',uid));
    chk(await sb.from('models').delete().eq('user_id',uid));
  }
};

/* ---------------- OPENROUTER ---------------- */
async function orError(res){
  let msg='HTTP '+res.status, code=res.status, meta=null;
  try{
    const j=await res.json(); const e=j.error||j;
    msg=e.message||msg; code=e.code||code; meta=e.metadata||null;
  }catch{}
  const err=new Error(msg); err.status=code; err.meta=meta;
  err.retryAfter=res.headers.get('Retry-After');
  return err;
}

export const OR = {
  headers(key){
    return {
      'Authorization':'Bearer '+key,
      'Content-Type':'application/json',
      'HTTP-Referer': location.origin || 'https://simurgh.app',
      'X-Title': CFG.APP_NAME
    };
  },
  async listModels(){
    const res = await fetch(CFG.OR_BASE+'/models');
    if(!res.ok) throw await orError(res);
    const j = await res.json();
    const free = (j.data||[])
      .filter(m=>m.pricing && m.pricing.prompt==='0' && m.pricing.completion==='0')
      .map(m=>({
        id:m.id, name:m.name||m.id,
        context_length: m.context_length || m.top_provider?.context_length || 0,
        max_completion_tokens: m.top_provider?.max_completion_tokens || null,
        input_modalities: m.architecture?.input_modalities || ['text'],
        supports_reasoning: Array.isArray(m.supported_parameters) && (m.supported_parameters.includes('reasoning')||m.supported_parameters.includes('include_reasoning')),
        description: (m.description||'').slice(0,400),
        created: m.created || null
      }));
    if(!free.some(m=>m.id===CFG.ROUTER_ID)){
      free.unshift({ id:CFG.ROUTER_ID, name:'Free Models Router', context_length:200000, max_completion_tokens:null,
        input_modalities:['text','image'], supports_reasoning:true, description:'Auto-routes each request to an available free model.', created:null });
    }
    return free;
  },
  async validateKey(key){
    const res = await fetch(CFG.OR_BASE+'/key', { headers:{ 'Authorization':'Bearer '+key } });
    if(!res.ok) throw await orError(res);
    const j = await res.json();
    return j.data || j;
  },
  /* streaming chat — returns {model, provider, usage, finish, id}; throws normalized errors */
  async streamChat({ key, body, signal, onContent, onReasoning }){
    const res = await fetch(CFG.OR_BASE+'/chat/completions', {
      method:'POST', headers:OR.headers(key), body:JSON.stringify(body), signal
    });
    if(!res.ok) throw await orError(res);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf='';
    const out = { model:body.model, provider:null, usage:null, finish:null, id:null };
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buf += dec.decode(value, { stream:true });
      let ix;
      while((ix = buf.indexOf('\n')) >= 0){
        const line = buf.slice(0,ix).trim(); buf = buf.slice(ix+1);
        if(!line || line.startsWith(':')) continue;
        if(!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if(payload === '[DONE]') return out;
        let j; try{ j=JSON.parse(payload); }catch{ continue; }
        if(j.error){
          const e=new Error(j.error.message||'Stream error');
          e.status=j.error.code||500; e.meta=j.error.metadata||null; throw e;
        }
        if(j.model) out.model=j.model;
        if(j.provider) out.provider=j.provider;
        if(j.id) out.id=j.id;
        if(j.usage) out.usage=j.usage;
        const ch = j.choices && j.choices[0];
        if(!ch) continue;
        if(ch.finish_reason) out.finish=ch.finish_reason;
        const d = ch.delta || {};
        if(typeof d.reasoning==='string' && d.reasoning) onReasoning(d.reasoning);
        else if(Array.isArray(d.reasoning_details)){
          for(const r of d.reasoning_details){ const tx=r.text||r.summary||''; if(tx) onReasoning(tx); }
        }
        if(typeof d.content==='string' && d.content) onContent(d.content);
      }
    }
    return out;
  },
  async complete({ key, body }){
    const res = await fetch(CFG.OR_BASE+'/chat/completions', {
      method:'POST', headers:OR.headers(key), body:JSON.stringify({ ...body, stream:false })
    });
    if(!res.ok) throw await orError(res);
    const j = await res.json();
    if(j.error) throw new Error(j.error.message);
    return { content: j.choices?.[0]?.message?.content || '', model: j.model, usage: j.usage };
  },
  curl(req, key){
    const q = s => "'"+String(s).replace(/'/g,"'\\''")+"'";
    const lines = ['curl '+q(req.url)+' \\'];
    const h = { ...req.headers, Authorization:'Bearer '+(key||'YOUR_OPENROUTER_KEY') };
    for(const k in h) lines.push('  -H '+q(k+': '+h[k])+' \\');
    lines.push('  -d '+q(JSON.stringify(req.body)));
    return lines.join('\n');
  }
};
