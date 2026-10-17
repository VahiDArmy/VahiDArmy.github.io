export const $=(s,r=document)=>r.querySelector(s);
// Safe element builder: text is always inserted as text nodes (no innerHTML => no XSS).
export function h(tag,attrs={},...kids){const e=document.createElement(tag);
for(const[k,v]of Object.entries(attrs)){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}
for(const c of kids.flat())e.append(c?.nodeType?c:document.createTextNode(c??''));return e}
