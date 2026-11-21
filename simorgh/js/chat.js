import { CFG, t, REASON_OPTS } from './config.js?v=4';
import { el, esc, dirOf, fmtTime, fmtDur, fmtNum, shortModel, stripMd, estimateTokens, readImage, readText, fileExt, download, debounce, throttle, clamp } from './utils.js?v=4';
import { icon, toast, menu, confirmDlg, lightbox, htmlPreview, copyWithToast } from './ui.js?v=4';
import { S, on, emit, getKey, activeConv, effectiveModel, modelInfo, resolveParam, buildPath, cleanBranchMap, trimContext, getDraft, setDraft, displayName, toggleSidebar, saveSettings } from './state.js?v=4';
import { DB, OR } from './api.js?v=4';
import { renderMarkdown, setMathCallback } from './markdown.js?v=4';
import { openSettings, openRequestViewer, openModelPicker, openChatSettings, exportConversation } from './settings.js?v=4';

const FENCE='```';
let root=null, scroller=null, msgsEl=null, headerEl=null, composerEl=null, inputEl=null, sendBtn=null, chipsRow=null, tokenEst=null, emptyEl=null, pill=null;
let view={path:[],byParent:{}};
let pending=[];
let stick=true;
let speakingId=null, recognition=null, slashState=null;

export function mountChat(container){
  root=container;
  root.innerHTML='';
  headerEl=el('div',{id:'chat-header'});
  scroller=el('div',{id:'scroller'});
  msgsEl=el('div',{id:'msgs'});
  emptyEl=el('div',{id:'empty',style:{display:'none'}});
  scroller.append(msgsEl,emptyEl);
  pill=el('button',{id:'scroll-pill',html:icon('arrowDown',14)+'<span>'+t('chat.scrollToBottom')+'</span>',onclick:()=>{ stick=true; scrollBottom(true); }});
  const scrollWrap=el('div',{style:{position:'relative',flex:'1',minHeight:'0',display:'flex',flexDirection:'column'}},scroller,pill);
  scroller.style.flex='1';
  composerEl=buildComposer();
  const dropOv=el('div',{id:'drop-overlay',text:t('chat.dropHere')});
  root.append(el('div',{id:'offline-bar',text:t('nav.offline')}),headerEl,scrollWrap,el('div',{id:'composer-wrap'},composerEl),dropOv);

  scroller.addEventListener('scroll',()=>{
    stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
    pill.classList.toggle('show',!stick && view.path.length>0);
  });
  let dragDepth=0;
  root.addEventListener('dragenter',e=>{ e.preventDefault(); dragDepth++; dropOv.classList.add('show'); });
  root.addEventListener('dragleave',e=>{ e.preventDefault(); if(--dragDepth<=0){ dragDepth=0; dropOv.classList.remove('show'); } });
  root.addEventListener('dragover',e=>e.preventDefault());
  root.addEventListener('drop',e=>{ e.preventDefault(); dragDepth=0; dropOv.classList.remove('show'); if(e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files); });

  scroller.addEventListener('click', onAction);

  if(!window.__simurghActionGuard){
    window.__simurghActionGuard=true;
    document.addEventListener('click', e=>{
      const tgt=e.target;
      if(!tgt || !tgt.closest) return;
      const b=tgt.closest('[data-act]');
      if(!b) return;
      const act=b.dataset.act;
      if(act!=='req' && act!=='tts') return;
      const conv=activeConv();
      const msgs=conv?(S.messages[conv.id]||[]):[];
      const m=b.dataset.mid ? msgs.find(x=>x.id===b.dataset.mid) : null;
      if(!m) return;
      e.preventDefault();
      e.stopPropagation();
      if(act==='req') openRequestViewer(m);
      else speak(m);
    }, true);
  }

  setMathCallback(()=>paintMessages());
  on('active', ()=>{ paintHeader(); paintMessages(); loadDraft(); paintChips(); updateComposerMode(); });
  on('messages', ()=>{ paintMessages(); updateComposerMode(); });
  on('generating', ()=>{ paintHeader(); updateComposerMode(); });
  on('settings', ()=>{ paintHeader(); paintMessages(); updateHint(); });
  on('models', ()=>paintHeader());
  on('open-conv', id=>openConversation(id));
  on('new-chat', ()=>newChat());
  on('delete-conv', id=>deleteConv(id));
  on('reveal-msg', ({convId,msgId})=>revealMessage(convId,msgId));
  on('insert-prompt', text=>{ inputEl.value = inputEl.value ? inputEl.value+'\n'+text : text; autosize(); inputEl.focus(); saveDraftNow(); });
  on('pick-model-global', id=>{ const c=activeConv(); if(c) setConvModel(c,id); else saveSettings({defaultModel:id}); });
  on('model-picker', opts=>openModelPicker(opts.anchor,{current:opts.current,onPick:opts.onPick}));
  paintHeader(); paintMessages(); updateHint();
}

export async function openConversation(id){
  S.activeConvId=id;
  history.replaceState(null,'','#c/'+id);
  emit('active');
  stick=true;
  if(!S.messages[id]){
    try{
      const rows=await DB.convMessages(id);
      S.messages[id]=rows;
      const conv=S.conversations.find(c=>c.id===id);
      if(conv){
        const cleaned=cleanBranchMap(conv,rows);
        if(JSON.stringify(cleaned)!==JSON.stringify(conv.branch_map||{})){
          conv.branch_map=cleaned;
          DB.updateConversation(id,{branch_map:cleaned}).catch(()=>{});
        }
      }
      emit('messages');
    }catch(e){ toast(e.message,'err'); }
  }
  scrollBottom(false);
}
export async function newChat(){
  const existing=activeConv();
  if(existing && !(S.messages[existing.id]||[]).length){ inputEl?.focus(); return; }
  try{
    const proj=S.projects.find(p=>p.id===S.projectFilter);
    const conv=await DB.createConversation({
      title:t('nav.newChat'),
      model_id: proj?.model_id || S.settings.defaultModel,
      router_mode: S.settings.stickyRouter?'sticky':'router',
      project_id: S.projectFilter||null
    });
    S.conversations.unshift(conv);
    S.messages[conv.id]=[];
    emit('conversations');
    await openConversation(conv.id);
    inputEl?.focus();
  }catch(e){ toast(e.message,'err'); }
}
async function deleteConv(id){
  if(!await confirmDlg({title:t('chat.deleteConvQ'),message:t('chat.deleteConvBody')})) return;
  try{
    stopGeneration(id);
    await DB.deleteConversation(id);
    S.conversations=S.conversations.filter(c=>c.id!==id);
    delete S.messages[id];
    if(S.activeConvId===id){
      S.activeConvId=S.conversations[0]?.id||null;
      if(S.activeConvId) openConversation(S.activeConvId); else { history.replaceState(null,'','#'); emit('active'); }
    }
    emit('conversations'); toast(t('toast.deleted'),'ok');
  }catch(e){ toast(e.message,'err'); }
}
async function ensureConv(){
  let conv=activeConv();
  if(!conv){
    conv=await DB.createConversation({ title:t('nav.newChat'), model_id:S.settings.defaultModel, router_mode:S.settings.stickyRouter?'sticky':'router', project_id:S.projectFilter||null });
    S.conversations.unshift(conv); S.messages[conv.id]=[];
    S.activeConvId=conv.id;
    history.replaceState(null,'','#c/'+conv.id);
    emit('conversations');
  }
  return conv;
}

