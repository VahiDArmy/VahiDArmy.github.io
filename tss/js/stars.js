// =============================================================
// ستاره‌های چهارپر متقارن با هسته درخشان و پرتوهای نازک
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
  const MAX_STARS = 25; // تعداد کمتر برای کیفیت بالاتر
  const SPEED = 0.2; // سرعت بسیار آهسته

  // دریافت رنگ‌های تم
  function getColors() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      neon: style.getPropertyValue('--neon').trim() || '#2DE8C8',
      violet: style.getPropertyValue('--violet').trim() || '#8B7CF6',
      gold: style.getPropertyValue('--star-gold').trim() || '#E8C84A',
      neonGlow: style.getPropertyValue('--neon-glow').trim() || 'rgba(45,232,200,0.35)',
      violetGlow: style.getPropertyValue('--violet-glow').trim() || 'rgba(139,124,246,0.35)',
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  // تبدیل رنگ به RGBA با شفافیت
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ایجاد یک ستاره چهارپر با دقت بالا
  function createStar() {
    const colors = getColors();
    const colorPalette = [colors.neon, colors.violet, colors.gold];
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    
    // اندازه‌های دقیق
    const coreRadius = 2 + Math.random() * 3; // هسته مرکزی
    const armLength = 15 + Math.random() * 25; // طول پرتوها
    const armWidth = 3.5 + Math.random() * 4.5; // ضخامت اولیه پرتوها (در هسته)
    const opacity = 0.25 + Math.random() * 0.35;
    const glowIntensity = 0.6 + Math.random() * 0.4;

    return {
      x: Math.random() * width,
      y: Math.random() * height - height,
      coreRadius: coreRadius,
      armLength: armLength,
      armWidth: armWidth,
      opacity: opacity,
      glowIntensity: glowIntensity,
      color: color,
      speed: SPEED * (0.7 + Math.random() * 0.6),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.001,
      phase: Math.random() * Math.PI * 2,
      // ذخیره رنگ‌های کمکی
      colorLight: color,
      colorDark: color,
    };
  }

  // رسم یک ستاره چهارپر با افکت فلر نوری دقیق
  function drawStar(star) {
    const { 
      x, y, coreRadius, armLength, armWidth, 
      opacity, glowIntensity, color, rotation 
    } = star;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;

    // ============================================================
    // ۱. هسته مرکزی درخشان (گل‌کور)
    // ============================================================
    
    // لایه اول: درخشش دور هسته
    const glowRadius = coreRadius * 6;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.05, color);
    gradient.addColorStop(0.15, hexToRgba(color, 0.6));
    gradient.addColorStop(0.4, hexToRgba(color, 0.15));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30 * glowIntensity;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ============================================================
    // ۲. چهار پرتو مستقیم با نوک‌های باریک
    // ============================================================
    
    const directions = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ];

    for (const dir of directions) {
      const startX = dir.dx * coreRadius * 0.4;
      const startY = dir.dy * coreRadius * 0.4;
      const endX = dir.dx * armLength;
      const endY = dir.dy * armLength;

      // ============================================================
      // پرتو اصلی با ضخامت متغیر (باریک‌شونده)
      // ============================================================
      
      // ضخامت در نزدیک هسته (ضخیم‌تر) و در نوک (بسیار نازک)
      const segments = 20;
      const startWidth = armWidth;
      const endWidth = 0.15; // نوک بسیار باریک و تیز

      // رسم پرتو به صورت پلی‌گون با ضخامت متغیر
      ctx.beginPath();
      
      // نقاط بالای پرتو
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        const width = startWidth + (endWidth - startWidth) * t;
        // عمود بر جهت پرتو
        const perpX = -dir.dy;
        const perpY = dir.dx;
        const px = cx + perpX * width * 0.5;
        const py = cy + perpY * width * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      
      // نقاط پایین پرتو (برگشت)
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        const width = startWidth + (endWidth - startWidth) * t;
        const perpX = -dir.dy;
        const perpY = dir.dx;
        const px = cx - perpX * width * 0.5;
        const py = cy - perpY * width * 0.5;
        ctx.lineTo(px, py);
      }
      
      ctx.closePath();
      
      // گرادیان در طول پرتو (از مرکز به نوک)
      const grad = ctx.createLinearGradient(
        startX, startY,
        endX, endY
      );
      const alphaStart = 1;
      const alphaEnd = 0.1;
      grad.addColorStop(0, hexToRgba(color, alphaStart));
      grad.addColorStop(0.3, hexToRgba(color, alphaStart * 0.9));
      grad.addColorStop(0.7, hexToRgba(color, alphaStart * 0.5));
      grad.addColorStop(1, hexToRgba(color, alphaEnd));
      
      ctx.fillStyle = grad;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * glowIntensity;
      ctx.fill();
      ctx.shadowBlur = 0;

      // ============================================================
      // لایه دوم: پرتو نوری محو (برای افکت فلر)
      // ============================================================
      
      ctx.globalAlpha = opacity * 0.2;
      const glowGrad = ctx.createLinearGradient(
        startX, startY,
        endX * 1.5, endY * 1.5
      );
      glowGrad.addColorStop(0, hexToRgba(color, 0.4));
      glowGrad.addColorStop(0.5, hexToRgba(color, 0.1));
      glowGrad.addColorStop(1, 'transparent');
      
      ctx.shadowColor = color;
      ctx.shadowBlur = 25 * glowIntensity;
      ctx.lineWidth = armWidth * 1.5;
      ctx.strokeStyle = glowGrad;
      ctx.beginPath();
      ctx.moveTo(startX * 0.2, startY * 0.2);
      ctx.lineTo(endX * 1.3, endY * 1.3);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ============================================================
    // ۳. هسته مرکزی پرنور (نقطه سفید درخشان)
    // ============================================================
    
    ctx.globalAlpha = opacity * 0.95;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * glowIntensity;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // ============================================================
    // ۴. افکت فلر نوری (هاله‌های رنگی دور هسته)
    // ============================================================
    
    ctx.globalAlpha = opacity * 0.15;
    ctx.shadowBlur = 0;
    const flareGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 8);
    flareGrad.addColorStop(0, hexToRgba(color, 0.3));
    flareGrad.addColorStop(0.3, hexToRgba(color, 0.08));
    flareGrad.addColorStop(0.7, hexToRgba('#FFFFFF', 0.05));
    flareGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flareGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // بروزرسانی موقعیت ستاره‌ها
    for (const star of stars) {
      star.y += star.speed;
      star.rotation += star.rotationSpeed;
      star.phase += 0.005;
      // نوسان بسیار ملایم درخشش
      star.opacity = (0.3 + Math.sin(star.phase) * 0.08) * (0.85 + Math.random() * 0.1);
    }

    // حذف ستاره‌هایی که از پایین خارج شده‌اند
    stars = stars.filter(s => s.y - s.armLength < height + 30);
    
    // ایجاد ستاره‌های جدید
    while (stars.length < MAX_STARS) {
      const star = createStar();
      star.y = -star.armLength - Math.random() * 100;
      stars.push(star);
    }

    // مرتب‌سازی بر اساس شفافیت (ترسیم از شفاف‌تر به کدرتر برای عمق)
    stars.sort((a, b) => a.opacity - b.opacity);

    // رسم ستاره‌ها
    for (const star of stars) {
      drawStar(star);
    }

    requestAnimationFrame(animate);
  }

  // راه‌اندازی
  window.addEventListener('resize', () => {
    resize();
    stars.forEach(s => {
      s.x = Math.min(Math.max(s.x, 0), width);
      s.y = Math.min(Math.max(s.y, 0), height);
    });
  });

  resize();
  
  // ستاره‌های اولیه با توزیع بهتر
  for (let i = 0; i < MAX_STARS; i++) {
    const star = createStar();
    star.y = Math.random() * height;
    star.x = Math.random() * width;
    stars.push(star);
  }
  
  animate();
})();