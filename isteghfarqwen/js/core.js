/* Nūr core: helpers · state · sound · atmosphere · UI primitives */
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic=n=>`<svg class="ic"><use href="#${n}"/></svg>`;
const fl=()=>`<svg class="fl" viewBox="0 0 220 20"><use href="#fl"/></svg>`;
const cl=(v,a,b)=>Math.min(b,Math.max(a,v));
const copy=o=>JSON.parse(JSON.stringify(o));
const dk=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt=n=>new Intl.NumberFormat('en').format(n);
const buzz=m=>{try{navigator.vibrate&&navigator.vibrate(m)}catch{}};
const deb=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}};
const lj=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const ls=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const wds=s=>String(s||'').split(/\s+/).filter(Boolean);
function norm(s){let n='';for(const c of String(s||'')){
 if(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u200c]/.test(c))continue;
 let x=c;if('أإآٱ'.includes(x))x='ا';else if(x==='ة'||x==='ۀ')x='ه';else if(x==='ى'||x==='ی')x='ي';else if(x==='ک')x='ك';else if(x==='ؤ')x='و';else if(x==='ئ')x='ي';
 n+=x}return n}

const LS='nur.v7',LSS='nur.session.v4';
const DEF={v:7,set:{theme:'lapis',arFont:'amiri',fs:1,lh:2.2,glow:1,inter:false,wordSound:true,sound:true,vol:.7,amb:false,motion:true,goal:5,aiOn:true},
read:{},last:null,bm:{},notes:{},tas:{total:0,session:0,target:100,phrase:0},ach:{},act:{}};
function wd(s){const d=copy(DEF);if(!s||![3,4,5,6,7].includes(s.v))return d;
 const o={...d,...s,v:7,set:{...d.set,...(s.set||{})},tas:{...d.tas,...(s.tas||{})},read:s.read||{},bm:s.bm||{},notes:s.notes||{},ach:s.ach||{},act:s.act||{}};
 ['lang','auto','speed','rate','focus'].forEach(k=>delete o.set[k]);return o}

const N={$, $$, esc, ic, fl, cl, copy, dk, fmt, buzz, deb, lj, ls, wds, norm, LS, LSS, DEF, wd,
 S:wd(lj(LS)||lj('nur.v6')||lj('nur.v5')), SES:lj(LSS),
 P:[], IX:{}, CHOF:{}, CH:[], AUD:null, VIEW:'read', SEL:null, libTab:'bm', wordQ:'',
 io:null, lastTouch:Date.now(), syncErr:'', lastSync:0};
window.NUR=N;

N.day=()=>(N.S.act[dk()]||={r:0,t:0,s:0});
N.nread=()=>Object.keys(N.S.read).length;
N.streak=()=>{let n=0,d=new Date();const has=k=>{const a=N.S.act[k];return a&&(a.r>0||a.t>0||a.s>=60)};
 if(!has(dk(d)))d.setDate(d.getDate()-1);while(has(dk(d))){n++;d.setDate(d.getDate()-1)}return n};
N.saveLocal=()=>ls(LS,N.S);
N.save=()=>{N.saveLocal();N.hud&&N.hud();N.syncSoon&&N.syncSoon()};

N.build=()=>{const D=window.NUR_DATA;N.CH=D.CH;N.P=[];N.IX={};N.CHOF={};
 D.CH.forEach((c,ci)=>c[2].forEach(n=>{const raw=D.W[n]||[],words=[];
  for(let i=0;i<raw.length;i+=2)words.push({i:words.length,a:raw[i]||'',f:raw[i+1]||'',fw:wds(raw[i+1]||'')});
  const o={n,ch:c[0],chf:c[1],ci,words,arText:words.map(w=>w.a).join(' '),faText:words.map(w=>w.f).join(' ')};
  N.P.push(o);N.IX[n]=o;N.CHOF[n]=c}))};
