import { t } from './config.js';
import { $, el, esc, fuzzy, copyText, clamp } from './utils.js';
import { S, emit } from './state.js';
import { DB } from './api.js';

/* ---------------- icons ---------------- */
const P = {
  logo:'<path d="M20 4c-6 0-12 4-14 10l-2 6 6-2c6-2 10-8 10-14z"/><path d="M6 14c4-1 8-4 10-8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  edit:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  fork:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 12v3"/>',
  branch:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 9v6"/><path d="M18 12a9 9 0 0 1-9 6"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>', chevR:'<path d="m9 18 6-6-6-6"/>', chevD:'<path d="m6 9 6 6 6-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  sparkles:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  brain:'<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4.5 17.5 2.5 2.5 0 0 1 3 13a2.5 2.5 0 0 1 .23-3.77A2.5 2.5 0 0 1 4.5 5.5 2.5 2.5 0 0 1 7 3.04 2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44A2.5 2.5 0 0 0 19.5 17.5 2.5 2.5 0 0 0 21 13a2.5 2.5 0 0 0-.23-3.77A2.5 2.5 0 0 0 19.5 5.5 2.5 2.5 0 0 0 17 3.04 2.5 2.5 0 0 0 14.5 2z"/>',
  code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M9.9 4.24A9.5 9.5 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  paperclip:'<path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  pin:'<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  star:'<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  thumbUp:'<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/>',
  thumbDown:'<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/>',
  more:'<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 10-10"/><path d="m16 7 3 3"/>',
  zap:'<path d="M13 2 3 14h8l-1 8 11-13h-8z"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  warn:'<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  terminal:'<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  wrap:'<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4"/><path d="m16 16-2 2 2 2"/><path d="M3 18h7"/>',
  external:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  layers:'<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 14 10 6 10-6"/>',
  arrowDown:'<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  keyboard:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  palette:'<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 22a2.5 2.5 0 0 0 2-4 2.4 2.4 0 0 1 2-4h2a4 4 0 0 0 4-4"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  play:'<path d="m6 4 14 8-14 8z"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  xCircle:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  filter:'<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>'
};
export function icon(name, size=18){
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[name]||P.info)+'</svg>';
}
export function iconEl(name, size=18){ const sp=el('span',{html:icon(name,size),style:{display:'contents'}}); return sp; }

/* ---------------- toasts ---------------- */
let toastBox=null;
export function toast(msg, type='info', ms){
  if(!toastBox){ toastBox=el('div',{id:'toasts'}); document.body.append(toastBox); }
  while(toastBox.children.length>=4) toastBox.firstChild.remove();
  const ic = type==='ok'?'checkCircle':type==='err'?'xCircle':type==='warn'?'warn':'info';
  const n = el('div',{class:'toast '+type, role:'status', html:icon(ic,17)+'<span>'+esc(msg)+'</span>'});
  n.addEventListener('click',()=>n.remove());
  toastBox.append(n);
  setTimeout(()=>{ n.style.opacity='0'; n.style.transition='opacity .3s'; setTimeout(()=>n.remove(),320); }, ms || (type==='err'?5200:3000));
}

