// ابزارهای مشترک رابط کاربری
const UI = (function () {
  function populateSurahSelect(selectEl, index, selected) {
    selectEl.innerHTML = index
      .map(
        (s) =>
          `<option value="${s.number}" ${s.number === selected ? 'selected' : ''}>${s.number} - ${s.name_fa}</option>`
      )
      .join('');
  }

  function populateAyahSelect(selectEl, ayahCount, selected) {
    let html = '';
    for (let i = 1; i <= ayahCount; i++) {
      html += `<option value="${i}" ${i === selected ? 'selected' : ''}>آیه ${i}</option>`;
    }
    selectEl.innerHTML = html;
  }

  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = '<div class="toast__inner"></div>';
      document.body.appendChild(el);
    }
    el.querySelector('.toast__inner').textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setProgressRing(ringEl, percent, labelEl) {
    const circle = ringEl.querySelector('.ring-fg');
    const r = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * r;
    circle.style.strokeDasharray = `${circumference}`;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    requestAnimationFrame(() => {
      circle.style.strokeDashoffset = offset;
    });
    if (labelEl) labelEl.textContent = `${Math.round(percent)}٪`;
  }

  function countUp(el, target, duration = 900) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased).toLocaleString('fa-IR');
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function toPersianDigits(str) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => fa[d]);
  }

  return { populateSurahSelect, populateAyahSelect, toast, setProgressRing, countUp, toPersianDigits };
})();