N.audit=()=>{let aw=0,fw=0,noF=0,noA=0;
 N.P.forEach(p=>p.words.forEach(w=>{aw++;fw+=w.fw.length;if(!w.fw.length)noF++;if(!wds(w.a).length)noA++}));
 const t=aw+fw,cov=t?Math.round(((aw-noF)+fw)/t*100):100;
 return{passages:N.P.length,aw,fw,noF,noA,orphanF:0,cov,ok:noF===0&&noA===0}};

N.tidy=()=>{const t=N.S.set;
 if(!['lapis','parchment','shrine','plum'].includes(t.theme))t.theme='lapis';
 if(!['amiri','scheherazade','naskh'].includes(t.arFont))t.arFont='amiri';
 t.fs=cl(+t.fs||1,.8,1.8);t.lh=cl(+t.lh||2.2,1.8,2.9);t.glow=cl(t.glow==null?1:+t.glow,0,2);
 t.vol=cl(+t.vol||0,0,1);t.goal=cl(Math.round(+t.goal)||5,1,43);
 t.inter=!!t.inter;t.wordSound=t.wordSound!==false;t.sound=!!t.sound;t.amb=!!t.amb;t.motion=!!t.motion;t.aiOn=t.aiOn!==false;
 N.S.tas.total=Math.max(0,Math.round(+N.S.tas.total)||0);N.S.tas.session=Math.max(0,Math.round(+N.S.tas.session)||0);
 if(![33,99,100,313,1000].includes(N.S.tas.target))N.S.tas.target=100;
 N.S.tas.phrase=cl(Math.round(+N.S.tas.phrase)||0,0,3);
 if(!N.P.length)return;const ok=i=>!!N.IX[+i];
 for(const k of Object.keys(N.S.read))if(!ok(k))delete N.S.read[k];
 for(const k of Object.keys(N.S.bm))if(!ok(k))delete N.S.bm[k];
 for(const k of Object.keys(N.S.notes))if(!ok(k)||!N.S.notes[k]?.t)delete N.S.notes[k];
 if(N.S.last!=null&&!ok(N.S.last))N.S.last=null};

/* sound */
N.Snd={c:null,g:null,
 ready(){if(!N.S.set.sound)return null;if(!this.c){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
  this.c=new A();this.g=this.c.createGain();this.g.connect(this.c.destination)}
  if(this.c.state==='suspended')this.c.resume().catch(()=>{});this.g.gain.value=N.S.set.vol;return this.c},
 t(f,d,ty='sine',v=.12,at=0,f2){const c=this.c,t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
  o.type=ty;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(this.g);o.start(t);o.stop(t+d+.05)},
 p(n){if(n==='hover'&&(!this.c||this.c.state!=='running'))return;if(!this.ready())return;const T=this.t.bind(this);
 ({word:()=>{T(880,.05,'sine',.06);T(1320,.07,'sine',.025,.03)},
  ai:()=>{T(660,.09,'sine',.07,0,990);T(1320,.14,'triangle',.03,.07);T(1760,.2,'sine',.02,.14)},
  tap:()=>T(340,.05,'sine',.07),hover:()=>T(560,.02,'sine',.016),
  open:()=>T(392,.13,'sine',.07,0,588),close:()=>T(520,.11,'sine',.055,0,300),
  on:()=>{T(440,.05,'triangle',.09);T(660,.08,'triangle',.09,.06)},
  off:()=>{T(660,.05,'triangle',.07);T(330,.09,'triangle',.07,.06)},
  ok:()=>{T(523,.08,'sine',.09);T(659,.08,'sine',.09,.07);T(784,.15,'sine',.09,.14)},
  err:()=>{T(190,.15,'sawtooth',.05);T(150,.18,'sawtooth',.04,.09)},
  bm:()=>{T(660,.05,'triangle',.09);T(880,.1,'triangle',.08,.05)},
  tick:()=>{T(900,.03,'triangle',.11);T(180,.05,'sine',.08)},
  chime:()=>{T(523,.9,'sine',.1);T(1046,.9,'sine',.045,.02)},
  fan:()=>{[523,659,784,1046].forEach((f,i)=>T(f,.2,'triangle',.09,i*.1))},
  pop:()=>T(760,.04,'sine',.07,0,980)}[n]||(()=>{}))()}};
