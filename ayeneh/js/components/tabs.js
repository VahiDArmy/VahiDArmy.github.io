import {h} from '../utils/dom.js';
export function tabs(items,active,onSelect){const bar=h('div',{class:'tabs',role:'tablist'});
const draw=()=>bar.replaceChildren(...items.map(([k,l])=>h('button',{class:'tab'+(k===active?' on':''),role:'tab','aria-selected':String(k===active),onclick:()=>{active=k;draw();onSelect(k)}},l)));
draw();return bar}
