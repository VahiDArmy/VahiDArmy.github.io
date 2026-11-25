/* Nūr AI · Persian morphology tutor over OpenRouter free models.
   Every step is logged. The word popup carries a real data-a button. */
(()=>{
const N=window.NUR,{$,$$,esc,ic,lj,ls,cl,log}=N;
const OR='https://openrouter.ai/api/v1';
const K_KEY='nur.ai.key',K_MODELS='nur.ai.models',K_CACHE='nur.ai.cache',K_ALIAS='nur.ai.alias',K_DEAD='nur.ai.aliasDead',K_SYNC='nur.ai.synced';
const ALIAS='openrouter/free';
const SEED=[
 {model_id:ALIAS,label:'OpenRouter · Free router',provider:'openrouter',context_length:0,active:true,is_default:true,sort:0},
 {model_id:'meta-llama/llama-3.3-70b-instruct:free',label:'Llama 3.3 70B Instruct',provider:'meta-llama',context_length:131072,active:true,is_default:false,sort:1},
 {model_id:'deepseek/deepseek-chat-v3-0324:free',label:'DeepSeek V3 0324',provider:'deepseek',context_length:64000,active:true,is_default:false,sort:2},
 {model_id:'google/gemini-2.0-flash-exp:free',label:'Gemini 2.0 Flash Exp',provider:'google',context_length:1048576,active:true,is_default:false,sort:3}
];
const isFree=id=>/:free$/.test(id)||id===ALIAS;
const ai={scope:'word',target:null,busy:false,last:null,tries:[],stage:'',error:null,needKey:false,busyAt:0};
N.ai=ai;

/* key */
ai.key=()=>{try{return localStorage.getItem(K_KEY)||''}catch{return''}};
ai.setKey=v=>{try{v?localStorage.setItem(K_KEY,v):localStorage.removeItem(K_KEY)}catch{}
 log('ai',v?'API key stored locally':'API key cleared',{tail:v?v.slice(-4):''});ai.paintKey()};
ai.paintKey=()=>{const k=ai.key(),el=$('#drKey');
 if(el)el.textContent=k?('•••• '+k.slice(-4)):'Not set';
 const m=$('#drModel');if(m)m.textContent=(ai.def()||{}).model_id||'—'};

/* registry */
ai.load=()=>{const s=lj(K_MODELS);
 if(Array.isArray(s)&&s.length){const ms=s.filter(m=>m&&m.model_id).map((m,i)=>({...m,sort:m.sort??i}));
  if(!ms.some(m=>m.model_id===ALIAS))ms.unshift({...SEED[0],is_default:!ms.some(x=>x.is_default)});
  return ms}
 return SEED.map(m=>({...m}))};
ai.models=ai.load();
ai.save=()=>{ls(K_MODELS,ai.models);ai.paintKey();N.hud&&N.hud()};
ai.def=()=>ai.models.find(m=>m.is_default&&m.active)||ai.models.find(m=>m.active)||ai.models[0];
ai.chain=()=>{const d=ai.def();const rest=ai.models.filter(m=>m.active&&m!==d).sort((a,b)=>a.sort-b.sort);
 return (d?[d,...rest]:rest).slice(0,8)};
ai.byId=id=>ai.models.find(m=>m.model_id===id);
ai.add=(id,label,provider,ctx,quiet)=>{id=String(id||'').trim();
 if(!id)throw new Error('Model id is required.');
 if(!isFree(id))throw new Error('Only free models are allowed — the id must end with :free (or be openrouter/free).');
 if(ai.byId(id))return null;
 const m={model_id:id,label:label||id.split('/').pop().replace(':free',''),provider:provider||id.split('/')[0],
  context_length:+ctx||0,active:false,is_default:ai.models.length===0,sort:ai.models.length};
 ai.models.push(m);if(!quiet){ai.save();log('model','Model added',{id});ai.cloudPush()}
 return m};
ai.toggle=id=>{const m=ai.byId(id);if(!m)return;m.active=!m.active;
 if(!ai.models.some(x=>x.is_default&&x.active)){const n=ai.models.find(x=>x.active);if(n)n.is_default=true}
 ai.save();log('model',`Model ${m.active?'activated':'deactivated'}`,{id});ai.cloudPush()};
ai.bulk=on=>{let n=0;ai.models.forEach(m=>{if(m.model_id===ALIAS){m.active=true;return}
  if(m.active!==on){m.active=on;n++}});
 if(!ai.models.some(x=>x.is_default&&x.active)){const d=ai.byId(ALIAS)||ai.models[0];if(d){d.active=true;d.is_default=true}}
 ai.save();log('model',`Bulk ${on?'activate':'deactivate'}`,{changed:n});ai.cloudPush();return n};
ai.setDefault=async id=>{ai.models.forEach(m=>m.is_default=m.model_id===id);
 const m=ai.byId(id);if(m)m.active=true;ai.save();log('model','Default model set',{id});
 if(N.SES){try{await N.cloudModels.clearDefault();await N.cloudModels.patch(id,{is_default:true,active:true})}catch(e){log('net','Cloud default patch failed',e.message,'warn')}}};
ai.remove=async id=>{const i=ai.models.findIndex(m=>m.model_id===id);if(i<0)return null;
 const [m]=ai.models.splice(i,1);
 if(m.is_default){const n=ai.models.find(x=>x.active)||ai.models[0];if(n)n.is_default=true}
 ai.models.forEach((x,k)=>x.sort=k);ai.save();log('model','Model deleted',{id});
 if(N.SES){try{await N.cloudModels.remove(id)}catch(e){log('net','Cloud delete failed',e.message,'warn')}}
 return m};
ai.restore=async(m,i)=>{ai.models.splice(cl(i,0,ai.models.length),0,m);
 ai.models.forEach((x,k)=>x.sort=k);ai.save();log('model','Model restored',{id:m.model_id});ai.cloudPush()};
ai.cloudPull=async()=>{if(!N.SES)return;
 try{const rows=await N.cloudModels.list();if(!Array.isArray(rows)||!rows.length)return;
  const map=new Map(ai.models.map(m=>[m.model_id,m]));
  rows.forEach(r=>{if(!isFree(r.model_id))return;
   map.set(r.model_id,{model_id:r.model_id,label:r.label||r.model_id,provider:r.provider||'',
    context_length:+r.context_length||0,active:!!r.active,is_default:!!r.is_default,sort:+r.sort||0})});
  ai.models=[...map.values()].sort((a,b)=>a.sort-b.sort);
  if(!ai.models.some(m=>m.is_default&&m.active)){const n=ai.byId(ALIAS)||ai.models[0];if(n){n.active=true;n.is_default=true}}
  ai.save();log('net',`Pulled ${rows.length} cloud model rows`);
  if(N.VIEW==='models')N.render({keep:true})}catch(e){log('net','Cloud pull failed',e.message,'warn')}};
ai.cloudPush=async()=>{if(!N.SES)return;
 try{await N.cloudModels.upsert(ai.models.map((m,i)=>({...m,sort:i,updated_at:new Date().toISOString()})));
  log('net',`Pushed ${ai.models.length} models to ai_models`)}
 catch(e){log('net','Cloud push failed',e.message,'warn')}};

/* live catalogue — ALL free models */
let catMemo=null;
ai.catalogue=async(force)=>{
 if(catMemo&&!force)return catMemo;
 log('net','GET /models …');
 const r=await fetch(OR+'/models',{headers:{Accept:'application/json'}});
 if(!r.ok){log('net','Catalogue HTTP '+r.status,null,'err');throw new Error('Catalogue unreachable (HTTP '+r.status+').')}
 const j=await r.json();
 const all=j.data||[];
 catMemo=all.filter(m=>{const p=m.pricing||{};
  return /:free$/.test(m.id)||(String(p.prompt)==='0'&&String(p.completion)==='0')})
  .map(m=>({id:m.id,name:m.name||m.id,ctx:m.context_length||0,provider:m.id.split('/')[0]||''}))
  .sort((a,b)=>a.id.localeCompare(b.id));
 log('net',`Catalogue: ${all.length} total, ${catMemo.length} free`);
 return catMemo};

ai.syncAllFree=async()=>{
 const list=await ai.catalogue(true);
 let added=0;
 list.forEach(m=>{if(m.id===ALIAS)return;if(ai.add(m.id,m.name,m.provider,m.ctx,true))added++});
 if(!ai.byId(ALIAS))ai.models.unshift({...SEED[0]});
 const good=['meta-llama/llama-3.3-70b-instruct:free','deepseek/deepseek-chat-v3-0324:free','google/gemini-2.0-flash-exp:free'];
 good.forEach(id=>{const m=ai.byId(id);if(m)m.active=true});
 const al=ai.byId(ALIAS);if(al){al.active=true;al.is_default=true}
 ai.models.forEach((m,i)=>m.sort=i);
 ai.save();ls(K_SYNC,Date.now());
 log('model',`Synced all free models`,{added,total:ai.models.length});
 ai.cloudPush();
 return{added,total:ai.models.length}};

async function resolveAlias(){
 const c=lj(K_ALIAS);
 if(c&&c.id&&Date.now()-c.ts<864e5){log('ai','Alias cache hit',{id:c.id});return c.id}
 const list=(await ai.catalogue(true)).filter(m=>m.id!==ALIAS);
 const pick=list.find(m=>/llama-3\.3-70b-instruct:free$/.test(m.id))
  ||list.find(m=>/deepseek.*:free$/.test(m.id))
  ||list.find(m=>/gemini.*flash.*:free$/.test(m.id))
  ||list.find(m=>/qwen.*:free$/.test(m.id))
  ||list.find(m=>/mistral.*:free$/.test(m.id))
  ||list[0];
 if(!pick)throw new Error('OpenRouter lists no free model right now.');
 ls(K_ALIAS,{id:pick.id,ts:Date.now()});
 log('ai','Alias resolved',{alias:ALIAS,to:pick.id});
 return pick.id}

ai.heal=async()=>{try{const r=await ai.syncAllFree();return r.added}catch(e){log('ai','Heal failed',e.message,'err');return 0}};

/* cache */
const cache=()=>lj(K_CACHE)||{};
const putCache=(k,v)=>{const c=cache();c[k]=v;const keys=Object.keys(c);
 if(keys.length>140)keys.slice(0,keys.length-140).forEach(x=>delete c[x]);ls(K_CACHE,c)};
const ckOf=t=>`${t.scope}|${t.p}|${t.w??''}|v4`;

/* prompt */
const SYS=`شما آموزگار صرف و نحو عربی برای فارسی‌زبانان هستید. تنها به فارسی پاسخ دهید و خروجی را فقط یک شیء JSON معتبر بدهید، بدون بلوک کد و بدون متن اضافی.
کلیدها (همه رشتهٔ فارسی؛ اگر موردی ربط ندارد رشتهٔ خالی):
"root": حروف اصلی/ریشه با خط تیره، مثل «غ-ف-ر»
"kind": نوع کلمه: فعل، اسم، حرف، ضمیر، مصدر، اسم فاعل …
"pattern": وزن صرفی با حرکت، مثل «یَسْتَفْعِلُ»
"form": باب یا ساختار، مثل «ثلاثی مزید، باب استفعال»
"tense": زمان و صیغه، مثل «مضارع، متکلم وحده»
"person": شخص، جنس و شمار در صورت ربط
"affixes": اجزای چسبیده، مثل «ضمیر ـكَ، حرف جرّ بِـ»
"role": نقش نحوی و اعراب در همین عبارت
"meaning": معنای دقیق همین کلمه در همین عبارت، یک جملهٔ کوتاه
"note": یک نکتهٔ کوتاه آموزشی؛ اگر مطمئن نیستی صادقانه بگو
"items": آرایه؛ فقط برای تحلیل کل عبارت، حداکثر ۶ عضو {"word","root","gloss"}؛ در تحلیل تک‌کلمه آرایهٔ خالی.`;
function userMsg(t){const p=N.IX[t.p];
 if(t.scope==='passage')return `عبارت کامل:\n${p.arText}\n\nترجمهٔ تحت‌اللفظی:\n${p.faText}\n\nکل عبارت را تحلیل کن و ریشهٔ کلمات کلیدی را در items بیاور.`;
 const w=p.words[t.w];
 if(t.scope==='phrase'){const a=cl(t.w-3,0,p.words.length-1),b=cl(t.w+3,a,p.words.length-1),win=p.words.slice(a,b+1);
  return `عبارت کامل:\n${p.arText}\n\nقطعهٔ مورد نظر:\n${win.map(x=>x.a).join(' ')}\n\nکلمهٔ کانونی: «${w.a}» با برابر فارسی «${w.f}»\nتحلیل را روی همین کلمهٔ کانونی متمرکز کن.`}
 return `عبارت کامل:\n${p.arText}\n\nکلمهٔ مورد نظر: «${w.a}» — کلمهٔ ${t.w+1} از ${p.words.length}\nبرابر فارسی: «${w.f}»\nفقط همین کلمه را تحلیل کن.`}
function parseJSON(txt){
 let s=String(txt||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
 const a=s.indexOf('{'),b=s.lastIndexOf('}');
 if(a>=0&&b>a)s=s.slice(a,b+1);
 try{const o=JSON.parse(s);if(o&&typeof o==='object')return o}catch{}
 return{meaning:String(txt||'').trim(),note:''}}
function classify(e){
 const s=e.status,m=(e.message||'').toLowerCase();
 if(e.name==='AbortError')return{kind:'timeout',fa:'زمان پاسخ تمام شد'};
 if(e.net||m.includes('failed to fetch'))return{kind:'net',fa:'اتصال به OpenRouter برقرار نشد'};
 if(s===401)return{kind:'key',fa:'کلید پذیرفته نشد (۴۰۱)'};
 if(s===402)return{kind:'credit',fa:'این مدل اعتبار می‌خواهد (۴۰۲)'};
 if(s===403)return{kind:'gate',fa:'دسترسی به این مدل بسته است (۴۰۳)'};
 if(s===404||m.includes('not a valid model'))return{kind:'gone',fa:'این شناسهٔ مدل وجود ندارد (۴۰۴)'};
 if(s===429)return{kind:'rate',fa:'محدودیت نرخ رایگان (۴۲۹)'};
 return{kind:'other',fa:e.message||'خطای ناشناخته'}}

async function call(realId,t){
 const ctl=new AbortController();
 const to=setTimeout(()=>ctl.abort(),28000);
 log('ai','POST /chat/completions',{model:realId,scope:t.scope,p:t.p,w:t.w});
 try{
  const r=await fetch(OR+'/chat/completions',{method:'POST',signal:ctl.signal,
   headers:{Authorization:'Bearer '+ai.key(),'Content-Type':'application/json',
    'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur Istighfar'},
   body:JSON.stringify({model:realId,temperature:.2,max_tokens:800,
    messages:[{role:'system',content:SYS},{role:'user',content:userMsg(t)}]})});
  let j=null;try{j=await r.json()}catch{}
  log('ai','Response HTTP '+r.status,{model:realId});
  if(!r.ok){const msg=(j&&(j.error?.message||j.message))||('HTTP '+r.status);
   log('ai','Request failed',{model:realId,status:r.status,msg},'err');
   const e=new Error(msg);e.status=r.status;throw e}
  const txt=j?.choices?.[0]?.message?.content||'';
  if(!txt.trim()){log('ai','Empty completion',{model:realId},'warn');throw new Error('پاسخ خالی بود')}
  log('ai','Completion received',{model:realId,chars:txt.length});
  return parseJSON(txt);
 }catch(e){if(e.name!=='AbortError'&&!e.status&&!/failed to fetch/i.test(e.message||''))e.net=1;throw e}
 finally{clearTimeout(to)}}

/* panel */
const LBL={root:'ریشه',kind:'نوع کلمه',pattern:'وزن',form:'باب / ساختار',tense:'زمان و صیغه',
 person:'شخص و شمار',affixes:'اجزای چسبیده',role:'نقش و اعراب',meaning:'معنا در این عبارت'};
const scopeChips=()=>{const has=N.SEL!=null||ai.target?.scope!=='passage';
 return [['word','این کلمه'],['phrase','عبارت پیرامون'],['passage','کل فراز']]
  .map(([v,l])=>`<button class="pill ai ${ai.scope===v?'on':''}" data-a="aiscope" data-v="${v}"
   ${v!=='passage'&&!has?'disabled style="opacity:.4;pointer-events:none"':''}>${l}</button>`).join('')};
function targetHTML(t){const p=N.IX[t.p];if(!p)return'';
 if(t.scope==='passage')return`<div class="a">${esc(p.arText)}</div><div class="f">${esc(p.faText)}</div>`;
 const w=p.words[t.w];if(!w)return'';
 if(t.scope==='phrase'){const a=cl(t.w-3,0,p.words.length-1),b=cl(t.w+3,a,p.words.length-1);
  const win=p.words.slice(a,b+1).map((x,i)=>a+i===t.w?`<b style="color:var(--goldl)">${esc(x.a)}</b>`:esc(x.a)).join(' ');
  return`<div class="a">${win}</div><div class="f">${esc(p.words.slice(a,b+1).map(x=>x.f).join(' '))}</div>`}
 return`<div class="a">${esc(w.a)}</div><div class="f">${esc(w.f)}</div>`}
function resultHTML(d){let h='';
 for(const k of Object.keys(LBL)){const v=(d[k]||'').toString().trim();if(!v)continue;
  const lat=['root','pattern'].includes(k)&&/^[\u0600-\u06FF\s\u064B-\u065F\-ـ]+$/.test(v);
  h+=`<div class="ai-row"><div class="k">${LBL[k]}</div><div class="v">${lat?`<span class="lat">${esc(v)}</span>`:esc(v)}</div></div>`}
 if(Array.isArray(d.items)&&d.items.length)
  h+=`<div class="ai-items">`+d.items.slice(0,8).map(it=>
   `<div class="ai-item"><b>${esc(it.word||'')}</b> <i>${esc(it.root||'')}</i><br>${esc(it.gloss||'')}</div>`).join('')+`</div>`;
 const note=(d.note||'').toString().trim();
 if(note)h+=`<div class="ai-note">${esc(note)}</div>`;
 return h||`<div class="ai-err">پاسخ قابل خواندن نبود. مدل دیگری را امتحان کنید.</div>`}
const keyBoxHTML=()=>`<div class="ai-keybox">
 <p>برای تحلیل، کلید رایگان OpenRouter لازم است. کلید فقط در همین مرورگر می‌ماند.</p>
 <div class="field">${ic('lock')}<input id="aiKeyInline" type="password" placeholder="sk-or-v1-…" autocomplete="off" spellcheck="false">
  <button type="button" class="eye" data-a="eye" data-t="aiKeyInline">${ic('eye')}</button></div>
 <div class="acts"><button class="btn sm ai" data-a="aikeygo">${ic('check')}ذخیره و تحلیل</button>
  <a class="btn sm" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">${ic('out')}گرفتن کلید رایگان</a></div></div>`;
function paint(){
 try{
  const t=ai.target;if(!t)return;const p=N.IX[t.p];
  $('#aiTitle').textContent=t.scope==='passage'?'تحلیل کل فراز':'تحلیل کلمه';
  $('#aiSub').textContent=`فراز ${t.p} · ${p?p.ch:''}`;
  $('#aiScope').innerHTML=scopeChips();
  $('#aiTarget').innerHTML=targetHTML(t);
  $('#aiModel').textContent=ai.last?.shown||(ai.def()||{}).model_id||'—';
  const foot=$('.ai-foot');
  if(foot&&!foot.querySelector('[data-a=logs]'))
   foot.insertAdjacentHTML('afterbegin',`<button class="btn sm" data-a="logs">${ic('alert')}گزارش</button>`);
  const body=$('#aiBody');
  if(ai.busy){body.innerHTML=`<div class="ai-stage"><span class="dot"></span>${esc(ai.stage||'در حال تحلیل…')}</div>
   <div class="ai-sk"><i></i><i></i><i></i><i></i><i></i></div>`;return}
  if(ai.needKey){body.innerHTML=keyBoxHTML();setTimeout(()=>$('#aiKeyInline')?.focus(),60);return}
  if(ai.error){body.innerHTML=`<div class="ai-err">${esc(ai.error)}</div>`+
   (ai.tries.length?`<div class="ai-tries">${ai.tries.map(x=>`• ${esc(x.id)} — ${esc(x.fa)}`).join('<br>')}</div>`:'')+
   `<div class="macts" style="justify-content:flex-start">
    <button class="btn sm ai" data-a="aifix">${ic('zap')}رفع خودکار</button>
    <button class="btn sm" data-a="aidiag">${ic('shield')}عیب‌یابی</button>
    <button class="btn sm" data-a="logs">${ic('alert')}گزارش</button>
    <button class="btn sm" data-a="airetry">${ic('rotate')}تلاش دوباره</button></div>`;return}
  body.innerHTML=ai.last?resultHTML(ai.last.data):'';
 }catch(e){log('ui','AI paint failed',e.message,'err')}}
ai.paint=paint;

ai.open=async t=>{
 log('ai','open() called',t);
 try{
  if(!N.S.set.aiOn){N.toast('Persian explanations are off in Settings','warn','info');log('ai','Blocked: aiOn=false',null,'warn');return}
  if(!t||!N.IX[t.p]){log('ai','Blocked: bad target',t,'err');N.toast('کلمه‌ای انتخاب نشده','warn','alert');return}
  N.clearSel&&N.clearSel();
  ai.target=t;ai.scope=t.scope;ai.error=null;ai.tries=[];ai.needKey=false;ai.stage='';
  const c=cache()[ckOf(t)];ai.last=c||null;
  $('#ai').classList.add('open');paint();N.Snd.p('ai');
  if(c){log('ai','Cache hit',ckOf(t));return}
  if(!ai.key()){ai.needKey=true;log('ai','No API key stored',null,'warn');paint();return}
  await ai.run();
 }catch(e){ai.busy=false;ai.error='خطای داخلی: '+e.message;log('ai','open() threw',e.message,'err');paint()}};

ai.saveInlineKey=()=>{const v=($('#aiKeyInline')?.value||'').trim();
 if(!/^sk-or-/.test(v)){N.toast('کلید باید با sk-or- شروع شود','warn','alert');log('ai','Inline key rejected',null,'warn');return}
 ai.setKey(v);ai.needKey=false;N.Snd.p('ok');N.toast('کلید ذخیره شد','ok','key');ai.run()};

ai.run=async()=>{
 const t=ai.target;
 if(!t){log('ai','run() no target',null,'err');return}
 if(ai.busy){
  if(Date.now()-ai.busyAt>95000){log('ai','Watchdog: releasing stuck run',null,'warn');ai.busy=false}
  else{log('ai','run() skipped: already busy',null,'warn');return}}
 if(!ai.key()){ai.needKey=true;paint();return}
 const chain=ai.chain();
 log('ai','Chain built',{count:chain.length,ids:chain.map(m=>m.model_id)});
 if(!chain.length){ai.error='هیچ مدل فعالی در جدول نیست.';log('ai','No active models',null,'err');paint();return}
 ai.busy=true;ai.busyAt=Date.now();ai.error=null;ai.needKey=false;ai.tries=[];
 let done=null,gone=0;
 try{
  for(let i=0;i<chain.length;i++){
   const m=chain[i];
   ai.stage=`تلاش ${i+1} از ${chain.length} · ${m.model_id}`;paint();
   let realId=m.model_id;
   try{
    if(realId===ALIAS){
     if(lj(K_DEAD)){realId=await resolveAlias()}
     else{
      try{const data=await call(ALIAS,t);
       done={model:ALIAS,shown:ALIAS,data};break}
      catch(e0){const c0=classify(e0);
       log('ai','Literal openrouter/free failed → resolving alias',{kind:c0.kind},'warn');
       ls(K_DEAD,1);realId=await resolveAlias()}}}
    const data=await call(realId,t);
    done={model:realId,shown:realId===m.model_id?m.model_id:`${m.model_id} → ${realId.split('/').pop()}`,data};
    break;
   }catch(e){
    const c=classify(e);
    ai.tries.push({id:m.model_id,fa:c.fa+(realId!==m.model_id?` (${realId})`:'')});
    log('ai',`Attempt ${i+1} failed`,{id:m.model_id,real:realId,kind:c.kind,msg:e.message},'err');
    if(c.kind==='gone'){gone++;
     if(m.model_id===ALIAS){try{localStorage.removeItem(K_ALIAS)}catch{}}
     else{m.active=false;if(m.is_default){m.is_default=false;const n=ai.models.find(x=>x.active);if(n)n.is_default=true}
      ai.save();log('model','Stale id deactivated',{id:m.model_id},'warn')}}
    if(c.kind==='key'){ai.error='کلید OpenRouter پذیرفته نشد. کلید را دوباره وارد کنید.';break}
   }}
 }catch(e){ai.error='خطای داخلی: '+e.message;log('ai','run() threw',e.message,'err')}
 finally{ai.busy=false}
 if(done){ai.last=done;putCache(ckOf(t),done);log('ai','Analysis complete',{model:done.model});
  N.Snd.p('ok');N.buzz(8);N.checkAch&&N.checkAch()}
 else if(!ai.error){
  ai.error=gone?'شناسهٔ مدل‌ها کهنه شده است. «رفع خودکار» همهٔ مدل‌های رایگان امروز را می‌آورد.':
   'هیچ‌یک از مدل‌های فعال پاسخ ندادند. گزارش را ببینید.';
  N.Snd.p('err')}
 paint()};

ai.retry=()=>{if(!ai.target)return;const c=cache();delete c[ckOf(ai.target)];ls(K_CACHE,c);
 ai.last=null;ai.error=null;ai.needKey=false;log('ai','Retry requested');
 if(!ai.key()){ai.needKey=true;paint();return}ai.run()};
ai.close=()=>{$('#ai').classList.remove('open');N.Snd.p('close');log('ui','AI panel closed')};
ai.setScope=v=>{if(!ai.target)return;
 const p=ai.target.p,w=ai.target.w;
 ai.open({scope:v,p,w})};
ai.forPassage=(pn,wi)=>{const has=wi!=null;log('ui','AI requested',{p:pn,w:wi});
 ai.open({scope:has?'word':'passage',p:+pn,w:has?+wi:0})};
ai.forWord=()=>{if(!N.SEL){N.toast('ابتدا یک کلمه را لمس کنید','warn','info');log('ui','tip AI: no selection',null,'warn');return}
 log('ui','tip AI button pressed',{p:N.SEL.p,w:N.SEL.w});ai.forPassage(N.SEL.p,N.SEL.w)};
ai.now=()=>{if(N.SEL){ai.forPassage(N.SEL.p,N.SEL.w);return}
 const pn=N.S.last!=null&&N.IX[N.S.last]?N.S.last:N.P[0].n;ai.forPassage(pn,null)};
ai.copy=()=>{if(!ai.last)return;const d=ai.last.data;
 const lines=Object.keys(LBL).filter(k=>d[k]).map(k=>`${LBL[k]}: ${d[k]}`);
 if(Array.isArray(d.items))d.items.forEach(i=>lines.push(`${i.word} — ${i.root} — ${i.gloss}`));
 if(d.note)lines.push('نکته: '+d.note);
 N.copyText(lines.join('\n'));N.Snd.p('pop');N.toast('تحلیل کپی شد','ok','copy')};

/* diagnose */
ai.diagnose=async()=>{
 log('ai','Diagnosis started');
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
  <h2>${ic('shield')}عیب‌یابی هوش مصنوعی</h2>
  <div class="mbody">هر مرحله واقعاً آزمایش می‌شود.</div>
  <div class="diag" id="diagBox"></div>
  <div class="macts"><button class="btn ai" data-a="aifix">${ic('zap')}رفع خودکار</button>
   <button class="btn" data-a="logs">${ic('alert')}گزارش</button>
   <button class="btn ghost" data-a="mclose">بستن</button></div>`);
 const box=$('#diagBox');
 const row=(state,title,msg)=>{const d=document.createElement('div');d.className='diag-row '+state;
  d.innerHTML=`<div class="s">${state==='ok'?'✓':state==='bad'?'✕':'•'}</div>
   <div class="b"><b>${esc(title)}</b><span>${esc(msg||'')}</span></div>`;box.appendChild(d);return d};
 const set=(d,state,msg)=>{d.className='diag-row '+state;
  d.querySelector('.s').textContent=state==='ok'?'✓':state==='bad'?'✕':'•';
  d.querySelector('.b span').textContent=msg||''};
 const k=ai.key();
 if(!k)row('bad','کلید ذخیره نشده','یک کلید رایگان OpenRouter وارد کنید.');
 else row('ok','کلید موجود است','•••• '+k.slice(-4));
 let keyOK=false;
 if(k){const d=row('wait','اعتبار کلید','در حال بررسی…');
  try{const r=await fetch(OR+'/key',{headers:{Authorization:'Bearer '+k}});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const j=await r.json();keyOK=true;log('ai','Key valid',j.data?.label);
   set(d,'ok','کلید معتبر است'+(j.data?.label?' · '+j.data.label:''))}
  catch(e){log('ai','Key check failed',e.message,'err');set(d,'bad',e.message)}}
 const d2=row('wait','کاتالوگ رایگان','در حال دریافت…');
 let list=[];
 try{list=await ai.catalogue(true);set(d2,'ok',`${list.length} مدل رایگان در دسترس`)}
 catch(e){set(d2,'bad',e.message)}
 const d3=row('wait','مدل پیش‌فرض','در حال انتخاب…');
 let realId=null;
 try{const def=ai.def();
  realId=def?.model_id===ALIAS?await resolveAlias():def?.model_id;
  if(!realId)throw new Error('مدل فعالی وجود ندارد');
  set(d3,'ok',realId)}catch(e){set(d3,'bad',e.message)}
 if(k&&keyOK&&realId){
  const d4=row('wait','درخواست آزمایشی','در حال ارسال…');
  try{const r=await fetch(OR+'/chat/completions',{method:'POST',
    headers:{Authorization:'Bearer '+k,'Content-Type':'application/json',
     'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur'},
    body:JSON.stringify({model:realId,max_tokens:16,messages:[{role:'user',content:'فقط بنویس: آماده'}]})});
   let j=null;try{j=await r.json()}catch{}
   if(!r.ok)throw new Error((j&&(j.error?.message||j.message))||('HTTP '+r.status));
   const txt=(j?.choices?.[0]?.message?.content||'').trim();
   log('ai','Diagnosis completion OK',{model:realId,txt});
   set(d4,'ok','پاسخ: '+txt.slice(0,40));N.Snd.p('ok')}
  catch(e){log('ai','Diagnosis completion failed',e.message,'err');set(d4,'bad',e.message)}}
};

/* key modal */
ai.keyModal=()=>{const k=ai.key();
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
 <h2>${ic('key')}OpenRouter key</h2>
 <div class="mbody">Only in this browser's local storage. Sent straight to OpenRouter, never to Supabase.</div>
 <div class="field" style="margin-top:14px">${ic('lock')}
  <input id="aiKey" type="password" placeholder="sk-or-v1-…" value="${esc(k)}" autocomplete="off" spellcheck="false">
  <button type="button" class="eye" data-a="eye" data-t="aiKey">${ic('eye')}</button></div>
 <div class="macts">
  <a class="btn" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">${ic('out')}Get a free key</a>
  ${k?`<button class="btn bad" data-a="keyclear">${ic('trash')}Clear</button>`:''}
  <button class="btn" data-a="keytest">${ic('zap')}Test</button>
  <button class="btn ai" data-a="keysave">${ic('check')}Save key</button></div>`)};
ai.saveKey=()=>{const v=($('#aiKey')?.value||'').trim();
 if(v&&!/^sk-or-/.test(v)){N.toast('That does not look like an OpenRouter key','warn','alert');return}
 ai.setKey(v);N.mclose();N.Snd.p('ok');N.toast(v?'Key saved in this browser':'Key cleared','ok','key');
 if(N.VIEW==='models')N.render({keep:true})};
ai.testKey=async()=>{const v=($('#aiKey')?.value||'').trim()||($('#aiKey2')?.value||'').trim()||ai.key();
 if(!v){N.toast('Enter a key first','warn','alert');return}
 log('ai','Testing key…');
 try{const r=await fetch(OR+'/key',{headers:{Authorization:'Bearer '+v}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json(),d=j.data||{};
  log('ai','Key test OK',d.label);
  N.toast(`Key works${d.label?' · '+d.label:''}`,'ok','shield');N.Snd.p('ok')}
 catch(e){log('ai','Key test failed',e.message,'err');N.toast('Key test failed: '+e.message,'err','alert');N.Snd.p('err')}};

log('ai',`AI module ready · ${ai.models.length} models · key ${ai.key()?'present':'absent'}`);
})();
