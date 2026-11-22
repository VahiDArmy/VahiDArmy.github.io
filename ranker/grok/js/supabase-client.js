const SB_URL = 'https://nvmevqkaovazhmoznusf.supabase.co';
const SB_KEY = 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE';

const { createClient } = supabase;
const sb = createClient(SB_URL, SB_KEY);

/* Table prefix r3d_ */
const TABLES = {
  traits: 'r3d_traits',
  scores: 'r3d_scores'
};

/*
  Suggested SQL (run in Supabase SQL editor):

  create table if not exists public.r3d_traits (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique,
    description text,
    color text default '#7c5cff',
    icon text default 'gem',
    created_by uuid references auth.users(id),
    created_at timestamptz default now()
  );

  create table if not exists public.r3d_scores (
    id uuid primary key default gen_random_uuid(),
    rater_id uuid not null references public.people(id) on delete cascade,
    ratee_id uuid not null references public.people(id) on delete cascade,
    trait_id uuid not null references public.r3d_traits(id) on delete cascade,
    score numeric not null check (score >= -5 and score <= 5),
    note text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(rater_id, ratee_id, trait_id)
  );

  alter table public.r3d_traits enable row level security;
  alter table public.r3d_scores enable row level security;

  create policy "r3d_traits_read" on public.r3d_traits for select using (true);
  create policy "r3d_traits_write" on public.r3d_traits for all using (auth.role() = 'authenticated');
  create policy "r3d_scores_read" on public.r3d_scores for select using (true);
  create policy "r3d_scores_write" on public.r3d_scores for all using (auth.role() = 'authenticated');
*/

const DB = {
  async getPeople() {
    const { data, error } = await sb.from('people').select('id, full_name, avatar_url, job_title, bio, tags, status').order('full_name');
    if (error) throw error;
    return data || [];
  },

  async createPerson({ full_name, job_title, bio }) {
    const { data, error } = await sb.from('people').insert({
      full_name,
      job_title: job_title || null,
      bio: bio || null,
      status: 'active'
    }).select().single();
    if (error) throw error;
    return data;
  },

  async getTraits() {
    const { data, error } = await sb.from(TABLES.traits).select('*').order('name');
    if (error) {
      // table may not exist yet
      console.warn('traits fetch', error.message);
      return [];
    }
    return data || [];
  },

  async createTrait({ name, description, color }) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data, error } = await sb.from(TABLES.traits).insert({
      name,
      slug,
      description: description || null,
      color: color || '#7c5cff'
    }).select().single();
    if (error) throw error;
    return data;
  },

  async getScores(filters = {}) {
    let q = sb.from(TABLES.scores).select('*');
    if (filters.rater_id) q = q.eq('rater_id', filters.rater_id);
    if (filters.ratee_id) q = q.eq('ratee_id', filters.ratee_id);
    if (filters.trait_id) q = q.eq('trait_id', filters.trait_id);
    const { data, error } = await q;
    if (error) {
      console.warn('scores fetch', error.message);
      return [];
    }
    return data || [];
  },

  async upsertScore({ rater_id, ratee_id, trait_id, score, note }) {
    const { data, error } = await sb.from(TABLES.scores).upsert({
      rater_id,
      ratee_id,
      trait_id,
      score,
      note: note || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'rater_id,ratee_id,trait_id' }).select().single();
    if (error) throw error;
    return data;
  },

  async deleteScore(id) {
    const { error } = await sb.from(TABLES.scores).delete().eq('id', id);
    if (error) throw error;
  },

  // Auth helpers
  async signUp(email, password, name) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: name || email.split('@')[0] } }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await sb.auth.signOut();
  },

  async getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  onAuthChange(cb) {
    return sb.auth.onAuthStateChange((event, session) => cb(event, session));
  }
};

window.SB = sb;
window.DB = DB;
