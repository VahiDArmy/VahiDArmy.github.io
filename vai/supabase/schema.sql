-- ============================================================================
--  Miraj AI Chat  ·  Supabase schema
--  Project : https://ummhohozmpwltbgeczsf.supabase.co
--  Run this ONCE inside  →  Dashboard ▸ SQL Editor ▸ New query ▸ Run
--  It only creates the chat_* tables, nothing else is touched.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- chat_conversations : one row per chat thread
-- ---------------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid default auth.uid(),
  title           text not null default 'گفتگوی تازه',
  model           text not null default 'openrouter/free',
  system_prompt   text not null default '',
  settings        jsonb not null default '{}'::jsonb,
  pinned          boolean not null default false,
  archived        boolean not null default false,
  message_count   integer not null default 0,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists chat_conversations_last_message_idx
  on public.chat_conversations (last_message_at desc);

-- ---------------------------------------------------------------------------
-- chat_messages : one row per message (user / assistant / system)
--   request_body     → the EXACT string sent as the HTTP body (verbatim)
--   request_payload  → the same thing already parsed, for fast inspection
--   error            → the untouched provider error object
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id         uuid default auth.uid(),
  seq             integer not null default 0,
  role            text not null check (role in ('system','user','assistant')),
  content         text not null default '',
  reasoning       text,
  status          text not null default 'complete'
                  check (status in ('pending','streaming','complete','error','cancelled')),
  requested_model text,
  resolved_model  text,
  provider        text,
  usage           jsonb,
  error           jsonb,
  request_payload jsonb,
  request_body    text,
  request_headers jsonb,
  response_raw    text,
  edited          boolean not null default false,
  edit_history    jsonb not null default '[]'::jsonb,
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_seq_idx
  on public.chat_messages (conversation_id, seq);

-- ---------------------------------------------------------------------------
-- chat_models : the OpenRouter catalogue (free models are what we care about)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_models (
  id                    text primary key,
  name                  text not null default '',
  description           text default '',
  context_length        integer not null default 0,
  max_completion_tokens integer,
  pricing               jsonb not null default '{}'::jsonb,
  architecture          jsonb not null default '{}'::jsonb,
  supported_parameters  jsonb not null default '[]'::jsonb,
  modality              text default '',
  is_free               boolean not null default true,
  raw                   jsonb,
  enabled               boolean not null default true,
  favorite              boolean not null default false,
  hidden                boolean not null default false,
  sort_index            integer not null default 0,
  fetched_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists chat_models_free_idx on public.chat_models (is_free, enabled);

-- ---------------------------------------------------------------------------
-- chat_settings : tiny key/value bag (last model, ui prefs, …)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_settings (
  k          text primary key,
  v          jsonb,
  user_id    uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
--   This is an anonymous-first app (publishable key, no login screen),
--   therefore the policies are permissive. Tighten them if you add auth.
-- ---------------------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.chat_models        enable row level security;
alter table public.chat_settings      enable row level security;

drop policy if exists chat_conversations_all on public.chat_conversations;
create policy chat_conversations_all on public.chat_conversations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists chat_messages_all on public.chat_messages;
create policy chat_messages_all on public.chat_messages
  for all to anon, authenticated using (true) with check (true);

drop policy if exists chat_models_all on public.chat_models;
create policy chat_models_all on public.chat_models
  for all to anon, authenticated using (true) with check (true);

drop policy if exists chat_settings_all on public.chat_settings;
create policy chat_settings_all on public.chat_settings
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime (optional, harmless if the publication already exists)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_conversations;
  exception when others then null;
  end;
end $$;

-- ============================================================================
--  done.  the client will automatically fall back to local storage mode if
--  this script was never executed, so nothing breaks either way.
-- ============================================================================
