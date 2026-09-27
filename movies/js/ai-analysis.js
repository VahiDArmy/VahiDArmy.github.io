/* =========================================================
   تحلیل سلیقه و پیشنهاد با AI
   ========================================================= */
window.AIAnalysis = (function () {

  function collectUserData() {
    const all = DB.getAllTitles();
    const by = { love: [], good: [], hate: [] };
    all.forEach(t => {
      if (by[t.category]) {
        by[t.category].push({
          title: t.title,
          year: t.year,
          genre: t.genre,
          type: t.type
        });
      }
    });
    return by;
  }

  async function analyze({ onToken, signal } = {}) {
    const data = collectUserData();
    const total = data.love.length + data.good.length + data.hate.length;
    if (total < 3) throw new Error('حداقل ۳ عنوان برای تحلیل لازم است.');

    const messages = [
      { role: 'system', content: AIPrompts.analysisSystem },
      { role: 'user', content: AIPrompts.analysisUser(data) }
    ];

    return AI.chatStream({
      messages,
      temperature: 0.7,
      signal,
      onToken
    });
  }

  async function recommend(kind = 'both', { onToken, signal } = {}) {
    const data = collectUserData();
    const messages = [
      { role: 'system', content: AIPrompts.recommendSystem },
      { role: 'user', content: AIPrompts.recommendUser(data, kind) }
    ];

    return AI.chatStream({
      messages,
      temperature: 0.8,
      signal,
      onToken
    });
  }

  return { analyze, recommend, collectUserData };
})();