function paintHeader(){
  if(!headerEl) return;
  headerEl.innerHTML='';
  const conv=activeConv();
  const menuBtn=el('button',{class:'ibtn',html:icon('menu',18),title:t('nav.collapse'),onclick:()=>toggleSidebar()});
  headerEl.append(menuBtn);
  if(!conv){
    headerEl.append(el('span',{class:'logo-name',text:t('app.name')}),el('div',{class:'grow'}));
    return;
  }
  const title=el('button',{id:'chat-title',dir:'auto',text:conv.title,title:t('chat.rename'),onclick:()=>{
    const inp=el('input',{id:'chat-title-input',class:'input',value:conv.title,dir:'auto'});
    title.replaceWith(inp); inp.focus(); inp.select();
    const done=async save=>{
      if(save&&inp.value.trim()&&inp.value.trim()!==conv.title){
        try{ const row=await DB.updateConversation(conv.id,{title:inp.value.trim()}); Object.assign(conv,row); emit('conversations'); }catch(e){ toast(e.message,'err'); }
      }
      paintHeader();
    };
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter')done(true); if(e.key==='Escape')done(false); });
    inp.addEventListener('blur',()=>done(true));
  }});
  const eff=effectiveModel(conv);
  const isRouterSend = conv.model_id===CFG.ROUTER_ID && conv.router_mode==='router';
  const locked = conv.model_id===CFG.ROUTER_ID && conv.locked_model && conv.router_mode!=='router';
  const modelChip=el('button',{class:'chip model-chip',title:eff,
    html:icon(isRouterSend?'zap':'cpu',14)+'<span class="mono">'+esc(isRouterSend?'openrouter/free':shortModel(eff))+'</span>'+(locked?'<span class="badge acc hide-sm">'+t('settings.router')+'</span>':'')+icon('chevD',12),
    onclick:e=>openModelPicker(e.currentTarget,{current:conv.model_id===CFG.ROUTER_ID&&!conv.locked_model?CFG.ROUTER_ID:eff,onPick:id=>setConvModel(conv,id)})});
  const modeChip=el('button',{class:'chip hide-sm'+(conv.router_mode==='router'?' on':''),
    title:t(conv.router_mode==='router'?'chat.routerHint':'chat.stickyHint'),
    html:icon('repeat',13)+'<span>'+t(conv.router_mode==='router'?'chat.alwaysRouter':'chat.sticky')+'</span>',
    onclick:async()=>{
      const nm=conv.router_mode==='router'?'sticky':'router';
      try{ const row=await DB.updateConversation(conv.id,{router_mode:nm,...(nm==='router'?{locked_model:null}:{})}); Object.assign(conv,row); emit('conversations'); paintHeader(); }catch(e){ toast(e.message,'err'); }
    }});
  const gen=S.generating[conv.id];
  headerEl.append(title,
    el('div',{class:'hd-chips'},modelChip, conv.model_id===CFG.ROUTER_ID?modeChip:null, gen?el('span',{class:'spinner'}):null),
    el('button',{class:'ibtn',html:icon('sliders',17),title:t('chat.chatSettings'),onclick:()=>openChatSettings(conv)}),
    el('button',{class:'ibtn',html:icon('more',17),onclick:e=>{
      menu(e.currentTarget,[
        {label:t('chat.rename'),icon:'edit',onClick:()=>title.click()},
        {label:t('chat.aiTitle'),icon:'sparkles',onClick:()=>aiTitle(conv)},
        {label:conv.pinned?t('chat.unpin'):t('chat.pin'),icon:'pin',onClick:async()=>{ try{ const row=await DB.updateConversation(conv.id,{pinned:!conv.pinned}); Object.assign(conv,row); emit('conversations'); }catch(err){ toast(err.message,'err'); } }},
        {sep:true},
        {label:t('chat.exportMd'),icon:'download',onClick:()=>exportConversation(conv,'md')},
        {label:t('chat.exportJson'),icon:'download',onClick:()=>exportConversation(conv,'json')},
        {label:t('chat.exportTxt'),icon:'download',onClick:()=>exportConversation(conv,'txt')},
        {sep:true},
        {label:t('chat.delete'),icon:'trash',danger:true,onClick:()=>deleteConv(conv.id)}
      ]);
    }})
  );
}
async function setConvModel(conv,id){
  try{
    const row=await DB.updateConversation(conv.id,{ model_id:id, locked_model:null });
    Object.assign(conv,row);
    emit('conversations'); paintHeader();
  }catch(e){ toast(e.message,'err'); }
}
async function aiTitle(conv){
  const key=getKey(); if(!key){ toast(t('toast.keyNeeded'),'warn'); return; }
  const msgs=S.messages[conv.id]||[];
  const first=msgs.find(m=>m.role==='user');
  if(!first){ return; }
  toast(t('common.loading'),'info',1500);
  try{
    const r=await OR.complete({key,body:{ model:effectiveModel(conv), max_tokens:600,
      messages:[{role:'system',content:'Generate a concise chat title (3-6 words) in the same language as the user message. Output only the title, no quotes.'},
                {role:'user',content:first.content.slice(0,1200)}]}});
    let title=(r.content||'').trim().replace(/^["'«»]+|["'«»]+$/g,'').split('\n')[0].slice(0,60);
    if(!title) throw new Error('empty');
    const row=await DB.updateConversation(conv.id,{title});
    Object.assign(conv,row); emit('conversations'); paintHeader(); toast(t('settings.saved'),'ok');
  }catch(e){ toast(e.message,'err'); }
}

function paintMessages(){
  if(!msgsEl) return;
  const conv=activeConv();
  const msgs=conv?(S.messages[conv.id]||[]):[];
  view=conv?buildPath(conv,msgs):{path:[],byParent:{}};
  msgsEl.innerHTML='';
  const hasMsgs=view.path.length>0;
  emptyEl.style.display=hasMsgs?'none':'flex';
  msgsEl.style.display=hasMsgs?'flex':'none';
  if(!hasMsgs){ paintEmpty(); return; }
  for(const m of view.path) msgsEl.append(messageEl(m,conv));
  if(stick) scrollBottom(false);
}
function paintEmpty(){
  emptyEl.innerHTML='';
  const suggestions=[['sparkles','chat.suggest1'],['book','chat.suggest2'],['code','chat.suggest3'],['globe','chat.suggest4']];
  emptyEl.append(
    el('div',{class:'hero-logo',html:icon('logo',44)}),
    el('h1',{text:t('chat.emptyTitle')}),
    el('p',{class:'sub',text:t('chat.emptySub')}),
    el('div',{class:'sug-grid'}, suggestions.map(([ic,k],i)=>
      el('button',{class:'sug',style:{animationDelay:(i*0.07)+'s'},dataset:{suggest:t(k)},dir:'auto'},
        el('div',{class:'si',html:icon(ic,17)}),
        el('span',{text:t(k)})))),
    !getKey()?el('button',{class:'key-cta',html:icon('key',16)+'<span>'+t('chat.setKey')+'</span>',onclick:()=>openSettings('connection')}):null
  );
}

function messageEl(m,conv){
  const isUser=m.role==='user';
  const gen=S.generating[conv.id];
  const streaming=gen&&gen.msgId===m.id;
  const sibs=view.byParent[m.parent_id||'root']||[m];
  const sibIx=sibs.findIndex(x=>x.id===m.id);
  const meta=m.meta_json||{};
  const name=isUser?t('chat.you'):(m.model?shortModel(m.model):shortModel(effectiveModel(conv)));

  const head=el('div',{class:'msg-head'},
    el('span',{class:'msg-name',dir:'auto',text:name}),
    !isUser&&meta.routed_from?el('span',{class:'badge acc',title:meta.routed_from,text:t('chat.viaRouter')}):null,
    el('span',{class:'msg-time',text:fmtTime(m.created_at,S.settings.lang)}),
    sibs.length>1?el('span',{class:'ver-switch',title:t('chat.version',{i:sibIx+1,n:sibs.length})},
      el('button',{class:'ibtn',dataset:{act:'ver-prev',mid:m.id},disabled:sibIx<=0,html:icon('chevL',13)}),
      el('span',{text:(sibIx+1)+'/'+sibs.length}),
      el('button',{class:'ibtn',dataset:{act:'ver-next',mid:m.id},disabled:sibIx>=sibs.length-1,html:icon('chevR',13)})):null,
    !isUser&&!streaming&&meta.usage?el('span',{class:'msg-stats',
      text:fmtNum(meta.usage.completion_tokens)+' tok'+(meta.tps?' · '+meta.tps+'/s':'')+(meta.latency_ms?' · '+fmtDur(meta.latency_ms):'')}):null,
    m.status==='stopped'?el('span',{class:'badge warn',text:t('chat.stopped')}):null,
    meta.edited?el('span',{class:'badge',text:t('chat.edit')}):null,
    meta.continued?el('span',{class:'badge',text:t('chat.continue')}):null
  );

  const body=el('div',{class:'msg-body'});
  if(isUser && m.attachments?.length){
    const grid=el('div',{class:'att-grid'});
    for(const a of m.attachments){
      if(a.type==='image') grid.append(el('img',{class:'att-img',src:a.dataUrl,alt:a.name,dataset:{act:'img'},loading:'lazy'}));
      else grid.append(el('span',{class:'att-file',html:icon('paperclip',13)+'<span dir="auto">'+esc(a.name)+'</span>'}));
    }
    body.append(grid);
  }
  if(!isUser && S.settings.showReasoning && (m.reasoning||streaming)){
    const thinking=streaming && !m.content;
    const rMs=meta.reasoning_ms;
    body.append(el('div',{class:'reasoning'+((streaming||!m.content)?' open':'')},
      el('button',{class:'reason-head',dataset:{act:'reason-toggle',mid:m.id}},
        el('span',{html:icon('brain',15)}),
        el('span',{class:'reason-label'+(thinking?' reason-thinking':''),text:thinking?t('chat.thinking'):(rMs?t('chat.thoughtFor',{s:Math.max(1,Math.round(rMs/1000))}):t('chat.reasoning'))}),
        el('span',{class:'chev',html:icon('chevD',14)})),
      el('div',{class:'reason-body md',dir:'auto',html:m.reasoning?renderMarkdown(m.reasoning,streaming):''})));
  }
  const content=el('div',{class:'msg-content md',dir:'auto'});
  if(m.content) content.innerHTML=renderMarkdown(m.content,streaming);
  if(streaming) content.append(el('span',{class:'cursor'}));
  body.append(content);
  if(m.status==='error'&&m.error){
    body.append(el('div',{class:'err-box'},
      el('div',{class:'err-t',html:icon('warn',15)+'<span>'+t('toast.error')+'</span>'}),
      el('div',{class:'err-m',text:m.error}),
      el('div',{class:'row wrap'},
        el('button',{class:'btn soft sm',dataset:{act:'retry',mid:m.id},html:icon('refresh',13)+'<span>'+t('chat.retry')+'</span>'}),
        /404|no longer|not found|unavailable/i.test(m.error)?el('button',{class:'btn soft sm',dataset:{act:'use-router',mid:m.id},html:icon('zap',13)+'<span>'+t('chat.useRouter')+'</span>'}):null,
        /401|invalid.*key|no auth/i.test(m.error)?el('button',{class:'btn soft sm',html:icon('key',13)+'<span>'+t('settings.connection')+'</span>',onclick:()=>openSettings('connection')}):null)));
  }
  const acts=el('div',{class:'msg-actions'});
  const ib=(act,ic,label,on)=>el('button',{class:'ibtn sm'+(on?' on':''),dataset:{act,mid:m.id},title:label,'aria-label':label,html:icon(ic,15)});
  if(!streaming){
    acts.append(ib('copy','copy',t('chat.copy')));
    acts.append(ib('edit','edit',t('chat.edit')));
    if(!isUser){
      acts.append(ib('regen','refresh',t('chat.regenerate')));
      if(m.status==='stopped'||meta.finish_reason==='length')
        acts.append(el('button',{class:'btn soft sm',dataset:{act:'continue',mid:m.id},html:icon('play',13)+'<span>'+t('chat.continue')+'</span>'}));
      acts.append(ib('thumb-up','thumbUp','👍',m.feedback===1));
      acts.append(ib('thumb-down','thumbDown','👎',m.feedback===-1));
      acts.append(ib('tts',speakingId===m.id?'stop':'play',t(speakingId===m.id?'chat.stopSpeak':'chat.speak'),speakingId===m.id));
      acts.append(el('button',{class:'btn soft sm',dataset:{act:'req',mid:m.id},title:t('chat.viewRequest'),
        html:icon('terminal',13)+'<span>'+t('chat.viewRequest')+'</span>'}));
    }
    acts.append(ib('fork','fork',t('chat.fork')));
    acts.append(ib('del','trash',t('chat.delete')));
  } else {
    acts.append(el('button',{class:'btn danger sm',dataset:{act:'stop',mid:m.id},html:icon('stop',13)+'<span>'+t('chat.stop')+'</span>'}));
    acts.append(el('button',{class:'btn soft sm',dataset:{act:'req',mid:m.id},html:icon('terminal',13)+'<span>'+t('chat.viewRequest')+'</span>'}));
  }
  body.append(acts);

  return el('div',{class:'msg '+m.role,dataset:{mid:m.id}},
    el('div',{class:'msg-ava',text:isUser?(displayName()[0]||'?').toUpperCase():''},!isUser?el('span',{html:icon('sparkles',16)}):null),
    el('div',{style:{minWidth:'0'}},head,body));
}

async function onAction(e){
  const btn=e.target.closest('[data-act],[data-suggest]');
  if(!btn) return;
  const conv=activeConv();
  if(btn.dataset.suggest){ inputEl.value=btn.dataset.suggest; autosize(); inputEl.focus(); saveDraftNow(); return; }
  const act=btn.dataset.act;
  const mid=btn.dataset.mid;
  const msgEl=btn.closest('.msg');
  const msgs=conv?(S.messages[conv.id]||[]):[];
  const m=mid?msgs.find(x=>x.id===mid):null;

  if(act==='code-copy'){ copyWithToast(btn.closest('.codeblock').querySelector('code').textContent); return; }
  if(act==='code-wrap'){ btn.closest('.codeblock').classList.toggle('wrap'); return; }
  if(act==='code-preview'){ htmlPreview(btn.closest('.codeblock').querySelector('code').textContent); return; }
  if(act==='code-dl'){ const cb=btn.closest('.codeblock'); download('code.'+fileExt(btn.dataset.lang), cb.querySelector('code').textContent); return; }
  if(act==='img'){ lightbox(btn.src||btn.getAttribute('src')); return; }
  if(act==='req'||act==='tts') return;
  if(!conv||!m) return;

  switch(act){
    case 'copy': copyWithToast(m.content||''); break;
    case 'reason-toggle': {
      const r=btn.closest('.reasoning'); r.classList.toggle('open'); r.dataset.pinned='1'; break;
    }
    case 'ver-prev': case 'ver-next': {
      const sibs=view.byParent[m.parent_id||'root']||[];
      const ix=sibs.findIndex(x=>x.id===m.id);
      const nx=act==='ver-prev'?ix-1:ix+1;
      if(nx>=0&&nx<sibs.length) await setBranch(conv,m.parent_id||'root',sibs[nx].id);
      break;
    }
    case 'edit': startEdit(m,conv,msgEl); break;
    case 'regen': stopGeneration(conv.id); await regenerate(m,conv); break;
    case 'continue': await continueMsg(m,conv); break;
    case 'retry': await retryMsg(m,conv); break;
    case 'use-router': {
      try{ const row=await DB.updateConversation(conv.id,{model_id:CFG.ROUTER_ID,locked_model:null}); Object.assign(conv,row); emit('conversations'); paintHeader(); await retryMsg(m,conv); }catch(err){ toast(err.message,'err'); }
      break;
    }
    case 'stop': stopGeneration(conv.id); break;
    case 'fork': await forkFrom(m,conv); break;
    case 'del': {
      if(await confirmDlg({title:t('chat.deleteMsgQ'),message:t('chat.deleteMsgBody')})){
        try{
          await DB.deleteMessage(m.id);
          const gone=new Set([m.id]);
          let changed=true;
          while(changed){ changed=false; for(const mm of S.messages[conv.id]){ if(mm.parent_id&&gone.has(mm.parent_id)&&!gone.has(mm.id)){ gone.add(mm.id); changed=true; } } }
          S.messages[conv.id]=S.messages[conv.id].filter(x=>!gone.has(x.id));
          conv.branch_map=cleanBranchMap(conv,S.messages[conv.id]);
          DB.updateConversation(conv.id,{branch_map:conv.branch_map}).catch(()=>{});
          emit('messages');
        }catch(err){ toast(err.message,'err'); }
      }
      break;
    }
    case 'thumb-up': case 'thumb-down': {
      const val=act==='thumb-up'?1:-1;
      const nv=m.feedback===val?0:val;
      try{ const row=await DB.updateMessage(m.id,{feedback:nv}); Object.assign(m,row); emit('messages'); }catch(err){ toast(err.message,'err'); }
      break;
    }
  }
}

async function setBranch(conv,key,msgId){
  conv.branch_map={...(conv.branch_map||{}),[key]:msgId};
  emit('messages');
  try{ const row=await DB.updateConversation(conv.id,{branch_map:conv.branch_map}); conv.branch_map=row.branch_map; }
  catch(e){ toast(e.message,'err'); }
}
function startEdit(m,conv,msgEl){
  const contentEl=msgEl.querySelector('.msg-content');
  const actsEl=msgEl.querySelector('.msg-actions');
  const ta=el('textarea',{class:'edit-area',dir:'auto'}); ta.value=m.content||'';
  const isUser=m.role==='user';
  const btns=el('div',{class:'edit-btns'},
    el('button',{class:'btn primary sm',text:isUser?t('chat.saveSend'):t('chat.save'),onclick:async()=>{
      const val=ta.value.trim();
      if(!val) return;
      try{
        const sib=await DB.createMessage({
          conversation_id:conv.id, parent_id:m.parent_id, role:m.role, content:val,
          attachments:isUser?(m.attachments||[]):[],
          model:isUser?null:m.model, status:'complete',
          request_json:isUser?null:m.request_json, meta_json:isUser?null:{...(m.meta_json||{}),edited:true}
        });
        S.messages[conv.id].push(sib);
        await setBranch(conv,m.parent_id||'root',sib.id);
        if(isUser) await generateFor(conv,sib);
      }catch(err){ toast(err.message,'err'); }
    }}),
    el('button',{class:'btn ghost sm',text:t('chat.cancel'),onclick:()=>paintMessages()})
  );
  contentEl.replaceWith(ta);
  if(actsEl) actsEl.style.display='none';
  ta.after(btns);
  ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
  ta.addEventListener('keydown',e=>{ if(e.key==='Escape') paintMessages(); });
}
async function regenerate(m,conv){
  const parent=(S.messages[conv.id]||[]).find(x=>x.id===m.parent_id);
  if(!parent){ toast(t('toast.error'),'err'); return; }
  await generateFor(conv,parent);
}
async function forkFrom(m,conv){
  try{
    const ix=view.path.findIndex(x=>x.id===m.id);
    const chain=view.path.slice(0,ix+1);
    const nc=await DB.createConversation({
      title:t('chat.forkTitle',{t:conv.title}).slice(0,80),
      model_id:conv.model_id, locked_model:conv.locked_model, router_mode:conv.router_mode,
      system_prompt:conv.system_prompt, params:conv.params||{}, project_id:conv.project_id
    });
    let prev=null; const rows=[];
    for(const mm of chain){
      const row=await DB.createMessage({
        conversation_id:nc.id, parent_id:prev, role:mm.role, content:mm.content, reasoning:mm.reasoning,
        model:mm.model, status:mm.status==='streaming'?'stopped':mm.status, error:mm.error,
        request_json:mm.request_json, meta_json:mm.meta_json, attachments:mm.attachments||[], feedback:mm.feedback||0
      });
      rows.push(row); prev=row.id;
    }
    S.messages[nc.id]=rows;
    S.conversations.unshift(nc);
    emit('conversations');
    await openConversation(nc.id);
    toast(t('chat.forked'),'ok');
  }catch(e){ toast(e.message,'err'); }
}
export async function revealMessage(convId,msgId){
  await openConversation(convId);
  const conv=S.conversations.find(c=>c.id===convId);
  const msgs=S.messages[convId]||[];
  const target=msgs.find(m=>m.id===msgId);
  if(!conv||!target) return;
  const map={...(conv.branch_map||{})};
  let cur=target;
  while(cur){ map[cur.parent_id||'root']=cur.id; cur=msgs.find(m=>m.id===cur.parent_id); }
  conv.branch_map=map;
  DB.updateConversation(convId,{branch_map:map}).catch(()=>{});
  emit('messages');
  setTimeout(()=>{
    const n=msgsEl.querySelector('[data-mid="'+msgId+'"]');
    if(n){ stick=false; n.scrollIntoView({block:'center',behavior:'smooth'}); n.classList.add('flash'); setTimeout(()=>n.classList.remove('flash'),1900); }
  },80);
}

function composeContext(conv,uptoId){
  const msgs=S.messages[conv.id]||[];
  const {path}=buildPath(conv,msgs);
  let cut=path.length;
  if(uptoId){ const ix=path.findIndex(m=>m.id===uptoId); if(ix>=0) cut=ix+1; }
  const use=path.slice(0,cut).filter(m=>(m.content&&m.content.trim())||(m.attachments&&m.attachments.length));
  const proj=S.projects.find(p=>p.id===conv.project_id);
  const sys=[S.settings.systemPrompt,proj?.instructions,conv.system_prompt].filter(x=>x&&x.trim()).join('\n\n');
  const eff=effectiveModel(conv);
  const info=modelInfo(eff);
  const vision=info?(info.input_modalities||['text']).includes('image'):true;
  const out=[];
  if(sys) out.push({role:'system',content:sys});
  for(const m of use){
    if(m.role==='user'){
      const imgs=(m.attachments||[]).filter(a=>a.type==='image');
      const txts=(m.attachments||[]).filter(a=>a.type==='text');
      let text=m.content||'';
      for(const tx of txts) text+='\n\n[Attached file: '+tx.name+']\n'+FENCE+'\n'+tx.text+'\n'+FENCE;
      if(imgs.length&&vision){
        const parts=[];
        if(text.trim()) parts.push({type:'text',text});
        for(const im of imgs) parts.push({type:'image_url',image_url:{url:im.dataUrl}});
        out.push({role:'user',content:parts});
      } else {
        if(imgs.length) text+='\n\n['+imgs.length+' image attachment(s) omitted — the selected model has no vision support]';
        out.push({role:'user',content:text});
      }
    } else if(m.role==='assistant'){
      if(m.status==='error'&&!m.content) continue;
      out.push({role:'assistant',content:m.content||''});
    }
  }
  return out;
}
function buildBody(conv,ctx){
  const eff=effectiveModel(conv);
  const info=modelInfo(eff);
  const body={ model:eff, messages:ctx, stream:true, usage:{include:true} };
  const temp=resolveParam(conv,'temperature'); if(temp!=null) body.temperature=temp;
  const topP=resolveParam(conv,'topP'); if(topP!=null) body.top_p=topP;
  const maxT=resolveParam(conv,'maxTokens'); if(maxT!=null) body.max_tokens=maxT;
  const r=resolveParam(conv,'reasoning');
  const supported=!info||info.supports_reasoning;
  if(supported){
    if(r==='off') body.reasoning={enabled:false};
    else if(['low','medium','high'].includes(r)) body.reasoning={enabled:true,effort:r};
  }
  return body;
}
async function generateFor(conv,parentUserMsg){
  const key=getKey();
  if(!key){ toast(t('toast.keyNeeded'),'warn'); openSettings('connection'); return; }
  try{
    const am=await DB.createMessage({ conversation_id:conv.id, parent_id:parentUserMsg.id, role:'assistant', content:'', status:'streaming' });
    S.messages[conv.id].push(am);
    await setBranch(conv,parentUserMsg.id,am.id);
    const ctx=trimContext(composeContext(conv,parentUserMsg.id),effectiveModel(conv),resolveParam(conv,'maxTokens'),S.settings.contextLimit);
    await runStream(conv,am,buildBody(conv,ctx),{mode:'fresh'});
  }catch(e){ toast(e.message,'err'); }
}
async function continueMsg(m,conv){
  const key=getKey(); if(!key){ toast(t('toast.keyNeeded'),'warn'); return; }
  stopGeneration(conv.id);
  const ctx=trimContext(composeContext(conv,m.id),effectiveModel(conv),resolveParam(conv,'maxTokens'),S.settings.contextLimit);
  ctx.push({role:'user',content:t('chat.continueInstr')});
  await runStream(conv,m,buildBody(conv,ctx),{mode:'continue'});
}
async function retryMsg(m,conv){
  stopGeneration(conv.id);
  const key=getKey(); if(!key){ toast(t('toast.keyNeeded'),'warn'); return; }
  const ctx=trimContext(composeContext(conv,m.parent_id),effectiveModel(conv),resolveParam(conv,'maxTokens'),S.settings.contextLimit);
  m.content=''; m.reasoning=''; m.error=null; m.status='streaming';
  emit('messages');
  await runStream(conv,m,buildBody(conv,ctx),{mode:'fresh'});
}

async function runStream(conv,m,body,{mode}){
  const key=getKey();
  const ctrl=new AbortController();
  const startedAt=Date.now();
  S.generating[conv.id]={ctrl,msgId:m.id,startedAt};
  emit('generating');
  const req={ url:CFG.OR_BASE+'/chat/completions', method:'POST',
    headers:{...OR.headers(key),Authorization:'Bearer {{OPENROUTER_KEY}}'},
    body, sent_at:new Date().toISOString() };
  m.request_json=req; m.status='streaming'; m.error=null;
  DB.updateMessage(m.id,{request_json:req,status:'streaming',error:null}).catch(()=>{});
  emit('messages');

  let content=mode==='continue'?(m.content||''):'';
  let reasoning=mode==='continue'?(m.reasoning||''):'';
  let reasonStart=null, firstContentAt=null, lastSave=0;
  const baseLen=content.length;

  const paint=throttle(()=>{
    const n=msgsEl.querySelector('[data-mid="'+m.id+'"]');
    if(!n) return;
    const cEl=n.querySelector('.msg-content');
    if(cEl){ cEl.innerHTML=renderMarkdown(content,true); cEl.append(el('span',{class:'cursor'})); }
    let rEl=n.querySelector('.reasoning');
    if(reasoning&&S.settings.showReasoning){
      if(!rEl){
        rEl=el('div',{class:'reasoning open'},
          el('button',{class:'reason-head',dataset:{act:'reason-toggle',mid:m.id}},
            el('span',{html:icon('brain',15)}),
            el('span',{class:'reason-label reason-thinking',text:t('chat.thinking')}),
            el('span',{class:'chev',html:icon('chevD',14)})),
          el('div',{class:'reason-body md',dir:'auto'}));
        cEl.before(rEl);
      }
      const rb=rEl.querySelector('.reason-body');
      rb.innerHTML=renderMarkdown(reasoning,true);
      rb.scrollTop=rb.scrollHeight;
      if(content&&!rEl.dataset.pinned){ rEl.classList.remove('open'); const lb=rEl.querySelector('.reason-label'); lb.classList.remove('reason-thinking'); lb.textContent=t('chat.thinking'); }
    }
    if(stick) scrollBottom(false);
  },60);
  const save=()=>{
    lastSave=Date.now();
    DB.updateMessage(m.id,{content,reasoning}).catch(()=>{});
  };

  let result=null, err=null, aborted=false;
  try{
    result=await OR.streamChat({
      key, body, signal:ctrl.signal,
      onReasoning:tx=>{ if(!reasonStart)reasonStart=Date.now(); reasoning+=tx; paint(); if(Date.now()-lastSave>2000)save(); },
      onContent:tx=>{ if(!firstContentAt)firstContentAt=Date.now(); content+=tx; paint(); if(Date.now()-lastSave>2000)save(); }
    });
  }catch(e){
    if(e.name==='AbortError') aborted=true; else err=e;
  }
  const endedAt=Date.now();
  delete S.generating[conv.id];

  const meta={...(m.meta_json||{})};
  if(mode==='continue') meta.continued=true;
  if(result){
    meta.provider=result.provider; meta.finish_reason=result.finish; meta.usage=result.usage; meta.model=result.model;
    if(body.model!==result.model) meta.routed_from=body.model; else delete meta.routed_from;
  }
  meta.latency_ms=endedAt-startedAt;
  const outTok=result?.usage?.completion_tokens || estimateTokens(content.slice(baseLen));
  meta.tps=outTok?Math.round(outTok/((endedAt-startedAt)/1000)*10)/10:null;
  if(reasonStart) meta.reasoning_ms=(firstContentAt||endedAt)-reasonStart;

  m.content=content; m.reasoning=reasoning; m.meta_json=meta;
  m.status=aborted?'stopped':err?'error':'complete';
  m.error=err?(err.message+(err.status?' (HTTP '+err.status+')':'')+(err.retryAfter?' · retry after '+err.retryAfter+'s':'')):null;
  if(result) m.model=result.model;
  if(!content&&!reasoning&&err) m.status='error';

  try{
    const row=await DB.updateMessage(m.id,{content:m.content,reasoning:m.reasoning,status:m.status,error:m.error,model:m.model,meta_json:meta});
    Object.assign(m,row);
  }catch(e){ console.warn(e); }

  if(result&&conv.model_id===CFG.ROUTER_ID&&conv.router_mode!=='router'&&!conv.locked_model&&result.model&&result.model!==CFG.ROUTER_ID){
    try{
      const row=await DB.updateConversation(conv.id,{locked_model:result.model});
      Object.assign(conv,row);
      toast(t('chat.routedTo',{m:shortModel(result.model)}),'info');
    }catch(e){ console.warn(e); }
  } else {
    DB.updateConversation(conv.id,{}).catch(()=>{});
  }
  if(mode==='fresh'&&S.settings.autoTitle&&conv.title===t('nav.newChat')){
    const first=(S.messages[conv.id]||[]).find(x=>x.role==='user');
    if(first){
      let title=(first.content||'').replace(/\s+/g,' ').trim().slice(0,60)||t('chat.imageChat');
      if((first.content||'').length>60) title+='…';
      try{ const row=await DB.updateConversation(conv.id,{title}); Object.assign(conv,row); }catch{}
    }
  }
  const ix=S.conversations.findIndex(c=>c.id===conv.id);
  if(ix>0){ const [c]=S.conversations.splice(ix,1); c.updated_at=new Date().toISOString(); S.conversations.unshift(c); }
  emit('conversations'); emit('generating');
  if(S.activeConvId===conv.id){ paintHeader(); emit('messages'); if(stick)scrollBottom(false); }
  if(aborted) toast(t('chat.genStopped'),'info',1800);
}
export function stopGeneration(convId){
  const g=S.generating[convId||S.activeConvId];
  if(g) g.ctrl.abort();
}

function buildComposer(){
  inputEl=el('textarea',{id:'input',rows:1,dir:'auto',placeholder:t('chat.placeholder'),'aria-label':t('chat.placeholder')});
  chipsRow=el('div',{id:'chips-row'});
  tokenEst=el('span',{id:'token-est'});
  sendBtn=el('button',{id:'send-btn',title:t('chat.send'),html:icon('send',18)});
  const fileIn=el('input',{type:'file',multiple:true,accept:'image/*,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh',style:{display:'none'},
    onchange:e=>{ handleFiles(e.target.files); e.target.value=''; }});
  const attachBtn=el('button',{class:'ibtn',title:t('chat.attach'),html:icon('paperclip',18),onclick:()=>fileIn.click()});
  const micBtn=el('button',{class:'ibtn',title:t('chat.mic'),html:icon('mic',18),onclick:()=>startMic(micBtn)});
  const tplBtn=el('button',{class:'ibtn',title:t('chat.templates'),html:icon('book',18),onclick:()=>{ if(slashState) closeSlash(); else openSlash('button'); }});
  const reasonBtn=el('button',{class:'ibtn',title:t('chat.reasoning'),html:icon('brain',18),onclick:e=>{
    const conv=activeConv();
    const cur=conv?resolveParam(conv,'reasoning'):S.settings.reasoning;
    menu(e.currentTarget,REASON_OPTS.map(r=>({label:t('settings.'+r),checked:cur===r,onClick:async()=>{
      if(conv){ try{ const row=await DB.updateConversation(conv.id,{params:{...(conv.params||{}),reasoning:r}}); Object.assign(conv,row); paintReasonBtn(); }catch(err){ toast(err.message,'err'); } }
      else saveSettings({reasoning:r});
    }})));
  }});
  reasonBtn.id='reason-btn';
  const anchor=el('div',{id:'composer-anchor'});
  const box=el('div',{id:'composer'},
    anchor,chipsRow,inputEl,fileIn,
    el('div',{class:'comp-bar'},attachBtn,tplBtn,reasonBtn,micBtn,el('span',{class:'spacer'}),tokenEst,sendBtn)
  );
  const hint=el('div',{id:'comp-hint'});
  const wrap=el('div',{},box,hint);

  sendBtn.addEventListener('click',()=>{
    if(S.generating[S.activeConvId]) stopGeneration(S.activeConvId);
    else sendCurrent();
  });
  inputEl.addEventListener('input',()=>{ autosize(); updateTokenEst(); saveDraftNow(); maybeSlash(); });
  inputEl.addEventListener('keydown',e=>{
    if(slashState){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); slashState.move(e.key==='ArrowDown'?1:-1); return; }
      if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); slashState.pick(); return; }
      if(e.key==='Escape'){ e.preventDefault(); closeSlash(); return; }
    }
    if(e.key==='Enter'&&!e.shiftKey&&S.settings.enterSend&&!e.isComposing){
      e.preventDefault(); sendCurrent();
    }
  });
  inputEl.addEventListener('paste',e=>{
    const files=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));
    if(files.length){ e.preventDefault(); handleFiles(files); }
  });
  return wrap;
}
function updateHint(){
  const h=document.getElementById('comp-hint');
  if(h) h.textContent=S.settings.enterSend?t('chat.hint'):t('chat.hintClick');
  if(inputEl) inputEl.placeholder=t('chat.placeholder');
  paintReasonBtn();
}
function paintReasonBtn(){
  const b=document.getElementById('reason-btn');
  if(!b) return;
  const conv=activeConv();
  const r=conv?resolveParam(conv,'reasoning'):S.settings.reasoning;
  b.classList.toggle('active',r!=='off');
  b.title=t('chat.reasoning')+': '+t('settings.'+r);
}
function updateComposerMode(){
  if(!sendBtn) return;
  const gen=S.generating[S.activeConvId];
  sendBtn.classList.toggle('stop',!!gen);
  sendBtn.innerHTML=icon(gen?'stop':'send',18);
  sendBtn.title=gen?t('chat.stop'):t('chat.send');
  sendBtn.disabled=false;
  paintReasonBtn();
}
function autosize(){
  inputEl.style.height='auto';
  inputEl.style.height=Math.min(220,inputEl.scrollHeight)+'px';
}
function updateTokenEst(){
  const n=estimateTokens(inputEl.value);
  tokenEst.textContent=n?('~'+n+' tok'):'';
}
const saveDraftNow=debounce(()=>{ if(S.activeConvId) setDraft(S.activeConvId,inputEl.value); },400);
function loadDraft(){
  if(!inputEl) return;
  inputEl.value=S.activeConvId?getDraft(S.activeConvId):'';
  pending=[]; autosize(); updateTokenEst();
}
async function sendCurrent(){
  const text=inputEl.value.trim();
  if(!text&&!pending.length) return;
  if(S.generating[S.activeConvId]) return;
  if(!getKey()){ toast(t('toast.keyNeeded'),'warn'); openSettings('connection'); return; }
  const conv=await ensureConv();
  const msgs=S.messages[conv.id]||(S.messages[conv.id]=[]);
  const {path}=buildPath(conv,msgs);
  const leaf=path.length?path[path.length-1].id:null;
  try{
    const um=await DB.createMessage({ conversation_id:conv.id, parent_id:leaf, role:'user', content:text, attachments:pending });
    msgs.push(um);
    if(leaf) await setBranch(conv,leaf,um.id);
    inputEl.value=''; pending=[]; setDraft(conv.id,'');
    autosize(); updateTokenEst(); paintChips(); closeSlash();
    stick=true; emit('messages'); scrollBottom(false);
    await generateFor(conv,um);
  }catch(e){ toast(e.message,'err'); }
}

