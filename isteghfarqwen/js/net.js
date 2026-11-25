/* Nūr net: Supabase REST (auth · state sync · ai_models) — no SDK */
(()=>{
const N=window.NUR,{$,esc,ic,copy,lj,ls,deb}=N;
const SB='https://ummhohozmpwltbgeczsf.supabase.co';
const KEY='sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';
const T1='istigfarqwen_user_state',T2='istigfarqwen_daily_activity',TM='ai_models';
N.SB={url:SB,key:KEY,TM};
N.SQL_STATE=`create table if not exists public.istigfarqwen_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());
create table if not exists public.istigfarqwen_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, reads int default 0, tasbih int default 0, seconds int default 0,
  primary key (user_id, day));
alter table public.istigfarqwen_user_state enable row level security;
alter table public.istigfarqwen_daily_activity enable row level security;
drop policy if exists s_sel on public.istigfarqwen_user_state;
drop policy if exists s_ins on public.istigfarqwen_user_state;
drop policy if exists s_upd on public.istigfarqwen_user_state;
create policy s_sel on public.istigfarqwen_user_state for select using (auth.uid()=user_id);
create policy s_ins on public.istigfarqwen_user_state for insert with check (auth.uid()=user_id);
create policy s_upd on public.istigfarqwen_user_state for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists a_sel on public.istigfarqwen_daily_activity;
drop policy if exists a_ins on public.istigfarqwen_daily_activity;
drop policy if exists a_upd on public.istigfarqwen_daily_activity;
create policy a_sel on public.istigfarqwen_daily_activity for select using (auth.uid()=user_id);
create policy a_ins on public.istigfarqwen_daily_activity for insert with check (auth.uid()=user_id);
create policy a_upd on public.istigfarqwen_daily_activity for update using (auth.uid()=user_id) with check (auth.uid()=user_id);`;

const emsg=j=>(j&&(j.msg||j.error_description||j.message||(typeof j.error==='string'&&j.error)||j.hint))||'Something went wrong';
let rt=null;
N.setSes=j=>{N.SES={access_token:j.access_token,refresh_token:j.refresh_token,
 expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),user:j.user};
 ls(N.LSS,N.SES);sched();N.acctUI()};
N.clearSes=()=>{N.SES=null;localStorage.removeItem(N.LSS);clearTimeout(rt);N.acctUI();N.syncState('off')};
N.sb=async(p,o={})=>{const{method='GET',body,auth=true,prefer,_r=false}=o;
 const h={apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+(auth&&N.SES?N.SES.access_token:KEY)};
 if(prefer)h.Prefer=prefer;
 let r;try{r=await fetch(SB+p,{method,headers:h,body:body?JSON.stringify(body):undefined})}
 catch{const e=new Error('No connection to the cloud. Everything stays saved on this device.');e.net=1;throw e}
 let j=null;try{j=await r.json()}catch{}
 if(!r.ok){if(r.status===401&&N.SES&&p.startsWith('/rest')&&!_r&&await N.refresh())return N.sb(p,{...o,_r:true});
  const e=new Error(emsg(j)||'HTTP '+r.status);e.status=r.status;throw e}return j};
N.refresh=async()=>{if(!N.SES?.refresh_token)return false;
 try{N.setSes(await N.sb('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:N.SES.refresh_token}}));return true}
 catch(e){if(e.net){N.syncState('err');return false}N.clearSes();return false}};
function sched(){clearTimeout(rt);if(!N.SES)return;
 rt=setTimeout(async()=>{if(await N.refresh())N.syncState('ok')},Math.max(5000,N.SES.expires_at*1000-Date.now()-60000))}
N.sched=sched;
N.syncState=s=>{const b=$('#syncBtn');b.className='syncb '+(N.SES?s:'off');
 b.title={off:'Guest mode — sign in to sync',ok:'Synced',busy:'Syncing…',err:'Sync problem — tap for details'}[s]||'Cloud sync';N.syncUI()};
N.syncUI=()=>{const b=$('#drSyncBtn'),n=$('#drSyncState');if(!b||!n)return;
 b.querySelector('span').textContent=N.SES?'Sync now':'Sign in';
 const err=N.SES&&$('#syncBtn').classList.contains('err'),ok=N.SES&&$('#syncBtn').classList.contains('ok');
 n.className='syncnote'+(err?' err':ok?' ok':'');
 n.textContent=!N.SES?'Guest — everything is saved on this device.':err?(N.syncErr||'Sync problem — tap for details.'):
  ok?('Synced'+(N.lastSync?' at '+new Date(N.lastSync).toLocaleTimeString():'')+'.'):'Signed in — not synced yet.'};
const uMin=(a={},b={})=>{const o={...a};for(const k in b)o[k]=Math.min(o[k]??Infinity,b[k]);return o};
N.merge=(l,c)=>{if(!c)return l;const C=N.wd(c),m=N.wd(l);
 m.read=uMin(C.read,m.read);m.bm=uMin(C.bm,m.bm);m.ach=uMin(C.ach,m.ach);
 m.notes={...C.notes};for(const k in l.notes)if(l.notes[k]?.t&&(!m.notes[k]||l.notes[k].ts>m.notes[k].ts))m.notes[k]=l.notes[k];
 m.tas={...m.tas,total:Math.max(m.tas.total,C.tas.total)};m.act={...C.act};
 for(const d in l.act){const a=l.act[d],b=m.act[d]||{r:0,t:0,s:0};
  m.act[d]={r:Math.max(a.r,b.r),t:Math.max(a.t,b.t),s:Math.max(a.s,b.s)}}
 m.last=l.last??C.last;return m};
N.push=async()=>{if(!N.SES)return;N.syncState('busy');
 await N.sb(`/rest/v1/${T1}?on_conflict=user_id`,{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
  body:{user_id:N.SES.user.id,state:N.S,updated_at:new Date().toISOString()}});
 const a=N.day();
 await N.sb(`/rest/v1/${T2}?on_conflict=user_id,day`,{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
  body:{user_id:N.SES.user.id,day:N.dk(),reads:a.r,tasbih:a.t,seconds:a.s}});
 N.lastSync=Date.now();N.syncErr='';N.syncState('ok')};
N.pull=async()=>{if(!N.SES)return;
 const r=await N.sb(`/rest/v1/${T1}?user_id=eq.${N.SES.user.id}&select=state`);
 if(r?.[0]?.state){N.S=N.merge(N.S,r[0].state);N.tidy();N.saveLocal();N.apply();N.render({keep:true})}};
N.afterAuth=async()=>{try{await N.pull();await N.push();await N.ai.cloudPull();await N.ai.cloudPush()}
 catch(e){N.syncErr=e.message;N.syncState('err')}};
N.syncSoon=deb(()=>{if(N.SES)N.push().catch(e=>{N.syncErr=e.message;N.syncState('err')})},3000);
N.syncNow=async()=>{if(!N.SES){N.openAuth();return}
 try{await N.afterAuth();if(N.syncErr)throw new Error(N.syncErr);N.Snd.p('ok');N.toast('Everything is in sync','ok','sync')}
 catch(e){N.syncErr=e.message;N.syncState('err');N.Snd.p('err');N.syncHelp()}};
N.syncHelp=()=>N.modal(`<h2>${ic('db')}Cloud sync</h2><div class="mbody">${N.SES?
 `Signed in as <b style="color:var(--gold)">${esc(N.SES.user.email||'')}</b>.<br><br>${N.syncErr?`<span style="color:var(--pom)">${esc(N.syncErr)}</span>`:'No problems recorded.'}
 <br><br>If the error mentions a missing table or policy, run the setup SQL in Supabase → SQL Editor:`
 :'Sign in to sync your progress and the AI model list across devices.'}</div>
 ${N.SES?`<div class="sqlbox">${esc(N.SQL_STATE)}</div>`:''}
 <div class="macts">${N.SES?`<button class="btn" data-a="copysql">${ic('copy')}Copy state SQL</button>
 <button class="btn" data-a="sqlai">${ic('cpu')}AI models SQL</button>
 <button class="btn" data-a="sync">${ic('sync')}Retry</button>`:
 `<button class="btn gold" data-a="openauth">${ic('user')}Sign in</button>`}
 <button class="btn ghost" data-a="mclose">Close</button></div>`);

/* ai_models — general table, no prefix */
N.cloudModels={
 list:async()=>await N.sb(`/rest/v1/${TM}?select=*&order=sort.asc`),
 upsert:async rows=>await N.sb(`/rest/v1/${TM}?on_conflict=model_id`,{method:'POST',
  prefer:'resolution=merge-duplicates,return=minimal',body:rows}),
 patch:async(id,body)=>await N.sb(`/rest/v1/${TM}?model_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',prefer:'return=minimal',body}),
 remove:async id=>await N.sb(`/rest/v1/${TM}?model_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'}),
 clearDefault:async()=>await N.sb(`/rest/v1/${TM}?is_default=eq.true`,{method:'PATCH',prefer:'return=minimal',body:{is_default:false}})
};

/* auth UI */
N.uname=()=>N.SES?.user?.user_metadata?.name||N.SES?.user?.email?.split('@')[0]||'Seeker';
N.acctUI=()=>{$('#avBtn').innerHTML=N.SES?esc(N.uname()[0].toUpperCase()):ic('user');
 $('#drAcct').innerHTML=N.SES?
 `<div class="acct"><span class="av">${esc(N.uname()[0].toUpperCase())}</span><div class="who"><b>${esc(N.uname())}</b><span>${esc(N.SES.user.email||'')}</span></div></div>
  <div class="stack"><button class="btn bad" data-a="logout">${ic('out')}Sign out</button></div>`:
 `<p class="mu" style="font-size:12.5px;line-height:1.65;margin-bottom:11px">Reading as a guest. Everything is saved on this device; sign in to carry it across devices.</p>
  <button class="btn gold wide" data-a="openauth">${ic('user')}Sign in / Create account</button>`;
 N.syncUI()};
N.acctMenu=()=>{if(!N.SES){N.openAuth();return}const m=$('#acctMenu');
 if(!m.hidden){m.hidden=true;return}
 const r=$('#avBtn').getBoundingClientRect();m.style.top=(r.bottom+9)+'px';m.style.right=Math.max(10,innerWidth-r.right)+'px';
 m.innerHTML=`<div class="ph"><b>${esc(N.uname())}</b><span>${esc(N.SES.user.email||'')}</span></div>
 <button class="pm" data-a="sync">${ic('sync')}Sync now</button>
 <button class="pm" data-a="drawer">${ic('set')}Settings</button>
 <button class="pm" data-a="export">${ic('dl')}Export data</button>
 <button class="pm bad" data-a="logout">${ic('out')}Sign out</button>`;m.hidden=false;N.Snd.p('pop')};
N.openAuth=()=>{N.closePal(1);N.closeSearch(1);$('#auth').classList.add('open');N.atab('in');N.Snd.p('open');setTimeout(()=>$('#inE').focus(),80)};
N.closeAuth=()=>{$('#auth').classList.remove('open');N.Snd.p('close')};
N.atab=v=>{$$('.atabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 $('#fIn').hidden=v!=='in';$('#fUp').hidden=v!=='up';$('#fFg').hidden=true;$('#aVer').hidden=true;$('#aErr').hidden=true};
const aerr=m=>{const e=$('#aErr');e.textContent=m;e.hidden=false;N.Snd.p('err')};
N.bindAuth=()=>{const w=(f,fn)=>f.addEventListener('submit',async e=>{e.preventDefault();
  const b=f.querySelector('[type=submit]');b.classList.add('busy');$('#aErr').hidden=true;
  try{await fn()}catch(x){aerr(x.message)}finally{b.classList.remove('busy')}});
 w($('#fIn'),async()=>{N.setSes(await N.sb('/auth/v1/token?grant_type=password',{method:'POST',auth:false,
  body:{email:$('#inE').value.trim(),password:$('#inP').value}}));
  await N.afterAuth();N.closeAuth();N.Snd.p('ok');N.toast(`Welcome back, ${N.uname()}`,'gold','spark')});
 w($('#fUp'),async()=>{const j=await N.sb('/auth/v1/signup',{method:'POST',auth:false,
  body:{email:$('#upE').value.trim(),password:$('#upP').value,data:{name:$('#upN').value.trim()}}});
  if(j.access_token){N.setSes(j);await N.afterAuth();N.closeAuth();N.Snd.p('fan');N.toast(`Ahlan, ${N.uname()}!`,'gold','spark')}
  else{$('#fUp').hidden=true;$('#aVer').hidden=false;const e=$('#upE').value.trim();
   $('#verE').textContent=e;$('#aVer').dataset.e=e;N.Snd.p('ok')}});
 w($('#fFg'),async()=>{await N.sb('/auth/v1/recover',{method:'POST',auth:false,body:{email:$('#fgE').value.trim()}});
  N.toast('Reset link sent','ok','mail');N.Snd.p('ok');N.atab('in')})};
N.logout=async()=>{try{await N.sb('/auth/v1/logout',{method:'POST'})}catch{}
 N.clearSes();N.toast('Signed out — data stays on this device','ok','out')};
})();
