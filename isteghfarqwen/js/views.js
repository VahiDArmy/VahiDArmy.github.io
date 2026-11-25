/* Nūr views: reader · words · library · tasbīḥ · journey */
(()=>{
const N=window.NUR,{$,$$,esc,ic,fl,cl,fmt,dk,buzz}=N;
const PHRASES=[{ar:'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',f:'از خدا آمرزش می‌خواهم و به او بازمی‌گردم',n:'Istighfār'},
{ar:'سُبْحَانَ اللهِ وَبِحَمْدِهِ',f:'پاک و منزه است خدا و ستایش از آنِ اوست',n:'Taḥmīd'},
{ar:'لَا إِلَهَ إِلَّا اللهُ',f:'هیچ معبودی جز خدا نیست',n:'Tahlīl'},
{ar:'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ',f:'خدایا بر محمد و خاندان محمد درود فرست',n:'Ṣalawāt'}];
const TARGETS=[33,99,100,313,1000];
let tipRaf=0;

const lineHTML=(p,side)=>p.words.map(w=>
 `<span class="w" data-p="${p.n}" data-w="${w.i}" data-s="${side}">${esc(side==='a'?w.a:w.f)}</span>`).join(' ');
const verseHTML=p=>`<article class="verse ${N.S.read[p.n]?'read':''}" id="v-${p.n}" data-p="${p.n}">
 <div class="vhead"><span class="vnum">${p.n}</span><div class="vacts">
  <button class="vact ai" data-a="ai" data-id="${p.n}" title="Explain in Persian (A)">${ic('ai')}</button>
  <button class="vact ${N.S.read[p.n]?'done':''}" data-a="read" data-id="${p.n}" title="Mark read">${ic('check')}</button>
  <button class="vact ${N.S.notes[p.n]?'on':''}" data-a="note" data-id="${p.n}" title="Note">${ic('note')}</button>
  <button class="vact ${N.S.bm[p.n]?'on':''}" data-a="bm" data-id="${p.n}" title="Bookmark">${ic('bm')}</button>
  <button class="vact" data-a="copyv" data-id="${p.n}" title="Copy passage">${ic('copy')}</button>
 </div></div>
 <p class="line ar" dir="rtl" lang="ar">${lineHTML(p,'a')}</p>
 ${N.S.set.inter?`<p class="line fa" dir="rtl" lang="fa">${lineHTML(p,'f')}</p>`:''}
 ${N.S.notes[p.n]?`<div class="vnote">${ic('note')}<span>${esc(N.S.notes[p.n].t)}</span></div>`:''}
</article>`;
function vRead(){
 const opts=N.CH.map((c,i)=>`<option value="ch${i}">${esc(c[0])}</option>`).join('');
 let out='',ci=-1;
 N.P.forEach(p=>{if(p.ci!==ci){ci=p.ci;const c=N.CH[ci],done=c[2].filter(n=>N.S.read[n]).length;
  out+=`<div class="chapter" id="ch${ci}">${fl()}<h2>${ci+1}. ${esc(c[0])}</h2><div class="cfa">${esc(c[1])}</div>
   <div class="cm"><span class="cdone">${done}/${c[2].length} read</span>
   <span class="seal" ${done<c[2].length?'hidden':''}>${ic('check')}COMPLETE</span>
   <button class="pill" style="padding:4px 11px;font-size:11px" data-a="markch" data-c="${ci}">${ic('check')}Mark chapter</button></div></div>`}
  out+=verseHTML(p)});
 return`<div class="page"><div class="bism">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
 <div class="strip"><select id="chSel" aria-label="Chapter">${opts}</select>
  <button class="cov" data-a="go" data-v="words" title="Every word bound both ways">${ic('shield')}<span>${N.AUD.cov}%</span></button>
  <button class="sq ai" data-a="ai-now" title="Explain in Persian (A)">${ic('ai')}</button>
  <button class="sq ${N.S.set.inter?'on':''}" data-a="inter" title="Persian line">${ic('lines')}</button>
  <button class="sq" data-a="fs" data-v="-1" title="Smaller">A−</button>
  <button class="sq" data-a="fs" data-v="1" title="Larger">A+</button>
  <button class="sq" data-a="logs" title="Activity log">${ic('alert')}</button>
  <button class="sq" data-a="drawer" title="Settings">${ic('set')}</button></div>
 ${out}
 <div class="vend">${fl()}<p>${N.nread()===N.P.length?'You have read the entire duʿāʾ. May every word be a light for you.':'Touch a word for its Persian. The violet star in that popup explains its root and structure.'}</p>
  <button class="btn" data-a="go" data-v="words">${ic('link')}Every word pair</button>
  <button class="btn gold" data-a="go" data-v="tas">${ic('target')}Seal it with tasbīḥ</button></div></div>`}
function afterRead(p,keep){
 N.io=new IntersectionObserver(es=>{let best=null;
  es.forEach(e=>{if(e.isIntersecting&&(!best||e.intersectionRatio>best.intersectionRatio))best=e});
  if(best){const id=+best.target.dataset.p;if(N.S.last!==id){N.S.last=id;N.saveLocal();N.syncSoon()}
   const sel=$('#chSel');if(sel&&N.IX[id]&&sel.value!=='ch'+N.IX[id].ci)sel.value='ch'+N.IX[id].ci}},
  {threshold:[.1,.35,.6]});
 $$('.verse').forEach(e=>N.io.observe(e));
 const t=p&&N.IX[p]?N.IX[p]:(N.S.last!=null&&N.IX[N.S.last]?N.IX[N.S.last]:null),sel=$('#chSel');
 if(sel&&t)sel.value='ch'+t.ci;
 if(t&&!keep)setTimeout(()=>{const e=$('#v-'+t.n);if(e){e.scrollIntoView({block:'center',behavior:'auto'});
  if(p){e.classList.add('flash');setTimeout(()=>e.classList.remove('flash'),1600)}}},40)}

/* word selection + popup carrying a real action button */
N.clearSel=()=>{N.SEL=null;$$('.w.lit').forEach(e=>e.classList.remove('lit'));
 $$('.verse.active').forEach(e=>e.classList.remove('active'));
 const t=$('#tip');if(t)t.classList.remove('on')};
N.selectWord=el=>{
 const pn=+el.dataset.p,wi=+el.dataset.w,side=el.dataset.s,p=N.IX[pn];if(!p)return;
 if(N.SEL&&N.SEL.p===pn&&N.SEL.w===wi){N.clearSel();N.Snd.p('tap');return}
 N.clearSel();N.SEL={p:pn,w:wi,side,el};
 $$(`#v-${pn} .w[data-w="${wi}"]`).forEach(e=>e.classList.add('lit'));
 $('#v-'+pn)?.classList.add('active');
 const w=p.words[wi],tip=$('#tip');
 tip.classList.toggle('ar',side==='f');
 tip.innerHTML=`<div class="t">${esc(side==='a'?w.f:w.a)}</div>
  <button class="tip-ai" type="button" data-a="tipai" aria-label="تحلیل صرفی این کلمه" title="ریشه و ساختار">${ic('ai')}</button>`;
 tip.classList.add('on');N.placeTip();
 if(N.S.set.wordSound)N.Snd.p('word');buzz(5);
 N.log('ui','Word selected',{p:pn,w:wi,side});
 if(N.S.last!==pn){N.S.last=pn;N.saveLocal();N.syncSoon()}};
N.placeTip=()=>{const tip=$('#tip');if(!tip)return;
 if(!N.SEL||N.overlaysOpen()){tip.classList.remove('on');return}
 const el=N.SEL.el;
 if(!el||!el.isConnected){N.clearSel();return}
 const r=el.getBoundingClientRect();
 if(r.bottom<70||r.top>innerHeight-70){tip.classList.remove('on');return}
 tip.classList.add('on');
 const tw=tip.offsetWidth,th=tip.offsetHeight,cx=r.left+r.width/2;
 const x=cl(cx-tw/2,8,Math.max(8,innerWidth-tw-8));
 let y=r.top-th-11,below=false;
 if(y<66){y=r.bottom+11;below=true}
 if(y+th>innerHeight-70)y=Math.max(66,innerHeight-th-70);
 tip.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
 tip.classList.toggle('below',below);
 tip.style.setProperty('--cx',cl(cx-x,12,tw-12)+'px')};
addEventListener('scroll',()=>{if(tipRaf)return;
 tipRaf=requestAnimationFrame(()=>{tipRaf=0;N.placeTip()})},{passive:true});
addEventListener('resize',()=>N.placeTip());
N.stepWord=d=>{if(!N.SEL)return;const p=N.IX[N.SEL.p];let i=N.SEL.w+d,pn=N.SEL.p;
 if(i<0){const k=N.P.findIndex(x=>x.n===pn)-1;if(k<0)return;pn=N.P[k].n;i=N.P[k].words.length-1}
 else if(i>=p.words.length){const k=N.P.findIndex(x=>x.n===pn)+1;if(k>=N.P.length)return;pn=N.P[k].n;i=0}
 const el=$(`#v-${pn} .line.ar .w[data-w="${i}"]`);
 if(el){const r=el.getBoundingClientRect();
  if(r.top<90||r.bottom>innerHeight-60)el.scrollIntoView({block:'center',behavior:'smooth'});N.selectWord(el)}};
N.pickWord=(pn,wi)=>{const el=$(`#v-${pn} .line.ar .w[data-w="${wi}"]`);if(el)N.selectWord(el)};
N.jumpTo=(id,wi)=>{N.closeSearch(1);N.closePal(1);const n=+id;
 if(N.VIEW!=='read'){N.go('read',n);if(wi!=null)setTimeout(()=>N.pickWord(n,+wi),320);return}
 const el=$('#v-'+n);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});
  el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600)}
 if(wi!=null)setTimeout(()=>N.pickWord(n,+wi),340)};

