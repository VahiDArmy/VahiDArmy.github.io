// دریافت تفسیر از ویکی از طریق corsproxy
async function fetchRavanTafsirFromWiki(surah, ayah) {
  // پیدا کردن نام سوره به فارسی
  const surahData = index.find(s => s.number === surah);
  const surahName = surahData?.name_fa || surah;
  
  // ساخت URL صفحه ویکی - دقیقاً به فرمت نمونه کاربر
  const wikiPath = `%D8%A2%DB%8C%D9%87_${ayah}_%D8%B3%D9%88%D8%B1%D9%87_${encodeURIComponent(surahName)}`;
  const wikiUrl = `https://wiki.ahlolbait.com/${wikiPath}`;
  
  // ساخت آدرس پروکسی
  const proxyUrl = `https://corsproxy.io/?key=ce9413ae&url=${encodeURIComponent(wikiUrl)}`;
  
  console.log('📡 درخواست به:', proxyUrl);
  
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`دریافت صفحه با خطا مواجه شد (کد ${response.status})`);
  }
  
  const html = await response.text();
  console.log('📄 HTML دریافت شد، طول:', html.length);
  
  // ذخیره HTML در console برای بررسی
  console.log('📄 100 کاراکتر اول HTML:', html.substring(0, 500));
  
  // استخراج بخش تفسیر روان جاوید
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // روش اول: جستجوی مستقیم در textContent
  const text = doc.body.textContent || '';
  console.log('📝 متن استخراج شده، طول:', text.length);
  console.log('📝 200 کاراکتر اول متن:', text.substring(0, 500));
  
  // روش دوم: جستجوی عنصر با کلاس خاص
  // بررسی کلاس‌های مختلف در صفحه
  const allElements = doc.querySelectorAll('*');
  let foundTafsir = false;
  
  for (const el of allElements) {
    const elText = el.textContent || '';
    if (elText.includes('تفسیر روان جاوید') || elText.includes('روان جاوید')) {
      console.log('🔍 عنصر حاوی "تفسیر روان جاوید" پیدا شد:', el.outerHTML.substring(0, 300));
      foundTafsir = true;
    }
  }
  
  if (!foundTafsir) {
    console.log('⚠️ هیچ عنصری با "تفسیر روان جاوید" پیدا نشد');
  }
  
  // روش اول: regex روی textContent
  const regex = /تفسیر روان جاوید\s*\(ثقفی تهرانى\)\s*([\s\S]*?)(?=تفسیر\s+\w+|$)/i;
  const match = text.match(regex);
  
  if (!match || !match[1]) {
    // روش دوم: جستجوی ساده‌تر
    const simpleRegex = /روان جاوید\s*([\s\S]*?)(?=تفسیر\s+\w+|$)/i;
    const simpleMatch = text.match(simpleRegex);
    if (simpleMatch && simpleMatch[1]) {
      let tafsirText = simpleMatch[1].trim();
      tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
      if (tafsirText.length > 20) {
        return tafsirText;
      }
    }
    throw new Error('متن تفسیر روان جاوید در صفحه یافت نشد');
  }
  
  let tafsirText = match[1].trim();
  tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
  
  if (tafsirText.length < 10) {
    throw new Error('متن تفسیر بسیار کوتاه است، احتمالاً اشتباه استخراج شده');
  }
  
  return tafsirText;
}