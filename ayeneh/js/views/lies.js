import {h} from '../utils/dom.js';
import {date,num} from '../utils/format.js';
import {SUBJECTS,CATEGORIES,STATUS} from '../config.js';
import * as api from '../services/lies.js';
import {tabs} from '../components/tabs.js';
import {modal,confirmBox} from '../components/modal.js';
import {toast} from '../components/toast.js';
const who=i=>i.subject==='person'?i.person_name:SUBJECTS[i.subject];
const sorters={new:(a,b)=>b.created_at.localeCompare(a.created_at),old:(a,b)=>a.created_at.localeCompare(b.created_at),belief:(a,b)=>b.belief-a.belief};
export function liesView(root,state){
const f={q:'',subject:'all',status:'all',sort:'new'},sel=new Set();
const sl=(opts,key)=>h('select',{onchange:e=>{f[key]=e.target.value;draw()}},Object.entries(opts).map(([v,l])=>h('option',{value:v},l)));
const q=h('input',{type:'search',placeholder:'جستجو در دروغ‌ها…',oninput:e=>{f.q=e.target.value.trim().toLowerCase();draw()}});
const list=h('div',{class:'list'});
const bulk=h('button',{class:'btn danger',hidden:true,onclick:async()=>{if(!await confirmBox(`${num(sel.size)} مورد حذف شود؟`))return;
try{await api.remove([...sel]);state.items=state.items.filter(i=>!sel.has(i.id));sel.clear();draw();toast('حذف شد')}catch(e){toast(e.message,'err')}}},'حذف انتخاب‌شده‌ها');
function draw(){
const rows=state.items.filter(i=>(f.subject==='all'||i.subject===f.subject)&&(f.status==='all'||i.status===f.status)&&(!f.q||[i.lie,i.truth,i.person_name,i.category].join(' ').toLowerCase().includes(f.q))).sort(sorters[f.sort]);
bulk.hidden=!sel.size;list.replaceChildren(...(rows.length?rows.map(card):[h('div',{class:'empty'},'اینجا هنوز چیزی نیست. اولین دروغ را صادقانه ثبت کن.')]))}
function card(i){const b=h('span');b.style.setProperty('--w',i.belief+'%');
return h('article',{class:'card lie'},
h('input',{type:'checkbox','aria-label':'انتخاب',checked:sel.has(i.id),onchange:e=>{e.target.checked?sel.add(i.id):sel.delete(i.id);bulk.hidden=!sel.size}}),
h('div',{class:'grow'},h('div',{class:'meta'},h('span',{class:'chip'},who(i)),h('span',{class:'chip'},i.category),h('span',{class:'chip '+i.status},STATUS[i.status]),h('time',{class:'muted'},date(i.created_at))),
h('p',{class:'lie-text'},'«'+i.lie+'»'),i.truth?h('p',{class:'truth'},'حقیقت: '+i.truth):'',h('div',{class:'bar',title:'میزان باور '+num(i.belief)+'٪'},b)),
h('div',{class:'row'},h('button',{class:'icon',title:'ویرایش',onclick:()=>edit(i)},'✎'),h('button',{class:'icon',title:'حذف',onclick:async()=>{if(!await confirmBox('این مورد حذف شود؟'))return;try{await api.remove([i.id]);state.items=state.items.filter(x=>x.id!==i.id);sel.delete(i.id);draw();toast('حذف شد')}catch(e){toast(e.message,'err')}}},'🗑')))}
function edit(i={}){
const v={subject:i.subject||'me',person_name:i.person_name||'',lie:i.lie||'',truth:i.truth||'',category:i.category||'دیگر',belief:i.belief??50,status:i.status||'believing'};
const opts=(m,cur)=>Object.entries(m).map(([k,l])=>h('option',{value:k,selected:k===cur},l));
const fld=(l,n)=>h('label',{class:'field'},h('span',{},l),n);
const name=h('input',{maxlength:'60',placeholder:'نام فرد (مثلاً {name})',value:v.person_name,hidden:v.subject!=='person',oninput:e=>v.person_name=e.target.value});
const subj=h('select',{onchange:e=>{v.subject=e.target.value;name.hidden=v.subject!=='person'}},opts(SUBJECTS,v.subject));
const lie=h('textarea',{rows:'3',maxlength:'1000',placeholder:'چه دروغی به خودش می‌گوید؟',oninput:e=>v.lie=e.target.value},v.lie);
const truth=h('textarea',{rows:'3',maxlength:'2000',placeholder:'حقیقت چیست؟ (اختیاری)',oninput:e=>v.truth=e.target.value},v.truth);
const cat=h('select',{onchange:e=>v.category=e.target.value},CATEGORIES.map(c=>h('option',{value:c,selected:c===v.category},c)));
const st=h('select',{onchange:e=>v.status=e.target.value},opts(STATUS,v.status));
const bel=h('input',{type:'range',min:'0',max:'100',value:String(v.belief),oninput:e=>v.belief=+e.target.value});
modal({title:i.id?'ویرایش':'دروغ تازه',body:h('div',{},fld('دربارهٔ چه کسی؟',subj),name,fld('دروغ',lie),fld('حقیقت',truth),fld('دسته',cat),fld('وضعیت',st),fld('میزان باور (۰ تا ۱۰۰)',bel)),
actions:[{label:'انصراف'},{label:'ذخیره',kind:'primary',run:async()=>{
if(!v.lie.trim()){toast('متن دروغ را بنویس','err');return false}
if(v.subject==='person'&&!v.person_name.trim()){toast('نام فرد را وارد کن','err');return false}
const p={...v,person_name:v.subject==='person'?v.person_name.trim():null,lie:v.lie.trim(),truth:v.truth.trim()||null};
try{const r=i.id?await api.update(i.id,p):await api.create(p);state.items=i.id?state.items.map(x=>x.id===i.id?r:x):[r,...state.items];draw();toast('ذخیره شد')}catch(e){toast(e.message,'err');return false}}}]})}
function exportJson(){const u=URL.createObjectURL(new Blob([JSON.stringify(state.items,null,2)],{type:'application/json'}));const a=h('a',{href:u,download:'ayeneh-export.json'});a.click();URL.revokeObjectURL(u)}
root.replaceChildren(h('section',{},h('div',{class:'toolbar'},q,sl({all:'همهٔ وضعیت‌ها',...STATUS},'status'),sl({new:'جدیدترین',old:'قدیمی‌ترین',belief:'بیشترین باور'},'sort'),h('button',{class:'btn primary',onclick:()=>edit()},'+ دروغ تازه'),h('button',{class:'btn',onclick:exportJson},'خروجی JSON'),bulk),
tabs([['all','همه'],...Object.entries(SUBJECTS)],'all',k=>{f.subject=k;draw()}),list));
draw()}