/* verse actions */
N.refreshVerse=id=>{const e=$('#v-'+id);
 if(e){e.classList.toggle('read',!!N.S.read[id]);
  e.querySelector('[data-a=read]').classList.toggle('done',!!N.S.read[id]);
  e.querySelector('[data-a=note]').classList.toggle('on',!!N.S.notes[id]);
  e.querySelector('[data-a=bm]').classList.toggle('on',!!N.S.bm[id]);
  e.querySelector('.vnote')?.remove();
  if(N.S.notes[id])e.insertAdjacentHTML('beforeend',`<div class="vnote">${ic('note')}<span>${esc(N.S.notes[id].t)}</span></div>`)}
 const c=N.CHOF[id],p=N.IX[id];if(c&&p){const el=$('#ch'+p.ci);
  if(el){const d=c[2].filter(n=>N.S.read[n]).length;
   el.querySelector('.cdone').textContent=`${d}/${c[2].length} read`;
   el.querySelector('.seal').hidden=d<c[2].length}}};
N.setRead=(id,on)=>{id=+id;if(!N.IX[id])return;
 if(on&&!N.S.read[id]){N.S.read[id]=Date.now();N.day().r++}else if(!on&&N.S.read[id])delete N.S.read[id];
 N.save();N.refreshVerse(id);N.Snd.p(on?'ok':'tap');N.log('ui',on?'Marked read':'Unmarked',{id});
 if(on){N.checkAch();if(N.nread()===N.P.length){N.celebrate();N.render({keep:true})}}};