/* ---------------- modal stack ---------------- */
const modalStack=[];
const menuStack=[];
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    if(menuStack.length){ e.preventDefault(); closeAllMenus(); return; }
    if(modalStack.length){ e.preventDefault(); modalStack[modalStack.length-1].close(); }
  }
});
export function closeTop(){ if(modalStack.length) modalStack[modalStack.length-1].close(); }
export function modal({ title, body, actions=[], size='', onClose, noPad=false }={}){
  const overlay = el('div',{class:'overlay'});
  const box = el('div',{class:'modal '+size, role:'dialog','aria-modal':'true'});
  const head = el('div',{class:'modal-head'},
    el('div',{class:'modal-title',text:title||''}),
    el('button',{class:'ibtn',html:icon('x'),title:t('common.close'),onclick:()=>close()})
  );
  const bodyEl = el('div',{class:'modal-body',style:noPad?{padding:'0'}:{}});
  if(typeof body==='string') bodyEl.innerHTML=body; else if(body) bodyEl.append(body);
  box.append(head, bodyEl);
  let footEl=null;
  if(actions.length){
    footEl=el('div',{class:'modal-foot'});
    for(const a of actions){
      footEl.append(el('button',{class:'btn '+(a.class||'soft'),text:a.label,onclick:()=>a.onClick ? a.onClick(close, bodyEl) : close()}));
    }
    box.append(footEl);
  }
  overlay.append(box);
  overlay.addEventListener('mousedown', e=>{ if(e.target===overlay) close(); });
  document.getElementById('overlays').append(overlay);
  const entry={ close, root:box, body:bodyEl, overlay };
  modalStack.push(entry);
  function close(){
    const ix=modalStack.indexOf(entry); if(ix>=0) modalStack.splice(ix,1);
    overlay.remove(); if(onClose) onClose();
  }
  /* on touch devices, don't auto-focus inputs (pops the keyboard unexpectedly);
     explicit [autofocus] elements still get focus everywhere */
  setTimeout(()=>{
    const fine=window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    const f=box.querySelector('[autofocus]')||(fine?box.querySelector('input,textarea,select'):null);
    if(f) f.focus();
  },60);
  return entry;
}
export function confirmDlg({ title, message, okText, danger=true }){
  return new Promise(res=>{
    let done=false;
    modal({ title, body:el('p',{class:'muted',style:{margin:'0',fontSize:'.9rem'},text:message||''}),
      actions:[
        { label:t('common.cancel'), class:'ghost', onClick:(close)=>{ done=true; close(); res(false); } },
        { label:okText||t('common.delete'), class:danger?'danger':'primary', onClick:(close)=>{ done=true; close(); res(true); } }
      ],
      onClose:()=>{ if(!done) res(false); }
    });
  });
}
export function promptDlg({ title, label, value='', placeholder='', multiline=false }){
  return new Promise(res=>{
    let done=false;
    const input = multiline ? el('textarea',{class:'input',rows:6,placeholder}) : el('input',{class:'input',placeholder,autofocus:true});
    input.value=value;
    const m=modal({ title, body:el('div',{class:'field'}, label?el('label',{class:'lbl',text:label}):null, input),
      actions:[
        { label:t('common.cancel'), class:'ghost', onClick:(close)=>{ done=true; close(); res(null); } },
        { label:t('common.save'), class:'primary', onClick:(close)=>{ done=true; close(); res(input.value); } }
      ],
      onClose:()=>{ if(!done) res(null); }
    });
    if(multiline) setTimeout(()=>input.focus(),60);
    input.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!multiline){ e.preventDefault(); done=true; m.close(); res(input.value); } });
  });
}

/* ---------------- floating menus (touch-safe) ---------------- */
export function closeAllMenus(){ while(menuStack.length) menuStack.pop()(); }
export function floatPanel(anchor, node){
  closeAllMenus();
  node.classList.add('menu');
  document.getElementById('overlays').append(node);
  const place=()=>{
    if(!document.body.contains(anchor)) { close(); return; }
    const r=anchor.getBoundingClientRect();
    const nw=node.offsetWidth, nh=node.offsetHeight;
    const rtl=document.documentElement.dir==='rtl';
    let left = rtl ? r.right-nw : r.left;
    left = clamp(left, 8, Math.max(8,window.innerWidth-nw-8));
    let top = r.bottom+6;
    if(top+nh>window.innerHeight-8) top=Math.max(8, r.top-nh-6);
    node.style.left=left+'px'; node.style.top=top+'px';
  };
  let closed=false;
  const close=()=>{
    if(closed) return; closed=true;
    node.remove();
    document.removeEventListener('pointerdown',out,true);
    document.removeEventListener('scroll',onScroll,true);
    window.removeEventListener('resize',place);
    const ix=menuStack.indexOf(close); if(ix>=0) menuStack.splice(ix,1);
  };
  /* pointerdown covers mouse + touch + pen uniformly */
  const out=e=>{ if(!node.contains(e.target) && !anchor.contains(e.target)) close(); };
  /* scrolling INSIDE the panel (its own list) must never close it */
  const onScroll=e=>{ if(node.contains(e.target)) return; close(); };
  place();
  setTimeout(()=>{ if(!closed) document.addEventListener('pointerdown',out,true); },0);
  document.addEventListener('scroll',onScroll,true);
  /* keyboard opening / rotation → reposition, never close */
  window.addEventListener('resize',place);
  menuStack.push(close);
  return close;
}
export function menu(anchor, items){
  const node=el('div',{});
  for(const it of items){
    if(it.sep){ node.append(el('div',{class:'menu-sep'})); continue; }
    node.append(el('button',{class:'menu-item'+(it.danger?' danger':''),
      html:(it.icon?icon(it.icon,16):'')+'<span>'+esc(it.label)+'</span>'+(it.hint?'<span class="mi-hint">'+esc(it.hint)+'</span>':'')+(it.checked?'<span class="mi-check">'+icon('check',15)+'</span>':''),
      onclick:()=>{ closeAllMenus(); it.onClick && it.onClick(); }
    }));
  }
  return floatPanel(anchor, node);
}

