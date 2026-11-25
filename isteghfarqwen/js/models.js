/* Nūr AI Models — general table (Supabase `ai_models`, no prefix) */
(()=>{
const N=window.NUR,{$,$$,esc,ic,fmt}=N;
N.SQL_AI=`-- General AI model table (no prefix)
create table if not exists public.ai_models (
  model_id text primary key,
  label text not null default '',
  provider text not null default '',
  context_length integer not null default 0,
  active boolean not null default true,
  is_default boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_models enable row level security;
drop policy if exists ai_models_read on public.ai_models;
drop policy if exists ai_models_ins on public.ai_models;
drop policy if exists ai_models_upd on public.ai_models;
drop policy if exists ai_models_del on public.ai_models;
create policy ai_models_read on public.ai_models for select using (true);
create policy ai_models_ins on public.ai_models for insert to authenticated with check (true);
create policy ai_models_upd on public.ai_models for update to authenticated using (true) with check (true);
create policy ai_models_del on public.ai_models for delete to authenticated using (true);
create unique index if not exists ai_models_one_default on public.ai_models ((is_default)) where is_default;
insert into public.ai_models (model_id,label,provider,context_length,active,is_default,sort) values
 ('openrouter/free','OpenRouter · Free router','openrouter',0,true,true,0),
 ('meta-llama/llama-3.3-70b-instruct:free','Llama 3.3 70B Instruct','meta-llama',131072,true,false,1),
 ('deepseek/deepseek-chat-v3-0324:free','DeepSeek V3 0324','deepseek',64000,true,false,2),
 ('google/gemini-2.0-flash-exp:free','Gemini 2.0 Flash Exp','google',1048576,true,false,3)
on conflict (model_id) do nothing;`;

N.vModels=()=>{
 const ms=N.ai.models,k=N.ai.key(),act=ms.filter(m=>m.active).length;
 const rows=ms.map(m=>`<div class="mrow ${m.active?'':'off'}">
  <div class="id"><b>${esc(m.model_id)}</b><span>${esc(m.label||'')}${m.provider?' · '+esc(m.provider):''}</span></div>
  <div class="ctx mu" style="font-size:11.5px;font-variant-numeric:tabular-nums">${m.context_length?fmt(m.context_length):'—'}</div>
  <div class="st" style="display:flex;gap:5px;flex-wrap:wrap">
   <span class="tag free">free</span>
   ${m.is_default?'<span class="tag def">default</span>':''}
   <span class="tag ${m.active?'on':'off'}">${m.active?'active':'off'}</span></div>
  <div class="macts">
   <button class="btn xs" data-a="mtest" data-id="${esc(m.model_id)}" title="Test">${ic('zap')}</button>
   <button class="btn xs ${m.is_default?'ai':''}" data-a="mdef" data-id="${esc(m.model_id)}" title="Make default">${ic('star')}</button>
   <button class="btn xs ${m.active?'warn':''}" data-a="mtoggle" data-id="${esc(m.model_id)}" title="${m.active?'Deactivate':'Activate'}">${ic('power')}</button>
   <button class="btn xs bad" data-a="mdel" data-id="${esc(m.model_id)}" title="Delete">${ic('trash')}</button>
  </div></div>`).join('');
 return`<div class="page">
 <div class="grid g4 stg">
  <div class="card"><div class="sic a">${ic('cpu')}</div><div class="big">${ms.length}</div><div class="lbl">models in table</div></div>
  <div class="card"><div class="sic t">${ic('power')}</div><div class="big">${act}</div><div class="lbl">active</div></div>
  <div class="card"><div class="sic">${ic('shield')}</div><div class="big">100%</div><div class="lbl">free only</div></div>
  <div class="card"><div class="sic a">${ic('key')}</div><div class="big" style="font-size:20px">${k?'stored':'missing'}</div><div class="lbl">local api key</div></div>
 </div>

 <div class="card ai-card-lite" style="margin-top:15px">
  <div class="chd">${ic('key')}OpenRouter key · this browser only</div>
  <div class="mbody">The key is kept in local storage and sent straight to OpenRouter. It is never written to Supabase. Only free models are ever called.</div>
  <div class="keycard" style="margin-top:13px">
   <div class="field">${ic('lock')}<input id="aiKey2" type="password" placeholder="sk-or-v1-…" value="${esc(k)}" autocomplete="off" spellcheck="false">
    <button type="button" class="eye" data-a="eye" data-t="aiKey2">${ic('eye')}</button></div>
   <button class="btn ai" data-a="keysave2">${ic('check')}Save</button>
   <button class="btn" data-a="keytest2">${ic('zap')}Test</button>
   <a class="btn" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">${ic('out')}Get key</a>
  </div>
 </div>

 <div class="hd">Model table · ai_models</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:13px">
  <button class="btn ai sm" data-a="madd">${ic('plus')}Add free model</button>
  <button class="btn sm" data-a="mcat">${ic('dl')}Load free catalogue</button>
  <button class="btn sm" data-a="mpull">${ic('sync')}Pull from cloud</button>
  <button class="btn sm" data-a="mpush">${ic('ul')}Push to cloud</button>
  <button class="btn sm" data-a="sqlai">${ic('db')}Table SQL</button>
 </div>
 <div class="mtbl">
  <div class="mrow head"><div>model</div><div class="ctx">context</div><div>state</div><div style="text-align:right">actions</div></div>
  ${rows||`<div class="pempty">No models yet — add a free one.</div>`}
 </div>
 <p class="syncnote" style="margin-top:12px">Deactivate keeps a row but skips it. Delete removes it and offers undo. The star sets the default; if a model fails, the next active free model is tried automatically.</p>
 </div>`};

N.bindModels=()=>{};

N.modelAdd=()=>N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
 <h2>${ic('plus')}Add a free model</h2>
 <div class="mbody">Only free models are accepted: the id must end with <b>:free</b>, or be <b>openrouter/free</b>.</div>
 <div class="field" style="margin-top:13px">${ic('cpu')}<input id="mId" placeholder="provider/model-name:free" autocomplete="off" spellcheck="false"></div>
 <div class="field" style="margin-top:9px">${ic('note')}<input id="mLabel" placeholder="Display name (optional)"></div>
 <div class="macts"><button class="btn ghost" data-a="mclose">Cancel</button>
  <button class="btn ai" data-a="msave">${ic('check')}Add model</button></div>`);
N.modelSave=()=>{try{N.ai.add($('#mId').value,$('#mLabel').value.trim());
 N.mclose();N.Snd.p('ok');N.toast('Model added','ai','cpu');N.render({keep:true})}
 catch(e){N.Snd.p('err');N.toast(e.message,'err','alert')}};

N.modelCat=async()=>{
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
  <h2>${ic('dl')}Free catalogue</h2><div class="mbody">Live list from OpenRouter, filtered to zero-cost models.</div>
  <div class="catlist" id="catList"><div class="pempty">Loading…</div></div>`);
 try{const list=await N.ai.catalogue();
  const box=$('#catList');if(!box)return;
  box.innerHTML=list.length?list.map(m=>{const has=!!N.ai.byId(m.id);
   return`<div class="catrow"><div class="n"><b>${esc(m.id)}</b><span>${esc(m.name)}${m.ctx?' · '+fmt(m.ctx)+' ctx':''}</span></div>
   ${has?'<span class="tag on">added</span>':`<button class="btn xs ai" data-a="mcatadd" data-id="${esc(m.id)}" data-name="${esc(m.name)}" data-ctx="${m.ctx}">${ic('plus')}Add</button>`}</div>`}).join('')
   :`<div class="pempty">No free models returned right now.</div>`}
 catch(e){const box=$('#catList');if(box)box.innerHTML=`<div class="ai-err">${esc(e.message)}</div>`}};

