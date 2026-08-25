// بارگذاری metadata (در این پروژه metadata جداگانه نداریم، از خود فایل‌ها استفاده می‌کنیم)
async function loadMetadata() {
  // برای سادگی، اطلاعات سوره‌ها را از یک فایل ایندکس یا از خود سوره‌ها استخراج می‌کنیم
  // اما چون گفتید فایل‌ها 1.json تا 114.json هستند، می‌توانیم از یک metadata.json استفاده نکنیم
  // به‌جای آن، این تابع را با دریافت نام فایل‌ها تطبیق می‌دهیم.
  // در این نسخه، metadata واقعی نداریم پس یک آرایه خالی برمی‌گردانیم یا می‌توانید یک فایل metadata.json بسازید.
  return [];
}

// بارگذاری داده یک سوره از فایل JSON
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

// دریافت آیه مشخص از داده سوره
function getAyahFromSurah(surahData, ayahNumber) {
  if (!surahData || !surahData.ayahs) return null;
  return surahData.ayahs.find(ayah => ayah.v === ayahNumber) || null;
}