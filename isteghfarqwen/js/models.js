/* Nūr AI Models — general table (Supabase `ai_models`, no prefix) */
(()=>{
const N=window.NUR,{$,$$,esc,ic,fmt}=N;
N.mq='';N.mfilter='all';
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
create unique index if not exists ai_models_one_default on public.ai_models ((is_default)) where is_default;`;

N.vModels=()=>{
 const ms=N.ai.models,k=N.ai.key(),act=ms.filter(m=>m.active).length;
 return`<div class="page">
 <div class="grid g4 stg">
  <div class="card"><div class="sic a">${ic('cpu')}</div><div class="big" id="mTotal">${ms.length}</div><div class="lbl">models in table</div></div>
  <div class="card"><div class="sic t">${ic('power')}</div><div class="big" id="mActive">${act}</div><div class="lbl">active</div></div>
  <div class="card"><div class="sic">${ic('shield')}</div><div class="big">100%</div><div class="lbl">free only</div></div>
  <div class="card"><div class="sic a">${ic('key')}</div><div class="big" style="font-size:20px">${k?'stored':'missing'}</div><div class="lbl">local api key</div></div>
 </div>

 <div class="card ai-card-lite" style="margin-top:15px">
  <div class="chd">${ic('key')}OpenRouter key · this browser only</div>
  <div class="mbody">Kept in local storage, sent straight to OpenRouter, never to Supabase. <b>openrouter/free</b> stays as the default row and is resolved at call time to a live free model, so it keeps working when individual ids change.</div>
  <div class="keycard" style="margin-top:13px">
   <div class="field">${ic('lock')}<input id="aiKey2" type="password" placeholder="sk-or-v1-…" value="${esc(k)}" autocomplete="off" spellcheck="false">
    <button type="button" class="eye" data-a="eye" data-t="aiKey2">${ic('eye')}</button></div>
   <button class="btn ai" data-a="keysave2">${ic('check')}Save</button>
   <button class="btn" data-a="keytest2">${ic('zap')}Test</button>
   <a class="btn" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">${ic('out')}Get key</a>
  </div>
  <div class="macts" style="justify-content:flex-start">
   <button class="btn sm ai" data-a="aidiag">${ic('shield')}Full diagnosis</button>
   <button class="btn sm" data-a="logs">${ic('alert')}Activity log</button>
  </div>
 </div>

 <div class="hd">Model table · ai_models</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px">
  <button class="btn ai sm" data-a="msync">${ic('dl')}Sync ALL free models</button>
  <button class="btn sm" data-a="madd">${ic('plus')}Add one</button>
  <button class="btn sm" data-a="mon">${ic('power')}Activate all</button>
  <button class="btn sm warn" data-a="moff">${ic('power')}Deactivate all</button>
  <button class="btn sm" data-a="mpull">${ic('sync')}Pull cloud</button>
  <button class="btn sm" data-a="mpush">${ic('ul')}Push cloud</button>
  <button class="btn sm" data-a="sqlai">${ic('db')}Table SQL</button>
 </div>
 <div class="srch">${ic('search')}<input id="mq" placeholder="Filter models by id, name or provider…" value="${esc(N.mq)}" autocomplete="off"></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px">
  ${['all','active','off','default'].map(f=>`<button class="pill ${N.mfilter===f?'on':''}" data-a="mfilt" data-v="${f}">${f}</button>`).join('')}
  <span class="mu" id="mShown" style="font-size:11.5px;align-self:center;margin-inline-start:auto"></span>
 </div>
 <div class="mtbl">
  <div class="mrow head"><div>model</div><div class="ctx">context</div><div>state</div><div style="text-align:right">actions</div></div>
  <div id="mrows"></div>
 </div>
 <p class="syncnote" style="margin-top:12px">Deactivate keeps a row but skips it. Delete removes it and offers undo. The star sets the default. On failure the next active free model is tried; a 404 deactivates the stale id automatically. Only the first eight active models are tried per request.</p>
 </div>`};

N.renderModels=()=>{
 const box=$('#mrows');if(!box)return;
 const q=N.mq.trim().toLowerCase(),f=N.mfilter;
 let list=N.ai.models.filter(m=>{
  if(f==='active'&&!m.active)return false;
  if(f==='off'&&m.active)return false;
  if(f==='default'&&!m.is_default)return false;
  if(!q)return true;
  return (m.model_id+' '+(m.label||'')+' '+(m.provider||'')).toLowerCase().includes(q)});
 const shown=list.slice(0,400);
 box.innerHTML=shown.length?shown.map(m=>`<div class="mrow ${m.active?'':'off'}">
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
  </div></div>`).join('')
  :`<div class="pempty">No model matches this filter.</div>`;
 const s=$('#mShown');if(s)s.textContent=`${shown.length} of ${list.length} shown · ${N.ai.models.length} total`;
 const t=$('#mTotal');if(t)t.textContent=N.ai.models.length;
 const a=$('#mActive');if(a)a.textContent=N.ai.models.filter(m=>m.active).length};

N.bindModels=()=>{const q=$('#mq');
 if(q)q.addEventListener('input',()=>{N.mq=q.value;N.renderModels()});
 N.renderModels();
 if(!N.lj('nur.ai.synced')&&N.ai.models.length<10){
  N.log('model','First visit: auto-syncing full free catalogue');
  N.ai.syncAllFree().then(r=>{N.toast(`${r.total} free models loaded from OpenRouter`,'ai','cpu');N.renderModels()})
   .catch(e=>N.log('model','Auto-sync failed',e.message,'warn'))}};

N.modelAdd=()=>N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
 <h2>${ic('plus')}Add a free model</h2>
 <div class="mbody">Only free models: the id must end with <b>:free</b>, or be <b>openrouter/free</b>.</div>
 <div class="field" style="margin-top:13px">${ic('cpu')}<input id="mId" placeholder="provider/model-name:free" autocomplete="off" spellcheck="false"></div>
 <div class="field" style="margin-top:9px">${ic('note')}<input id="mLabel" placeholder="Display name (optional)"></div>
 <div class="macts"><button class="btn ghost" data-a="mclose">Cancel</button>
  <button class="btn ai" data-a="msave">${ic('check')}Add model</button></div>`);
N.modelSave=()=>{try{const m=N.ai.add($('#mId').value,$('#mLabel').value.trim());
 if(!m)throw new Error('That model is already in the table.');
 N.mclose();N.Snd.p('ok');N.toast('Model added','ai','cpu');N.render({keep:true})}
 catch(e){N.Snd.p('err');N.toast(e.message,'err','alert')}};

N.modelTest=async id=>{
 if(!N.ai.key()){N.toast('Save an OpenRouter key first','warn','key');N.ai.keyModal();return}
 const btn=$(`[data-a=mtest][data-id="${CSS.escape(id)}"]`);btn&&btn.classList.add('busy');
 N.log('model','Testing model',{id});
 try{
  let real=id;
  if(id==='openrouter/free'){const c=await N.ai.catalogue(true);
   const p=c.find(m=>m.id!==id);if(!p)throw new Error('No free model in catalogue');real=p.id}
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',
   headers:{Authorization:'Bearer '+N.ai.key(),'Content-Type':'application/json',
    'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur'},
   body:JSON.stringify({model:real,max_tokens:16,messages:[{role:'user',content:'فقط بنویس: آماده'}]})});
  let j=null;try{j=await r.json()}catch{}
  if(!r.ok)throw new Error((j&&(j.error?.message||j.message))||('HTTP '+r.status));
  N.log('model','Test OK',{id:real});N.Snd.p('ok');N.toast(real+' responded','ok','shield')}
 catch(e){N.log('model','Test failed',{id,msg:e.message},'err');N.Snd.p('err');N.toast(id+' — '+e.message,'err','alert')}
 finally{btn&&btn.classList.remove('busy')}};

N.sqlAI=()=>N.modal(`<h2>${ic('db')}ai_models — general table</h2>
 <div class="mbody">Run once in Supabase → SQL Editor. No prefix. Anyone may read; signed-in users may curate. The API key is never stored here.</div>
 <div class="sqlbox">${esc(N.SQL_AI)}</div>
 <div class="macts"><button class="btn gold" data-a="copysqlai">${ic('copy')}Copy SQL</button>
  <button class="btn ghost" data-a="mclose">Close</button></div>`);
})();
