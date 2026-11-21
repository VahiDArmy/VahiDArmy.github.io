import { CFG, DEFAULTS, setLang, getLang } from './config.js?v=4';
import { DB } from './api.js?v=4';
import { debounce, estimateTokens } from './utils.js?v=4';

export const S = {
  user:null, profile:null,
  settings:{ ...DEFAULTS },
  conversations:[], messages:{}, activeConvId:null,
  models:[], prompts:[], projects:[],
  generating:{},
  sidebarOpen: window.innerWidth>900,
  online: navigator.onLine,
  projectFilter: null
};

const subs = {};
export function on(evt, fn){ (subs[evt]||(subs[evt]=[])).push(fn); }
export function emit(evt, data){ for(const fn of (subs[evt]||[])){ try{ fn(data); }catch(e){ console.error(e); } } }

export function initSettings(){
  try{
    const local = JSON.parse(localStorage.getItem(CFG.LS.settings)||'{}');
    S.settings = { ...DEFAULTS, ...local };
  }catch{ S.settings = { ...DEFAULTS }; }
  const sbState = localStorage.getItem(CFG.LS.sidebar);
  if(sbState!=null && window.innerWidth>900) S.sidebarOpen = sbState==='1';
  setLang(S.settings.lang);
  applyAppearance();
}
const cloudSave = debounce(async ()=>{
  if(!S.user) return;
  try{ await DB.saveProfile({ settings:S.settings }); }catch(e){ console.warn('settings sync failed', e); }
}, 900);
export function saveSettings(patch, { cloud=true }={}){
  S.settings = { ...S.settings, ...patch };
  if(patch.lang) setLang(patch.lang);
  localStorage.setItem(CFG.LS.settings, JSON.stringify(S.settings));
  applyAppearance();
  emit('settings', patch);
  if(cloud) cloudSave();
}
export function applyCloudSettings(cloud){
  if(cloud && typeof cloud==='object'){
    S.settings = { ...DEFAULTS, ...S.settings, ...cloud };
    localStorage.setItem(CFG.LS.settings, JSON.stringify(S.settings));
    setLang(S.settings.lang);
    applyAppearance();
    emit('settings', {});
  }
}
export function applyAppearance(){
  const s=S.settings, d=document.documentElement;
  d.dataset.theme=s.theme; d.dataset.density=s.density; d.dataset.width=s.chatWidth; d.dataset.bgfx=s.bgFx;
  d.lang=s.lang; d.dir=s.lang==='fa'?'rtl':'ltr';
  d.style.setProperty('--fscale', (s.fontScale||100)/100);
  if(s.bubbles) d.dataset.bubbles='1'; else delete d.dataset.bubbles;
  d.dataset.motion = s.reduceMotion?'off':'on';
  d.dataset.sidebar = S.sidebarOpen?'open':'closed';
  d.dataset.online = S.online?'on':'off';
}
export function toggleSidebar(force){
  S.sidebarOpen = force!=null ? force : !S.sidebarOpen;
  localStorage.setItem(CFG.LS.sidebar, S.sidebarOpen?'1':'0');
  applyAppearance();
}

export function getKey(){ return localStorage.getItem(CFG.LS.key)||''; }
export function setKey(k){ if(k) localStorage.setItem(CFG.LS.key,k); else localStorage.removeItem(CFG.LS.key); }

export function cacheModels(){ try{ localStorage.setItem(CFG.LS.models, JSON.stringify(S.models)); }catch{} }
export function loadCachedModels(){
  try{ S.models = JSON.parse(localStorage.getItem(CFG.LS.models)||'[]'); }catch{ S.models=[]; }
}
export function modelInfo(id){
  const row = S.models.find(m=>m.id===id);
  if(row) return row.info;
  if(id===CFG.ROUTER_ID) return { id, name:'Free Models Router', context_length:200000, input_modalities:['text','image'], supports_reasoning:true };
  return null;
}

export function activeConv(){ return S.conversations.find(c=>c.id===S.activeConvId)||null; }
export function effectiveModel(conv){
  if(!conv) return S.settings.defaultModel;
  return conv.router_mode==='router' ? conv.model_id : (conv.locked_model || conv.model_id);
}
export function resolveParam(conv, key){
  const v = conv && conv.params ? conv.params[key] : undefined;
  return (v!=null && v!=='inherit') ? v : S.settings[key];
}
export function buildPath(conv, msgs){
  const byParent={};
  for(const m of msgs){ const k=m.parent_id||'root'; (byParent[k]||(byParent[k]=[])).push(m); }
  for(const k in byParent) byParent[k].sort((a,b)=> a.created_at<b.created_at?-1 : a.created_at>b.created_at?1 : (a.id<b.id?-1:1));
  const map=(conv && conv.branch_map)||{};
  const path=[]; const seen=new Set(); let key='root';
  while(byParent[key] && byParent[key].length){
    const sibs=byParent[key];
    let pick = map[key] ? sibs.find(m=>m.id===map[key]) : null;
    if(!pick) pick=sibs[sibs.length-1];
    if(seen.has(pick.id)) break;
    seen.add(pick.id); path.push(pick); key=pick.id;
  }
  return { path, byParent };
}
export function cleanBranchMap(conv, msgs){
  const ids=new Set(msgs.map(m=>m.id));
  const map={ ...(conv.branch_map||{}) };
  for(const k in map) if(!ids.has(map[k])) delete map[k];
  return map;
}

export function trimContext(messages, modelId, maxTokens, limit){
  const sys = messages.filter(m=>m.role==='system');
  let rest = messages.filter(m=>m.role!=='system');
  if(limit>0 && rest.length>limit) rest = rest.slice(-limit);
  const info = modelInfo(modelId);
  const ctx = (info && info.context_length) || 32000;
  const budget = Math.max(2000, ctx - (maxTokens||2048) - 800);
  const sizeOf = m => estimateTokens(typeof m.content==='string' ? m.content : JSON.stringify(m.content)) + 8;
  let total = sys.reduce((a,m)=>a+sizeOf(m),0) + rest.reduce((a,m)=>a+sizeOf(m),0);
  while(total>budget && rest.length>1){ total -= sizeOf(rest.shift()); }
  return [...sys, ...rest];
}

function drafts(){ try{ return JSON.parse(localStorage.getItem(CFG.LS.drafts)||'{}'); }catch{ return {}; } }
export function getDraft(id){ return drafts()[id]||''; }
export function setDraft(id, text){
  const d=drafts();
  if(text) d[id]=text; else delete d[id];
  const keys=Object.keys(d);
  while(keys.length>60) delete d[keys.shift()];
  try{ localStorage.setItem(CFG.LS.drafts, JSON.stringify(d)); }catch{}
}
export function displayName(){
  return S.profile?.display_name || S.user?.user_metadata?.display_name || (S.user?.email||'?').split('@')[0];
}
export { getLang };
