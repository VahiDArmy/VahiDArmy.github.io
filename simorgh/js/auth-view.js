import { CFG, t, THEMES } from './config.js';
import { el, icon as _u } from './utils.js';
import { icon, toast } from './ui.js';
import { Auth } from './api.js';
import { S, saveSettings } from './state.js';

export function renderAuth(root, mode='in'){
  let busy=false, notice=null, error=null, tab=(mode==='magic')?'magic':(mode==='reset-set')?'reset-set':'in';
  let confirmEmail=null;

  function paint(){
    root.innerHTML='';
    root.removeAttribute('aria-busy');
    const feats=[['cpu','auth.f1t','auth.f1s'],['globe','auth.f2t','auth.f2s'],['branch','auth.f3t','auth.f3s'],['brain','auth.f4t','auth.f4s']];
    const hero=el('div',{class:'auth-hero'},
      el('div',{class:'row'},
        el('div',{class:'logo-mark',style:{width:'46px',height:'46px'},html:icon('logo',26)}),
        el('span',{class:'logo-name',style:{fontSize:'1.5rem'},text:t('app.name')})
      ),
      el('h1',{text:t('app.tag')}),
      el('p',{class:'tag',text:'ChatGPT-class experience · OpenRouter free models · Supabase cloud · فارسی / English'}),
      el('div',{class:'auth-feats'}, feats.map(([ic,a,b],i)=>
        el('div',{class:'auth-feat',style:{animationDelay:(i*0.09)+'s'}},
          el('div',{class:'fi',html:icon(ic,17)}),
          el('div',{}, el('b',{text:t(a)}), el('span',{text:t(b)}))
        )
      ))
    );

    const email=el('input',{class:'input',type:'email',placeholder:'you@example.com',autocomplete:'email',autofocus:true,required:true});
    const pass=el('input',{class:'input',type:'password',placeholder:'••••••••',autocomplete:tab==='up'?'new-password':'current-password',required:true});
    const name=el('input',{class:'input',type:'text',placeholder:t('auth.name'),autocomplete:'name'});
    const passWrap=el('div',{class:'pass-wrap'}, pass,
      el('button',{class:'ibtn',type:'button',html:icon('eye',16),title:t('common.ok'),onclick:(e)=>{
        const shown = pass.type==='text';
        pass.type = shown?'password':'text';
        e.currentTarget.innerHTML = icon(shown?'eye':'eyeOff',16);
      }})
    );
    const errBox = error?el('div',{class:'auth-err',text:error}):null;
    const okBox = notice?el('div',{class:'auth-ok',text:notice}):null;
    const submitBtn=el('button',{class:'btn primary',type:'submit',style:{width:'100%',marginTop:'6px'},
      text: tab==='in'?t('auth.signIn'):tab==='up'?t('auth.signUp'):tab==='magic'?t('auth.magic'):t('auth.setPassword')});

    const form=el('form',{class:'auth-card',onsubmit:async e=>{
      e.preventDefault();
      if(busy) return;
      error=null; notice=null;
      const em=email.value.trim();
      if(tab!=='reset-set' && !em){ return; }
      busy=true; submitBtn.disabled=true;
      submitBtn.textContent = tab==='in'?t('auth.signingIn'):tab==='up'?t('auth.creating'):t('auth.sending');
      try{
        if(tab==='in'){
          await Auth.signIn(em, pass.value);
        } else if(tab==='up'){
          const data=await Auth.signUp(em, pass.value, name.value.trim());
          if(data.session){ /* autoconfirmed — app takes over */ }
          else { confirmEmail=em; tab='confirm'; }
        } else if(tab==='magic'){
          await Auth.magic(em); notice=t('auth.magicSent')+' '+t('auth.magicHint');
        } else if(tab==='reset-req'){
          await Auth.resetRequest(em); notice=t('auth.resetSent');
        } else if(tab==='reset-set'){
          await Auth.updatePassword(pass.value);
          toast(t('settings.saved'),'ok');
          location.hash=''; location.reload();
        }
      }catch(err){
        error = err.message==='Invalid login credentials' ? (S.settings.lang==='fa'?'ایمیل یا رمز نادرست است':'Invalid email or password') : (err.message||String(err));
      }
      busy=false;
      paint();
    }});

    const topBar=el('div',{class:'auth-top'},
      el('button',{class:'ibtn',html:icon('globe',17),title:'فارسی / English',onclick:()=>{ saveSettings({lang:S.settings.lang==='fa'?'en':'fa'},{cloud:false}); paint(); }}),
      el('button',{class:'ibtn',html:icon('palette',17),title:t('settings.theme'),onclick:()=>{
        const ix=THEMES.findIndex(x=>x.id===S.settings.theme);
        saveSettings({theme:THEMES[(ix+1)%THEMES.length].id},{cloud:false}); paint();
      }})
    );

    if(tab==='confirm'){
      form.append(
        el('div',{class:'row',style:{marginBottom:'14px'},html:icon('checkCircle',22)}, el('b',{text:t('auth.confirmEmail')})),
        el('p',{class:'muted small',text:t('auth.confirmEmailBody',{e:confirmEmail})}),
        el('button',{class:'btn soft',type:'button',style:{width:'100%'},text:t('auth.resend'),onclick:async e=>{
          try{ await Auth.resend(confirmEmail); toast(t('auth.resent'),'ok'); }catch(err){ toast(err.message,'err'); }
        }}),
        el('button',{class:'btn ghost',type:'button',style:{width:'100%',marginTop:'8px'},text:t('auth.back'),onclick:()=>{ tab='in'; paint(); }})
      );
    } else {
      if(tab==='in'||tab==='up'||tab==='magic'){
        form.append(el('div',{class:'auth-tabs'},
          ...[['in','auth.signIn'],['up','auth.signUp'],['magic','auth.magic']].map(([id,lb])=>
            el('button',{class:'auth-tab'+(tab===id?' active':''),type:'button',text:t(lb),onclick:()=>{ tab=id; error=null; notice=null; paint(); }})
          )
        ));
      } else {
        form.append(el('b',{style:{display:'block',marginBottom:'14px',fontSize:'1.05rem'},text:tab==='reset-set'?t('auth.resetTitle'):t('auth.forgot')}));
      }
      if(errBox) form.append(errBox);
      if(okBox) form.append(okBox);
      if(tab!=='reset-set'){
        form.append(el('div',{class:'field'}, el('label',{class:'lbl',text:t('auth.email')}), email));
      }
      if(tab==='up'){
        form.append(el('div',{class:'field'}, el('label',{class:'lbl',text:t('auth.name')+' ('+t('common.optional')+')'}), name));
      }
      if(tab==='in'||tab==='up'||tab==='reset-set'){
        form.append(el('div',{class:'field'}, el('label',{class:'lbl',text:tab==='reset-set'?t('auth.newPassword'):t('auth.password')}), passWrap));
      }
      if(tab!=='reset-set') form.append(submitBtn);
      else form.append(submitBtn);
      if(tab==='in'){
        form.append(el('div',{style:{textAlign:'center',marginTop:'13px'}},
          el('a',{href:'#',class:'small',text:t('auth.forgot'),onclick:e=>{ e.preventDefault(); tab='reset-req'; error=null; notice=null; paint(); }})));
      }
      if(tab==='reset-req'){
        form.append(el('button',{class:'btn ghost',type:'button',style:{width:'100%',marginTop:'8px'},text:t('auth.back'),onclick:()=>{ tab='in'; notice=null; paint(); }}));
      }
      form.append(el('p',{class:'muted',style:{fontSize:'.7rem',textAlign:'center',margin:'16px 0 0'},
        text:CFG.APP_NAME+' · Supabase + OpenRouter · '+t('settings.apiKeyHint')}));
    }

    const side=el('div',{class:'auth-side'}, topBar, form);
    root.append(el('div',{id:'auth'}, hero, side));
  }
  paint();
}