N.toggleBm=id=>{id=+id;if(!N.IX[id])return;
 if(N.S.bm[id]){delete N.S.bm[id];N.Snd.p('tap')}
 else{N.S.bm[id]=Date.now();N.Snd.p('bm');buzz(12);N.toast('Passage bookmarked','ok','bm')}
 N.save();N.refreshVerse(id);N.checkAch()};
N.markCh=ci=>{const c=N.CH[+ci];if(!c)return;let n=0;
 c[2].forEach(pn=>{if(!N.S.read[pn]){N.S.read[pn]=Date.now();n++;N.refreshVerse(pn)}});
 if(n){N.day().r+=n;N.save();N.Snd.p('ok');N.toast(`Chapter marked — ${n} passage${n>1?'s':''}`,'ok','check');
  N.checkAch();if(N.nread()===N.P.length){N.celebrate();N.render({keep:true})}}
 else N.toast('Chapter already complete','ok','check')};
N.noteModal=id=>{id=+id;const n=N.S.notes[id];
 N.modal(`<button class="ib mx" data-a="mclose">${ic('x')}</button><h2>${ic('note')}Note on passage ${id}</h2>
 <p style="font-family:var(--ar);direction:rtl;text-align:right;font-size:17px;color:var(--tx);margin-bottom:12px;line-height:1.9">${esc(N.IX[id].arText.slice(0,80))}…</p>
 <textarea id="nta" placeholder="Your reflection…">${esc(n?.t||'')}</textarea>
 <div class="macts">${n?`<button class="btn bad" data-a="ndel" data-id="${id}">${ic('trash')}Delete</button>`:''}
 <button class="btn gold" data-a="nsave" data-id="${id}">${ic('check')}Save note</button></div>`)};
