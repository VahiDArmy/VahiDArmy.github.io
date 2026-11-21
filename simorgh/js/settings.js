import { CFG, t, THEMES, LANGS, REASON_OPTS } from './config.js';
import { el, esc, fmtNum, fmtDur, fmtTime, fmtBytes, shortModel, fuzzy, download, debounce } from './utils.js';
import { icon, toast, modal, confirmDlg, menu, floatPanel, copyWithToast } from './ui.js';
import { S, on, emit, saveSettings, getKey, setKey, modelInfo, effectiveModel, cacheModels } from './state.js';
import { DB, OR } from './api.js';
import { highlight } from './markdown.js';

/* ================= MODEL SYNC ================= */
export async function refreshModels(btn){
  const old = btn ? btn.innerHTML : null;
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner"></span><span>'+t('settings.refreshing')+'</span>'; }
  try{
    const fetched = await OR.listModels();
    const { rows, staleCount } = await DB.mergeModels(fetched);
    S.models = rows;
    cacheModels();
    localStorage.setItem(CFG.LS.modelsAt, new Date().toISOString());
    emit('models');
    toast(t('toast.modelsUpdated',{n:fetched.length}),'ok');
    if(staleCount) toast(t('toast.staleWarn',{n:staleCount}),'warn');
  }catch(e){ toast(e.message,'err'); }
  if(btn){ btn.disabled=false; btn.innerHTML=old; }
}

