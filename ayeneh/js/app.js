import {$,h} from './utils/dom.js';
import {configured} from './services/supabase.js';
import * as auth from './services/auth.js';
import * as api from './services/lies.js';
import {authView} from './views/auth.js';
import {dashboardView} from './views/dashboard.js';
import {liesView} from './views/lies.js';
import {toast} from './components/toast.js';
import {IDLE_LOCK_MS} from './config.js';
const root=$('#app'),state={items:[]},routes={'#/':dashboardView,'#/lies':liesView};
const nav=[['#/','داشبورد'],['#/lies','دروغ‌ها']];
let uid;
function route(){const m=$('.content');if(!m)return;const k=routes[location.hash]?location.hash:'#/';
document.querySelectorAll('.navlink').forEach(a=>a.classList.toggle('on',a.getAttribute('href')===k));routes[k](m,state)}
async function start(session){
if(!session){state.items=[];return authView(root)}
root.replaceChildren(h('header',{class:'top'},h('b',{class:'brand'},'◐ آینه'),h('nav',{},nav.map(([href,l])=>h('a',{href,class:'navlink'},l))),h('button',{class:'btn',onclick:()=>auth.signOut()},'خروج')),h('main',{class:'content'}));
try{state.items=await api.list()}catch(e){toast(e.message,'err')}route()}
if(!configured)root.append(h('main',{class:'center'},h('div',{class:'card'},'ابتدا آدرس و کلید Supabase را در js/config.js وارد کنید.')));
else{auth.onChange(s=>{const id=s?.user?.id??null;if(id===uid)return;uid=id;start(s)});addEventListener('hashchange',route);
let t;const arm=()=>{clearTimeout(t);t=setTimeout(()=>uid&&auth.signOut(),IDLE_LOCK_MS)};['click','keydown','pointermove'].forEach(e=>addEventListener(e,arm,{passive:true}))}
