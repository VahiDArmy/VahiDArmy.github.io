(function () {
  const T3D = window.T3D;
  const listeners = new Set();

  const state = {
    user: null,
    myPerson: null,
    people: [],
    traits: [],
    scores: [],
    bookmarks: [],
    loaded: false,
    focusedPersonId: null,
    focusedTraitId: null,
    theme: T3D.store.get('theme', 'light'),
    route: 'person',
    aiConv: null,
    aiMessages: [],
    aiConvs: []
  };

  function emit() {
    for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } }
  }

  function set(patch) {
    Object.assign(state, patch);
    emit();
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // Derivations
  function personById(id) { return state.people.find(p => p.id === id) || null; }
  function traitById(id) { return state.traits.find(t => t.id === id) || null; }
  function scoreFor(rater, ratee, trait) {
    return state.scores.find(s => s.rater_person_id === rater && s.ratee_person_id === ratee && s.trait_id === trait) || null;
  }
  function scoresByRater(raterId) { return state.scores.filter(s => s.rater_person_id === raterId); }
  function scoresByRatee(rateeId) { return state.scores.filter(s => s.ratee_person_id === rateeId); }
  function scoresByTrait(traitId) { return state.scores.filter(s => s.trait_id === traitId); }

  function avgReceived(personId) {
    const list = scoresByRatee(personId);
    if (!list.length) return null;
    return list.reduce((a, s) => a + Number(s.score), 0) / list.length;
  }
  function avgReceivedByTrait(personId, traitId) {
    const list = state.scores.filter(s => s.ratee_person_id === personId && s.trait_id === traitId);
    if (!list.length) return null;
    return list.reduce((a, s) => a + Number(s.score), 0) / list.length;
  }
  function avgGiven(personId) {
    const list = scoresByRater(personId);
    if (!list.length) return null;
    return list.reduce((a, s) => a + Number(s.score), 0) / list.length;
  }
  function avgTraitAcross(traitId) {
    const list = scoresByTrait(traitId);
    if (!list.length) return null;
    return list.reduce((a, s) => a + Number(s.score), 0) / list.length;
  }

  T3D.state = state;
  T3D.setState = set;
  T3D.subscribeState = subscribe;
  T3D.derive = {
    personById, traitById, scoreFor,
    scoresByRater, scoresByRatee, scoresByTrait,
    avgReceived, avgReceivedByTrait, avgGiven, avgTraitAcross
  };
})();
