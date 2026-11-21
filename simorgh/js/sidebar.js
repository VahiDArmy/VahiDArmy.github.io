import { t, CFG } from './config.js';
import { el, icon as _noop, fmtTime } from './utils.js';
import { icon, toast, menu, confirmDlg, promptDlg, modal, palette } from './ui.js';
import { S, on, emit, toggleSidebar, displayName, saveSettings } from './state.js';
import { DB, Auth } from './api.js';
import { openSettings, exportConversation, exportAll } from './settings.js';
import { shortModel } from './utils.js';

let rootEl=null, listEl=null, searchQ='', projOpen=true;

export function mountSidebar(root){
  rootEl=root;
  paint();
  on('conversations', paintList);
  on('projects', paint);
  on('generating', paintList);
  on('active', paintList);
  on('settings', ()=>paint());
  on('online', paint);
}

function paint(){
  if(!rootEl) return;
  rootEl.innerHTML='';
  const search=el('input',{class:'input',placeholder:t('nav.search'),value:searchQ,oninput:e=>{ searchQ=e.target.value; paintList(); }});
  const head=el('div',{class:'sb-head'},
    el('div',{class:'logo-mark',html:icon('logo',18)}),
    el('span',{class:'logo-name grow',text:t('app.name')}),
    el('button',{class:'ibtn',html:icon('sidebar',17),title:t('nav.collapse'),onclick:()=>toggleSidebar(false)})
  );
  const newBtn=el('button',{class:'sb-new',html:icon('plus',17)+'<span>'+t('nav.newChat')+'</span><kbd style="margin-inline-start:auto;background:rgba(255,255,255,.16);border-color:transparent;color:#fff">Alt N</kbd>',
    onclick:()=>emit('new-chat')});
  const searchWrap=el('div',{class:'sb-search',html:icon('search',15)},search);

  listEl=el('div',{class:'sb-scroll'});
  const foot=el('div',{class:'sb-foot'},
    el('div',{class:'sb-status'},
      el('span',{class:'dot'+(S.online?'':' off')}),
      el('span',{text:S.online?t('nav.online'):t('nav.offline')})
    ),
    el('button',{class:'sb-user',onclick:e=>{
      menu(e.currentTarget,[
        {label:t('nav.settings'),icon:'settings',onClick:()=>openSettings()},
        {label:t('nav.shortcuts'),icon:'keyboard',onClick:()=>emit('show-shortcuts')},
        {label:t('nav.exportAll'),icon:'download',onClick:()=>exportAll()},
        {label:S.settings.lang==='fa'?'English':'فارسی',icon:'globe',onClick:()=>saveSettings({lang:S.settings.lang==='fa'?'en':'fa'})},
        {sep:true},
        {label:t('nav.signOut'),icon:'logout',danger:true,onClick:async()=>{ await Auth.signOut(); }}
      ]);
    }},
      el('div',{class:'avatar',text:(displayName()[0]||'?').toUpperCase()}),
      el('div',{class:'grow',style:{minWidth:'0'}},
        el('div',{class:'ellip',style:{fontWeight:'600',fontSize:'.85rem'},text:displayName()}),
        el('div',{class:'ellip muted',style:{fontSize:'.7rem'},text:S.user?.email||''})
      ),
      el('span',{html:icon('more',16),class:'muted'})
    )
  );
  rootEl.append(head,newBtn,searchWrap,listEl,foot);
  paintList();
}

function groupLabel(ts){
  const d=new Date(ts), now=new Date();
  const day=86400000, start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  if(d.getTime()>=start) return t('nav.today');
  if(d.getTime()>=start-day) return t('nav.yesterday');
  if(d.getTime()>=start-7*day) return t('nav.week');
  return t('nav.older');
}