/* ================= MODEL PICKER ================= */
export function openModelPicker(anchor, { current, onPick, manage=true }){
  const panel=el('div',{class:'menu mp-panel'});
  const search=el('input',{class:'input',placeholder:t('settings.searchModels'),autofocus:true});
  const list=el('div',{class:'mp-list'});
  panel.append(el('div',{class:'mp-search'},search), list);
  if(manage) panel.append(el('div',{class:'mp-foot'},
    el('button',{class:'btn ghost sm',html:icon('sliders',15)+'<span>'+t('cmd.models')+'</span>',
      onclick:()=>{ close(); openSettings('models'); }})));
  const close=floatPanel(anchor, panel);
  function paint(){
    const q=search.value.trim();
    list.innerHTML='';
    const router=modelInfo(CFG.ROUTER_ID);
    const rItem=el('button',{class:'mp-item mp-router'+(current===CFG.ROUTER_ID?' current':''),
      html:icon('zap',18)+'<span class="grow"><span class="mp-name">'+t('settings.router')+'</span><span class="mp-id" style="display:block">'+t('settings.routerDesc')+' · openrouter/free</span></span>'+(current===CFG.ROUTER_ID?icon('check',16):''),
      onclick:()=>{ close(); onPick(CFG.ROUTER_ID); }});
    if(!q || fuzzy(q,'free router openrouter/free')>0) list.append(rItem);
    let models=S.models.filter(m=>m.id!==CFG.ROUTER_ID && m.active && !m.stale);
    models.sort((a,b)=>(b.pinned-a.pinned)||a.info.name.localeCompare(b.info.name));
    if(q) models=models.map(m=>({m,s:fuzzy(q,m.info.name+' '+m.id)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.m);
    for(const m of models){
      const inf=m.info;
      const badges=[
        inf.context_length?'<span class="badge">'+t('settings.ctx',{n:inf.context_length>=1000?Math.round(inf.context_length/1000)+'k':inf.context_length})+'</span>':'',
        (inf.input_modalities||[]).includes('image')?'<span class="badge acc">'+t('settings.vision')+'</span>':'',
        inf.supports_reasoning?'<span class="badge ok">'+t('settings.reasoningCap')+'</span>':''
      ].join('');
      list.append(el('button',{class:'mp-item'+(current===m.id?' current':''),
        html:(m.pinned?icon('star',15):icon('cpu',15))+
          '<span class="grow" style="min-width:0"><span class="mp-name ellip" style="display:block">'+esc(inf.name)+'</span><span class="mp-id mono ellip" style="display:block">'+esc(m.id)+'</span><span class="row" style="gap:4px;margin-top:3px">'+badges+'</span></span>'+
          (current===m.id?icon('check',16):''),
        onclick:()=>{ close(); onPick(m.id); }}));
    }
    if(!list.children.length) list.append(el('div',{class:'sb-empty',text:t('settings.noModels')}));
  }
  search.addEventListener('input',paint);
  paint();
  setTimeout(()=>search.focus(),50);
  return close;
}

/* ================= REQUEST INSPECTOR ================= */
export function openRequestViewer(msg){
  if(!msg.request_json){ toast(t('req.noReq'),'warn'); return; }
  const req=msg.request_json, meta=msg.meta_json||{};
  let tab='payload', revealed=false;
  const tabsEl=el('div',{class:'req-tabs'});
  const bodyEl=el('div',{});
  const tabs=[['payload','req.payload'],['headers','req.headers'],['curl','req.curl'],['response','req.response']];
  function paint(){
    tabsEl.innerHTML='';
    for(const [id,lb] of tabs)
      tabsEl.append(el('button',{class:'chip'+(tab===id?' on':''),text:t(lb),onclick:()=>{ tab=id; paint(); }}));
    bodyEl.innerHTML='';
    if(tab==='payload'){
      const json=JSON.stringify(req.body,null,2);
      bodyEl.append(
        el('div',{class:'row between',style:{marginBottom:'9px'}},
          el('span',{class:'mono muted small',text:req.method+' '+req.url}),
          el('button',{class:'btn soft sm',html:icon('copy',14)+'<span>'+t('common.copy')+'</span>',onclick:()=>copyWithToast(json)})),
        el('div',{class:'req-code',html:highlight(json,'json')}));
    } else if(tab==='headers'){
      const h={...req.headers};
      if(revealed) h.Authorization='Bearer '+getKey();
      const json=JSON.stringify(h,null,2);
      bodyEl.append(
        el('div',{class:'row',style:{marginBottom:'9px'}},
          el('button',{class:'btn soft sm',html:icon(revealed?'eyeOff':'eye',14)+'<span>'+t(revealed?'req.hide':'req.reveal')+'</span>',onclick:()=>{ revealed=!revealed; paint(); }}),
          el('button',{class:'btn soft sm',html:icon('copy',14)+'<span>'+t('common.copy')+'</span>',onclick:()=>copyWithToast(json)})),
        el('div',{class:'req-code',html:highlight(json,'json')}));
    } else if(tab==='curl'){
      const cmd=OR.curl(req, revealed?getKey():null);
      bodyEl.append(
        el('div',{class:'row',style:{marginBottom:'9px'}},
          el('button',{class:'btn soft sm',html:icon(revealed?'eyeOff':'eye',14)+'<span>'+t(revealed?'req.hide':'req.reveal')+'</span>',onclick:()=>{ revealed=!revealed; paint(); }}),
          el('button',{class:'btn soft sm',html:icon('copy',14)+'<span>'+t('common.copy')+'</span>',onclick:()=>copyWithToast(cmd)})),
        el('div',{class:'req-code',html:highlight(cmd,'bash')}));
    } else {
      const u=meta.usage||{};
      const stat=(k,v)=>el('div',{class:'req-stat'},el('div',{class:'k',text:k}),el('div',{class:'v',text:v==null?'—':String(v)}));
      bodyEl.append(
        el('div',{class:'req-meta-grid'},
          stat(t('req.requested'), req.body.model),
          stat(t('req.model'), msg.model||meta.model),
          stat(t('req.provider'), meta.provider),
          stat(t('req.finish'), meta.finish_reason),
          stat(t('req.latency'), fmtDur(meta.latency_ms)),
          stat(t('req.tps'), meta.tps),
          stat(t('req.promptTok'), fmtNum(u.prompt_tokens)),
          stat(t('req.completionTok'), fmtNum(u.completion_tokens)),
          stat(t('req.reasoningTok'), fmtNum(u.completion_tokens_details?.reasoning_tokens)),
          stat(t('req.totalTok'), fmtNum(u.total_tokens)),
          stat(t('req.cost'), u.cost!=null?'$'+u.cost:'$0'),
          stat(t('req.sentAt'), fmtTime(req.sent_at, S.settings.lang))
        ),
        el('div',{class:'req-code',html:highlight(JSON.stringify(meta,null,2),'json')}));
    }
  }
  paint();
  modal({ title:t('req.title'), size:'wide', body:el('div',{},tabsEl,bodyEl) });
}

/* ================= CHAT SETTINGS ================= */
export function openChatSettings(conv){
  const params={...(conv.params||{})};
  const sys=el('textarea',{class:'input',rows:4,placeholder:t('settings.systemPromptPh')}); sys.value=conv.system_prompt||'';
  const reasonSel=el('select',{class:'input'},
    el('option',{value:'inherit',text:t('chat.inherit')}),
    ...REASON_OPTS.map(r=>el('option',{value:r,text:t('settings.'+r)})));
  reasonSel.value=params.reasoning||'inherit';
  const tempIn=el('input',{class:'input',type:'number',step:'0.1',min:'0',max:'2',placeholder:t('settings.inherit')});
  if(params.temperature!=null&&params.temperature!=='inherit') tempIn.value=params.temperature;
  const maxIn=el('input',{class:'input',type:'number',min:'1',placeholder:t('settings.inherit')});
  if(params.maxTokens!=null&&params.maxTokens!=='inherit') maxIn.value=params.maxTokens;
  let routerMode=conv.router_mode||'sticky';
  const rmWrap=el('div',{class:'row wrap'},
    ...[['sticky','chat.sticky'],['router','chat.alwaysRouter']].map(([id,lb])=>
      el('button',{type:'button',class:'chip'+(routerMode===id?' on':''),text:t(lb),dataset:{rm:id},onclick:e=>{
        routerMode=id; rmWrap.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.rm===id));
        rmHint.textContent=t(routerMode==='sticky'?'chat.stickyHint':'chat.routerHint');
      }})));
  const rmHint=el('div',{class:'hint',text:t(routerMode==='sticky'?'chat.stickyHint':'chat.routerHint')});
  const projSel=el('select',{class:'input'},
    el('option',{value:'',text:t('chat.noProject')}),
    ...S.projects.map(p=>el('option',{value:p.id,text:(p.emoji||'📁')+' '+p.name})));
  projSel.value=conv.project_id||'';
  modal({
    title:t('chat.chatSettings'),
    body:el('div',{},
      el('div',{class:'field'},el('label',{class:'lbl',text:t('chat.systemPrompt')}),sys),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('chat.routerMode')}),rmWrap,rmHint),
      el('div',{class:'row wrap'},
        el('div',{class:'field grow'},el('label',{class:'lbl',text:t('settings.reasoningEffort')}),reasonSel),
        el('div',{class:'field grow'},el('label',{class:'lbl',text:t('settings.temperature')}),tempIn),
        el('div',{class:'field grow'},el('label',{class:'lbl',text:t('settings.maxTokens')}),maxIn)
      ),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('common.project')}),projSel),
      conv.locked_model?el('div',{class:'hint',html:icon('zap',13)+' '+t('chat.actualModel')+': <span class="mono">'+esc(conv.locked_model)+'</span>'}):null
    ),
    actions:[
      {label:t('common.cancel'),class:'ghost'},
      {label:t('common.save'),class:'primary',onClick:async close=>{
        const patch={
          system_prompt:sys.value,
          router_mode:routerMode,
          project_id:projSel.value||null,
          params:{
            reasoning:reasonSel.value,
            temperature:tempIn.value===''?'inherit':Number(tempIn.value),
            maxTokens:maxIn.value===''?'inherit':Number(maxIn.value)
          }
        };
        if(routerMode==='router') patch.locked_model=null;
        try{
          const row=await DB.updateConversation(conv.id,patch);
          Object.assign(conv,row);
          emit('conversations'); emit('active'); close(); toast(t('settings.saved'),'ok');
        }catch(e){ toast(e.message,'err'); }
      }}
    ]
  });
}