N.modelTest=async id=>{
 if(!N.ai.key()){N.toast('Save an OpenRouter key first','warn','key');N.ai.keyModal();return}
 const btn=$(`[data-a=mtest][data-id="${CSS.escape(id)}"]`);btn&&btn.classList.add('busy');
 try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',
  headers:{Authorization:'Bearer '+N.ai.key(),'Content-Type':'application/json',
   'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur'},
  body:JSON.stringify({model:id,max_tokens:12,messages:[{role:'user',content:'بگو: آماده'}]})});
  let j=null;try{j=await r.json()}catch{}
  if(!r.ok)throw new Error((j&&(j.error?.message||j.message))||('HTTP '+r.status));
  N.Snd.p('ok');N.toast(id+' responded','ok','shield')}
 catch(e){N.Snd.p('err');N.toast(id+' — '+e.message,'err','alert')}
 finally{btn&&btn.classList.remove('busy')}};

N.sqlAI=()=>N.modal(`<h2>${ic('db')}ai_models — general table</h2>
 <div class="mbody">Run once in Supabase → SQL Editor. No prefix, as requested. Anyone may read the list; signed-in users may curate it. The API key is never stored here.</div>
 <div class="sqlbox">${esc(N.SQL_AI)}</div>
 <div class="macts"><button class="btn gold" data-a="copysqlai">${ic('copy')}Copy SQL</button>
  <button class="btn ghost" data-a="mclose">Close</button></div>`);
})();
