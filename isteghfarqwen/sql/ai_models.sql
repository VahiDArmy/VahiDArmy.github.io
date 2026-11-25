-- Nūr · general AI model table (no prefix, as requested)
-- The OpenRouter API key is NEVER stored here — it lives in the browser only.

create table if not exists public.ai_models (
  model_id       text primary key,
  label          text not null default '',
  provider       text not null default '',
  context_length integer not null default 0,
  active         boolean not null default true,
  is_default     boolean not null default false,
  sort           integer not null default 0,
  updated_at     timestamptz not null default now()
);

alter table public.ai_models enable row level security;

drop policy if exists ai_models_read on public.ai_models;
drop policy if exists ai_models_ins  on public.ai_models;
drop policy if exists ai_models_upd  on public.ai_models;
drop policy if exists ai_models_del  on public.ai_models;

create policy ai_models_read on public.ai_models for select using (true);
create policy ai_models_ins  on public.ai_models for insert to authenticated with check (true);
create policy ai_models_upd  on public.ai_models for update to authenticated using (true) with check (true);
create policy ai_models_del  on public.ai_models for delete to authenticated using (true);

create unique index if not exists ai_models_one_default
  on public.ai_models ((is_default)) where is_default;

insert into public.ai_models (model_id,label,provider,context_length,active,is_default,sort) values
 ('openrouter/free','OpenRouter · Free router','openrouter',0,true,true,0),
 ('meta-llama/llama-3.3-70b-instruct:free','Llama 3.3 70B Instruct','meta-llama',131072,true,false,1),
 ('deepseek/deepseek-chat-v3-0324:free','DeepSeek V3 0324','deepseek',64000,true,false,2),
 ('google/gemini-2.0-flash-exp:free','Gemini 2.0 Flash Exp','google',1048576,true,false,3),
 ('qwen/qwen-2.5-72b-instruct:free','Qwen 2.5 72B Instruct','qwen',32768,false,false,4),
 ('mistralai/mistral-small-3.1-24b-instruct:free','Mistral Small 3.1 24B','mistralai',96000,false,false,5)
on conflict (model_id) do nothing;
