const d=new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'});
export const date=v=>d.format(new Date(v));
export const num=n=>Number(n).toLocaleString('fa-IR');