async function handleFiles(files){
  for(const f of [...files]){
    if(pending.length>=CFG.MAX_FILES){ toast(t('chat.maxFiles',{n:CFG.MAX_FILES}),'warn'); break; }
    if(f.type.startsWith('image/')){
      if(f.size>CFG.MAX_IMG_MB*1048576){ toast(t('chat.tooBig',{n:f.name,m:CFG.MAX_IMG_MB+'MB'}),'warn'); continue; }
      const dataUrl=await readImage(f);
      pending.push({type:'image',name:f.name,dataUrl});
    } else {
      if(f.size>CFG.MAX_TXT_KB*1024){ toast(t('chat.tooBig',{n:f.name,m:CFG.MAX_TXT_KB+'KB'}),'warn'); continue; }
      const text=await readText(f);
      pending.push({type:'text',name:f.name,text:String(text).slice(0,CFG.MAX_TXT_KB*1024)});
    }
  }
  paintChips();
}
function paintChips(){
  if(!chipsRow) return;
  chipsRow.innerHTML='';
  pending.forEach((a,ix)=>{
    chipsRow.append(el('span',{class:'p-chip'},
      a.type==='image'?el('img',{src:a.dataUrl,alt:a.name}):el('span',{html:icon('paperclip',14)}),
      el('span',{class:'ellip',dir:'auto',text:a.name}),
      el('span',{class:'x',html:icon('x',13),onclick:()=>{ pending.splice(ix,1); paintChips(); }})
    ));
  });
}

