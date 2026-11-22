import { supabase } from './supabase.js';

export const store = {
  session: null,
  user: null,
  people: [],
  traits: [],
  scores: [],
  scoreMap: new Map(),
  myPerson: null,
  listeners: new Set(),
  loaded: false,

  key(r, t, tr) { return `${r}|${t}|${tr}`; },

  async load() {
    const [pRes, tRes, sRes] = await Promise.all([
      supabase.from('people').select('*').order('full_name'),
      supabase.from('mx3_traits').select('*').order('sort_order'),
      supabase.from('mx3_scores').select('*')
    ]);
    this.people = pRes.data || [];
    this.traits = tRes.data || [];
    this.scores = sRes.data || [];
    this.scoreMap.clear();
    for (const s of this.scores) {
      this.scoreMap.set(this.key(s.ranker_id, s.target_id, s.trait_id), s);
    }
    this.myPerson = this.people.find(p => p.user_id === this.user?.id) || null;
    this.loaded = true;
    this.emit();
  },

  getScoreObj(ranker, target, trait) {
    return this.scoreMap.get(this.key(ranker, target, trait)) || null;
  },
  getScore(ranker, target, trait) {
    const o = this.getScoreObj(ranker, target, trait);
    return o ? Number(o.score) : null;
  },

  async setScore(ranker, target, trait, value, note = null) {
    const existing = this.getScoreObj(ranker, target, trait);
    if (value === null) {
      if (existing) {
        const { error } = await supabase.from('mx3_scores').delete().eq('id', existing.id);
        if (error) throw error;
        this.scoreMap.delete(this.key(ranker, target, trait));
        this.scores = this.scores.filter(s => s.id !== existing.id);
      }
    } else {
      const payload = {
        ranker_id: ranker, target_id: target, trait_id: trait,
        score: value, note, created_by: this.user.id
      };
      if (existing) {
        const { data, error } = await supabase.from('mx3_scores').update(payload).eq('id', existing.id).select().single();
        if (error) throw error;
        Object.assign(existing, data);
      } else {
        const { data, error } = await supabase.from('mx3_scores').insert(payload).select().single();
        if (error) throw error;
        this.scores.push(data);
        this.scoreMap.set(this.key(ranker, target, trait), data);
      }
    }
    this.emit();
  },

  async addPerson(payload) {
    const { data, error } = await supabase.from('people').insert(payload).select().single();
    if (error) throw error;
    this.people.push(data);
    this.people.sort((a, b) => a.full_name.localeCompare(b.full_name));
    this.emit();
    return data;
  },
  async updatePerson(id, payload) {
    const { data, error } = await supabase.from('people').update(payload).eq('id', id).select().single();
    if (error) throw error;
    const i = this.people.findIndex(p => p.id === id);
    if (i >= 0) this.people[i] = data;
    this.emit();
    return data;
  },
  async deletePerson(id) {
    const { error } = await supabase.from('people').delete().eq('id', id);
    if (error) throw error;
    this.people = this.people.filter(p => p.id !== id);
    this.scores = this.scores.filter(s => s.ranker_id !== id && s.target_id !== id);
    this.scoreMap.clear();
    for (const s of this.scores) this.scoreMap.set(this.key(s.ranker_id, s.target_id, s.trait_id), s);
    this.emit();
  },

  async addTrait(payload) {
    const { data, error } = await supabase.from('mx3_traits').insert(payload).select().single();
    if (error) throw error;
    this.traits.push(data);
    this.traits.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    this.emit();
    return data;
  },
  async updateTrait(id, payload) {
    const { data, error } = await supabase.from('mx3_traits').update(payload).eq('id', id).select().single();
    if (error) throw error;
    const i = this.traits.findIndex(t => t.id === id);
    if (i >= 0) this.traits[i] = data;
    this.emit();
    return data;
  },
  async deleteTrait(id) {
    const { error } = await supabase.from('mx3_traits').delete().eq('id', id);
    if (error) throw error;
    this.traits = this.traits.filter(t => t.id !== id);
    this.scores = this.scores.filter(s => s.trait_id !== id);
    this.scoreMap.clear();
    for (const s of this.scores) this.scoreMap.set(this.key(s.ranker_id, s.target_id, s.trait_id), s);
    this.emit();
  },

  // Stats
  averageReceived(personId) {
    const received = this.scores.filter(s => s.target_id === personId);
    if (!received.length) return null;
    return received.reduce((a, s) => a + Number(s.score), 0) / received.length;
  },
  averageGiven(personId) {
    const given = this.scores.filter(s => s.ranker_id === personId);
    if (!given.length) return null;
    return given.reduce((a, s) => a + Number(s.score), 0) / given.length;
  },
  coverage() {
    const possible = this.people.length * (this.people.length - 1) * this.traits.length;
    if (!possible) return 0;
    return Math.min(100, Math.round((this.scores.length / possible) * 100));
  },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) fn(this); }
};