/* ---------------- command palette ---------------- */
let COMMANDS=[];
export function registerCommands(list){ COMMANDS=list; }
export function palette(initialMode){
  const overlay=el('div',{class:'overlay palette-overlay'});
  const input=el('input',{placeholder:t('palette.ph'),autofocus:true});
  const listEl=el('div',{class:'palette-list'});
  const box=el('div',{class:'palette'}, el('div',{class:'palette-in',html:icon('search',18)},input), listEl);
  overlay.append(box);
  overlay.addEventListener('mousedown',e=>{ if(e.target===overlay) close(); });
  document.getElementById('overlays').append(overlay);
  const entry={close}; modalStack.push(entry);
  function close(){ const ix=modalStack.indexOf(entry); if(ix>=0) modalStack.splice(ix,1); overlay.remove(); }
  let items=[], sel=0, searchToken=0;
  function render(){
    listEl.innerHTML='';
    if(!items.length){ listEl.append(el('div',{class:'sb-empty',text:t('palette.noResults')})); return; }
    let lastSec=null;
    items.forEach((it,ix)=>{
      if(it.sec!==lastSec){ listEl.append(el('div',{class:'pal-sec',text:it.sec})); lastSec=it.sec; }
      const n=el('button',{class:'pal-item'+(ix===sel?' sel':''),
        html:icon(it.icon||'zap',16)+'<span class="grow"><span style="display:block" dir="auto">'+esc(it.label)+'</span>'+(it.sub?'<span class="pi-sub" dir="auto">'+esc(it.sub)+'</span>':'')+'</span>'+(it.kbd?'<kbd>'+esc(it.kbd)+'</kbd>':''),
        onmouseenter:()=>{ sel=ix; paintSel(); },
        onclick:()=>{ close(); it.run && it.run(); }
      });
      listEl.append(n);
    });
    paintSel();
  }
  function paintSel(){
    [...listEl.querySelectorAll('.pal-item')].forEach((n,i)=>n.classList.toggle('sel',i===sel));
    const cur=listEl.querySelector('.pal-item.sel'); if(cur) cur.scrollIntoView({block:'nearest'});
  }
  function collect(q){
    items=[];
    const scored=(arr,label,fn)=>arr.map(x=>({x,s:fuzzy(q,fn(x))})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s);
    if(!q || initialMode!=='messages'){
      for(const c of scored(COMMANDS,'',c=>c.label).slice(0,q?5:8))
        items.push({sec:t('palette.actions'),label:c.x.label,icon:c.x.icon,kbd:c.x.kbd,run:c.x.run});
      for(const c of scored(S.conversations,'',c=>c.title).slice(0,6))
        items.push({sec:t('palette.chats'),label:c.x.title,icon:'message',run:()=>emit('open-conv',c.x.id)});
      const activeModels=S.models.filter(m=>m.active&&!m.stale);
      for(const m of scored(activeModels,'',m=>m.info.name+' '+m.id).slice(0,q?5:0))
        items.push({sec:t('palette.models'),label:m.x.info.name,sub:m.x.id,icon:'cpu',run:()=>emit('pick-model-global',m.x.id)});
      for(const p of scored(S.prompts,'',p=>p.title+' '+p.body).slice(0,q?4:0))
        items.push({sec:t('palette.prompts'),label:p.x.title,sub:p.x.body.slice(0,70),icon:'book',run:()=>emit('insert-prompt',p.x.body)});
    }
    sel=0; render();
    const token=++searchToken;
    if(q && q.length>=3){
      DB.searchMessages(q).then(rows=>{
        if(token!==searchToken) return;
        for(const r of rows.slice(0,8)){
          const conv=S.conversations.find(c=>c.id===r.conversation_id);
          items.push({sec:t('palette.messages'),label:(conv?conv.title:'—'),sub:r.content.replace(/\s+/g,' ').slice(0,90),icon:'search',
            run:()=>emit('reveal-msg',{convId:r.conversation_id,msgId:r.id})});
        }
        render();
      }).catch(()=>{});
    }
  }
  input.addEventListener('input',()=>collect(input.value.trim()));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(items.length-1,sel+1); paintSel(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(0,sel-1); paintSel(); }
    else if(e.key==='Enter'){ e.preventDefault(); const it=items[sel]; if(it){ close(); it.run&&it.run(); } }
  });
  collect('');
  return close;
}

/* ---------------- shared helpers ---------------- */
export async function copyWithToast(text){
  const ok=await copyText(text);
  toast(ok?t('chat.copied'):t('toast.error'), ok?'ok':'err');
}
export function lightbox(src){
  modal({ title:'', size:'wide', body:el('img',{class:'lightbox-img',src}) });
}
export function htmlPreview(code){
  const frame=el('iframe',{class:'preview-frame',sandbox:'allow-scripts',srcdoc:code});
  modal({ title:'HTML Preview', size:'xwide', body:frame });
}