function maybeSlash(){
  const v=inputEl.value;
  if(v.startsWith('/')&&!v.includes('\n')){
    const q=v.slice(1);
    if(slashState && slashState.mode==='slash') slashState.update(q);
    else openSlash('slash',q);
  } else closeSlash();
}
function openSlash(mode,q=''){
  closeSlash();
  const anchor=document.getElementById('composer-anchor');
  const composerBox=document.getElementById('composer');
  if(!anchor) return;
  const panel=el('div',{class:'slash-panel'});
  let sel=0, rows=[], query=q||'';
  function paint(){
    const queryL=query.toLowerCase();
    rows=S.prompts.filter(p=>!queryL||p.title.toLowerCase().includes(queryL)||p.body.toLowerCase().includes(queryL));
    panel.innerHTML='';
    if(!rows.length){
      panel.append(el('div',{class:'sb-empty'},
        el('span',{text:t('settings.promptsHint')}),
        el('button',{class:'btn soft sm',style:{marginTop:'8px'},text:t('settings.newPrompt'),onclick:()=>{ closeSlash(); openSettings('prompts'); }})));
      return;
    }
    rows.forEach((p,ix)=>{
      panel.append(el('button',{class:'slash-item'+(ix===sel?' sel':''),
        onmouseenter:()=>{ sel=ix; panel.querySelectorAll('.slash-item').forEach((n,i)=>n.classList.toggle('sel',i===sel)); },
        onclick:()=>pick(ix)},
        el('span',{class:'st',dir:'auto',text:p.title}),
        el('span',{class:'sb2',dir:'auto',text:p.body.slice(0,90)})));
    });
  }
  function pick(ix){
    const p=rows[ix==null?sel:ix];
    if(!p) return;
    inputEl.value = mode==='slash' ? p.body : (inputEl.value?inputEl.value+'\n'+p.body : p.body);
    closeSlash(); autosize(); updateTokenEst(); saveDraftNow(); inputEl.focus();
  }
  const out=e=>{ if(!panel.contains(e.target) && !(composerBox&&composerBox.contains(e.target))) closeSlash(); };
  slashState={
    mode, update:nq=>{ query=nq; sel=0; paint(); },
    move:d=>{ sel=clamp(sel+d,0,Math.max(0,rows.length-1)); paint(); },
    pick:()=>pick()
  };
  anchor.append(panel);
  setTimeout(()=>{ if(slashState) document.addEventListener('pointerdown',out,true); },0);
  slashState.out=out;
  paint();
}
function closeSlash(){
  if(slashState && slashState.out) document.removeEventListener('pointerdown',slashState.out,true);
  slashState=null;
  document.querySelectorAll('.slash-panel').forEach(n=>n.remove());
}