N.saveNote=id=>{id=+id;const t=$('#nta').value.trim();
 if(t)N.S.notes[id]={t,ts:Date.now()};else delete N.S.notes[id];
 N.save();N.refreshVerse(id);N.mclose();N.Snd.p('ok');
 N.toast(t?'Note saved':'Note removed','ok','note');N.checkAch();if(N.VIEW==='lib')N.render({keep:true})};
N.dropNote=id=>{id=+id;const old=N.S.notes[id];if(!old)return;delete N.S.notes[id];
 N.save();N.refreshVerse(id);N.mclose();if(N.VIEW==='lib')N.render({keep:true});N.Snd.p('tap');
 N.toast('Note removed','ok','trash',{label:'Undo',fn:()=>{N.S.notes[id]=old;N.save();N.refreshVerse(id);
  if(N.VIEW==='lib')N.render({keep:true});N.Snd.p('ok')}})};
N.copyVerse=async id=>{const p=N.IX[+id];if(!p)return;
 await N.copyText(p.arText+'\n\n'+p.faText+'\n\n— The Grand Istighfār, № '+p.n);
 N.Snd.p('pop');N.toast('Passage copied — Arabic and Persian','ok','copy')};

/* words */
function vWords(){const a=N.AUD;
 return`<div class="page">
 <div class="grid g4 stg">
  <div class="card"><div class="sic t">${ic('shield')}</div><div class="big">${a.cov}%</div><div class="lbl">word coverage</div></div>
  <div class="card"><div class="sic">${ic('book')}</div><div class="big">${fmt(a.aw)}</div><div class="lbl">Arabic words</div></div>
  <div class="card"><div class="sic t">${ic('feather')}</div><div class="big">${fmt(a.fw)}</div><div class="lbl">Persian words</div></div>
  <div class="card"><div class="sic a">${ic('ai')}</div><div class="big">${fmt(N.ai.models.filter(m=>m.active).length)}</div><div class="lbl">active free models</div></div>
 </div>
 <div class="card" style="margin-top:15px">
  <div class="chd">${ic('shield')}Integrity check</div>
  <div class="mbody">Each Arabic word carries its own Persian counterpart, and each Persian word belongs to exactly one Arabic word.</div>
  <div class="grid g3" style="margin-top:14px;gap:10px">
   <div><div class="big" style="font-size:22px;color:${a.noF?'var(--pom)':'var(--ok)'}">${a.noF}</div><div class="lbl">Arabic without Persian</div></div>
   <div><div class="big" style="font-size:22px;color:${a.noA?'var(--pom)':'var(--ok)'}">${a.noA}</div><div class="lbl">empty Arabic side</div></div>
   <div><div class="big" style="font-size:22px;color:var(--ok)">${a.orphanF}</div><div class="lbl">Persian without Arabic</div></div>
  </div>
  <div class="macts"><button class="btn" data-a="reaudit">${ic('rotate')}Run check again</button>
   <button class="btn gold" data-a="go" data-v="read">${ic('book')}Back to reading</button></div>
 </div>
 <div class="hd">Every word pair · violet star explains it</div>
 <div class="srch">${ic('search')}<input id="wq" placeholder="Filter by any Arabic or Persian word…" value="${esc(N.wordQ)}" autocomplete="off"></div>
 <div id="wlist"></div></div>`}