function paintList(){
  if(!listEl) return;
  listEl.innerHTML='';
  /* projects */
  const projSec=el('div',{class:'sb-sec'},
    el('button',{class:'row',style:{gap:'5px',color:'inherit',font:'inherit',textTransform:'inherit',letterSpacing:'inherit'},
      html:(projOpen?icon('chevD',12):icon('chevR',12))+'<span>'+t('nav.projects')+'</span>',
      onclick:()=>{ projOpen=!projOpen; paintList(); }}),
    el('button',{class:'ibtn sm',html:icon('plus',13),title:t('nav.newProject'),onclick:()=>openProjectModal()})
  );
  listEl.append(projSec);
  if(projOpen){
    listEl.append(el('button',{class:'sb-proj'+(S.projectFilter===null?' active':''),
      html:icon('layers',15)+'<span class="grow ellip">'+t('nav.allChats')+'</span><span class="cnt">'+S.conversations.length+'</span>',
      onclick:()=>{ S.projectFilter=null; paintList(); }}));
    for(const p of S.projects){
      const cnt=S.conversations.filter(c=>c.project_id===p.id).length;
      listEl.append(el('button',{class:'sb-proj'+(S.projectFilter===p.id?' active':''),
        html:'<span style="font-size:1rem">'+(p.emoji||'📁')+'</span><span class="grow ellip" dir="auto"></span><span class="cnt">'+cnt+'</span>',
        onclick:()=>{ S.projectFilter=p.id; paintList(); },
        oncontextmenu:e=>{ e.preventDefault(); projMenu(e.currentTarget,p); }}));
      const row=listEl.lastChild;
      row.querySelector('.grow').textContent=p.name;
      const moreBtn=el('button',{class:'ibtn sm',html:icon('more',13),onclick:e=>{ e.stopPropagation(); projMenu(e.currentTarget,p); }});
      row.append(moreBtn);
    }
    if(!S.projects.length) listEl.append(el('div',{class:'sb-empty',style:{padding:'6px 12px'},text:t('nav.noProjects')}));
  }
  /* conversations */
  let convs=S.conversations.slice();
  if(S.projectFilter) convs=convs.filter(c=>c.project_id===S.projectFilter);
  if(searchQ) convs=convs.filter(c=>c.title.toLowerCase().includes(searchQ.toLowerCase()));
  const pinned=convs.filter(c=>c.pinned), rest=convs.filter(c=>!c.pinned);
  const addSection=(label,arr)=>{
    if(!arr.length) return;
    listEl.append(el('div',{class:'sb-sec'},el('span',{text:label})));
    for(const c of arr) listEl.append(convItem(c));
  };
  addSection(t('nav.pinned'),pinned);
  let lastGroup=null;
  for(const c of rest){
    const g=groupLabel(c.updated_at);
    if(g!==lastGroup){ listEl.append(el('div',{class:'sb-sec'},el('span',{text:g}))); lastGroup=g; }
    listEl.append(convItem(c));
  }
  if(!convs.length){
    listEl.append(el('div',{class:'sb-empty',text:t('nav.noChats')}));
  }
  if(searchQ && searchQ.length>=3){
    listEl.append(el('button',{class:'sb-item',style:{marginTop:'8px',color:'var(--accent)'},
      html:icon('search',15)+'<span class="t">'+t('nav.searchMsgs')+'</span>',
      onclick:()=>palette('messages')}));
  }
}

function convItem(c){
  const gen=S.generating[c.id];
  const item=el('button',{class:'sb-item'+(c.id===S.activeConvId?' active':''),
    onclick:()=>{ emit('open-conv',c.id); if(window.innerWidth<=900) toggleSidebar(false); }},
    gen?el('span',{class:'gen-ind spinner',style:{width:'13px',height:'13px'}}):el('span',{html:icon('message',15),class:'muted',style:{display:'contents'}}),
    el('span',{class:'t',dir:'auto',text:c.title}),
    c.pinned?el('span',{class:'pin-ind',html:icon('pin',12)}):null
  );
  const more=el('button',{class:'ibtn sm more',html:icon('more',14),onclick:e=>{ e.stopPropagation(); convMenu(e.currentTarget,c); }});
  item.append(more);
  item.addEventListener('contextmenu',e=>{ e.preventDefault(); convMenu(item,c); });
  return item;
}

