import {h} from '../utils/dom.js';
import * as auth from '../services/auth.js';
import {toast} from '../components/toast.js';
export function authView(root){
let up=false;
const email=h('input',{type:'email',placeholder:'ایمیل',required:true,autocomplete:'email',dir:'ltr'});
const pass=h('input',{type:'password',placeholder:'رمز عبور (حداقل ۸ کاراکتر)',required:true,minlength:'8',autocomplete:'current-password',dir:'ltr'});
const btn=h('button',{class:'btn primary block',type:'submit'},'ورود');
const sw=h('button',{class:'link',type:'button',onclick:()=>{up=!up;btn.textContent=up?'ساخت حساب':'ورود';sw.textContent=up?'حساب دارید؟ ورود':'حساب ندارید؟ ثبت‌نام'}},'حساب ندارید؟ ثبت‌نام');
const form=h('form',{class:'card auth',onsubmit:async e=>{e.preventDefault();btn.disabled=true;
try{if(up){await auth.signUp(email.value.trim(),pass.value);toast('حساب ساخته شد. در صورت فعال بودن تأیید ایمیل، صندوق ایمیل را بررسی کنید.')}else await auth.signIn(email.value.trim(),pass.value)}
catch(err){toast(err.message,'err')}btn.disabled=false}},
h('div',{class:'logo'},'◐'),h('h1',{},'دروغ‌هایی که به خودمان می‌گوییم'),h('p',{class:'muted'},'فضایی کاملاً خصوصی برای صادق بودن با خودت. هیچ داده‌ای عمومی نیست.'),email,pass,btn,sw);
root.replaceChildren(h('main',{class:'center'},form))}
