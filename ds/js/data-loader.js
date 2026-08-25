async function loadSurahData(surahNumber) {
  try {
    const response = await fetch(`${DATA_PATH}surahs/${surahNumber}.json`);
    if (!response.ok) throw new Error(`سوره ${surahNumber} یافت نشد`);
    return await response.json();
  } catch (error) {
    console.error('loadSurahData:', error);
    return null;
  }
}

function getAyahFromSurah(surahData, ayahNumber) {
  if (!surahData || !surahData.ayahs) return null;
  return surahData.ayahs.find(ayah => ayah.v === ayahNumber) || null;
}