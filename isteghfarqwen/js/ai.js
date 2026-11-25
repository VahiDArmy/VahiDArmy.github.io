/* Nūr AI: local OpenRouter key · free-model registry · Persian morphology tutor */
(()=>{
const N=window.NUR,{$,$$,esc,ic,lj,ls,cl}=N;
const OR='https://openrouter.ai/api/v1';
const K_KEY='nur.ai.key',K_MODELS='nur.ai.models',K_CACHE='nur.ai.cache';
const SEED=[
 {model_id:'openrouter/free',label:'OpenRouter · Free router',provider:'openrouter',context_length:0,active:true,is_default:true,sort:0},
 {model_id:'meta-llama/llama-3.3-70b-instruct:free',label:'Llama 3.3 70B Instruct',provider:'meta-llama',context_length:131072,active:true,is_default:false,sort:1},
 {model_id:'deepseek/deepseek-chat-v3-0324:free',label:'DeepSeek V3 0324',provider:'deepseek',context_length:64000,active:true,is_default:false,sort:2},
 {model_id:'google/gemini-2.0-flash-exp:free',label:'Gemini 2.0 Flash Exp',provider:'google',context_length:1048576,active:true,is_default:false,sort:3},
 {model_id:'qwen/qwen-2.5-72b-instruct:free',label:'Qwen 2.5 72B Instruct',provider:'qwen',context_length:32768,active:false,is_default:false,sort:4},
 {model_id:'mistralai/mistral-small-3.1-24b-instruct:free',label:'Mistral Small 3.1 24B',provider:'mistralai',context_length:96000,active:false,is_default:false,sort:5}
];
const isFree=id=>/:free$/.test(id)||id==='openrouter/free';
const ai={scope:'word',target:null,busy:false,last:null,tries:[]};
N.ai=ai;

/* key — local only, never uploaded */
ai.key=()=>{try{return localStorage.getItem(K_KEY)||''}catch{return''}};
ai.setKey=v=>{try{v?localStorage.setItem(K_KEY,v):localStorage.removeItem(K_KEY)}catch{}ai.paintKey()};
ai.paintKey=()=>{const k=ai.key(),el=$('#drKey');
 if(el)el.textContent=k?('•••• '+k.slice(-4)):'Not set';
 const m=$('#drModel');if(m)m.textContent=(ai.def()||{}).model_id||'—'};

/* registry */
ai.load=()=>{const s=lj(K_MODELS);
 if(Array.isArray(s)&&s.length)return s.map((m,i)=>({...m,sort:m.sort??i}));
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
ai.toggle=id=>{const m=ai.byId(id);if(!m)return;
 m.active=!m.active;
 if(!m.active&&m.is_default){m.is_default=false;const n=ai.models.find(x=>x.active);if(n)n.is_default=true}
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
ai.restore=async(m,i)=>{ai.models.splice(cl(i,0,ai.models.length),0,m);ai.models.forEach((x,k)=>x.sort=k);
 ai.save();ai.cloudPush()};
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

/* free catalogue */
ai.catalogue=async()=>{const r=await fetch(OR+'/models');
 if(!r.ok)throw new Error('Could not reach the OpenRouter catalogue.');
 const j=await r.json();
 return (j.data||[]).filter(m=>{const p=m.pricing||{};
  return isFree(m.id)||(String(p.prompt)==='0'&&String(p.completion)==='0')})
  .map(m=>({id:m.id,name:m.name||m.id,ctx:m.context_length||0,
   provider:(m.id.split('/')[0]||'')})).sort((a,b)=>a.id.localeCompare(b.id))};

/* cache */
const cache=()=>lj(K_CACHE)||{};
const putCache=(k,v)=>{const c=cache();c[k]=v;const keys=Object.keys(c);
 if(keys.length>140)keys.slice(0,keys.length-140).forEach(x=>delete c[x]);ls(K_CACHE,c)};

/* prompt */
const SYS=`شما آموزگار صرف و نحو عربی برای فارسی‌زبانان هستید. تنها به زبان فارسی پاسخ دهید و خروجی را فقط به صورت یک شیء JSON معتبر بدهید، بدون توضیح اضافی و بدون بلوک کد.
کلیدها (همه رشتهٔ فارسی، اگر موردی ربط ندارد رشتهٔ خالی):
"root": حروف اصلی/ریشه با خط تیره، مثل «غ-ف-ر»
"kind": نوع کلمه: فعل، اسم، حرف، ضمیر، مصدر، اسم فاعل و مانند آن
"pattern": وزن صرفی با حرکت‌گذاری، مثل «یَسْتَفْعِلُ» یا «فَعَّال»
"form": ساختار یا باب، مثل «ثلاثی مجرد، باب نَصَرَ» یا «ثلاثی مزید، باب استفعال»
"tense": زمان و صیغه، مثل «مضارع، متکلم وحده»
"person": شخص، جنس و شمار در صورت ربط
"affixes": اجزای چسبیده و حروف اضافه، مثل «همزهٔ استفهام، ضمیر ـكَ، حرف جرّ بِـ»
"role": نقش نحوی و اعراب در همین عبارت، مثل «مفعولٌ به، منصوب»
"meaning": معنای دقیق همین کلمه در همین عبارت، یک جملهٔ کوتاه
"note": یک نکتهٔ کوتاه آموزشی؛ اگر در چیزی مطمئن نیستی همین‌جا صادقانه بگو
"items": آرایه؛ تنها وقتی کل عبارت خواسته شده، حداکثر ۶ عضو با کلیدهای {"word","root","gloss"} برای مهم‌ترین کلمات عبارت. در تحلیل تک‌کلمه آرایهٔ خالی بده.`;
function userMsg(t){
 const p=N.IX[t.p];
 if(t.scope==='passage')return `عبارت کامل:\n${p.arText}\n\nترجمهٔ تحت‌اللفظی فارسی:\n${p.faText}\n\nکل این عبارت را تحلیل کن: ساختارهای مهم، نقش‌ها، و ریشهٔ کلمات کلیدی را در items بیاور.`;
 const w=p.words[t.w];
 if(t.scope==='phrase'){const a=cl(t.w-3,0,p.words.length-1),b=cl(t.w+3,a,p.words.length-1);
  const win=p.words.slice(a,b+1);
  return `عبارت کامل:\n${p.arText}\n\nقطعهٔ مورد نظر:\n${win.map(x=>x.a).join(' ')}\n\nکلمهٔ کانونی: «${w.a}» (با برابر فارسی «${w.f}»)\nتحلیل را روی همین کلمهٔ کانونی متمرکز کن و نقشش را در همین قطعه بگو.`}
 return `عبارت کامل:\n${p.arText}\n\nکلمهٔ مورد نظر: «${w.a}» — جایگاه: کلمهٔ ${t.w+1} از ${p.words.length}\nبرابر فارسی در ترجمهٔ تحت‌اللفظی: «${w.f}»\nفقط همین کلمه را تحلیل کن.`}

function parseJSON(txt){
 let s=String(txt||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
 const a=s.indexOf('{'),b=s.lastIndexOf('}');
 if(a>=0&&b>a)s=s.slice(a,b+1);
 try{return JSON.parse(s)}catch{}
 return{meaning:String(txt||'').trim(),note:''}}

async function call(model,t,signal){
 const r=await fetch(OR+'/chat/completions',{method:'POST',signal,
  headers:{Authorization:'Bearer '+ai.key(),'Content-Type':'application/json',
   'HTTP-Referer':location.origin||'https://nur.local','X-Title':'Nur · Istighfar word tutor'},
  body:JSON.stringify({model,temperature:.2,max_tokens:900,
   messages:[{role:'system',content:SYS},{role:'user',content:userMsg(t)}]})});
 let j=null;try{j=await r.json()}catch{}
 if(!r.ok){const m=(j&&(j.error?.message||j.message))||('HTTP '+r.status);const e=new Error(m);e.status=r.status;throw e}
 const txt=j?.choices?.[0]?.message?.content||'';
 if(!txt.trim())throw new Error('The model returned an empty answer.');
 return parseJSON(txt)}

/* panel */
const LBL={root:'ریشه',kind:'نوع کلمه',pattern:'وزن',form:'باب / ساختار',tense:'زمان و صیغه',
 person:'شخص و شمار',affixes:'اجزای چسبیده',role:'نقش و اعراب',meaning:'معنا در این عبارت'};
function scopeChips(){
 const has=N.SEL!=null;
 return [['word','این کلمه'],['phrase','عبارت پیرامون'],['passage','کل فراز']]
  .map(([v,l])=>`<button class="pill ai ${ai.scope===v?'on':''}" data-a="aiscope" data-v="${v}" ${v!=='passage'&&!has?'disabled style="opacity:.4;pointer-events:none"':''}>${l}</button>`).join('')}
function targetHTML(t){const p=N.IX[t.p];if(!p)return'';
 if(t.scope==='passage')return`<div class="a">${esc(p.arText)}</div><div class="f">${esc(p.faText)}</div>`;
 const w=p.words[t.w];
 if(t.scope==='phrase'){const a=cl(t.w-3,0,p.words.length-1),b=cl(t.w+3,a,p.words.length-1);
  const win=p.words.slice(a,b+1).map((x,i)=>a+i===t.w?`<b style="color:var(--goldl)">${esc(x.a)}</b>`:esc(x.a)).join(' ');
  return`<div class="a">${win}</div><div class="f">${esc(p.words.slice(a,b+1).map(x=>x.f).join(' '))}</div>`}
 return`<div class="a">${esc(w.a)}</div><div class="f">${esc(w.f)}</div>`}
function resultHTML(d){
 let h='';
 for(const k of Object.keys(LBL)){const v=(d[k]||'').toString().trim();if(!v)continue;
  const lat=/^[\u0600-\u06FF\s\u064B-\u065F\-ـ]+$/.test(v)&&['root','pattern'].includes(k);
  h+=`<div class="ai-row"><div class="k">${LBL[k]}</div><div class="v">${lat?`<span class="lat">${esc(v)}</span>`:esc(v)}</div></div>`}
 if(Array.isArray(d.items)&&d.items.length){
  h+=`<div class="ai-items">`+d.items.slice(0,8).map(it=>
   `<div class="ai-item"><b>${esc(it.word||'')}</b> <i>${esc(it.root||'')}</i><br>${esc(it.gloss||'')}</div>`).join('')+`</div>`}
 const note=(d.note||'').toString().trim();
 if(note)h+=`<div class="ai-note">${esc(note)}</div>`;
 return h||`<div class="ai-err">پاسخ قابل خواندن نبود. دوباره تلاش کنید یا مدل دیگری را انتخاب کنید.</div>`}
function paint(){
 const t=ai.target;if(!t)return;const p=N.IX[t.p];
 $('#aiTitle').textContent=t.scope==='passage'?'تحلیل کل فراز':'تحلیل کلمه';
 $('#aiSub').textContent=`فراز ${t.p} · ${p?p.ch:''}`;
 $('#aiScope').innerHTML=scopeChips();
 $('#aiTarget').innerHTML=targetHTML(t);
 $('#aiModel').textContent=ai.last?.model||(ai.def()||{}).model_id||'—';
 const body=$('#aiBody');
 if(ai.busy){body.innerHTML=`<div class="ai-sk"><i></i><i></i><i></i><i></i><i></i></div>`;return}
 if(ai.error){body.innerHTML=`<div class="ai-err">${esc(ai.error)}</div>`+
  (ai.tries.length?`<div class="ai-tries">${ai.tries.map(x=>`• ${esc(x.id)} — ${esc(x.err)}`).join('<br>')}</div>`:'')+
  `<div class="macts" style="justify-content:flex-start"><button class="btn sm ai" data-a="keymod">${ic('key')}کلید</button>
   <button class="btn sm" data-a="gomodels">${ic('cpu')}مدل‌ها</button>
   <button class="btn sm" data-a="airetry">${ic('rotate')}تلاش دوباره</button></div>`;return}
 body.innerHTML=ai.last?resultHTML(ai.last.data):''}
ai.paint=paint;

ai.open=async t=>{
 if(!N.S.set.aiOn){N.toast('Persian explanations are switched off in Settings','warn','info');return}
 ai.target=t;ai.error=null;ai.tries=[];
 const ck=`${t.scope}|${t.p}|${t.w??''}|v2`,c=cache()[ck];
 ai.last=c||null;
 $('#ai').classList.add('open');paint();N.Snd.p('ai');
 if(c){$('#aiModel').textContent=c.model;return}
 if(!ai.key()){ai.error='کلید OpenRouter ذخیره نشده است. کلید رایگان خود را وارد کنید؛ فقط در همین مرورگر می‌ماند.';paint();return}
 await ai.run()};
ai.run=async()=>{
 const t=ai.target;if(!t||ai.busy)return;
 const chain=ai.chain();
 if(!chain.length){ai.error='هیچ مدل فعالی در جدول نیست. یک مدل رایگان فعال کنید.';paint();return}
 ai.busy=true;ai.error=null;ai.tries=[];paint();
 const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),60000);
 let done=null;
 for(const m of chain){
  try{const data=await call(m.model_id,t,ctl.signal);done={model:m.model_id,data};break}
  catch(e){ai.tries.push({id:m.model_id,err:e.name==='AbortError'?'timeout':e.message});
   if(e.name==='AbortError')break}}
 clearTimeout(to);ai.busy=false;
 if(done){ai.last=done;const ck=`${t.scope}|${t.p}|${t.w??''}|v2`;putCache(ck,done);
  N.Snd.p('ok');N.buzz(8)}
 else{ai.error='هیچ‌یک از مدل‌های فعال پاسخ ندادند.';N.Snd.p('err')}
 paint()};
ai.retry=()=>{if(!ai.target)return;const t=ai.target;
 const ck=`${t.scope}|${t.p}|${t.w??''}|v2`,c=cache();delete c[ck];ls(K_CACHE,c);
 ai.last=null;ai.error=null;
 if(!ai.key()){ai.error='کلید OpenRouter ذخیره نشده است.';paint();return}
 ai.run()};
ai.close=()=>{$('#ai').classList.remove('open');N.Snd.p('close')};
ai.setScope=v=>{if(!ai.target)return;
 if(v!=='passage'&&N.SEL==null)return;
 ai.scope=v;ai.target={...ai.target,scope:v,p:N.SEL?N.SEL.p:ai.target.p,w:N.SEL?N.SEL.w:ai.target.w};
 ai.last=null;ai.error=null;ai.open(ai.target)};
ai.forPassage=(pn,wi)=>{const has=wi!=null;
 ai.scope=has?'word':'passage';ai.open({scope:ai.scope,p:+pn,w:has?+wi:0})};
ai.now=()=>{if(N.SEL){ai.scope='word';ai.open({scope:'word',p:N.SEL.p,w:N.SEL.w});return}
 const pn=N.S.last!=null&&N.IX[N.S.last]?N.S.last:N.P[0].n;ai.forPassage(pn,null)};
ai.copy=()=>{if(!ai.last)return;const d=ai.last.data;
 const lines=Object.keys(LBL).filter(k=>d[k]).map(k=>`${LBL[k]}: ${d[k]}`);
 if(Array.isArray(d.items))d.items.forEach(i=>lines.push(`${i.word} — ${i.root} — ${i.gloss}`));
 if(d.note)lines.push('نکته: '+d.note);
 N.copyText(lines.join('\n'));N.Snd.p('pop');N.toast('تحلیل کپی شد','ok','copy')};

/* key modal */
ai.keyModal=()=>{const k=ai.key();
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button>
 <h2>${ic('key')}OpenRouter key</h2>
 <div class="mbody">Stored only in this browser's local storage. It is sent straight to OpenRouter and never to Supabase. Free models are the only ones this app will call.</div>
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
ai.testKey=async()=>{const v=($('#aiKey')?.value||'').trim()||ai.key();
 if(!v){N.toast('Enter a key first','warn','alert');return}
 const b=$('#mroot [data-a=keytest]');b&&b.classList.add('busy');
 try{const r=await fetch(OR+'/key',{headers:{Authorization:'Bearer '+v}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();const d=j.data||{};
  N.toast(`Key works${d.label?' · '+d.label:''}${d.limit!=null?' · limit '+d.limit:''}`,'ok','shield');N.Snd.p('ok')}
 catch(e){N.toast('Key test failed: '+e.message,'err','alert');N.Snd.p('err')}
 finally{b&&b.classList.remove('busy')}};
})();
