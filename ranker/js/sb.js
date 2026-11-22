(function () {
  const T3D = window.T3D;
  const cfg = T3D.CONFIG;

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  T3D.client = client;
  T3D.auth = client.auth;

  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  const API = {
    // ---------- people ----------
    async listPeople() {
      const data = await unwrap(client.from('people').select('*').order('full_name', { ascending: true }).limit(500));
      return data || [];
    },
    async getPerson(id) {
      return unwrap(client.from('people').select('*').eq('id', id).maybeSingle());
    },
    async myPerson() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const data = await unwrap(client.from('people').select('*').eq('user_id', user.id).maybeSingle());
      return data || null;
    },
    async createMyPerson(full_name) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const existing = await this.myPerson();
      if (existing) return existing;
      const row = { full_name: full_name || user.email?.split('@')[0] || 'New Member', user_id: user.id, created_by: user.id };
      return unwrap(client.from('people').insert(row).select().single());
    },

    // ---------- traits ----------
    async listTraits() {
      return unwrap(client.from('t3d_traits').select('*').order('position', { ascending: true }));
    },

    // ---------- scores ----------
    async listScores() {
      // Fetch all scores (assume moderate size). For very large use pagination.
      const data = await unwrap(client.from('t3d_scores').select('*'));
      return data || [];
    },
    async upsertScore({ rater_person_id, ratee_person_id, trait_id, score, note }) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Sign in required');
      const payload = {
        rater_person_id, ratee_person_id, trait_id,
        score: Math.max(0, Math.min(100, Number(score))),
        note: note || null,
        created_by: user.id
      };
      return unwrap(client.from('t3d_scores').upsert(payload, { onConflict: 'rater_person_id,ratee_person_id,trait_id' }).select().single());
    },
    async deleteScore(id) {
      return unwrap(client.from('t3d_scores').delete().eq('id', id));
    },

    // ---------- bookmarks ----------
    async listBookmarks() {
      return unwrap(client.from('t3d_bookmarks').select('*'));
    },
    async toggleBookmark(person_id, trait_id) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Sign in required');
      const existing = await unwrap(
        client.from('t3d_bookmarks').select('*').eq('user_id', user.id).eq('person_id', person_id).eq('trait_id', trait_id).maybeSingle()
      );
      if (existing) {
        await unwrap(client.from('t3d_bookmarks').delete().eq('id', existing.id));
        return false;
      }
      await unwrap(client.from('t3d_bookmarks').insert({ user_id: user.id, person_id, trait_id }));
      return true;
    },

    // ---------- AI conversations ----------
    async listConvs() {
      return unwrap(client.from('t3d_ai_conversations').select('*').order('updated_at', { ascending: false }));
    },
    async createConv(model, title) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Sign in required');
      return unwrap(client.from('t3d_ai_conversations').insert({ user_id: user.id, model, title: title || 'New chat' }).select().single());
    },
    async deleteConv(id) {
      return unwrap(client.from('t3d_ai_conversations').delete().eq('id', id));
    },
    async listMessages(conv_id) {
      return unwrap(client.from('t3d_ai_messages').select('*').eq('conversation_id', conv_id).order('created_at', { ascending: true }));
    },
    async addMessage(conv_id, role, content, reasoning) {
      return unwrap(client.from('t3d_ai_messages').insert({ conversation_id: conv_id, role, content, reasoning: reasoning || null }).select().single());
    },

    // ---------- realtime ----------
    subscribeScores(onChange) {
      return client.channel('t3d-scores-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 't3d_scores' }, onChange)
        .subscribe();
    },
    subscribeTraits(onChange) {
      return client.channel('t3d-traits-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 't3d_traits' }, onChange)
        .subscribe();
    }
  };

  T3D.api = API;
})();
