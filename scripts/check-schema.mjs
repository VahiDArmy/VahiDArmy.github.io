// ---------------------------------------------------------------------------
// Runs supabase/schema.sql against a real Postgres engine (PGlite) with a
// stubbed auth schema, then checks that row-level security actually isolates
// two users. This is the script that matters most: the user runs the same SQL
// by hand in the Supabase editor, so a syntax error would block them.
//
// Install the engine first:  npm i -D @electric-sql/pglite
// Run:                        node scripts/check-schema.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const schema = fs.readFileSync('supabase/schema.sql', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

process.on('unhandledRejection', (err) => {
  console.error(`\nschema check failed: ${err?.message || err}`);
  process.exit(1);
});

const db = new PGlite();

// Supabase provides these; PGlite does not.
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select null::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated;
    end if;
  end $$;
`);

// pgcrypto is bundled with Supabase; PGlite already has gen_random_uuid().
const runnable = schema
  .replace(/create extension if not exists pgcrypto;/i, '')
  .replace(/grant usage, select on all sequences in schema public to authenticated;/i, '');

console.log('running schema.sql …');
await db.exec(runnable);
console.log('  schema executed without error');

const expected = [
  'fb_projects', 'fb_messages', 'fb_memory', 'fb_tasks', 'fb_runs', 'fb_steps',
  'fb_checkpoints', 'fb_file_index', 'fb_models', 'fb_model_prefs', 'fb_settings',
];

const tables = await db.query(`
  select table_name, relrowsecurity
  from information_schema.tables t
  join pg_class c on c.relname = t.table_name
  where t.table_schema = 'public' and t.table_name like 'fb\\_%'
  order by 1
`);
const names = tables.rows.map((row) => row.table_name);
console.log(`  ${names.length} fb_ tables created`);

for (const table of expected) {
  assert(names.includes(table), `missing table ${table}`);
}
for (const row of tables.rows) {
  assert(row.relrowsecurity === true, `RLS is not enabled on ${row.table_name}`);
}
console.log('  row level security enabled on every table');

const policies = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'public'`);
console.log(`  ${policies.rows[0].n} policies created`);
assert(policies.rows[0].n >= 40, 'expected an owner policy set for each private table');

// ---------------------------------------------------------------------------
// functional isolation test, as the `authenticated` role (RLS applies)
// ---------------------------------------------------------------------------

await db.exec(`
  insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com');
  create or replace function auth.uid() returns uuid language sql stable as $$ select '${USER_A}'::uuid $$;
`);

await db.exec('set role authenticated;');
await db.exec(`
  insert into public.fb_projects (name, description) values ('Project A', 'owned by A');
  insert into public.fb_tasks (project_id, title) select id, 'First task' from public.fb_projects;
  insert into public.fb_settings (data) values ('{"temperature":0.2}'::jsonb);
  insert into public.fb_models (id, name, is_free, supports_tools) values ('demo/free-model', 'Free Model', true, true) on conflict (id) do update set name = excluded.name;
  insert into public.fb_model_prefs (model_id, enabled) values ('demo/free-model', false);
`);
const seenByA = await db.query('select count(*)::int as n from public.fb_projects');
assert(seenByA.rows[0].n === 1, `user A should see exactly 1 project, saw ${seenByA.rows[0].n}`);
console.log('  user A can insert and read their own rows');

// Switch identity to B and confirm isolation.
// (Defining a function in the auth schema needs the owner role back.)
await db.exec('reset role;');
await db.exec(`
  create or replace function auth.uid() returns uuid language sql stable as $$ select '${USER_B}'::uuid $$;
`);
// Superusers bypass RLS, so the queries must run as `authenticated`.
await db.exec('set role authenticated;');
const seenByB = await db.query('select count(*)::int as n from public.fb_projects');
assert(seenByB.rows[0].n === 0, `user B must not see A's projects, saw ${seenByB.rows[0].n}`);

const prefsB = await db.query('select count(*)::int as n from public.fb_model_prefs');
assert(prefsB.rows[0].n === 0, 'user B must not see A\'s model preferences');
console.log('  user B sees none of user A\'s rows (projects, preferences)');

const catalog = await db.query('select count(*)::int as n from public.fb_models');
assert(catalog.rows[0].n === 1, 'the shared model catalog should be readable by every signed-in user');
console.log('  the shared model catalog stays readable across users');

// A must not be able to spoof ownership by inserting someone else's user_id.
await db.exec('reset role;');
await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${USER_B}'::uuid $$;`);
await db.exec('set role authenticated;');
let blocked = false;
try {
  await db.exec(`insert into public.fb_projects (name, user_id) values ('Spoofed', '${USER_A}')`);
} catch (err) {
  blocked = /row-level security|violates/i.test(err.message);
}
assert(blocked, 'inserting a row on behalf of another user must be blocked by RLS');
console.log('  spoofing another user_id is blocked by RLS');

await db.exec('reset role;');
await db.close();

console.log('\nschema is valid and enforces per-user isolation');
