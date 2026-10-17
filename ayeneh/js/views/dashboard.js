import {h} from '../utils/dom.js';
import {num} from '../utils/format.js';
import {SUBJECTS,STATUS} from '../config.js';
export function dashboardView(root,state){
const n=state.items.length,by=k=>state.items.reduce((m,i)=>(m[i[k]]=(m[i[k]]||0)+1,m),{});
const avg=n?Math.round(state.items.reduce((s,i)=>s+i.belief,0)/n):0;
const stat=(l,v)=>h('div',{class:'card stat'},h('b',{},v),h('span',{class:'muted'},l));
const dist=(t,map,labels)=>h('div',{class:'card'},h('h3',{},t),Object.entries(labels).map(([k,l])=>{const c=map[k]||0,b=h('span');b.style.setProperty('--w',(n?c/n*100:0)+'%');return h('div',{class:'dist'},h('span',{},l),h('div',{class:'bar'},b),h('em',{},num(c)))}));
root.replaceChildren(h('section',{},h('div',{class:'grid'},stat('کل دروغ‌ها',num(n)),stat('میانگین میزان باور',num(avg)+'٪'),stat('رها‌شده',num(by('status').freed||0))),
h('div',{class:'grid two'},dist('دربارهٔ چه کسی',by('subject'),SUBJECTS),dist('وضعیت',by('status'),STATUS))))}