N.Amb={n:null,
 start(){if(this.n)return;const c=N.Snd.ready();if(!c)return;const g=c.createGain();g.gain.value=0;
  g.gain.linearRampToValueAtTime(.04*N.S.set.vol,c.currentTime+3);
  const a=c.createOscillator(),b=c.createOscillator(),l=c.createOscillator(),lg=c.createGain();
  a.frequency.value=110;b.frequency.value=110.7;l.frequency.value=.07;lg.gain.value=.016*N.S.set.vol;
  l.connect(lg);lg.connect(g.gain);a.connect(g);b.connect(g);g.connect(c.destination);
  a.start();b.start();l.start();this.n={a,b,l,g}},
 stop(){if(!this.n)return;const{a,b,l,g}=this.n;try{g.gain.linearRampToValueAtTime(0,N.Snd.c.currentTime+1)}catch{}
  setTimeout(()=>{try{a.stop();b.stop();l.stop()}catch{}},1200);this.n=null},
 sync(){if(!N.S.set.sound||!N.S.set.amb){this.stop();return}
  if(this.n){try{this.n.g.gain.linearRampToValueAtTime(.04*N.S.set.vol,N.Snd.c.currentTime+.3)}catch{}}else this.start()}};

/* atmosphere */
N.Sky={cv:null,cx:null,ps:[],raf:0,run:false,cols:['#e3b23c','#2ee6c5','#9b8cff'],
 init(){this.cv=$('#stars');this.cx=this.cv.getContext('2d');this.refresh();this.resize();
  addEventListener('resize',()=>this.resize());document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.sync());this.sync()},
 refresh(){const c=getComputedStyle(document.documentElement);
  this.cols=['--gold','--turq','--ai'].map(k=>c.getPropertyValue(k).trim()||'#e3b23c')},
 resize(){if(!this.cx)return;const d=Math.min(2,devicePixelRatio||1);
  this.cv.width=innerWidth*d;this.cv.height=innerHeight*d;this.cx.setTransform(d,0,0,d,0,0);
  const n=Math.min(70,Math.floor(innerWidth*innerHeight/27000));
  this.ps=Array.from({length:n},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.4+.35,
   v:Math.random()*.12+.025,p:Math.random()*6.28,c:Math.floor(Math.random()*3)}));this.sync()},
 draw(t){if(!this.cx)return;this.cx.clearRect(0,0,innerWidth,innerHeight);
  for(const p of this.ps){this.cx.globalAlpha=(.3+.7*Math.abs(Math.sin(t/1900+p.p)))*.36;
   this.cx.fillStyle=this.cols[p.c];this.cx.beginPath();this.cx.arc(p.x,p.y,p.r,0,7);this.cx.fill()}this.cx.globalAlpha=1},
 loop(){if(!this.cx||this.run)return;this.run=true;
  const step=t=>{if(!this.run)return;this.draw(t);
   for(const p of this.ps){p.y-=p.v;if(p.y<-4){p.y=innerHeight+4;p.x=Math.random()*innerWidth}}
   this.raf=requestAnimationFrame(step)};this.raf=requestAnimationFrame(step)},
 stop(){this.run=false;cancelAnimationFrame(this.raf)},
 sync(){if(!this.cx)return;N.S.set.motion&&!document.hidden?this.loop():(this.stop(),this.draw(1200))}};
