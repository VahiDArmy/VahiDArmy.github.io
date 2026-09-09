// =============================================================
// ستاره‌های چهارپر متحرک در پس‌زمینه
// =============================================================
(function initStars() {
  // بررسی کاهش حرکت
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height;
  let stars = [];
  const MAX_STARS = 45;
  const SPEED = 0.3; // سرعت آهسته

  // دریافت رنگ‌های تم
  function getColors() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      neon: style.getPropertyValue('--neon').trim() || '#2DE8C8',
      violet: style.getPropertyValue('--violet').trim() || '#8B7CF6',
      gold: style.getPropertyValue('--star-gold').trim() || '#E8C84A',
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  // ایجاد یک ستاره چهارپر
  function createStar() {
    const colors = getColors();
    const colorPalette = [colors.neon, colors.violet, colors.gold];
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    
    // اندازه‌های تصادفی
    const size = 6 + Math.random() * 20; // اندازه کلی
    const coreRadius = 2 + Math.random() * 4;
    const armLength = size;
    const armWidth = 0.8 + Math.random() * 1.5;
    const opacity = 0.2 + Math.random() * 0.5;
    const glowIntensity = 0.3 + Math.random() * 0.5;

    return {
      x: Math.random() * width,
      y: Math.random() * height - height, // از بالا شروع کن
      size: size,
      coreRadius: coreRadius,
      armLength: armLength,
      armWidth: armWidth,
      opacity: opacity,
      glowIntensity: glowIntensity,
      color: color,
      speed: SPEED * (0.6 + Math.random() * 0.8),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.002,
      phase: Math.random() * Math.PI * 2, // برای نوسان درخشش
    };
  }

  // رسم یک ستاره چهارپر با افکت نوری
  function drawStar(star) {
    const { x, y, size, coreRadius, armLength, armWidth, opacity, glowIntensity, color, rotation } = star;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;

    // درخشش مرکزی (گلو)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 3);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    // چهار پرتو (بازوها)
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';

    const arms = [
      { angle: 0, dx: 1, dy: 0 },
      { angle: Math.PI / 2, dx: 0, dy: 1 },
      { angle: Math.PI, dx: -1, dy: 0 },
      { angle: 3 * Math.PI / 2, dx: 0, dy: -1 },
    ];

    for (const arm of arms) {
      const startX = arm.dx * coreRadius * 0.6;
      const startY = arm.dy * coreRadius * 0.6;
      const endX = arm.dx * armLength;
      const endY = arm.dy * armLength;

      // پرتو با ضخامت متغیر (نوک باریک)
      const widthAtStart = armWidth * 2.5;
      const widthAtEnd = 0.3;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      
      // منحنی برای حالت نرم
      const cp1x = startX + arm.dx * (armLength * 0.4);
      const cp1y = startY + arm.dy * (armLength * 0.4);
      const cp2x = startX + arm.dx * (armLength * 0.7);
      const cp2y = startY + arm.dy * (armLength * 0.7);
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();

      // پرتو دوم برای ایجاد جلوه نوری
      ctx.shadowBlur = 20 * glowIntensity;
      ctx.globalAlpha = opacity * 0.3;
      ctx.lineWidth = armWidth * 3;
      ctx.beginPath();
      ctx.moveTo(startX * 0.5, startY * 0.5);
      ctx.bezierCurveTo(cp1x * 0.8, cp1y * 0.8, cp2x * 0.8, cp2y * 0.8, endX * 0.9, endY * 0.9);
      ctx.stroke();
    }

    // هسته مرکزی پرنور
    ctx.shadowBlur = 15 * glowIntensity;
    ctx.globalAlpha = opacity * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function updateStars() {
    const colors = getColors();
    // تنظیم رنگ‌ها در صورت تغییر تم
    stars.forEach(star => {
      // گاهی رنگ را عوض نکنید، اما در صورت نیاز می‌توانید
    });
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // بروزرسانی موقعیت ستاره‌ها
    for (const star of stars) {
      star.y += star.speed;
      star.rotation += star.rotationSpeed;
      star.phase += 0.01;
      // نوسان درخشش
      star.opacity = (0.3 + Math.sin(star.phase) * 0.15) * (0.7 + Math.random() * 0.1);
    }

    // حذف ستاره‌هایی که از پایین خارج شده‌اند و ایجاد ستاره‌های جدید
    stars = stars.filter(s => s.y - s.size < height + 20);
    
    while (stars.length < MAX_STARS) {
      stars.push(createStar());
    }

    // رسم ستاره‌ها
    for (const star of stars) {
      drawStar(star);
    }

    requestAnimationFrame(animate);
  }

  // راه‌اندازی
  window.addEventListener('resize', () => {
    resize();
    // ستاره‌های موجود را با ابعاد جدید تطبیق بده
    stars.forEach(s => {
      s.x = Math.min(s.x, width);
      s.y = Math.min(s.y, height);
    });
  });

  // گوش دادن به تغییرات تم برای بروزرسانی رنگ‌ها
  const observer = new MutationObserver(() => {
    // رنگ‌ها در حین انیمیشن بروز می‌شوند
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  // ستاره‌های اولیه
  for (let i = 0; i < MAX_STARS; i++) {
    const star = createStar();
    star.y = Math.random() * height; // پخش در کل صفحه
    stars.push(star);
  }
  animate();
})();