// بارگذاری metadata و داده‌های سوره
async function loadMetadata() {
  try {
    const response = await fetch(`${DATA_PATH}metadata.json`);
    if (!response.ok) throw new Error('خطا در بارگذاری metadata');
    return await response.json();
  } catch (error) {
    console.error('loadMetadata:', error);
    return [];
  }
}

async function loadSurahData(surahNumber) {
  try {
    const response = await fetch(`${DATA_PATH}surah_${surahNumber}.json`);
    if (!response.ok) throw new Error(`سوره ${surahNumber} یافت نشد`);
    return await response.json();
  } catch (error) {
    console.error('loadSurahData:', error);
    return [];
  }
}

// دریافت آیه مشخص از داده سوره
function getAyahFromSurah(surahData, ayahNumber) {
  return surahData.find(ayah => ayah.number === ayahNumber) || null;
}
