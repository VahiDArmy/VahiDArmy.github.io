/* Nūr app: router · actions · events · boot */
(()=>{
const N=window.NUR,{$,$$,esc,ic,cl,fmt,deb,copy,lj}=N;
const TITLES={read:'The Grand Istighfār',words:'Word to Word',models:'AI Models',lib:'Library',tas:'Tasbīḥ',jour:'Your Journey'};
const ORDER=['read','words','models','lib','tas','jour'];

N.hud=()=>{$('#navCov').textContent=(N.AUD?N.AUD.cov:100)+'%';
 $('#navAi').textContent=N.ai.models.filter(m=>m.active).length};
N.go=(v,p)=>{N.Snd.p('tap');const h='#/'+v+(p!=null?'/'+p:'');
 if(location.hash===h)N.render();else location.hash=h};
const route=()=>{const a=location.hash.replace(/^#\/?/,'').split('/');
 return{v:TITLES[a[0]]?a[0]:'read',p:a[1]||null}};
N.render=(o={})=>{const keep=!!o.keep,y=scrollY;N.clearSel();
 const{v,p}=route();N.VIEW=v;
 $('#ttl').textContent=TITLES[v];document.title='Nūr · '+TITLES[v];
 $$('.nav button,#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 if(N.io){N.io.disconnect();N.io=null}
 const views={...N.views,models:N.vModels};
 $('#view').innerHTML=views[v](p);
 if(v==='read')N.afterRead(p,keep);
 if(v==='tas')N.tasUI();
 if(v==='words')N.bindWords();
 if(v==='models')N.bindModels();
 N.hud();if(keep)scrollTo(0,y);else if(!p)scrollTo(0,0)};

/* search */
function doSearch(q){const box=$('#sOut');q=q.trim();
 if(q.length<2){box.innerHTML=`<div class="pempty">Type two letters — Arabic diacritics are ignored.</div>`;return}
 const qn=N.norm(q),out=[];
 for(const p of N.P){for(const w of p.words){
  if(N.norm(w.a).includes(qn)||N.norm(w.f).includes(qn)){out.push({p,w});if(out.length>=30)break}}
  if(out.length>=30)break}
 box.innerHTML=out.length?out.map((r,i)=>`<button class="pi ${i===0?'k':''}" data-a="jumpw" data-id="${r.p.n}" data-w="${r.w.i}">
  <span class="pnumsm">${r.p.n}</span><div class="t"><b>${esc(r.p.ch)}</b>
  <span class="ars" dir="rtl">${esc(r.w.a)}</span><span class="fas" dir="rtl">${esc(r.w.f)}</span></div>${ic('r')}</button>`).join('')
  :`<div class="pempty">Nothing found for “${esc(q)}”.</div>`}
N.openSearch=()=>{N.closePal(1);$('#search').classList.add('open');$('#sIn').value='';doSearch('');
 N.Snd.p('open');setTimeout(()=>$('#sIn').focus(),60)};
N.closeSearch=s=>{const o=$('#search');if(!o.classList.contains('open'))return;
 o.classList.remove('open');if(!s)N.Snd.p('close')};

/* palette */
let pIdx=0,pItems=[];
const cmds=()=>{const c=[{t:'Reader · resume',i:'book',r:()=>N.go('read')},
 {t:'Reader · from the beginning',i:'play',r:()=>N.go('read',N.P[0].n)},
 {t:'Explain current word in Persian',i:'ai',r:()=>N.ai.now()},
 {t:'Toggle Persian line',i:'lines',r:()=>A.inter()},
 {t:'Words · verify coverage',i:'shield',r:()=>N.go('words')},
 {t:'AI models · manage',i:'cpu',r:()=>N.go('models')},
 {t:'OpenRouter key',i:'key',r:()=>N.ai.keyModal()},
 {t:'Library',i:'bm',r:()=>N.go('lib')},{t:'Tasbīḥ',i:'target',r:()=>N.go('tas')},
 {t:'Journey',i:'flame',r:()=>N.go('jour')},
 {t:'Search a word',i:'search',r:N.openSearch},{t:'Toggle sound',i:'vol',r:()=>A.sound()},
 {t:'Settings',i:'set',r:N.openDr},{t:'Export data',i:'dl',r:exportData},
 {t:'Cloud sync',i:'sync',r:N.syncNow},{t:'Setup SQL · state',i:'db',r:sqlState},
 {t:'Setup SQL · ai_models',i:'db',r:N.sqlAI},
 {t:N.SES?'Sign out':'Sign in',i:N.SES?'out':'user',r:()=>N.SES?N.logout():N.openAuth()},
 {t:'About & shortcuts',i:'info',r:about}];
 N.CH.forEach((s,i)=>c.push({t:`Chapter ${i+1} · ${s[0]}`,i:'fl',
  r:()=>{N.go('read');setTimeout(()=>$('#ch'+i)?.scrollIntoView({block:'start',behavior:'smooth'}),180)}}));
 return c};
const palRender=(q='')=>{pItems=cmds().filter(c=>c.t.toLowerCase().includes(q.toLowerCase()));pIdx=0;
 $('#pOut').innerHTML=pItems.length?pItems.map((c,i)=>
  `<button class="pi ${i===0?'k':''}" data-p="${i}">${ic(c.i)}<div class="t"><b>${esc(c.t)}</b></div></button>`).join('')
  :`<div class="pempty">No matching command.</div>`};
N.openPal=()=>{N.closeSearch(1);$('#pal').classList.add('open');$('#pIn').value='';palRender();
 N.Snd.p('open');setTimeout(()=>$('#pIn').focus(),60)};
N.closePal=s=>{const o=$('#pal');if(!o.classList.contains('open'))return;
 o.classList.remove('open');if(!s)N.Snd.p('close')};
const palMove=d=>{if(!pItems.length)return;pIdx=cl(pIdx+d,0,pItems.length-1);
 $$('#pOut .pi').forEach((e,i)=>e.classList.toggle('k',i===pIdx));$('#pOut .k')?.scrollIntoView({block:'nearest'})};
const palRun=(i=pIdx)=>{const c=pItems[i];if(c){N.closePal();c.r()}};

/* about · sql · data */
const about=()=>{const keys=[['Touch a word','Only its Persian'],['A / violet star','Root & structure in Persian'],
 ['← / →','Previous / next word'],['Esc','Close / clear'],['I','Toggle Persian line'],['/','Search a word'],
 ['Ctrl / ⌘ K','Commands'],['1 – 6','Switch pages'],['M','Mute / unmute'],['Space','Count tasbīḥ'],
 ['+ / −','Arabic size'],['B / R','Bookmark / mark read'],['?','This panel']];
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button><h2>${ic('info')}About Nūr</h2>
 <div style="font-family:var(--ar);direction:rtl;text-align:center;font-size:22px;color:var(--gold);line-height:2;margin:6px 0 12px">فَيَا مَنْ وَعَدَ فَوَفَى، وَأَوْعَدَ فَعَفَا</div>
 <div class="mbody">The Grand Istighfār, transmitted from Imam ʿAlī ibn Abī Ṭālib (peace be upon him).
 ${N.P.length} passages · ${fmt(N.AUD.aw)} Arabic words · ${fmt(N.AUD.fw)} Persian words — every word bound both ways.
 The violet star sends the Arabic word, its phrase and the whole passage to a free OpenRouter model and asks for its root, weight, form, affixes and grammatical role — explained in Persian.</div>
 <div class="hd" style="margin:20px 0 4px">Keys & touch</div>
 <div class="keys">${keys.map(k=>`<div><span>${esc(k[1])}</span><kbd>${esc(k[0])}</kbd></div>`).join('')}</div>`)};
const sqlState=()=>N.modal(`<h2>${ic('db')}State tables</h2>
 <div class="mbody">Run once in Supabase → SQL Editor for progress sync.</div>
 <div class="sqlbox">${esc(N.SQL_STATE)}</div>
 <div class="macts"><button class="btn gold" data-a="copysql">${ic('copy')}Copy SQL</button>
  <button class="btn ghost" data-a="mclose">Close</button></div>`);
const exportData=()=>{const b=new Blob([JSON.stringify({...N.S,ai_models:N.ai.models,exported_at:new Date().toISOString()},null,2)],
 {type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`nur-istighfar-${N.dk()}.json`;
 a.click();URL.revokeObjectURL(a.href);N.Snd.p('ok');N.toast('Data exported (key excluded)','ok','dl')};
const bindImport=()=>$('#impFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(!f)return;
 try{const j=JSON.parse(await f.text());if(!j||![3,4,5,6,7].includes(j.v))throw new Error('Not a Nūr backup');
  N.S=N.merge(N.S,j);
  if(Array.isArray(j.ai_models))j.ai_models.forEach(m=>{if(m&&/:free$|openrouter\/free/.test(m.model_id)&&!N.ai.byId(m.model_id))
   N.ai.models.push({...m,sort:N.ai.models.length})});
  N.ai.save();N.tidy();N.saveLocal();N.apply();N.save();N.render({keep:true});
  N.Snd.p('ok');N.toast('Data imported & merged','ok','ul')}
 catch(x){N.Snd.p('err');N.toast('Import failed: '+x.message,'err','alert')}
 e.target.value=''});
const resetAll=async()=>{if(!await N.confirmBox({title:'Reset all progress?',
 body:'Read marks, bookmarks, notes, tasbīḥ and streaks will be cleared on this device'+(N.SES?' and in the cloud.':'.'),
 ok:'Reset everything',danger:true}))return;
 const keep=N.S.set;N.S=copy(N.DEF);N.S.set=keep;N.save();N.render();N.Snd.p('off');
 N.toast('A clean page. Begin again.','ok','rotate')};

/* actions */
const A={
 go:t=>N.go(t.dataset.v),
 jump:t=>N.jumpTo(t.dataset.id),
 jumpw:t=>N.jumpTo(t.dataset.id,t.dataset.w),
 ai:t=>{const pn=+t.dataset.id;const wi=N.SEL&&N.SEL.p===pn?N.SEL.w:null;N.ai.forPassage(pn,wi)},
 aiw:t=>N.ai.forPassage(+t.dataset.id,+t.dataset.w),
 'ai-now':()=>N.ai.now(),
 aiclose:()=>N.ai.close(),
 airetry:()=>N.ai.retry(),
 aicopy:()=>N.ai.copy(),
 aiscope:t=>N.ai.setScope(t.dataset.v),
 gomodels:()=>{N.ai.close();N.mclose();N.closeDr();N.go('models')},
 keymod:()=>N.ai.keyModal(),
 keysave:()=>N.ai.saveKey(),
 keyclear:()=>{N.ai.setKey('');N.mclose();N.toast('Key cleared','ok','key');if(N.VIEW==='models')N.render({keep:true})},
 keytest:()=>N.ai.testKey(),
 keysave2:()=>{const v=($('#aiKey2')?.value||'').trim();
  if(v&&!/^sk-or-/.test(v)){N.toast('That does not look like an OpenRouter key','warn','alert');return}
  N.ai.setKey(v);N.Snd.p('ok');N.toast(v?'Key saved in this browser':'Key cleared','ok','key');N.render({keep:true})},
 keytest2:async()=>{const v=($('#aiKey2')?.value||'').trim();if(v)N.ai.setKey(v);
  const b=$('[data-a=keytest2]');b&&b.classList.add('busy');
  await N.ai.testKey().catch(()=>{});b&&b.classList.remove('busy')},
 madd:()=>N.modelAdd(),
 msave:()=>N.modelSave(),
 mcat:()=>N.modelCat(),
 mcatadd:t=>{try{N.ai.add(t.dataset.id,t.dataset.name,'',t.dataset.ctx);
  N.Snd.p('ok');N.toast('Added '+t.dataset.id,'ai','cpu');t.outerHTML='<span class="tag on">added</span>'}
  catch(e){N.Snd.p('err');N.toast(e.message,'err','alert')}},
 mtest:t=>N.modelTest(t.dataset.id),
 mdef:async t=>{await N.ai.setDefault(t.dataset.id);N.Snd.p('pop');
  N.toast('Default model set','ai','star');N.render({keep:true})},
 mtoggle:t=>{N.ai.toggle(t.dataset.id);N.Snd.p('tap');N.render({keep:true})},
 mdel:async t=>{const id=t.dataset.id,i=N.ai.models.findIndex(m=>m.model_id===id);
  const m=await N.ai.remove(id);if(!m)return;N.Snd.p('tap');N.render({keep:true});
  N.toast('Model deleted','ok','trash',{label:'Undo',fn:async()=>{await N.ai.restore(m,i);
   N.render({keep:true});N.Snd.p('ok')}})},
 mpull:async()=>{if(!N.SES){N.toast('Sign in to pull the shared table','warn','user');N.openAuth();return}
  await N.ai.cloudPull();N.Snd.p('ok');N.toast('Pulled from ai_models','ok','sync');N.render({keep:true})},
 mpush:async()=>{if(!N.SES){N.toast('Sign in to push the shared table','warn','user');N.openAuth();return}
  try{await N.cloudModels.upsert(N.ai.models.map((m,i)=>({...m,sort:i,updated_at:new Date().toISOString()})));
   N.Snd.p('ok');N.toast('Pushed to ai_models','ok','ul')}
  catch(e){N.Snd.p('err');N.toast(e.message,'err','alert');N.sqlAI()}},
 sqlai:()=>N.sqlAI(),
 copysqlai:async()=>{await N.copyText(N.SQL_AI);N.Snd.p('ok');N.toast('ai_models SQL copied','ok','copy')},
 copysql:async()=>{await N.copyText(N.SQL_STATE);N.Snd.p('ok');N.toast('State SQL copied','ok','copy')},
 sql:sqlState,
 inter:()=>{N.S.set.inter=!N.S.set.inter;N.save();if(N.VIEW==='read')N.render({keep:true});
  N.fillDrawer();N.Snd.p('pop');
  N.toast(N.S.set.inter?'Persian line shown — touch it for the Arabic':'Persian line hidden','ok','lines')},
 read:t=>N.setRead(t.dataset.id,!N.S.read[+t.dataset.id]),
 note:t=>N.noteModal(t.dataset.id),
 bm:t=>N.toggleBm(t.dataset.id),
 copyv:t=>N.copyVerse(t.dataset.id),
 bmdel:t=>{const id=+t.dataset.id;N.toggleBm(id);N.render({keep:true});
  N.toast('Bookmark removed','ok','trash',{label:'Undo',fn:()=>{N.S.bm[id]=Date.now();N.save();
   N.refreshVerse(id);N.render({keep:true});N.Snd.p('bm')}})},
 markch:t=>N.markCh(t.dataset.c),
 nedit:t=>N.noteModal(t.dataset.id),nsave:t=>N.saveNote(t.dataset.id),
 ndel:t=>N.dropNote(t.dataset.id),ndellib:t=>N.dropNote(t.dataset.id),
 libtab:t=>{N.libTab=t.dataset.v;N.render({keep:true});N.Snd.p('tap')},
 reaudit:()=>{N.AUD=N.audit();N.render({keep:true});N.Snd.p(N.AUD.ok?'ok':'err');
  N.toast(N.AUD.ok?`Verified — ${fmt(N.AUD.aw)} Arabic and ${fmt(N.AUD.fw)} Persian words, all bound`:'Integrity problem found',
   N.AUD.ok?'ok':'err',N.AUD.ok?'shield':'alert')},
 tinc:()=>N.tInc(),tdec:()=>N.tDec(),
 treset:async()=>{if(await N.confirmBox({title:'Reset this round?',
  body:`The round counter returns to 0. Lifetime total (${fmt(N.S.tas.total)}) is kept.`,ok:'Reset round'})){
  N.S.tas.session=0;N.save();N.tasUI();N.Snd.p('off')}},
 ttarget:t=>{N.S.tas.target=+t.dataset.v;N.save();N.render({keep:true});N.Snd.p('pop')},
 tphrase:t=>{N.S.tas.phrase=+t.dataset.v;N.save();N.render({keep:true});N.Snd.p('pop')},
 fs:t=>{N.S.set.fs=cl(+(N.S.set.fs+(+t.dataset.v)*.1).toFixed(2),.8,1.8);N.apply();N.save();N.fillDrawer();N.Snd.p('tick')},
 theme:t=>{N.S.set.theme=t.dataset.v;N.apply();N.save();N.Snd.p('pop')},
 sound:()=>{N.S.set.sound=!N.S.set.sound;N.apply();N.save();N.fillDrawer();
  N.Snd.p(N.S.set.sound?'on':'off');N.toast(N.S.set.sound?'Sound on':'Sound muted','ok',N.S.set.sound?'vol':'mute')},
 drawer:()=>{$('#acctMenu').hidden=true;N.openDr()},closedr:()=>N.closeDr(),
 search:()=>N.openSearch(),closesearch:()=>N.closeSearch(),
 pal:()=>N.openPal(),closepal:()=>N.closePal(),
 about,acct:()=>N.acctMenu(),
 openauth:()=>{N.closeDr();N.mclose();N.openAuth()},closeauth:()=>N.closeAuth(),
 atab:t=>{N.atab(t.dataset.v);N.Snd.p('tap')},
 forgot:()=>{$('#fIn').hidden=true;$('#fFg').hidden=false;$('#fgE').value=$('#inE').value},
 eye:t=>{const i=$('#'+t.dataset.t);i.type=i.type==='password'?'text':'password';
  t.innerHTML=ic(i.type==='password'?'eye':'eyeoff');N.Snd.p('tick')},
 resend:async()=>{try{await N.sb('/auth/v1/resend',{method:'POST',auth:false,
  body:{type:'signup',email:$('#aVer').dataset.e}});N.toast('Verification email resent','ok','mail');N.Snd.p('ok')}
  catch(e){const x=$('#aErr');x.textContent=e.message;x.hidden=false;N.Snd.p('err')}},
 logout:()=>{$('#acctMenu').hidden=true;N.closeDr();N.logout()},
 sync:()=>{$('#acctMenu').hidden=true;if(N.SES&&N.syncErr)N.syncHelp();else N.syncNow()},
 export:()=>{$('#acctMenu').hidden=true;exportData()},
 import:()=>$('#impFile').click(),reset:()=>resetAll(),
 mclose:()=>N.mclose(),
 mok:()=>{const r=N.mres;N.mres=null;$('#mroot').innerHTML='';N.Snd.p('close');r&&r(true)}};
const QUIET=new Set(Object.keys(A));

/* events */
document.addEventListener('click',e=>{
 const pb=e.target.closest('[data-p]');
 if(pb&&!pb.classList.contains('w')&&!pb.classList.contains('verse')){palRun(+pb.dataset.p);return}
 const t=e.target.closest('[data-a]');
 if(t){e.stopPropagation();const a=t.dataset.a;if(!QUIET.has(a))N.Snd.p('tap');A[a]&&A[a](t,e);return}
 const w=e.target.closest('.w');if(w){N.selectWord(w);return}
 if($('#ai').classList.contains('open'))return;
 if(N.SEL){N.clearSel();return}
 if(!e.target.closest('#acctMenu')&&!e.target.closest('#avBtn'))$('#acctMenu').hidden=true});
let hv=0;
document.addEventListener('mouseover',e=>{
 if(!e.target.closest('.btn,.ib,.pill,.nav button,.vact,.sq,.w'))return;
 const n=Date.now();if(n-hv>110){hv=n;N.Snd.p('hover')}});
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='sIn'){doSearch(t.value);return}
 if(t.id==='pIn'){palRender(t.value);return}
 const k=t.dataset.s;if(!k)return;
 N.S.set[k]=t.type==='checkbox'?t.checked:parseFloat(t.value);
 N.tidy();N.apply();N.save();
 if(k==='vol')N.Snd.p('tick');
 if(k==='sound')N.Snd.p(N.S.set.sound?'on':'off');
 if(k==='inter'&&N.VIEW==='read')N.render({keep:true});
 if(k==='goal'&&N.VIEW==='jour')N.render({keep:true})});
document.addEventListener('change',e=>{
 if(e.target.id==='chSel')$('#'+e.target.value)?.scrollIntoView({block:'start',behavior:'smooth'})});
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{N.lastTouch=Date.now()},{passive:true}));
document.addEventListener('pointerdown',()=>{if(N.S.set.amb&&N.S.set.sound)N.Amb.sync()},{once:true});
addEventListener('pagehide',N.saveLocal);
document.addEventListener('visibilitychange',()=>{if(document.hidden)N.saveLocal()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>N.placeTip());

document.addEventListener('keydown',e=>{
 const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();
  $('#pal').classList.contains('open')?N.closePal():N.openPal();return}
 if(e.key==='Escape'){
  if($('#mroot').innerHTML)N.mclose();
  else if($('#ai').classList.contains('open'))N.ai.close();
  else if($('#pal').classList.contains('open'))N.closePal();
  else if($('#search').classList.contains('open'))N.closeSearch();
  else if($('#auth').classList.contains('open'))N.closeAuth();
  else if(document.body.classList.contains('drawer'))N.closeDr();
  else if(!$('#acctMenu').hidden)$('#acctMenu').hidden=true;
  else if(N.SEL)N.clearSel();return}
 if($('#pal').classList.contains('open')){
  if(e.key==='ArrowDown'){e.preventDefault();palMove(1)}
  if(e.key==='ArrowUp'){e.preventDefault();palMove(-1)}
  if(e.key==='Enter'){e.preventDefault();palRun()}return}
 if($('#search').classList.contains('open')){
  if(e.key==='Enter'){e.preventDefault();$('#sOut .pi')?.click()}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();
   const it=$$('#sOut .pi');if(!it.length)return;
   let i=it.findIndex(x=>x.classList.contains('k'));i=cl(i+(e.key==='ArrowDown'?1:-1),0,it.length-1);
   it.forEach((x,j)=>x.classList.toggle('k',j===i));it[i].scrollIntoView({block:'nearest'})}return}
 if($('#ai').classList.contains('open')){
  if(!typing&&e.key.toLowerCase()==='r')N.ai.retry();return}
 if(typing)return;
 const k=e.key;
 if(k==='/'){e.preventDefault();N.openSearch();return}
 if(k==='?'){about();return}
 if(k.toLowerCase()==='m'){A.sound();return}
 if(k.toLowerCase()==='i'){A.inter();return}
 if(k.toLowerCase()==='a'){e.preventDefault();N.ai.now();return}
 if(['1','2','3','4','5','6'].includes(k)){N.go(ORDER[+k-1]);return}
 if(N.VIEW==='tas'&&k===' '){e.preventDefault();N.tInc();return}
 if(N.VIEW==='read'){
  if(N.SEL&&(k==='ArrowLeft'||k==='ArrowRight')){e.preventDefault();N.stepWord(k==='ArrowLeft'?1:-1);return}
  if(k==='+'||k==='='){N.S.set.fs=cl(+(N.S.set.fs+.1).toFixed(2),.8,1.8);N.apply();N.save();N.fillDrawer();N.Snd.p('tick')}
  if(k==='-'){N.S.set.fs=cl(+(N.S.set.fs-.1).toFixed(2),.8,1.8);N.apply();N.save();N.fillDrawer();N.Snd.p('tick')}
  if(k.toLowerCase()==='b'&&N.S.last!=null)N.toggleBm(N.S.last);
  if(k.toLowerCase()==='r'&&N.S.last!=null)N.setRead(N.S.last,!N.S.read[N.S.last])}});

let tt=0;
setInterval(()=>{if(N.VIEW==='read'&&document.visibilityState==='visible'&&Date.now()-N.lastTouch<90000){
 N.day().s+=5;N.saveLocal();if(++tt%12===0)N.syncSoon()}},5000);

/* boot */
(function init(){
 N.build();N.AUD=N.audit();N.tidy();N.apply();N.Sky.init();N.bindAuth();bindImport();
 addEventListener('hashchange',()=>N.render());
 if(!location.hash)history.replaceState(null,'','#/read');
 N.render();N.acctUI();N.ai.paintKey();
 $('#boot').classList.add('done');setTimeout(()=>$('#boot')?.remove(),600);
 if(N.SES){if(N.SES.expires_at*1000<Date.now()+60000)
  N.refresh().then(()=>{if(N.SES){N.sched();N.afterAuth()}});
  else{N.sched();N.afterAuth()}}else N.syncState('off');
 N.checkAch();
 setTimeout(()=>{if(!N.lj('nur.hintAI')){N.ls('nur.hintAI',1);
  N.toast('Touch a word for its Persian · the violet star explains its root','ai','ai')}},1200);
 if(!N.AUD.ok)N.toast('Word alignment problem — open Words','err','alert');
})();
})();