function renderWords(){const box=$('#wlist');if(!box)return;
 const q=N.wordQ.trim(),qn=q?N.norm(q):'',out=[];
 for(const p of N.P){for(const w of p.words){
  if(!qn||N.norm(w.a).includes(qn)||N.norm(w.f).includes(qn)){out.push({p,w});if(out.length>=180)break}}
  if(out.length>=180)break}
 box.innerHTML=out.length?out.map(o=>`<div class="wrow">
  <div class="a" dir="rtl" data-a="jumpw" data-id="${o.p.n}" data-w="${o.w.i}">${esc(o.w.a)}</div>
  <div class="f" dir="rtl" data-a="jumpw" data-id="${o.p.n}" data-w="${o.w.i}">${esc(o.w.f)}</div>
  <button class="btn xs ai" data-a="aiw" data-id="${o.p.n}" data-w="${o.w.i}" title="Explain">${ic('ai')}</button>
  <div class="pn">Passage ${o.p.n} · word ${o.w.i+1} of ${o.p.words.length}</div></div>`).join('')
  :`<div class="pempty">No word matches “${esc(q)}”.</div>`}
N.bindWords=()=>{const q=$('#wq');if(q)q.addEventListener('input',()=>{N.wordQ=q.value;renderWords()});renderWords()};

/* library */
function vLib(){
 const bs=Object.keys(N.S.bm).map(Number).filter(i=>N.IX[i]).sort((a,b)=>a-b);
 const ns=Object.keys(N.S.notes).map(Number).filter(i=>N.IX[i]).sort((a,b)=>a-b);
 const list=N.libTab==='bm'?bs:ns;
 const items=list.map(id=>{const p=N.IX[id];
  return`<div class="libitem" data-a="jump" data-id="${id}"><span class="pnumsm">${id}</span><div class="body">
   <div class="meta">${esc(p.ch)}</div><div class="snip">${esc(p.arText)}</div><div class="snipe">${esc(p.faText)}</div>
   ${N.libTab==='notes'?`<div class="libnote">${esc(N.S.notes[id].t)}</div>`:''}</div>
   <div style="display:flex;flex-direction:column;gap:6px">
    <button class="ib" data-a="ai" data-id="${id}" title="Explain">${ic('ai')}</button>
    ${N.libTab==='notes'?`<button class="ib" data-a="nedit" data-id="${id}" title="Edit">${ic('note')}</button>`:''}
    <button class="ib" data-a="${N.libTab==='bm'?'bmdel':'ndellib'}" data-id="${id}" title="Remove">${ic('trash')}</button>
   </div></div>`}).join('');
 const empty=`<div class="empty">${ic(N.libTab==='bm'?'bm':'feather')}
  <h3>${N.libTab==='bm'?'No bookmarks yet':'No notes yet'}</h3>
  <p>${N.libTab==='bm'?'Tap the ribbon on any passage to keep it here.':'Tap the pen on any passage to write a reflection.'}</p>
  <button class="btn gold" data-a="go" data-v="read">${ic('book')}Go to the reader</button></div>`;
 return`<div class="page"><div style="display:flex;gap:9px;margin-bottom:18px;flex-wrap:wrap">
  <button class="pill ${N.libTab==='bm'?'on':''}" data-a="libtab" data-v="bm">${ic('bm')}Bookmarks · ${bs.length}</button>
  <button class="pill ${N.libTab==='notes'?'on':''}" data-a="libtab" data-v="notes">${ic('note')}Notes · ${ns.length}</button></div>
  ${list.length?items:empty}</div>`}