/* ================= EXPORT / IMPORT ================= */
export async function exportConversation(conv, fmt){
  try{
    const msgs = S.messages[conv.id] || await DB.convMessages(conv.id);
    S.messages[conv.id]=msgs;
    const stamp=new Date().toISOString().slice(0,10);
    const safe=(conv.title||'chat').replace(/[^\w\u0600-\u06FF-]+/g,'_').slice(0,40);
    if(fmt==='json'){
      download('simurgh_'+safe+'_'+stamp+'.json', JSON.stringify({app:'simurgh',version:1,conversations:[{...conv,messages:msgs}]},null,2),'application/json');
      return;
    }
    const { buildPath } = await import('./state.js');
    const { path } = buildPath(conv, msgs);
    if(fmt==='txt'){
      const { stripMd } = await import('./utils.js');
      const txt=path.map(m=>(m.role==='user'?'YOU':'ASSISTANT ('+(m.model||'')+')')+':\n'+stripMd(m.content)).join('\n\n──────────\n\n');
      download(safe+'.txt', conv.title+'\n\n'+txt);
      return;
    }
    let md='# '+conv.title+'\n\n> '+CFG.APP_NAME+' · '+stamp+' · '+effectiveModel(conv)+'\n\n';
    for(const m of path){
      md += (m.role==='user'?'## 🧑 You':'## ✦ '+(m.model||'Assistant'))+'\n\n';
      if(m.reasoning) md += '<details><summary>Reasoning</summary>\n\n'+m.reasoning+'\n\n</details>\n\n';
      md += (m.content||'')+'\n\n---\n\n';
    }
    download(safe+'.md', md, 'text/markdown');
  }catch(e){ toast(e.message,'err'); }
}
export async function exportAll(){
  try{
    toast(t('common.loading'),'info',1500);
    const convs=[];
    for(const c of S.conversations){
      const msgs=S.messages[c.id]||await DB.convMessages(c.id);
      convs.push({...c,messages:msgs});
    }
    download('simurgh_backup_'+new Date().toISOString().slice(0,10)+'.json',
      JSON.stringify({app:'simurgh',version:1,exported_at:new Date().toISOString(),conversations:convs,prompts:S.prompts,projects:S.projects,settings:S.settings},null,2),
      'application/json');
  }catch(e){ toast(e.message,'err'); }
}
export async function importData(file){
  try{
    const j=JSON.parse(await file.text());
    if(j.app!=='simurgh'||!Array.isArray(j.conversations)) throw new Error(t('settings.importBad'));
    const projMap={};
    for(const p of (j.projects||[])){
      const row=await DB.saveProject({name:p.name,emoji:p.emoji,instructions:p.instructions,model_id:p.model_id});
      projMap[p.id]=row.id; S.projects.push(row);
    }
    let count=0;
    for(const c of j.conversations){
      const conv=await DB.createConversation({
        title:c.title||'Imported', model_id:c.model_id||CFG.ROUTER_ID, locked_model:c.locked_model||null,
        router_mode:c.router_mode||'sticky', system_prompt:c.system_prompt||'', params:c.params||{},
        branch_map:{}, pinned:!!c.pinned, project_id:projMap[c.project_id]||null
      });
      const idMap={};
      const msgs=(c.messages||[]).slice().sort((a,b)=>a.created_at<b.created_at?-1:1);
      for(const m of msgs){
        const row=await DB.createMessage({
          conversation_id:conv.id, parent_id:idMap[m.parent_id]||null, role:m.role,
          content:m.content||'', reasoning:m.reasoning||'', model:m.model||null,
          status:m.status==='streaming'?'stopped':(m.status||'complete'), error:m.error||null,
          request_json:m.request_json||null, meta_json:m.meta_json||null,
          attachments:m.attachments||[], feedback:m.feedback||0
        });
        idMap[m.id]=row.id;
      }
      S.conversations.unshift(conv); count++;
    }
    for(const p of (j.prompts||[])){
      const row=await DB.savePrompt({title:p.title,body:p.body}); S.prompts.push(row);
    }
    emit('projects'); emit('prompts'); emit('conversations');
    if(S.conversations.length) emit('open-conv',S.conversations[0].id);
    toast(t('settings.importDone',{n:count}),'ok');
  }catch(e){ toast(e.message||t('settings.importBad'),'err'); }
}

