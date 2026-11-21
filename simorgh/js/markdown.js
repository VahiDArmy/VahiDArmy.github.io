import { esc } from './utils.js';

/* ---------- KaTeX lazy loading ---------- */
let katexState = 0; // 0 idle, 1 loading, 2 ready, 3 failed
let mathCb = null;
export function setMathCallback(fn){ mathCb = fn; }
function ensureKatex(){
  if(katexState!==0) return;
  katexState = 1;
  const css = document.createElement('link');
  css.rel='stylesheet'; css.href='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  document.head.append(css);
  const js = document.createElement('script');
  js.src='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
  js.onload=()=>{ katexState=2; if(mathCb) mathCb(); };
  js.onerror=()=>{ katexState=3; };
  document.head.append(js);
}
function renderMath(tex, display){
  if(window.katex){
    try{ return window.katex.renderToString(tex,{displayMode:display,throwOnError:false,output:'html'}); }catch{}
  }
  ensureKatex();
  return '<code class="math-fallback">'+esc(tex)+'</code>';
}

/* ---------- Syntax highlighter ---------- */
const KW = {
  js:'const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of try catch finally throw async await yield import export from default delete void static get set',
  ts:'const let var function return if else for while do switch case break continue new class extends implements interface type enum namespace declare readonly public private protected abstract super this typeof instanceof in of try catch finally throw async await yield import export from default delete void static get set as keyof satisfies',
  py:'def return if elif else for while break continue class import from as pass try except finally raise with lambda yield global nonlocal assert del async await match case',
  go:'func return if else for range break continue switch case default go defer chan select var const type struct interface map package import fallthrough',
  rust:'fn let mut return if else for while loop break continue match struct enum impl trait pub use mod crate self super where async await move dyn ref static const unsafe',
  c:'if else for while do switch case break continue return struct union enum typedef sizeof static extern const volatile register auto goto',
  cpp:'if else for while do switch case break continue return class struct union enum typedef sizeof static extern const volatile new delete template typename namespace using public private protected virtual override final friend operator try catch throw noexcept constexpr auto nullptr this',
  java:'if else for while do switch case break continue return class interface enum extends implements new try catch finally throw throws static final abstract public private protected synchronized volatile transient native import package this super instanceof',
  sql:'select from where insert into values update set delete create table alter drop index view join left right inner outer full on group by order having limit offset union all distinct as and or not null like in between exists case when then else end primary key foreign references count sum avg min max',
  bash:'if then else elif fi for do done while until case esac function in echo exit return local export readonly shift set source alias cd printf read',
  php:'if else elseif for foreach while do switch case break continue return function class extends implements new try catch finally throw static final abstract public private protected echo print include require include_once require_once use namespace const var',
  ruby:'def end if elsif else unless while until for do break next return class module begin rescue ensure raise yield require require_relative attr_accessor attr_reader attr_writer include extend self super',
  css:'', html:'', json:'', yaml:'', md:'', text:''
};
const LITS = new Set(['true','false','null','undefined','None','True','False','nil','NaN','Infinity','self','this']);
const ALIAS = {javascript:'js',jsx:'js',tsx:'ts',typescript:'ts',python:'py',py:'py',shell:'bash',sh:'bash',zsh:'bash',console:'bash',csharp:'cpp',cs:'cpp','c++':'cpp',c:'c',h:'c',kotlin:'java',swift:'java',scala:'java',dart:'java',golang:'go',rs:'rust',rb:'ruby',yml:'yaml',plaintext:'text',txt:'text',text:'text',md:'text',markdown:'text',xml:'html',svg:'html',vue:'html',php:'php',sql:'sql',json:'json',jsonc:'json'};

