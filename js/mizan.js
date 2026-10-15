// =============================================================
// خوانندهٔ داده‌های تفسیر المیزان
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

  // برای یک content، لیست آیات مرتبط را برمی‌گرداند
  async function getAyahsForContent(surah, contentId) {
    const map = await loadSurah(surah);
    const ayahs = [];
    for (const [ayahStr, ids] of Object.entries(map.ayah_to_content || {})) {
      if (ids.includes(contentId)) ayahs.push(Number(ayahStr));
    }
    return ayahs.sort((a, b) => a - b);
  }

  return { loadSurah, loadContent, getForAyah, getAyahsForContent };
})();