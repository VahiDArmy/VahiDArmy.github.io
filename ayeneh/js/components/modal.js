import {h} from '../utils/dom.js';
export function modal({title,body,actions=[],onClose}){
const close=()=>{document.removeEventListener('keydown',esc);ov.classList.add('out');setTimeout(()=>ov.remove(),200);onClose?.()};
const esc=e=>e.key==='Escape'&&close();
const ov=h('div',{class:'overlay',onclick:e=>e.target===ov&&close()},h('div',{class:'modal',role:'dialog','aria-modal':'true'},
h('header',{},h('h3',{},title),h('button',{class:'icon','aria-label':'بستن',onclick:close},'×')),h('div',{class:'modal-body'},body),
h('footer',{},actions.map(a=>h('button',{class:'btn '+(a.kind||''),onclick:async()=>{if(await a.run?.()!==false)close()}},a.label)))));
document.body.append(ov);document.addEventListener('keydown',esc);(ov.querySelector('textarea,input')||ov.querySelector('.btn'))?.focus()}
export const confirmBox=msg=>new Promise(r=>modal({title:'تأیید',body:h('p',{},msg),onClose:()=>r(false),actions:[{label:'انصراف'},{label:'بله، حذف شود',kind:'danger',run:()=>r(true)}]}));
