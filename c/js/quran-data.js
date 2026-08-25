// لایهٔ دسترسی به داده‌های قرآن (آیه عربی + ترجمه فولادوند)
// منبع: Tanzil.net — به‌صورت فایل محلی ذخیره شده، بدون نیاز به دیتابیس یا اینترنت زنده
const QuranData = (function () {
  const DATA_PATH = 'data';
  let indexCache = null;
  const surahCache = new Map();

  async function getIndex() {
    if (indexCache) return indexCache;
    const res = await fetch(`${DATA_PATH}/surahs_index.json`);
    if (!res.ok) throw new Error('عدم دسترسی به فهرست سوره‌ها');
    indexCache = await res.json();
    return indexCache;
  }

  async function getSurah(number) {
    if (surahCache.has(number)) return surahCache.get(number);
    const res = await fetch(`${DATA_PATH}/surahs/${number}.json`);
    if (!res.ok) throw new Error(`عدم دسترسی به سورهٔ ${number}`);
    const data = await res.json();
    surahCache.set(number, data);
    return data;
  }

  async function getAyah(surahNumber, ayahNumber) {
    const surah = await getSurah(surahNumber);
    const ayah = surah.ayahs.find((a) => a.v === ayahNumber);
    if (!ayah) throw new Error('آیه یافت نشد');
    return { ...ayah, surah };
  }

  const TOTAL_AYAHS = 6236;

  return { getIndex, getSurah, getAyah, TOTAL_AYAHS };
})();
