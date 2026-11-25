/* Nūr AI · Persian morphology tutor over OpenRouter free models.
   Key: browser-local only. Every word popup carries its own analysis button. */
(()=>{
const N=window.NUR,{$,$$,esc,ic,lj,ls,cl}=N;
const OR='https://openrouter.ai/api/v1';
const K_KEY='nur.ai.key',K_MODELS='nur.ai.models',K_CACHE='nur.ai.cache',K_ALIAS='nur.ai.alias';
const ALIAS='openrouter/free';
const SEED=[
 {model_id:ALIAS,label:'OpenRouter · Free router',provider:'openrouter',context_length:0,active:true,is_default:true,sort:0},
 {model_id:'meta-llama/llama-3.3-70b-instruct:free',label:'Llama 3.3 70B Instruct',provider:'meta-llama',context_length:131072,active:true,is_default:false,sort:1},
 {model_id:'deepseek/deepseek-chat-v3-0324:free',label:'DeepSeek V3 0324',provider:'deepseek',context_length:64000,active:true,is_default:false,sort:2},
 {model_id:'google/gemini-2.0-flash-exp:free',label:'Gemini 2.0 Flash Exp',provider:'google',context_length:1048576,active:true,is_default:false,sort:3},
 {model_id:'qwen/qwen-2.5-72b-instruct:free',label:'Qwen 2.5 72B Instruct',provider:'qwen',context_length:32768,active:false,is_default:false,sort:4},
 {model_id:'mistralai/mistral-small-3.1-24b-instruct:free',label:'Mistral Small 3.1 24B',provider:'mistralai',context_length:96000,active:false,is_default:false,sort:5}
];
const isFree=id=>/:free$/.test(id)||id===ALIAS;
const ai={scope:'word',target:null,busy:false,last:null,tries:[],stage:'',error:null};
N.ai=ai;

/* ── key ── */
ai.key=()=>{try{return localStorage.getItem(K_KEY)||''}catch{return''}};
ai.setKey=v=>{try{v?localStorage.setItem(K_KEY,v):localStorage.removeItem(K_KEY)}catch{}ai.paintKey()};
ai.paintKey=()=>{const k=ai.key(),el=$('#drKey');
 if(el)el.textContent=k?('•••• '+k.slice(-4)):'Not set';
 const m=$('#drModel');if(m)m.textContent=(ai.def()||{}).model_id||'—'};

/* ── registry ── */
ai.load=()=>{const s=lj(K_MODELS);
 if(Array.isArray(s)&&s.length){const ms=s.map((m,i)=>({...m,sort:m.sort??i}));
  if(!ms.some(m=>m.model_id===ALIAS))ms.unshift({...SEED[0],is_default:!ms.some(x=>x.is_default)});
  return ms}
 return SEED.map(m=>({...m}))};
ai.models=ai.load();
ai.save=()=>{ls(K_MODELS,ai.models);ai.paintKey();N.hud&&N.hud()};
ai.def=()=>ai.models.find(m=>m.is_default&&m.active)||ai.models.find(m=>m.active)||ai.models[0];
ai.chain=()=>{const d=ai.def();const rest=ai.models.filter(m=>m.active&&m!==d).sort((a,b)=>a.sort-b.sort);
 return d?[d,...rest]:rest};
ai.byId=id=>ai.models.find(m=>m.model_id===id);
ai.add=(id,label,provider,ctx)=>{id=String(id||'').trim();
 if(!id)throw new Error('Model id is required.');
 if(!isFree(id))throw new Error('Only free models are allowed — the id must end with :free (or be openrouter/free).');
 if(ai.byId(id))throw new Error('That model is already in the table.');
 ai.models.push({model_id:id,label:label||id.split('/').pop().replace(':free',''),provider:provider||id.split('/')[0],
  context_length:+ctx||0,active:true,is_default:ai.models.length===0,sort:ai.models.length});
 ai.save();ai.cloudPush()};
ai.toggle=id=>{const m=ai.byId(id);if(!m)return;m.active=!m.active;
 if(!ai.models.some(x=>x.is_default&&x.active)){const n=ai.models.find(x=>x.active);if(n)n.is_default=true}
 ai.save();ai.cloudPush()};
ai.setDefault=async id=>{ai.models.forEach(m=>m.is_default=m.model_id===id);
 const m=ai.byId(id);if(m)m.active=true;ai.save();
 if(N.SES){try{await N.cloudModels.clearDefault();await N.cloudModels.patch(id,{is_default:true,active:true})}catch{}}};
ai.remove=async id=>{const i=ai.models.findIndex(m=>m.model_id===id);if(i<0)return null;
 const [m]=ai.models.splice(i,1);
 if(m.is_default){const n=ai.models.find(x=>x.active)||ai.models[0];if(n)n.is_default=true}
 ai.models.forEach((x,k)=>x.sort=k);ai.save();
 if(N.SES){try{await N.cloudModels.remove(id)}catch{}}
 return m};
ai.restore=async(m,i)=>{ai.models.splice(cl(i,0,ai.models.length),0,m);
 ai.models.forEach((x,k)=>x.sort=k);ai.save();ai.cloudPush()};
ai.cloudPull=async()=>{if(!N.SES)return;
 try{const rows=await N.cloudModels.list();if(!Array.isArray(rows)||!rows.length)return;
  const map=new Map(ai.models.map(m=>[m.model_id,m]));
  rows.forEach(r=>{if(!isFree(r.model_id))return;
   map.set(r.model_id,{model_id:r.model_id,label:r.label||r.model_id,provider:r.provider||'',
    context_length:+r.context_length||0,active:!!r.active,is_default:!!r.is_default,sort:+r.sort||0})});
  ai.models=[...map.values()].sort((a,b)=>a.sort-b.sort);
  if(!ai.models.some(m=>m.is_default&&m.active)){const n=ai.models.find(m=>m.active)||ai.models[0];if(n)n.is_default=true}
  ai.save();if(N.VIEW==='models')N.render({keep:true})}catch{}};
ai.cloudPush=async()=>{if(!N.SES)return;
 try{await N.cloudModels.upsert(ai.models.map((m,i)=>({...m,sort:i,updated_at:new Date().toISOString()})))}catch{}};

/* ── live free catalogue ── */
let catMemo=null;
ai.catalogue=async(force)=>{
 if(catMemo&&!force)return catMemo;
 const r=await fetch(OR+'/models',{headers:{Accept:'application/json'}});
 if(!r.ok)throw new Error('Catalogue unreachable (HTTP '+r.status+').');
 const j=await r.json();
 catMemo=(j.data||[]).filter(m=>{const p=m.pricing||{};
  return isFree(m.id)||(String(p.prompt)==='0'&&String(p.completion)==='0')})
  .map(m=>({id:m.id,name:m.name||m.id,ctx:m.context_length||0,provider:m.id.split('/')[0]||''}))
  .sort((a,b)=>a.id.localeCompare(b.id));
 return catMemo};

/* openrouter/free is a router alias — resolve it to a real free model */
async function resolveAlias(){
 const c=lj(K_ALIAS);
 if(c&&c.id&&Date.now()-c.ts<864e5&&ai.byId(c.id)!==undefined)return c.id;
 const list=await ai.catalogue(true);
 const real=list.filter(m=>m.id!==ALIAS);
 const pick=real.find(m=>/llama-3\.3-70b-instruct:free$/.test(m.id))
  ||real.find(m=>/deepseek.*:free$/.test(m.id))
  ||real.find(m=>/gemini.*flash.*:free$/.test(m.id))
  ||real.find(m=>/qwen.*:free$/.test(m.id))
  ||real.find(m=>/mistral.*:free$/.test(m.id))
  ||real[0];
 if(!pick)throw new Error('OpenRouter lists no free model right now.');
 ls(K_ALIAS,{id:pick.id,ts:Date.now()});
 return pick.id}

async function heal(){
 try{const list=(await ai.catalogue(true)).filter(m=>m.id!==ALIAS);
  let added=0;
  for(const m of list.slice(0,4)){if(!ai.byId(m.id)){
   ai.models.push({model_id:m.id,label:m.name,provider:m.provider,context_length:m.ctx,
    active:true,is_default:false,sort:ai.models.length});added++}}
  if(added){if(!ai.models.some(x=>x.is_default&&x.active)){
    const n=ai.models.find(x=>x.active&&x.model_id!==ALIAS);if(n)n.is_default=true}
   ai.save();ai.cloudPush();
   N.toast(`${added} working free model${added>1?'s':''} added from the live catalogue`,'ai','cpu')}
  return added}catch{return 0}}
ai.heal=heal;

/* ── cache ── */
const cache=()=>lj(K_CACHE)||{};
const putCache=(k,v)=>{const c=cache();c[k]=v;const keys=Object.keys(c);
 if(keys.length>140)keys.slice(0,keys.length-140).forEach(x=>delete c[x]);ls(K_CACHE,c)};
const ckOf=t=>`${t.scope}|${t.p}|${t.w??''}|v3`;

/* ── prompt ── */
const SYS=`شما آموزگار صرف و نحو عربی برای فارسی‌زبانان هستید. تنها به فارسی پاسخ دهید و خروجی را فقط یک شیء JSON معتبر بدهید، بدون بلوک کد و بدون متن اضافی.
کلیدها (همه رشتهٔ فارسی؛ اگر موردی ربط ندارد رشتهٔ خالی):
"root": حروف اصلی/ریشه با خط تیره، مثل «غ-ف-ر»
"kind": نوع کلمه: فعل، اسم، حرف، ضمیر، مصدر، اسم فاعل …
"pattern": وزن صرفی با حرکت، مثل «یَسْتَفْعِلُ»
"form": باب یا ساختار، مثل «ثلاثی مزید، باب استفعال»
"tense": زمان و صیغه، مثل «مضارع، متکلم وحده»
"person": شخص، جنس و شمار در صورت ربط
"affixes": اجزای چسبیده، مثل «ضمیر ـكَ، حرف جرّ بِـ، همزهٔ متكلم»
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
 const to=setTimeout(()=>ctl.abort(),26000);
 try{
  const r=await fetch(OR+'/chat/completions',{method:'POST',signal:ctl.signal,
   headers:{Authorization:'Bearer '+ai.key(),'Content-Type':'application/json',
    'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur Istighfar'},
   body:JSON.stringify({model:realId,temperature:.2,max_tokens:800,
    messages:[{role:'system',content:SYS},{role:'user',content:userMsg(t)}]})});
  let j=null;try{j=await r.json()}catch{}
  if(!r.ok){const msg=(j&&(j.error?.message||j.message))||('HTTP '+r.status);
   const e=new Error(msg);e.status=r.status;throw e}
  const txt=j?.choices?.[0]?.message?.content||'';
  if(!txt.trim())throw new Error('پاسخ خالی بود');
  return parseJSON(txt);
 }catch(e){if(e.name!=='AbortError'&&!e.status&&!/failed to fetch/i.test(e.message||''))e.net=1;throw e}
 finally{clearTimeout(to)}}

/* ── panel ── */
const LBL={root:'ریشه',kind:'نوع کلمه',pattern:'وزن',form:'باب / ساختار',tense:'زمان و صیغه',
 person:'شخص و شمار',affixes:'اجزای چسبیده',role:'نقش و اعراب',meaning:'معنا در این عبارت'};
const scopeChips=()=>{const has=N.SEL!=null;
 return [['word','این کلمه'],['phrase','عبارت پیرامون'],['passage','کل فراز']]
  .map(([v,l])=>`<button class="pill ai ${ai.scope===v?'on':''}" data-a="aiscope" data-v="${v}"
   ${v!=='passage'&&!has?'disabled style="opacity:.4;pointer-events:none"':''}>${l}</button>`).join('')};
function targetHTML(t){const p=N.IX[t.p];if(!p)return'';
 if(t.scope==='passage')return`<div class="a">${esc(p.arText)}</div><div class="f">${esc(p.faText)}</div>`;
 const w=p.words[t.w];
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
 <p>برای تحلیل، کلید رایگان OpenRouter لازم است. کلید فقط در همین مرورگر می‌ماند و هرگز به سرور فرستاده نمی‌شود.</p>
 <div class="field">${ic('lock')}<input id="aiKeyInline" type="password" placeholder="sk-or-v1-…" autocomplete="off" spellcheck="false">
  <button type="button" class="eye" data-a="eye" data-t="aiKeyInline">${ic('eye')}</button></div>
 <div class="acts"><button class="btn sm ai" id="aiKeyGo">${ic('check')}ذخیره و تحلیل</button>
  <a class="btn sm" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">${ic('out')}گرفتن کلید رایگان</a></div></div>`;
function paint(){const t=ai.target;if(!t)return;const p=N.IX[t.p];
 $('#aiTitle').textContent=t.scope==='passage'?'تحلیل کل فراز':'تحلیل کلمه';
 $('#aiSub').textContent=`فراز ${t.p} · ${p?p.ch:''}`;
 $('#aiScope').innerHTML=scopeChips();
 $('#aiTarget').innerHTML=targetHTML(t);
 $('#aiModel').textContent=ai.last?.shown||(ai.def()||{}).model_id||'—';
 const body=$('#aiBody');
 if(ai.busy){body.innerHTML=`<div class="ai-stage"><span class="dot"></span>${esc(ai.stage||'در حال تحلیل…')}</div>
  <div class="ai-sk"><i></i><i></i><i></i><i></i><i></i></div>`;return}
 if(ai.needKey){body.innerHTML=keyBoxHTML();
  const go=$('#aiKeyGo');
  if(go)go.onclick=()=>{const v=($('#aiKeyInline')?.value||'').trim();
   if(!/^sk-or-/.test(v)){N.toast('کلید باید با sk-or- شروع شود','warn','alert');return}
   ai.setKey(v);ai.needKey=false;N.Snd.p('ok');N.toast('کلید ذخیره شد','ok','key');ai.run()};
  setTimeout(()=>$('#aiKeyInline')?.focus(),60);return}
 if(ai.error){body.innerHTML=`<div class="ai-err">${esc(ai.error)}</div>`+
  (ai.tries.length?`<div class="ai-tries">${ai.tries.map(x=>`• ${esc(x.id)} — ${esc(x.fa)}`).join('<br>')}</div>`:'')+
  `<div class="macts" style="justify-content:flex-start">
   <button class="btn sm ai" id="aiFix">${ic('zap')}رفع خودکار</button>
   <button class="btn sm" id="aiDiag">${ic('shield')}عیب‌یابی</button>
   <button class="btn sm" data-a="keymod">${ic('key')}کلید</button>
   <button class="btn sm" data-a="airetry">${ic('rotate')}تلاش دوباره</button></div>`;
  const f=$('#aiFix');if(f)f.onclick=async()=>{f.classList.add('busy');
   const n=await heal();f.classList.remove('busy');
   if(n){ai.error=null;ai.tries=[];ai.run()}else N.toast('کاتالوگ در دسترس نبود','warn','alert')};
  const d=$('#aiDiag');if(d)d.onclick=()=>ai.diagnose();
  return}
 body.innerHTML=ai.last?resultHTML(ai.last.data):''}
ai.paint=paint;

ai.open=async t=>{
 if(!N.S.set.aiOn){N.toast('Persian explanations are off in Settings','warn','info');return}
 ai.target=t;ai.error=null;ai.tries=[];ai.needKey=false;ai.stage='';
 const c=cache()[ckOf(t)];ai.last=c||null;
 $('#ai').classList.add('open');paint();N.Snd.p('ai');
 if(c)return;
 if(!ai.key()){ai.needKey=true;paint();return}
 await ai.run()};

ai.run=async()=>{
 const t=ai.target;if(!t||ai.busy)return;
 if(!ai.key()){ai.needKey=true;paint();return}
 const chain=ai.chain();
 if(!chain.length){ai.error='هیچ مدل فعالی در جدول نیست.';paint();return}
 ai.busy=true;ai.error=null;ai.needKey=false;ai.tries=[];
 let done=null,gone=0;
 for(let i=0;i<chain.length;i++){
  const m=chain[i];
  ai.stage=`تلاش ${i+1} از ${chain.length} · ${m.model_id}`;paint();
  let realId=m.model_id;
  try{
   if(realId===ALIAS){ai.stage=`تلاش ${i+1} از ${chain.length} · انتخاب مدل رایگان…`;paint();realId=await resolveAlias()}
   const data=await call(realId,t);
   done={model:realId,shown:realId===m.model_id?m.model_id:`${m.model_id} → ${realId.split('/').pop()}`,data};
   break;
  }catch(e){
   const c=classify(e);
   ai.tries.push({id:m.model_id,fa:c.fa+(realId!==m.model_id?` (${realId})`:'')});
   if(c.kind==='gone'){gone++;
    if(m.model_id===ALIAS){try{localStorage.removeItem(K_ALIAS)}catch{}}
    else{m.active=false;if(m.is_default){m.is_default=false;const n=ai.models.find(x=>x.active);if(n)n.is_default=true}ai.save()}}
   if(c.kind==='key'){ai.error='کلید OpenRouter پذیرفته نشد. کلید را دوباره وارد کنید.';break}
  }}
 ai.busy=false;
 if(done){ai.last=done;putCache(ckOf(t),done);N.Snd.p('ok');N.buzz(8);N.checkAch&&N.checkAch()}
 else if(!ai.error){
  ai.error=gone?'شناسهٔ مدل‌ها کهنه شده است. با «رفع خودکار» مدل‌های رایگانِ زندهٔ امروز جایگزین می‌شوند.':
   'هیچ‌یک از مدل‌های فعال پاسخ ندادند. عیب‌یابی کنید یا مدل دیگری اضافه کنید.';
  N.Snd.p('err')}
 paint()};

ai.retry=()=>{if(!ai.target)return;const c=cache();delete c[ckOf(ai.target)];ls(K_CACHE,c);
 ai.last=null;ai.error=null;ai.needKey=false;
 if(!ai.key()){ai.needKey=true;paint();return}ai.run()};
ai.close=()=>{$('#ai').classList.remove('open');N.Snd.p('close')};
ai.setScope=v=>{if(!ai.target)return;if(v!=='passage'&&N.SEL==null)return;
 ai.scope=v;ai.target={scope:v,p:N.SEL?N.SEL.p:ai.target.p,w:N.SEL?N.SEL.w:ai.target.w};
 ai.last=null;ai.error=null;ai.open(ai.target)};
ai.forPassage=(pn,wi)=>{const has=wi!=null;ai.scope=has?'word':'passage';
 ai.open({scope:ai.scope,p:+pn,w:has?+wi:0})};
ai.now=()=>{if(N.SEL){ai.forPassage(N.SEL.p,N.SEL.w);return}
 const pn=N.S.last!=null&&N.IX[N.S.last]?N.S.last:N.P[0].n;ai.forPassage(pn,null)};
ai.copy=()=>{if(!ai.last)return;const d=ai.last.data;
 const lines=Object.keys(LBL).filter(k=>d[k]).map(k=>`${LBL[k]}: ${d[k]}`);
 if(Array.isArray(d.items))d.items.forEach(i=>lines.push(`${i.word} — ${i.root} — ${i.gloss}`));
 if(d.note)lines.push('نکته: '+d.note);
 N.copyText(lines.join('\n'));N.Snd.p('pop');N.toast('تحلیل کپی شد','ok','copy')};

/* ── the small AI button inside every word popup ── */
function mountTip(){
 const tip=$('#tip');if(!tip||tip.dataset.aiMounted)return;
 tip.dataset.aiMounted='1';
 const ensure=()=>{if(!tip.querySelector('.tip-ai'))
  tip.insertAdjacentHTML('beforeend',
   `<button class="tip-ai" type="button" aria-label="تحلیل صرفی این کلمه" title="تحلیل ریشه و ساختار">${ic('ai')}</button>`)};
 ensure();
 new MutationObserver(ensure).observe(tip,{childList:true,subtree:true,characterData:true});
 tip.addEventListener('click',e=>{
  e.stopPropagation();
  const b=e.target.closest('.tip-ai');if(!b)return;
  if(!N.SEL){N.toast('ابتدا یک کلمه را لمس کنید','warn','info');return}
  b.classList.add('busy');setTimeout(()=>b.classList.remove('busy'),700);
  ai.forPassage(N.SEL.p,N.SEL.w)});
 tip.addEventListener('pointerdown',e=>e.stopPropagation());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountTip);else mountTip();

/* ── diagnose ── */
ai.diagnose=async()=>{
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
  <h2>${ic('shield')}عیب‌یابی هوش مصنوعی</h2>
  <div class="mbody">هر مرحله واقعاً آزمایش می‌شود و نتیجهٔ خام نشان داده می‌شود.</div>
  <div class="diag" id="diagBox"></div>
  <div class="macts"><button class="btn ai" id="diagFix">${ic('zap')}رفع خودکار</button>
   <button class="btn ghost" data-a="mclose">بستن</button></div>`);
 const box=$('#diagBox');
 const row=(state,title,msg)=>{const d=document.createElement('div');
  d.className='diag-row '+state;
  d.innerHTML=`<div class="s">${state==='ok'?'✓':state==='bad'?'✕':'•'}</div>
   <div class="b"><b>${esc(title)}</b><span>${esc(msg||'')}</span></div>`;
  box.appendChild(d);return d};
 const set=(d,state,msg)=>{d.className='diag-row '+state;
  d.querySelector('.s').textContent=state==='ok'?'✓':state==='bad'?'✕':'•';
  d.querySelector('.b span').textContent=msg||''};
 const k=ai.key();
 if(!k)row('bad','کلید ذخیره نشده','از بخش کلید، یک کلید رایگان OpenRouter وارد کنید.');
 else row('ok','کلید موجود است','•••• '+k.slice(-4));
 let keyOK=false;
 if(k){const d=row('wait','اعتبار کلید','در حال بررسی…');
  try{const r=await fetch(OR+'/key',{headers:{Authorization:'Bearer '+k}});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const j=await r.json();keyOK=true;
   set(d,'ok','کلید معتبر است'+(j.data?.label?' · '+j.data.label:''))}
  catch(e){set(d,'bad',e.message)}}
 const d2=row('wait','کاتالوگ مدل‌های رایگان','در حال دریافت…');
 let list=[];
 try{list=await ai.catalogue(true);set(d2,'ok',`${list.length} مدل رایگان در دسترس است`)}
 catch(e){set(d2,'bad',e.message)}
 const d3=row('wait','مدل پیش‌فرض','در حال انتخاب…');
 let realId=null;
 try{const def=ai.def();
  realId=def?.model_id===ALIAS?await resolveAlias():def?.model_id;
  if(!realId)throw new Error('مدل فعالی وجود ندارد');
  set(d3,'ok',realId)}
 catch(e){set(d3,'bad',e.message)}
 if(k&&keyOK&&realId){
  const d4=row('wait','درخواست آزمایشی','در حال ارسال…');
  try{const r=await fetch(OR+'/chat/completions',{method:'POST',
    headers:{Authorization:'Bearer '+k,'Content-Type':'application/json',
     'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur Istighfar'},
    body:JSON.stringify({model:realId,max_tokens:16,messages:[{role:'user',content:'فقط بنویس: آماده'}]})});
   let j=null;try{j=await r.json()}catch{}
   if(!r.ok)throw new Error((j&&(j.error?.message||j.message))||('HTTP '+r.status));
   set(d4,'ok','پاسخ دریافت شد: '+(j?.choices?.[0]?.message?.content||'').trim().slice(0,40));
   N.Snd.p('ok')}
  catch(e){set(d4,'bad',e.message)}}
 const fix=$('#diagFix');
 if(fix)fix.onclick=async()=>{fix.classList.add('busy');const n=await heal();fix.classList.remove('busy');
  N.toast(n?`${n} مدل زنده اضافه شد`:'کاتالوگ در دسترس نبود',n?'ai':'warn',n?'cpu':'alert');
  if(n&&N.VIEW==='models')N.render({keep:true})};
};

/* ── key modal ── */
ai.keyModal=()=>{const k=ai.key();
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
 <h2>${ic('key')}OpenRouter key</h2>
 <div class="mbody">Only in this browser's local storage. Sent straight to OpenRouter, never to Supabase. Only free models are called.</div>
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
 try{const r=await fetch(OR+'/key',{headers:{Authorization:'Bearer '+v}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json(),d=j.data||{};
  N.toast(`Key works${d.label?' · '+d.label:''}`,'ok','shield');N.Snd.p('ok')}
 catch(e){N.toast('Key test failed: '+e.message,'err','alert');N.Snd.p('err')}};
})();