function langRules(lang){
  lang = ALIAS[lang] || lang;
  const R = [];
  const push=(re,cls)=>R.push([new RegExp(re.source,'y'),cls]);
  if(lang==='json'){
    push(/"(?:[^"\\]|\\.)*"(?=\s*:)/,'attr'); push(/"(?:[^"\\]|\\.)*(?:"|$)/,'str');
    push(/-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,'num'); push(/[A-Za-z_]\w*/,'ident');
    return R;
  }
  if(lang==='html'){
    push(/<!--[\s\S]*?(?:-->|$)/,'com'); push(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/,'com');
    push(/<\/?[a-zA-Z][\w:.-]*/,'tag'); push(/\/?>/,'tag');
    push(/[a-zA-Z_:][\w:.-]*(?=\s*=)/,'attr');
    push(/"[^"]*(?:"|$)/,'str'); push(/'[^']*(?:'|$)/,'str');
    push(/&[a-zA-Z#\d]+;/,'lit');
    return R;
  }
  if(lang==='css'){
    push(/\/\*[\s\S]*?(?:\*\/|$)/,'com'); push(/@[\w-]+/,'kw');
    push(/"(?:[^"\\]|\\.)*(?:"|$)/,'str'); push(/'(?:[^'\\]|\\.)*(?:'|$)/,'str');
    push(/#[0-9a-fA-F]{3,8}\b/,'num'); push(/!important/,'kw');
    push(/[a-zA-Z-]+(?=\s*:)/,'attr'); push(/-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/,'num');
    push(/[.#][\w-]+/,'fn');
    return R;
  }
  if(lang==='yaml'){
    push(/#[^\n]*/,'com'); push(/[&*][\w-]+/,'var');
    push(/[\w.-]+(?=\s*:(?:\s|$))/,'attr');
    push(/"(?:[^"\\]|\\.)*(?:"|$)/,'str'); push(/'(?:[^']|'')*(?:'|$)/,'str');
    push(/\b(?:true|false|null|yes|no|on|off)\b/i,'lit'); push(/-?\b\d+(?:\.\d+)?\b/,'num');
    return R;
  }
  if(lang==='py'){ push(/"""[\s\S]*?(?:"""|$)/,'str'); push(/'''[\s\S]*?(?:'''|$)/,'str'); }
  if(lang==='py'||lang==='bash'||lang==='ruby'){ push(/#[^\n]*/,'com'); }
  if(lang==='sql'){ push(/--[^\n]*/,'com'); }
  if(lang!=='py'&&lang!=='bash'&&lang!=='ruby'&&lang!=='text'){ push(/\/\/[^\n]*/,'com'); }
  push(/\/\*[\s\S]*?(?:\*\/|$)/,'com');
  push(/"(?:[^"\\\n]|\\.)*(?:"|$)/,'str'); push(/'(?:[^'\\\n]|\\.)*(?:'|$)/,'str');
  push(/`(?:[^`\\]|\\.)*(?:`|$)/,'str');
  if(lang==='bash'){ push(/\$\{[^}]*\}|\$[\w@#?!*]+/,'var'); push(/(?:^|\s)--?[\w-]+/,'attr'); }
  if(lang==='py'){ push(/@[\w.]+/,'dec'); }
  push(/\b0[xXbBoO][\da-fA-F_]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,'num');
  push(/[A-Za-z_$][\w$]*/,'ident');
  push(/[{}[\]();,.:=+\-*/%<>!&|^~?]+/,'op');
  R.kwset = new Set((KW[lang]||KW.js).split(/\s+/).filter(Boolean));
  R.lang = lang;
  return R;
}
const rulesCache = {};
export function highlight(code, lang){
  lang = String(lang||'text').toLowerCase();
  const key = ALIAS[lang]||lang;
  if(key==='text' || !(KW[key]!==undefined || ['json','html','css','yaml','sql','bash','php','ruby'].includes(key))){
    return esc(code);
  }
  const rules = rulesCache[key] || (rulesCache[key]=langRules(key));
  let out='', pos=0, n=code.length, guard=0;
  while(pos<n && guard++<400000){
    let hit=false;
    for(const [re,cls] of rules){
      re.lastIndex=pos;
      const m=re.exec(code);
      if(m && m[0]){
        let txt=m[0], c=cls;
        if(cls==='ident'){
          const low = rules.lang==='sql' ? txt.toLowerCase() : txt;
          if(rules.kwset.has(low)) c='kw';
          else if(LITS.has(txt)) c='lit';
          else if(code[pos+txt.length]==='(') c='fn';
          else if(/^[A-Z]/.test(txt)) c='type';
          else c=null;
        }
        out += c ? '<span class="tk-'+c+'">'+esc(txt)+'</span>' : esc(txt);
        pos += txt.length; hit=true; break;
      }
    }
    if(!hit){ out+=esc(code[pos]); pos++; }
  }
  if(pos<n) out+=esc(code.slice(pos));
  return out;
}

/* ---------- Markdown renderer ---------- */
const PH = i => '\u0000'+i+'\u0000';

function inline(src, stash){
  let s = esc(src);
  const codes=[];
  s = s.replace(/(`+)([\s\S]*?)\1/g, (m,f,code)=>{ codes.push('<code class="inline">'+code.replace(/^ | $/g,'')+'</code>'); return '\u0001C'+(codes.length-1)+'\u0001'; });
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!$~|>])/g, (m,ch)=>{ codes.push(esc(ch)); return '\u0001C'+(codes.length-1)+'\u0001'; });
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (m,tex)=>stash(tex,false));
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (m,tex)=>stash(tex,true));
  s = s.replace(/(^|[^\\$\w])\$(?![\s$])((?:[^$\n\\]|\\.)+?)\$(?!\d)/g, (m,pre,tex)=>pre+stash(tex,false));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m,alt,url)=>{
    if(!/^(https?:|data:image\/)/i.test(url)) return m;
    return '<img src="'+url+'" alt="'+alt+'" loading="lazy" data-act="img">';
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m,txt,url)=>{
    if(!/^(https?:|mailto:|#)/i.test(url)) return m;
    return '<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+txt+'</a>';
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>]+)/g, (m,pre,url)=>{
    let trail=''; const tm=url.match(/[.,;:!?'")\]]+$/);
    if(tm){ trail=tm[0]; url=url.slice(0,-trail.length); }
    return pre+'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+url+'</a>'+trail;
  });
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([\s\S]+?)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g,'$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g,'<del>$1</del>');
  s = s.replace(/==([^=]+)==/g,'<mark>$1</mark>');
  s = s.replace(/\u0001C(\d+)\u0001/g, (m,i)=>codes[+i]);
  return s;
}

function splitRow(line){
  let s=line.trim();
  if(s.startsWith('|')) s=s.slice(1);
  if(s.endsWith('|')) s=s.slice(0,-1);
  return s.split('|').map(c=>c.trim());
}

export function renderMarkdown(src, streaming=false){
  if(!src) return '';
  const math=[];
  const stash=(tex,display)=>{ math.push({tex,display}); return PH(math.length-1); };
  const text = String(src).replace(/\r\n?/g,'\n');
  const lines = text.split('\n');
  const html=[];
  let i=0;

  const flushPara=(buf)=>{
    if(!buf.length) return;
    let joined = buf.join('\n');
    joined = joined.replace(/\$\$([\s\S]+?)\$\$/g,(m,tex)=>stash(tex,true));
    const parts = joined.split(/\u0000(\d+)\u0000/);
    if(parts.length>1){
      for(let p=0;p<parts.length;p++){
        if(p%2===1){ html.push('<div class="math-display">'+renderMath(math[+parts[p]].tex,true)+'</div>'); }
        else if(parts[p].trim()){ html.push('<p dir="auto">'+inline(parts[p],stash).replace(/\n/g,'<br>')+'</p>'); }
      }
    } else {
      html.push('<p dir="auto">'+inline(joined,stash).replace(/\n/g,'<br>')+'</p>');
    }
    buf.length=0;
  };

  let para=[];
  while(i<lines.length){
    const line=lines[i];
    const fence=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(fence){
      flushPara(para);
      const marker=fence[1][0], flen=fence[1].length;
      const lang=(fence[2]||'').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9+#-]/g,'');
      const buf=[]; i++; let closed=false;
      while(i<lines.length){
        const cm=lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if(cm && cm[1][0]===marker && cm[1].length>=flen){ closed=true; i++; break; }
        buf.push(lines[i]); i++;
      }
      const code=buf.join('\n');
      const canPreview=/^(html|svg|xml)$/.test(lang);
      html.push(
        '<div class="codeblock'+(closed?'':' streaming')+'">'+
          '<div class="code-head"><span class="code-lang">'+esc(lang||'code')+((!closed&&streaming)?'<span class="live-dot"></span>':'')+'</span>'+
          '<button class="ibtn sm" data-act="code-copy" title="Copy">'+IC('copy')+'</button>'+
          '<button class="ibtn sm" data-act="code-wrap" title="Wrap">'+IC('wrap')+'</button>'+
          (canPreview?'<button class="ibtn sm" data-act="code-preview" title="Preview">'+IC('eye')+'</button>':'')+
          '<button class="ibtn sm" data-act="code-dl" data-lang="'+esc(lang)+'" title="Download">'+IC('download')+'</button>'+
          '</div><pre><code>'+highlight(code,lang)+'</code></pre>'+
        '</div>');
      continue;
    }
    const h=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(h){ flushPara(para); const l=h[1].length; html.push('<h'+l+' dir="auto">'+inline(h[2],stash)+'</h'+l+'>'); i++; continue; }
    if(/^ {0,3}([-*_])( *\1){2,} *$/.test(line)){ flushPara(para); html.push('<hr>'); i++; continue; }
    if(/^ {0,3}>/.test(line)){
      flushPara(para);
      const buf=[];
      while(i<lines.length && /^ {0,3}>/.test(lines[i])){ buf.push(lines[i].replace(/^ {0,3}> ?/,'')); i++; }
      html.push('<blockquote dir="auto">'+renderMarkdown(buf.join('\n'),streaming)+'</blockquote>');
      continue;
    }
    const li=line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
    if(li){
      flushPara(para);
      const items=[];
      while(i<lines.length){
        const m2=lines[i].match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
        if(!m2) break;
        items.push({indent:Math.floor(m2[1].replace(/\t/g,'  ').length/2), ordered:/\d/.test(m2[2]), num:parseInt(m2[2])||1, text:m2[3]});
        i++;
      }
      html.push(buildList(items,stash));
      continue;
    }
    if(line.includes('|') && i+1<lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i+1]) && lines[i+1].includes('-')){
      flushPara(para);
      const head=splitRow(line);
      const aligns=splitRow(lines[i+1]).map(c=>{
        const l=c.startsWith(':'), r=c.endsWith(':');
        return l&&r?'center':r?'right':l?'left':'';
      });
      i+=2;
      const rows=[];
      while(i<lines.length && lines[i].includes('|') && lines[i].trim()){ rows.push(splitRow(lines[i])); i++; }
      let tb='<div class="table-wrap" dir="auto"><table><thead><tr>';
      head.forEach((c,x)=>{ tb+='<th'+(aligns[x]?' style="text-align:'+aligns[x]+'"':'')+'>'+inline(c,stash)+'</th>'; });
      tb+='</tr></thead><tbody>';
      for(const r of rows){
        tb+='<tr>';
        for(let x=0;x<head.length;x++) tb+='<td'+(aligns[x]?' style="text-align:'+aligns[x]+'"':'')+'>'+inline(r[x]||'',stash)+'</td>';
        tb+='</tr>';
      }
      html.push(tb+'</tbody></table></div>');
      continue;
    }
    if(!line.trim()){ flushPara(para); i++; continue; }
    para.push(line); i++;
  }
  flushPara(para);

  let out=html.join('\n');
  out=out.replace(/\u0000(\d+)\u0000/g,(m,idx)=>{
    const mm=math[+idx];
    return mm.display ? '<div class="math-display">'+renderMath(mm.tex,true)+'</div>' : renderMath(mm.tex,false);
  });
  return out;
}

function buildList(items, stash){
  let pos=0;
  function build(level){
    const ordered=items[pos].ordered;
    const start=items[pos].num;
    let h = ordered ? '<ol dir="auto"'+(start!==1?' start="'+start+'"':'')+'>' : '<ul dir="auto">';
    while(pos<items.length && items[pos].indent>=level){
      if(items[pos].indent>level){ h=h.replace(/<\/li>$/,'')+build(items[pos].indent)+'</li>'; continue; }
      let txt=items[pos].text, task='';
      const tm=txt.match(/^\[( |x|X)\]\s+(.*)$/);
      if(tm){ task=' class="task"'; txt='<input type="checkbox" disabled'+(tm[1]!==' '?' checked':'')+'>'+inline(tm[2],stash); }
      else txt=inline(txt,stash);
      h+='<li'+task+' dir="auto">'+txt+'</li>';
      pos++;
    }
    return h+(ordered?'</ol>':'</ul>');
  }
  return build(items[0].indent);
}

/* tiny inline icons used inside generated code headers (kept here to avoid circular imports) */
function IC(name){
  const p={
    copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    wrap:'<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4"/><path d="m16 16-2 2 2 2"/><path d="M3 18h7"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'
  }[name]||'';
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
}
