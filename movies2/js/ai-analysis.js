/* =========================================================
   تحلیل سلیقه و پیشنهاد
   ========================================================= */
window.AIAnalysis = (function () {

  function collectUserData() {
    const all = DB.getAllTitles();
    return { all: all };
  }

  async function analyze(options) {
    options = options || {};
    const data = collectUserData();
    if (data.all.length < 3) throw new Error('حداقل ۳ عنوان برای تحلیل لازم است.');
    const messages = [
      { role: 'system', content: AIPrompts.analysisSystem },
      { role: 'user', content: AIPrompts.analysisUser(data) }
    ];
    return AI.chatStream({
      messages: messages,
      temperature: 0.7,
      signal: options.signal,
      onToken: options.onToken
    });
  }

  async function recommend(kind, options) {
    options = options || {};
    const data = collectUserData();
    const messages = [
      { role: 'system', content: AIPrompts.recommendSystem },
      { role: 'user', content: AIPrompts.recommendUser(data, kind) }
    ];
    return AI.chatStream({
      messages: messages,
      temperature: 0.8,
      signal: options.signal,
      onToken: options.onToken
    });
  }

  return { analyze: analyze, recommend: recommend, collectUserData: collectUserData };
})();