/* tasbih */
function vTas(){const t=N.S.tas,p=PHRASES[t.phrase];
 return`<div class="page"><div class="tas">
  <div class="trow">${PHRASES.map((x,i)=>`<button class="pill ${i===t.phrase?'on':''}" data-a="tphrase" data-v="${i}">${x.n}</button>`).join('')}</div>
  <div class="tphrase">${p.ar}</div><div class="tsub">${esc(p.f)}</div>
  <button class="tbtn" id="tBtn" data-a="tinc" aria-label="Count">
   <svg class="ring" viewBox="0 0 300 300"><circle class="bgc" cx="150" cy="150" r="140" stroke-width="10"/>
   <circle class="fgc" id="tRing" cx="150" cy="150" r="140" stroke-width="10" stroke-dasharray="${2*Math.PI*140}" stroke-dashoffset="${2*Math.PI*140}"/></svg>
   <div class="tcore"><small>tap or press space</small><b id="tCount">0</b><div class="left" id="tLeft"></div></div></button>
  <div class="trow">${TARGETS.map(v=>`<button class="pill ${v===t.target?'on':''}" data-a="ttarget" data-v="${v}">${v}</button>`).join('')}</div>
  <div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:center">
   <button class="btn" data-a="tdec">${ic('minus')}Undo</button>
   <button class="btn bad" data-a="treset">${ic('rotate')}Reset round</button></div>
  <div class="tstats"><span>Round <b id="tSess">0</b> / ${t.target}</span>
   <span>Lifetime <b id="tTot">${fmt(t.total)}</b></span><span>Today <b id="tDay">${fmt(N.day().t)}</b></span></div>
 </div></div>`}
N.tasUI=()=>{const t=N.S.tas,C=2*Math.PI*140,r=$('#tRing');if(!r)return;
 r.style.strokeDashoffset=C*(1-Math.min(1,t.session/t.target));
 $('#tCount').textContent=fmt(t.session);
 $('#tLeft').textContent=t.session>=t.target?'✦ target reached ✦':`${t.target-t.session} to go`;
 $('#tSess').textContent=fmt(t.session);$('#tTot').textContent=fmt(t.total);$('#tDay').textContent=fmt(N.day().t)};
N.tInc=()=>{const t=N.S.tas;t.session++;t.total++;N.day().t++;N.save();N.tasUI();N.Snd.p('tick');buzz(8);
 const b=$('#tBtn');if(b){b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}
 if(t.session===t.target){N.Snd.p('chime');buzz([20,40,20]);N.confetti(90);
  N.toast(`Target of ${t.target} reached — may it be accepted`,'gold','spark')}N.checkAch()};
N.tDec=()=>{const t=N.S.tas;if(t.session>0){t.session--;t.total=Math.max(0,t.total-1);
 N.day().t=Math.max(0,N.day().t-1);N.save();N.tasUI();N.Snd.p('tap')}};

/* journey */
const ACH=[{k:'first',i:'spark',t:'First Light',d:'Mark your first passage as read',f:()=>N.nread()>=1},
{k:'ten',i:'book',t:'Devoted Reader',d:'Read 10 passages',f:()=>N.nread()>=10},
{k:'all',i:'award',t:'The Full Surrender',d:'Read every passage',f:()=>N.nread()===N.P.length},
{k:'bm5',i:'bm',t:'Keeper of Verses',d:'Bookmark 5 passages',f:()=>Object.keys(N.S.bm).length>=5},
{k:'note',i:'feather',t:'The Scribe',d:'Write your first reflection',f:()=>Object.keys(N.S.notes).length>=1},
{k:'d100',i:'target',t:'The Remembering',d:'100 tasbīḥ counted',f:()=>N.S.tas.total>=100},
{k:'d1000',i:'zap',t:'Thousandfold',d:'1,000 tasbīḥ counted',f:()=>N.S.tas.total>=1000},
{k:'s3',i:'flame',t:'Three Dawns',d:'A 3-day streak',f:()=>N.streak()>=3},
{k:'s7',i:'sun',t:'A Week of Light',d:'A 7-day streak',f:()=>N.streak()>=7},
{k:'ai1',i:'ai',t:'The Grammarian',d:'Receive one AI analysis',f:()=>!!N.lj('nur.ai.cache')}];
N.checkAch=()=>ACH.forEach(a=>{if(!N.S.ach[a.k]&&a.f()){N.S.ach[a.k]=Date.now();N.save();
 N.Snd.p('fan');N.confetti(70);N.toast('Achievement — '+a.t,'gold','award')}});