/* ================= SETTINGS MODAL ================= */
const TABS=[['general','settings.general','sliders'],['appearance','settings.appearance','palette'],['models','settings.models','cpu'],['generation','settings.generation','sparkles'],['connection','settings.connection','key'],['prompts','settings.prompts','book'],['data','settings.data','database'],['about','settings.about','info']];

export function openSettings(tab='general'){
  const tabsEl=el('div',{class:'set-tabs'});
  const pane=el('div',{class:'set-pane'});
  const m=modal({ title:t('settings.title'), size:'xwide', noPad:true,
    body:el('div',{class:'settings-grid'},tabsEl,pane) });
  function paintTabs(){
    tabsEl.innerHTML='';
    for(const [id,lb,ic] of TABS)
      tabsEl.append(el('button',{class:'set-tab'+(tab===id?' active':''),html:icon(ic,16)+'<span>'+t(lb)+'</span>',
        onclick:()=>{ tab=id; paintTabs(); paintPane(); }}));
  }
  const row=(title,hint,control)=>el('div',{class:'set-row'},
    el('div',{},el('div',{class:'sr-t',text:title}),hint?el('div',{class:'sr-h',text:hint}):null),control);
  const sw=(checked,onchange)=>{
    const inp=el('input',{type:'checkbox'}); inp.checked=checked;
    inp.addEventListener('change',()=>onchange(inp.checked));
    return el('label',{class:'switch'},inp,el('i',{}));
  };
  const sel=(opts,val,onchange)=>{
    const s=el('select',{class:'input',style:{width:'auto',minWidth:'130px'}},
      ...opts.map(([v,lb])=>el('option',{value:v,text:lb})));
    s.value=val; s.addEventListener('change',()=>onchange(s.value)); return s;
  };

  function paintPane(){
    pane.innerHTML='';
    const s=S.settings;
    if(tab==='general'){
      pane.append(el('h3',{text:t('settings.general')}),
        row(t('settings.lang'),t('settings.langHint'),sel(LANGS.map(l=>[l.id,l.name]),s.lang,v=>{ saveSettings({lang:v}); m.close(); openSettings('general'); })),
        row(t('settings.enterSend'),'',sw(s.enterSend,v=>saveSettings({enterSend:v}))),
        row(t('settings.autoTitle'),'',sw(s.autoTitle,v=>saveSettings({autoTitle:v}))),
        row(t('settings.showReasoning'),'',sw(s.showReasoning,v=>saveSettings({showReasoning:v}))),
        row(t('settings.reduceMotion'),'',sw(s.reduceMotion,v=>saveSettings({reduceMotion:v})))
      );
    }
    else if(tab==='appearance'){
      const grid=el('div',{class:'theme-grid'});
      for(const th of THEMES){
        grid.append(el('button',{class:'theme-card'+(s.theme===th.id?' active':''),onclick:()=>{ saveSettings({theme:th.id}); paintPane(); }},
          el('div',{class:'tc-prev',style:{background:th.sw[0]}},
            el('div',{class:'bar',style:{background:th.sw[1],width:'70%'}}),
            el('div',{class:'bar',style:{background:th.sw[2],width:'45%'}}),
            el('div',{class:'bar',style:{background:th.sw[1]+'55',width:'85%'}})),
          el('div',{class:'tc-name'},el('span',{text:th.name}),el('span',{html:icon(th.dark?'moon':'sun',13),class:'muted'}))
        ));
      }
      const fs=el('input',{type:'range',min:'80',max:'130',step:'5',value:String(s.fontScale),style:{maxWidth:'180px'}});
      const fsVal=el('span',{class:'mono muted small',text:s.fontScale+'%'});
      fs.addEventListener('input',()=>{ fsVal.textContent=fs.value+'%'; saveSettings({fontScale:Number(fs.value)}); });
      pane.append(el('h3',{text:t('settings.theme')}),grid,el('hr',{class:'divider'}),
        row(t('settings.density'),'',sel([[ 'cozy',t('settings.cozy')],['compact',t('settings.compact')]],s.density,v=>saveSettings({density:v}))),
        row(t('settings.fontScale'),'',el('div',{class:'row'},fs,fsVal)),
        row(t('settings.chatWidth'),'',sel([['narrow',t('settings.narrow')],['standard',t('settings.standard')],['wide',t('settings.wide')],['full',t('settings.full')]],s.chatWidth,v=>saveSettings({chatWidth:v}))),
        row(t('settings.bubbles'),'',sw(s.bubbles,v=>saveSettings({bubbles:v}))),
        row(t('settings.bgFx'),'',sel([['aurora',t('settings.fx.aurora')],['grid',t('settings.fx.grid')],['dots',t('settings.fx.dots')],['none',t('settings.fx.none')]],s.bgFx,v=>saveSettings({bgFx:v})))
      );
    }
    else if(tab==='models'){ paintModels(pane); }
    else if(tab==='generation'){
      const modelBtn=el('button',{class:'btn soft sm',html:icon('cpu',14)+'<span class="mono">'+esc(shortModel(s.defaultModel))+'</span>',
        onclick:e=>openModelPicker(e.currentTarget,{current:s.defaultModel,onPick:id=>{ saveSettings({defaultModel:id}); paintPane(); }})});
      const sys=el('textarea',{class:'input',rows:3,placeholder:t('settings.systemPromptPh')}); sys.value=s.systemPrompt;
      sys.addEventListener('change',()=>saveSettings({systemPrompt:sys.value}));
      const numOrNull=(val,ph)=>{ const i=el('input',{class:'input',type:'number',placeholder:ph,style:{width:'110px'}}); if(val!=null)i.value=val; return i; };
      const temp=numOrNull(s.temperature,t('settings.default')); temp.step='0.1'; temp.min='0'; temp.max='2';
      temp.addEventListener('change',()=>saveSettings({temperature:temp.value===''?null:Number(temp.value)}));
      const topp=numOrNull(s.topP,t('settings.default')); topp.step='0.05'; topp.min='0'; topp.max='1';
      topp.addEventListener('change',()=>saveSettings({topP:topp.value===''?null:Number(topp.value)}));
      const maxt=numOrNull(s.maxTokens,t('settings.default')); maxt.min='1';
      maxt.addEventListener('change',()=>saveSettings({maxTokens:maxt.value===''?null:Number(maxt.value)}));
      const ctxl=el('input',{class:'input',type:'number',min:'2',max:'400',value:String(s.contextLimit),style:{width:'110px'}});
      ctxl.addEventListener('change',()=>saveSettings({contextLimit:Math.max(2,Number(ctxl.value)||40)}));
      pane.append(el('h3',{text:t('settings.generation')}),
        row(t('settings.defaultModel'),'',modelBtn),
        row(t('settings.stickyDefault'),t('settings.stickyDefaultHint'),sw(s.stickyRouter,v=>saveSettings({stickyRouter:v}))),
        row(t('settings.reasoningEffort'),'',sel(REASON_OPTS.map(r=>[r,t('settings.'+r)]),s.reasoning,v=>saveSettings({reasoning:v}))),
        row(t('settings.temperature'),'0 – 2',temp),
        row(t('settings.topP'),'0 – 1',topp),
        row(t('settings.maxTokens'),'',maxt),
        row(t('settings.contextLimit'),t('settings.contextLimitHint'),ctxl),
        el('div',{class:'field',style:{marginTop:'14px'}},el('label',{class:'lbl',text:t('settings.systemPrompt')}),sys)
      );
    }
    else if(tab==='connection'){ paintConnection(pane); }
    else if(tab==='prompts'){ paintPrompts(pane); }
    else if(tab==='data'){
      const size=JSON.stringify(S.messages).length+JSON.stringify(S.conversations).length;
      const fileIn=el('input',{type:'file',accept:'.json,application/json',style:{display:'none'},onchange:e=>{ if(e.target.files[0]) importData(e.target.files[0]); e.target.value=''; }});
      pane.append(el('h3',{text:t('data.title')}),
        el('p',{class:'hint',text:t('settings.storage',{n:fmtBytes(size)})}),
        el('div',{class:'row wrap',style:{margin:'14px 0'}},
          el('button',{class:'btn soft',html:icon('download',16)+'<span>'+t('settings.exportAll')+'</span>',onclick:()=>exportAll()}),
          el('button',{class:'btn soft',html:icon('upload',16)+'<span>'+t('settings.import')+'</span>',onclick:()=>fileIn.click()}),fileIn),
        el('hr',{class:'divider'}),
        el('div',{class:'row wrap'},
          el('button',{class:'btn danger',html:icon('trash',16)+'<span>'+t('settings.clearChats')+'</span>',onclick:async()=>{
            if(await confirmDlg({title:t('settings.clearChatsQ'),message:t('chat.deleteConvBody')})){
              try{ await DB.wipeChats(); S.conversations=[]; S.messages={}; S.activeConvId=null; emit('conversations'); emit('active'); toast(t('toast.deleted'),'ok'); }catch(e){ toast(e.message,'err'); }
            }
          }}),
          el('button',{class:'btn danger',html:icon('warn',16)+'<span>'+t('settings.wipeAll')+'</span>',onclick:async()=>{
            if(await confirmDlg({title:t('settings.wipeAllQ'),message:t('settings.wipeAllBody')})){
              try{ await DB.wipeAll(); S.conversations=[]; S.messages={}; S.prompts=[]; S.projects=[]; S.models=[]; S.activeConvId=null; cacheModels();
                emit('conversations'); emit('active'); emit('prompts'); emit('projects'); emit('models'); toast(t('toast.deleted'),'ok'); }catch(e){ toast(e.message,'err'); }
            }
          }})
        )
      );
    }
    else if(tab==='about'){
      pane.append(el('h3',{text:t('app.name')+' · '+t('settings.version')+' '+CFG.VERSION}),
        el('p',{class:'muted small',text:t('settings.aboutText')}),
        el('div',{class:'row',style:{margin:'14px 0'}},
          el('a',{class:'btn soft sm',href:'https://openrouter.ai/docs',target:'_blank',rel:'noopener',html:icon('external',14)+'<span>OpenRouter Docs</span>'}),
          el('a',{class:'btn soft sm',href:'https://openrouter.ai/'+CFG.ROUTER_ID,target:'_blank',rel:'noopener',html:icon('zap',14)+'<span>Free Router</span>'})),
        el('hr',{class:'divider'}),
        shortcutsGrid()
      );
    }
  }
  paintTabs(); paintPane();
  const unsub=()=>{};
  return m;
}