function convMenu(anchor,c){
  const projItems=S.projects.map(p=>({label:(p.emoji||'📁')+' '+p.name,checked:c.project_id===p.id,
    onClick:async()=>{ try{ const row=await DB.updateConversation(c.id,{project_id:p.id}); Object.assign(c,row); emit('conversations'); }catch(e){ toast(e.message,'err'); } }}));
  menu(anchor,[
    {label:t('chat.rename'),icon:'edit',onClick:async()=>{
      const v=await promptDlg({title:t('chat.rename'),value:c.title});
      if(v!=null&&v.trim()){ try{ const row=await DB.updateConversation(c.id,{title:v.trim()}); Object.assign(c,row); emit('conversations'); emit('active'); }catch(e){ toast(e.message,'err'); } }
    }},
    {label:c.pinned?t('chat.unpin'):t('chat.pin'),icon:'pin',onClick:async()=>{
      try{ const row=await DB.updateConversation(c.id,{pinned:!c.pinned}); Object.assign(c,row); emit('conversations'); }catch(e){ toast(e.message,'err'); }
    }},
    {label:t('chat.exportMd'),icon:'download',onClick:()=>exportConversation(c,'md')},
    {label:t('chat.exportJson'),icon:'download',onClick:()=>exportConversation(c,'json')},
    ...projItems,
    c.project_id?{label:t('chat.noProject'),icon:'folder',onClick:async()=>{ try{ const row=await DB.updateConversation(c.id,{project_id:null}); Object.assign(c,row); emit('conversations'); }catch(e){ toast(e.message,'err'); } }}:null,
    {sep:true},
    {label:t('chat.delete'),icon:'trash',danger:true,onClick:()=>emit('delete-conv',c.id)}
  ].filter(Boolean));
}

function projMenu(anchor,p){
  menu(anchor,[
    {label:t('common.edit'),icon:'edit',onClick:()=>openProjectModal(p)},
    {label:t('chat.delete'),icon:'trash',danger:true,onClick:async()=>{
      if(await confirmDlg({title:t('proj.deleteQ'),message:t('proj.deleteBody')})){
        try{
          await DB.deleteProject(p.id);
          S.projects=S.projects.filter(x=>x.id!==p.id);
          for(const c of S.conversations) if(c.project_id===p.id) c.project_id=null;
          if(S.projectFilter===p.id) S.projectFilter=null;
          emit('projects'); emit('conversations'); toast(t('toast.deleted'),'ok');
        }catch(e){ toast(e.message,'err'); }
      }
    }}
  ]);
}

export function openProjectModal(p){
  const isEdit=!!p;
  const name=el('input',{class:'input',value:p?.name||'',autofocus:true});
  const emojis=['📁','🚀','📚','💼','🧪','🎨','🏠','💡','🌊','🔥'];
  let emoji=p?.emoji||'📁';
  const emoRow=el('div',{class:'row wrap'});
  const paintEmo=()=>{
    emoRow.innerHTML='';
    for(const e of emojis) emoRow.append(el('button',{type:'button',class:'chip'+(e===emoji?' on':''),style:{fontSize:'1rem'},text:e,onclick:()=>{ emoji=e; paintEmo(); }}));
  };
  paintEmo();
  const instr=el('textarea',{class:'input',rows:4,placeholder:t('proj.instructionsPh')}); instr.value=p?.instructions||'';
  let modelId=p?.model_id||'';
  const modelBtn=el('button',{type:'button',class:'btn soft sm',text:modelId?shortModel(modelId):t('settings.inherit'),
    onclick:e=>emit('model-picker',{anchor:e.currentTarget,current:modelId,onPick:id=>{ modelId=id; modelBtn.textContent=shortModel(id); }})});
  modal({
    title:isEdit?t('proj.edit'):t('proj.new'),
    body:el('div',{},
      el('div',{class:'field'},el('label',{class:'lbl',text:t('common.name')}),name),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('common.emoji')}),emoRow),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('common.instructions')}),instr),
      el('div',{class:'field'},el('label',{class:'lbl',text:t('proj.defaultModel')}),modelBtn)
    ),
    actions:[
      {label:t('common.cancel'),class:'ghost'},
      {label:isEdit?t('common.save'):t('common.create'),class:'primary',onClick:async close=>{
        if(!name.value.trim()) return;
        try{
          const row=await DB.saveProject({ id:p?.id, name:name.value.trim(), emoji, instructions:instr.value, model_id:modelId||null });
          if(isEdit) S.projects=S.projects.map(x=>x.id===row.id?row:x); else S.projects.push(row);
          emit('projects'); close(); toast(t('settings.saved'),'ok');
        }catch(e){ toast(e.message,'err'); }
      }}
    ]
  });
}