N.celebrate=()=>{N.Snd.p('fan');N.confetti(200);N.toast('The entire duʿāʾ is read. Taqabbal Allāh!','gold','spark')};
function heat(){const t=new Date();t.setHours(0,0,0,0);const s=new Date(t);s.setDate(s.getDate()-s.getDay()-77);let c='';
 for(let w=0;w<12;w++)for(let d=0;d<7;d++){const dt=new Date(s);dt.setDate(s.getDate()+w*7+d);
  const k=dk(dt),a=N.S.act[k],v=a?a.r+a.t:0,l=v===0?0:v<5?1:v<15?2:v<40?3:4;
  c+=`<i class="${dt>t?'fut':l?'l'+l:''}" title="${k} · ${a?`${a.r} read, ${a.t} tasbīḥ`:'rest'}"></i>`}
 return`<div class="heat">${c}</div><div class="hleg">less <i style="background:var(--surf2)"></i>
  <i style="background:color-mix(in srgb,var(--turq) 28%,var(--surf2))"></i>
  <i style="background:color-mix(in srgb,var(--turq) 52%,var(--surf2))"></i>
  <i style="background:color-mix(in srgb,var(--turq) 76%,var(--surf2))"></i>
  <i style="background:var(--turq)"></i> more</div>`}
function vJour(){const rc=N.nread(),mins=Math.round(Object.values(N.S.act).reduce((s,a)=>s+(a.s||0),0)/60),
 a=N.day(),g=N.S.set.goal;
 return`<div class="page"><div class="grid g4 stg">
  <div class="card"><div class="sic">${ic('flame')}</div><div class="big">${N.streak()}</div><div class="lbl">day streak</div></div>
  <div class="card"><div class="sic t">${ic('book')}</div><div class="big">${rc}<span class="mu" style="font-size:17px">/${N.P.length}</span></div><div class="lbl">passages read</div></div>
  <div class="card"><div class="sic">${ic('target')}</div><div class="big">${fmt(N.S.tas.total)}</div><div class="lbl">lifetime tasbīḥ</div></div>
  <div class="card"><div class="sic t">${ic('clock')}</div><div class="big">${fmt(mins)}</div><div class="lbl">minutes reading</div></div></div>
 <div class="grid g2" style="margin-top:15px">
  <div class="card"><div class="chd">${ic('target')}Today's intention</div>
   <p class="mu" style="font-size:13px;line-height:1.8">${a.r>=g?'Fulfilled. Extra passages are extra light.':`Read ${g-a.r} more passage${g-a.r>1?'s':''} today.`}
   <br>Today: <b style="color:var(--tx)">${a.r}</b> read · <b style="color:var(--tx)">${a.t}</b> tasbīḥ · <b style="color:var(--tx)">${Math.round(a.s/60)}</b> min.</p>
   <button class="btn" style="margin-top:12px" data-a="go" data-v="read">${ic('book')}Continue</button></div>
  <div class="card"><div class="chd">${ic('cal')}Last 12 weeks</div>${heat()}</div></div>
 <div class="hd">Achievements · ${Object.keys(N.S.ach).length}/${ACH.length}</div>
 <div class="achs">${ACH.map(x=>{const w=N.S.ach[x.k];
  return`<div class="ach ${w?'won':'lock'}">${ic(x.i)}<div><h4>${esc(x.t)}</h4><p>${esc(x.d)}</p>
  ${w?`<small>${new Date(w).toLocaleDateString()}</small>`:''}</div></div>`}).join('')}</div>
 <div class="hd">Data & diagnostics</div><div style="display:flex;gap:9px;flex-wrap:wrap">
  <button class="btn" data-a="export">${ic('dl')}Export</button>
  <button class="btn" data-a="import">${ic('ul')}Import</button>
  <button class="btn" data-a="sync">${ic('sync')}Sync</button>
  <button class="btn" data-a="sql">${ic('db')}Setup SQL</button>
  <button class="btn" data-a="logs">${ic('alert')}Activity log</button></div></div>`}

N.views={read:vRead,words:vWords,lib:vLib,tas:vTas,jour:vJour};
N.afterRead=afterRead;N.PHRASES=PHRASES;N.TARGETS=TARGETS;
})();
