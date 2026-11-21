import { CFG, t, THEMES } from './config.js';
import { el, $ } from './utils.js';
import { icon, toast, palette, registerCommands } from './ui.js';
import { S, on, emit, initSettings, applyCloudSettings, saveSettings, loadCachedModels, cacheModels, toggleSidebar, applyAppearance } from './state.js';
import { Auth, DB } from './api.js';
import { renderAuth } from './auth-view.js';
import { mountSidebar } from './sidebar.js';
import { mountChat, openConversation, newChat, stopGeneration, copyLast } from './chat.js';
import { openSettings, openShortcuts, refreshModels, exportAll, exportConversation } from './settings.js';
import { activeConv } from './state.js';

const appRoot = document.getElementById('app');
let booted = false, loading = false;

function splash(){
  appRoot.innerHTML='';
  appRoot.append(el('div',{id:'splash'},
    el('div',{class:'hero-logo',html:icon('logo',44)}),
    el('div',{class:'spinner',style:{width:'22px',height:'22px'}}),
    el('div',{class:'muted small',text:t('common.loading')})));
}

async function loadAll(){
  if(loading) return;
  loading=true;
  try{
    const profile=await DB.getProfile();
    S.profile=profile;
    applyCloudSettings(profile.settings);
    const [convs,models,prompts,projects]=await Promise.all([
      DB.listConversations(), DB.listModels(), DB.listPrompts(), DB.listProjects()
    ]);
    S.conversations=convs; S.models=models; S.prompts=prompts; S.projects=projects;
    cacheModels();
    await DB.markOrphansStopped().catch(()=>{});
    if(!models.length) refreshModels(null).catch(()=>{});
  }catch(e){
    console.error(e);
    toast(e.message,'err');
  }
  loading=false;
}

function renderApp(){
  appRoot.innerHTML='';
  appRoot.removeAttribute('aria-busy');
  const sidebar=el('aside',{id:'sidebar'});
  const main=el('main',{id:'main'});
  const backdrop=el('div',{id:'sb-backdrop',onclick:()=>toggleSidebar(false)});
  const fx=el('div',{id:'bgfx'});
  appRoot.append(sidebar,main,backdrop);
  if(!document.getElementById('bgfx')) document.body.prepend(fx);
  mountSidebar(sidebar);
  mountChat(main);
  registerCommands([
    {label:t('cmd.newChat'),icon:'plus',kbd:'Alt N',run:()=>newChat()},
    {label:t('cmd.settings'),icon:'settings',run:()=>openSettings()},
    {label:t('cmd.appearance'),icon:'palette',run:()=>openSettings('appearance')},
    {label:t('cmd.connection'),icon:'key',run:()=>openSettings('connection')},
    {label:t('cmd.models'),icon:'cpu',run:()=>openSettings('models')},
    {label:t('cmd.prompts'),icon:'book',run:()=>openSettings('prompts')},
    {label:t('cmd.refreshModels'),icon:'refresh',run:()=>refreshModels(null)},
    {label:t('cmd.theme'),icon:'moon',run:()=>{ const ix=THEMES.findIndex(x=>x.id===S.settings.theme); saveSettings({theme:THEMES[(ix+1)%THEMES.length].id}); }},
    {label:t('cmd.lang'),icon:'globe',run:()=>{ saveSettings({lang:S.settings.lang==='fa'?'en':'fa'}); location.reload(); }},
    {label:t('cmd.sidebar'),icon:'sidebar',kbd:'Ctrl B',run:()=>toggleSidebar()},
    {label:t('cmd.export'),icon:'download',kbd:'Ctrl Shift E',run:()=>{ const c=activeConv(); if(c) exportConversation(c,'md'); }},
    {label:t('nav.exportAll'),icon:'database',run:()=>exportAll()},
    {label:t('cmd.stop'),icon:'stop',run:()=>stopGeneration()},
    {label:t('cmd.shortcuts'),icon:'keyboard',kbd:'Ctrl /',run:()=>openShortcuts()},
    {label:t('cmd.signOut'),icon:'logout',run:()=>Auth.signOut()}
  ]);
  const hash=location.hash;
  const hm=hash.match(/^#c\/([\w-]+)/);
  if(hm && S.conversations.some(c=>c.id===hm[1])) openConversation(hm[1]);
  else if(S.conversations.length) openConversation(S.conversations[0].id);
  else emit('active');
}

function bindGlobals(){
  on('show-shortcuts',()=>openShortcuts());
  document.addEventListener('keydown',e=>{
    const mod=e.ctrlKey||e.metaKey;
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
    if(mod&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(S.user) palette(); }
    else if(e.altKey&&e.key.toLowerCase()==='n'){ e.preventDefault(); if(S.user) newChat(); }
    else if(mod&&e.key.toLowerCase()==='b'){ e.preventDefault(); if(S.user) toggleSidebar(); }
    else if(mod&&e.key==='/'){ e.preventDefault(); if(S.user) openShortcuts(); }
    else if(mod&&e.shiftKey&&e.key.toLowerCase()==='c'){ e.preventDefault(); if(S.user) copyLast(); }
    else if(mod&&e.shiftKey&&e.key.toLowerCase()==='e'){ e.preventDefault(); const c=activeConv(); if(c) exportConversation(c,'md'); }
    else if(e.key==='?'&&!typing&&S.user){ openShortcuts(); }
  });
  window.addEventListener('online',()=>{ S.online=true; applyAppearance(); emit('online'); });
  window.addEventListener('offline',()=>{ S.online=false; applyAppearance(); emit('online'); });
  window.addEventListener('beforeunload',e=>{
    if(Object.keys(S.generating).length){ e.preventDefault(); e.returnValue=''; }
  });
  window.addEventListener('error',e=>{ console.error(e.error||e.message); });
}

async function boot(){
  initSettings();
  loadCachedModels();
  bindGlobals();
  splash();
  const session=await Auth.session().catch(()=>null);
  Auth.onChange(async (evt,session)=>{
    if(evt==='PASSWORD_RECOVERY'){
      S.user=session?.user||null;
      renderAuth(appRoot,'reset-set');
      return;
    }
    if(evt==='SIGNED_IN'&&session){
      if(booted&&S.user?.id===session.user.id) return;
      S.user=session.user;
      if(!booted){ splash(); await loadAll(); booted=true; renderApp(); }
    }
    if(evt==='SIGNED_OUT'){
      booted=false; S.user=null; S.profile=null;
      S.conversations=[]; S.messages={}; S.activeConvId=null; S.prompts=[]; S.projects=[];
      history.replaceState(null,'','#');
      renderAuth(appRoot);
    }
  });
  if(session){
    S.user=session.user;
    await loadAll();
    booted=true;
    renderApp();
  } else {
    renderAuth(appRoot);
  }
}
boot();