N.confetti=(n=110)=>{if(!N.S.set.motion)return;const cv=$('#conf'),cx=cv.getContext('2d');
 cv.width=innerWidth;cv.height=innerHeight;
 const cs=getComputedStyle(document.documentElement),cols=['--gold','--turq','--ai','--ai2','--saff'].map(k=>cs.getPropertyValue(k).trim());
 const ps=Array.from({length:n},()=>({x:innerWidth/2+(Math.random()-.5)*innerWidth*.5,y:innerHeight*.36,
  vx:(Math.random()-.5)*11,vy:-Math.random()*11-3,s:Math.random()*7+4,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,
  c:cols[Math.floor(Math.random()*cols.length)],l:1}));
 let f=0;(function tick(){cx.clearRect(0,0,cv.width,cv.height);let alive=false;
  for(const p of ps){p.vy+=.28;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.l-=.008;
   if(p.l>0&&p.y<cv.height+30){alive=true;cx.save();cx.translate(p.x,p.y);cx.rotate(p.r);
    cx.globalAlpha=Math.max(0,p.l);cx.fillStyle=p.c;cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cx.restore()}}
  if(alive&&++f<300)requestAnimationFrame(tick);else cx.clearRect(0,0,cv.width,cv.height)})()};

/* primitives */
N.toast=(m,t='ok',i='check',action)=>{const b=$('#toasts');while(b.children.length>=4)b.firstChild.remove();
 const e=document.createElement('div');e.className='toast '+(t==='ok'?'':t);e.innerHTML=ic(i)+`<span>${esc(m)}</span>`;
 e.onclick=()=>e.remove();
 if(action){const u=document.createElement('button');u.className='undo';u.textContent=action.label;
  u.onclick=ev=>{ev.stopPropagation();action.fn();e.remove()};e.appendChild(u)}
 b.appendChild(e);setTimeout(()=>{e.classList.add('bye');setTimeout(()=>e.remove(),320)},action?6500:3400)};
N.mres=null;
N.modal=h=>{$('#mroot').innerHTML=`<div class="ov open"><div class="scrim" data-a="mclose"></div><div class="mcard">${h}</div></div>`;
 N.Snd.p('open');const f=$('#mroot textarea,#mroot input,#mroot .btn');f&&setTimeout(()=>f.focus(),60)};
N.mclose=()=>{if(!$('#mroot').innerHTML)return;$('#mroot').innerHTML='';N.Snd.p('close');
 if(N.mres){const r=N.mres;N.mres=null;r(false)}};
N.confirmBox=o=>new Promise(r=>{N.mres=r;
 N.modal(`<h2>${ic(o.danger?'alert':'info')}${esc(o.title)}</h2><div class="mbody">${esc(o.body)}</div>
 <div class="macts"><button class="btn ghost" data-a="mclose">Cancel</button>
 <button class="btn ${o.danger?'bad':'gold'}" data-a="mok">${esc(o.ok||'Confirm')}</button></div>`)});
N.copyText=async txt=>{try{await navigator.clipboard.writeText(txt)}catch{
 const a=document.createElement('textarea');a.value=txt;document.body.appendChild(a);a.select();
 try{document.execCommand('copy')}catch{}a.remove()}};

N.apply=()=>{const t=N.S.set,r=document.documentElement;
 r.dataset.theme=t.theme;r.dataset.arfont=t.arFont;
 r.style.setProperty('--ars',t.fs);r.style.setProperty('--arlh',t.lh);r.style.setProperty('--glow',t.glow);
 document.body.classList.toggle('calm',!t.motion);
 const b=$('#sndBtn');b.className='soundpill '+(t.sound?'on':'off');
 b.innerHTML=ic(t.sound?'vol':'mute')+`<span>Sound ${t.sound?'on':'off'}</span>`;
 $$('.th').forEach(c=>c.classList.toggle('on',c.dataset.v===t.theme));
 $('#fsVal').textContent=Math.round(t.fs*100)+'%';
 N.Amb.sync();N.Sky.refresh();N.Sky.sync();N.placeTip&&N.placeTip();N.ai&&N.ai.paintKey()};
N.fillDrawer=()=>{$$('#drawer [data-s]').forEach(e=>{const v=N.S.set[e.dataset.s];
 if(e.type==='checkbox')e.checked=!!v;else e.value=v});N.syncUI&&N.syncUI();N.ai&&N.ai.paintKey()};
N.openDr=()=>{N.fillDrawer();N.acctUI();document.body.classList.add('drawer');N.Snd.p('open')};
N.closeDr=()=>{document.body.classList.remove('drawer');N.Snd.p('close')};
})();