function startMic(btn){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast(t('chat.micUnsupported'),'warn'); return; }
  if(recognition){ recognition.stop(); return; }
  recognition=new SR();
  recognition.lang=S.settings.lang==='fa'?'fa-IR':'en-US';
  recognition.interimResults=true; recognition.continuous=false;
  const base=inputEl.value;
  btn.classList.add('active');
  toast(t('chat.micListening'),'info',1800);
  recognition.onresult=e=>{
    let final='',interim='';
    for(const r of e.results){ if(r.isFinal) final+=r[0].transcript; else interim+=r[0].transcript; }
    inputEl.value=(base?base+' ':'')+final+interim;
    autosize(); updateTokenEst();
  };
  recognition.onend=()=>{ btn.classList.remove('active'); recognition=null; saveDraftNow(); inputEl.focus(); };
  recognition.onerror=()=>{ btn.classList.remove('active'); recognition=null; };
  recognition.start();
}

if(window.speechSynthesis){
  try{ window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged=()=>{ try{ window.speechSynthesis.getVoices(); }catch{} }; }catch{}
}
function speak(m){
  if(!window.speechSynthesis){ toast(t('chat.ttsUnsupported'),'warn'); return; }
  if(speakingId===m.id){ speechSynthesis.cancel(); speakingId=null; emit('messages'); return; }
  speechSynthesis.cancel();
  const text=stripMd(m.content);
  if(!text){ toast(t('toast.error'),'warn'); return; }
  const u=new SpeechSynthesisUtterance(text);
  const want=dirOf(m.content)==='rtl'?'fa':'en';
  let voices=[];
  try{ voices=speechSynthesis.getVoices()||[]; }catch{}
  const v=voices.find(x=>x.lang&&x.lang.toLowerCase().startsWith(want))
        || voices.find(x=>x.default) || voices[0];
  if(v){ u.voice=v; u.lang=v.lang; } else { u.lang=want==='fa'?'fa-IR':'en-US'; }
  u.onstart=()=>toast(t('chat.speak'),'info',1500);
  u.onerror=()=>{ speakingId=null; toast(t('chat.ttsUnsupported'),'err'); if(S.activeConvId) emit('messages'); };
  u.onend=()=>{ speakingId=null; if(S.activeConvId) emit('messages'); };
  speakingId=m.id;
  try{ speechSynthesis.speak(u); }
  catch{ speakingId=null; toast(t('chat.ttsUnsupported'),'err'); }
  emit('messages');
}
export function copyLast(){
  const conv=activeConv(); if(!conv) return;
  const msgs=S.messages[conv.id]||[];
  const {path}=buildPath(conv,msgs);
  for(let i=path.length-1;i>=0;i--) if(path[i].role==='assistant'&&path[i].content){ copyWithToast(path[i].content); return; }
}

function scrollBottom(smooth){
  requestAnimationFrame(()=>{ scroller.scrollTo({top:scroller.scrollHeight,behavior:smooth?'smooth':'auto'}); });
}
