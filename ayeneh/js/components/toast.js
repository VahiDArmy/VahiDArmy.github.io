import {h} from '../utils/dom.js';
let box;
export function toast(msg,type='ok',ms=3200){box??=document.body.appendChild(h('div',{class:'toasts',role:'status','aria-live':'polite'}));
const t=h('div',{class:'toast '+type},msg);box.append(t);setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),250)},ms)}
