export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs={}, ...kids){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null || v===false) continue;
    if(k==='class') n.className = v;
    else if(k==='html') n.innerHTML = v;
    else if(k==='text') n.textContent = v;
    else if(k==='style' && typeof v==='object') Object.assign(n.style, v);
    else if(k==='dataset') Object.assign(n.dataset, v);
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
    else if(v===true) n.setAttribute(k,'');
    else n.setAttribute(k, String(v));
  }
  for(const kid of kids.flat(Infinity)){
    if(kid==null || kid===false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export function esc(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export function uid(){
  return (crypto.randomUUID) ? crypto.randomUUID() : 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);})+'-'+Date.now().toString(16);
}
export function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
export function throttle(fn, ms){ let last=0, t=null, args=null;
  return (...a)=>{ args=a; const now=Date.now();
    if(now-last>=ms){ last=now; fn(...args); }
    else if(!t){ t=setTimeout(()=>{ t=null; last=Date.now(); fn(...args); }, ms-(now-last)); }
  };
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const RTL_RE=/[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_RE=/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;
export function dirOf(s){
  for(const ch of String(s||'')){
    if(RTL_RE.test(ch)) return 'rtl';
    if(LTR_RE.test(ch)) return 'ltr';
  }
  return 'ltr';
}
export function estimateTokens(s){
  s=String(s||''); if(!s) return 0;
  return Math.ceil(s.length / (dirOf(s)==='rtl' ? 2.4 : 4));
}
export function fuzzy(q, s){
  q=String(q||'').toLowerCase(); s=String(s||'').toLowerCase();
  if(!q) return 1;
  if(s.includes(q)) return 100 - s.indexOf(q);
  let i=0, score=0;
  for(const ch of s){ if(ch===q[i]){ i++; score+=2; } if(i===q.length) return score; }
  return 0;
}
export async function copyText(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch{
    const ta=el('textarea',{style:{position:'fixed',opacity:'0'}}); ta.value=txt;
    document.body.append(ta); ta.select();
    let ok=false; try{ ok=document.execCommand('copy'); }catch{}
    ta.remove(); return ok;
  }
}
export function download(name, content, mime='text/plain'){
  const blob = content instanceof Blob ? content : new Blob([content],{type:mime+';charset=utf-8'});
  const a = el('a',{href:URL.createObjectURL(blob), download:name});
  document.body.append(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
export function fmtTime(ts, lang='en'){
  try{
    const d=new Date(ts), loc = lang==='fa'?'fa-IR':'en-US';
    const sameDay = d.toDateString()===new Date().toDateString();
    return sameDay ? new Intl.DateTimeFormat(loc,{hour:'2-digit',minute:'2-digit'}).format(d)
                   : new Intl.DateTimeFormat(loc,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }catch{ return ''; }
}
export function fmtDur(ms){
  if(ms==null) return '—';
  if(ms<1000) return Math.round(ms)+'ms';
  return (ms/1000).toFixed(1)+'s';
}
export function fmtNum(n){ return n==null?'—':Number(n).toLocaleString('en-US'); }
export function fmtBytes(n){
  if(n<1024) return n+' B';
  if(n<1048576) return (n/1024).toFixed(1)+' KB';
  return (n/1048576).toFixed(1)+' MB';
}
export function shortModel(id){
  if(!id) return '—';
  let s=String(id).split('/').pop().replace(/:free$/,'');
  return s.length>34 ? s.slice(0,32)+'…' : s;
}
export function stripMd(s){
  return String(s||'')
    .replace(/```[\s\S]*?(?:```|$)/g,' [code] ')
    .replace(/`([^`]*)`/g,'$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/[#>*_~|=-]{1,}/g,' ')
    .replace(/\s+/g,' ').trim();
}
export function readImage(file){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}
export function readText(file){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); });
}
export function fileExt(lang){
  const m={js:'js',javascript:'js',ts:'ts',typescript:'ts',python:'py',py:'py',html:'html',css:'css',json:'json',bash:'sh',shell:'sh',sh:'sh',sql:'sql',c:'c',cpp:'cpp',java:'java',go:'go',rust:'rs',ruby:'rb',php:'php',yaml:'yml',xml:'xml',md:'md',markdown:'md',txt:'txt'};
  return m[String(lang||'').toLowerCase()]||'txt';
}