function paintModels(pane){
  let q='', filter='all';
  const lastAt=localStorage.getItem(CFG.LS.modelsAt);
  const refreshBtn=el('button',{class:'btn primary sm',html:icon('refresh',14)+'<span>'+t('settings.refreshModels')+'</span>'});
  refreshBtn.addEventListener('click',()=>refreshModels(refreshBtn).then(paint));
  const search=el('input',{class:'input',placeholder:t('settings.searchModels'),style:{maxWidth:'220px'},oninput:e=>{ q=e.target.value; paint(); }});
  const filterSel=el('select',{class:'input',style:{width:'auto'},onchange:e=>{ filter=e.target.value; paint(); }},
    ...[['all',t('settings.filter.all')],['active',t('settings.filter.active')],['inactive',t('settings.filter.inactive')],['stale',t('settings.filter.stale')]].map(([v,lb])=>el('option',{value:v,text:lb})));
  const list=el('div',{class:'mm-list'});
  const counts=el('span',{class:'muted small'});
  function paint(){
    const total=S.models.length, act=S.models.filter(m=>m.active&&!m.stale).length, st=S.models.filter(m=>m.stale).length;
    counts.textContent=act+' / '+total+' · '+st+' '+t('settings.stale');
    list.innerHTML='';
    let rows=S.models.slice().sort((a,b)=>(a.id===CFG.ROUTER_ID?-1:b.id===CFG.ROUTER_ID?1:(b.pinned-a.pinned)||a.info.name.localeCompare(b.info.name)));
    if(filter==='active') rows=rows.filter(m=>m.active&&!m.stale);
    if(filter==='inactive') rows=rows.filter(m=>!m.active);
    if(filter==='stale') rows=rows.filter(m=>m.stale);
    if(q) rows=rows.map(m=>({m,s:fuzzy(q,m.info.name+' '+m.id)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.m);
    for(const m of rows){
      const inf=m.info, isRouter=m.id===CFG.ROUTER_ID;
      const badges=el('div',{class:'mm-badges',html:[
        inf.context_length?'<span class="badge">'+t('settings.ctx',{n:inf.context_length>=1000?Math.round(inf.context_length/1000)+'k':inf.context_length})+'</span>':'',
        (inf.input_modalities||[]).includes('image')?'<span class="badge acc">'+t('settings.vision')+'</span>':'',
        inf.supports_reasoning?'<span class="badge ok">'+t('settings.reasoningCap')+'</span>':'',
        m.stale?'<span class="badge warn">'+t('settings.stale')+'</span>':''
      ].join('')});
      const activeSw=el('input',{type:'checkbox'}); activeSw.checked=m.active;
      if(isRouter) activeSw.disabled=true;
      activeSw.addEventListener('change',async()=>{
        try{ await DB.setModelFlag(m.id,{active:activeSw.checked}); m.active=activeSw.checked; cacheModels(); emit('models'); paint(); }
        catch(e){ toast(e.message,'err'); activeSw.checked=!activeSw.checked; }
      });
      const pinBtn=el('button',{class:'ibtn sm'+(m.pinned?' active':''),html:icon('star',15),title:t('chat.pin'),onclick:async()=>{
        try{ await DB.setModelFlag(m.id,{pinned:!m.pinned}); m.pinned=!m.pinned; cacheModels(); emit('models'); paint(); }catch(e){ toast(e.message,'err'); }
      }});
      list.append(el('div',{class:'mm-row'+(m.active?'':' off')},
        el('div',{class:'mm-info'},
          el('div',{class:'mm-name'},el('span',{text:isRouter?t('settings.router'):inf.name}),isRouter?el('span',{class:'badge acc',text:'ROUTER'}):null),
          el('div',{class:'mm-id mono',text:m.id}),
          badges),
        pinBtn,
        el('label',{class:'switch',title:t('settings.active')},activeSw,el('i',{}))
      ));
    }
    if(!rows.length) list.append(el('div',{class:'sb-empty',text:t('settings.noModels')}));
  }
  pane.append(el('h3',{text:t('settings.models')}),
    el('div',{class:'mm-toolbar'},refreshBtn,search,filterSel,counts),
    el('p',{class:'hint',style:{marginBottom:'12px'},text:t('settings.modelsHint')}),
    el('p',{class:'hint',text:t('settings.lastFetch',{t:lastAt?fmtTime(lastAt,S.settings.lang):t('settings.never')})}),
    list);
  paint();
}

function paintConnection(pane){
  const keyIn=el('input',{class:'input mono',type:'password',placeholder:t('settings.apiKeyPh'),value:getKey()});
  const revealBtn=el('button',{class:'ibtn',type:'button',html:icon('eye',16),onclick:()=>{
    keyIn.type=keyIn.type==='password'?'text':'password';
    revealBtn.innerHTML=icon(keyIn.type==='password'?'eye':'eyeOff',16);
  }});
  const result=el('div',{});
  const saveBtn=el('button',{class:'btn primary',html:icon('shield',16)+'<span>'+t('settings.validateSave')+'</span>'});
  saveBtn.addEventListener('click',async()=>{
    const k=keyIn.value.trim();
    if(!k){ setKey(''); toast(t('settings.keyRemoved'),'ok'); result.innerHTML=''; return; }
    saveBtn.disabled=true;
    const old=saveBtn.innerHTML; saveBtn.innerHTML='<span class="spinner"></span>';
    try{
      const info=await OR.validateKey(k);
      setKey(k);
      const stat=(kk,v)=>el('div',{class:'req-stat'},el('div',{class:'k',text:kk}),el('div',{class:'v',text:v==null?'—':String(v)}));
      result.innerHTML='';
      result.append(el('div',{class:'auth-ok',style:{marginTop:'14px'},text:t('settings.keyValid')}),
        el('div',{class:'req-meta-grid'},
          stat(t('settings.usage'),info.usage!=null?'$'+Number(info.usage).toFixed(4):'—'),
          stat(t('settings.limit'),info.limit!=null?'$'+info.limit:t('settings.freeTier')),
          stat(t('settings.rateLimit'),info.rate_limit?info.rate_limit.requests+' / '+info.rate_limit.interval:'—'),
          stat('Label',info.label||'—')));
      emit('settings',{});
      toast(t('settings.keyValid'),'ok');
    }catch(e){
      result.innerHTML='';
      result.append(el('div',{class:'auth-err',style:{marginTop:'14px'},text:e.message}));
    }
    saveBtn.disabled=false; saveBtn.innerHTML=old;
  });
  pane.append(el('h3',{text:t('settings.connection')}),
    el('div',{class:'field'},
      el('label',{class:'lbl',text:t('settings.apiKey')}),
      el('div',{class:'pass-wrap'},keyIn,revealBtn),
      el('div',{class:'hint',text:t('settings.apiKeyHint')})),
    el('div',{class:'row wrap'},saveBtn,
      el('button',{class:'btn ghost',text:t('settings.removeKey'),onclick:()=>{ setKey(''); keyIn.value=''; result.innerHTML=''; toast(t('settings.keyRemoved'),'ok'); emit('settings',{}); }}),
      el('a',{class:'btn soft',href:'https://openrouter.ai/settings/keys',target:'_blank',rel:'noopener',html:icon('external',14)+'<span>'+t('settings.getKey')+'</span>'})),
    result);
}

function paintPrompts(pane){
  const list=el('div',{class:'mm-list'});
  function paint(){
    list.innerHTML='';
    for(const p of S.prompts){
      list.append(el('div',{class:'mm-row'},
        el('div',{class:'mm-info'},
          el('div',{class:'mm-name',dir:'auto',text:p.title}),
          el('div',{class:'mm-id',dir:'auto',style:{fontFamily:'inherit'},text:p.body.slice(0,110)})),
        el('button',{class:'ibtn sm',html:icon('edit',15),onclick:()=>editPrompt(p,paint)}),
        el('button',{class:'ibtn sm danger',html:icon('trash',15),onclick:async()=>{
          try{ await DB.deletePrompt(p.id); S.prompts=S.prompts.filter(x=>x.id!==p.id); emit('prompts'); paint(); toast(t('toast.deleted'),'ok'); }catch(e){ toast(e.message,'err'); }
        }})
      ));
    }
    if(!S.prompts.length) list.append(el('div',{class:'sb-empty',text:t('settings.promptsHint')}));
  }
  pane.append(el('h3',{text:t('settings.prompts')}),
    el('p',{class:'hint',style:{marginBottom:'12px'},text:t('settings.promptsHint')}),
    el('button',{class:'btn primary sm',style:{marginBottom:'13px'},html:icon('plus',14)+'<span>'+t('settings.newPrompt')+'</span>',onclick:()=>editPrompt(null,paint)}),
    list);
  paint();
}
function editPrompt(p, after){
  const title=el('input',{class:'input',value:p?.title||'',autofocus:true});
  const body=el('textarea',{class:'input',rows:6}); body.value=p?.body||'';
  modal({ title:p?t('common.edit'):t('settings.newPrompt'),
    body:el('div',{},
      el('div',{class:'field'},el('label',{class:'lbl',text:t('settings.promptTitle')}),title),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('settings.promptBody')}),body)),
    actions:[{label:t('common.cancel'),class:'ghost'},
      {label:t('common.save'),class:'primary',onClick:async close=>{
        if(!title.value.trim()||!body.value.trim()) return;
        try{
          const row=await DB.savePrompt({id:p?.id,title:title.value.trim(),body:body.value});
          if(p) S.prompts=S.prompts.map(x=>x.id===row.id?row:x); else S.prompts.push(row);
          emit('prompts'); close(); if(after)after(); toast(t('settings.saved'),'ok');
        }catch(e){ toast(e.message,'err'); }
      }}]
  });
}

export function shortcutsGrid(){
  const rows=[['short.palette','Ctrl K'],['short.newChat','Alt N'],['short.sidebar','Ctrl B'],['short.copyLast','Ctrl Shift C'],['short.export','Ctrl Shift E'],['short.send','Enter'],['short.newline','Shift Enter'],['short.templates','/'],['short.close','Esc']];
  return el('div',{},
    el('h3',{text:t('short.title')}),
    el('div',{class:'short-grid'}, rows.map(([k,v])=>[el('span',{text:t(k)}),el('kbd',{text:v})])));
}
export function openShortcuts(){ modal({ title:t('short.title'), body:shortcutsGrid() }); }
