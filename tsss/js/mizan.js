// =============================================================
// تفسیر المیزان — خوانندهٔ داده از data/surah/ و data/content/
// =============================================================
const Mizan = (function () {
  const surahCache = new Map();
  const contentCache = new Map();

  async function loadSurah(surahNumber) {
    if (surahCache.has(surahNumber)) return surahCache.get(surahNumber);
    const res = await fetch(`data/surah/${surahNumber}.json`);
    if (!res.ok) throw new Error(`عدم دسترسی به نقشهٔ سورهٔ ${surahNumber}`);
    const data = await res.json();
    surahCache.set(surahNumber, data);
    return data;
  }

  async function loadContent(contentId) {
    if (contentCache.has(contentId)) return contentCache.get(contentId);
    const res = await fetch(`data/content/${contentId}.json`);
    if (!res.ok) throw new Error(`عدم دسترسی به محتوای ${contentId}`);
    const data = await res.json();
    contentCache.set(contentId, data);
    return data;
  }

  async function getForAyah(surah, ayah) {
    const map = await loadSurah(surah);
    const ids =
      (map.ayah_to_content && map.ayah_to_content[String(ayah)]) || [];
    if (!ids.length) return [];
    return await Promise.all(ids.map((id) => loadContent(id)));
  }

  return { loadSurah, loadContent, getForAyah };
})();