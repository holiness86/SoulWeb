/**
 * تیم سُل وب — script.js v3 "Liquid Glass"
 * بر پایه jQuery 3.7.1 + Bootstrap 5.3 RTL
 * ═══════════════════════════════════════════
 */

$(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isDesktop    = window.innerWidth >= 992;

  /* ═══════════════════════════════════════════
     Utility: Debounce
  ═══════════════════════════════════════════ */
  function debounce(fn, delay) {
    let timer;
    return function () { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, arguments), delay); };
  }

  /* ═══════════════════════════════════════════
     0. Preloader
  ═══════════════════════════════════════════ */
  const $preloader = $('#preloader');
  if ($preloader.length) {
    $(window).on('load', function () {
      setTimeout(function () {
        $preloader.addClass('hidden');
        setTimeout(function () { $preloader.remove(); }, 600);
      }, 400);
    });
  }

  /* ═══════════════════════════════════════════
     1. Header: Scroll State (تکه‌های شیشه‌ای هم‌زمان)
  ═══════════════════════════════════════════ */
  const $siteHeader      = $('#siteHeader');
  const SCROLL_THRESHOLD = 40;

  function handleHeaderScroll() {
    $siteHeader.toggleClass('scrolled', $(window).scrollTop() > SCROLL_THRESHOLD);
  }
  $(window).on('scroll.header', handleHeaderScroll);
  handleHeaderScroll();

  /* ═══════════════════════════════════════════
     2. Theme Toggle — Fluid Bubble Transition
  ═══════════════════════════════════════════ */
  const $html         = $('html');
  const $themeToggle   = $('#themeToggle');
  const STORAGE_KEY     = 'sol-theme';

  function syncThemeIcon(theme) {
    $themeToggle.find('i').attr('class', 'bi ' + (theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'));
  }
  syncThemeIcon($html.attr('data-bs-theme') || 'light');

  function commitTheme(theme) {
    $html.attr('data-bs-theme', theme);
    syncThemeIcon(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  $themeToggle.on('click', function () {
    const nextTheme = $html.attr('data-bs-theme') === 'dark' ? 'light' : 'dark';

    if (reduceMotion) { commitTheme(nextTheme); return; }
    if ($('.theme-bubble-wrap').length) return; // جلوگیری از تداخل انیمیشن‌ها

    const rect = this.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const bubbleColor = nextTheme === 'dark' ? '#10102a' : '#f7f7fb';

    const maxDist = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const scaleMain = (maxDist * 2.3) / 40;

    const $wrap = $('<div class="theme-bubble-wrap" id="themeBubbleWrap"></div>').css({
      '--x': x + 'px', '--y': y + 'px', '--scale-main': scaleMain
    });
    ['main', 'drop d1', 'drop d2', 'drop d3'].forEach(function (cls) {
      $wrap.append($('<span class="theme-bubble ' + cls + '"></span>').css('--bubble-color', bubbleColor));
    });
    $('body').append($wrap);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { $wrap.addClass('expand'); });
    });

    setTimeout(function () { commitTheme(nextTheme); }, 1000);
    setTimeout(function () { $wrap.removeClass('expand'); }, 1080);
    setTimeout(function () { $wrap.remove(); }, 2100);
  });

  /* ═══════════════════════════════════════════
     3. اسکرول نرم — Anchor Links و Back To Top
     (روی اسکرول Wheel/Touch دست نمی‌زنیم؛ اسکرول native
      مرورگر خودش کاملا روانه. فقط پرش‌های برنامه‌ای —
      Anchor و Back-To-Top — را با scrollTo نرم می‌کنیم
      تا با scroll-behavior:smooth تداخل/Loop ایجاد نشود)
  ═══════════════════════════════════════════ */
  function smoothScrollTo(y) {
    const top = Math.max(0, y);
    if (reduceMotion) {
      window.scrollTo(0, top);
    } else {
      window.scrollTo({ top: top, left: 0, behavior: 'smooth' });
    }
  }

  $(document).on('click', 'a[href^="#"]', function (e) {
    const target = $(this).attr('href');
    if (!target || target === '#') return;
    const $target = $(target);
    if (!$target.length) return;

    e.preventDefault();

    const $panel = $('#mobileNavPanel');
    if ($panel.hasClass('show')) {
      bootstrap.Collapse.getInstance($panel[0])?.hide();
    }

    const offset = $siteHeader.outerHeight() + 24;
    smoothScrollTo($target.offset().top - offset);
  });

  $('.mobile-nav-links a').on('click', function () {
    const $panel = $('#mobileNavPanel');
    if ($panel.hasClass('show')) {
      bootstrap.Collapse.getOrCreateInstance($panel[0]).hide();
    }
  });

  /* ═══════════════════════════════════════════
     4. Back To Top
  ═══════════════════════════════════════════ */
  const $backToTop = $('#backToTop');
  $(window).on('scroll.btt', function () {
    $backToTop.toggleClass('visible', $(this).scrollTop() > 400);
  });
  $backToTop.on('click', function () {
    smoothScrollTo(0);
  });

  /* ═══════════════════════════════════════════
     5. Scroll Reveal (Intersection Observer)
  ═══════════════════════════════════════════ */
  if ('IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          $(entry.target).addClass('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    $('[class*="reveal"]').each(function () { revealObs.observe(this); });
  } else {
    $('[class*="reveal"]').addClass('visible');
  }

  /* ═══════════════════════════════════════════
     6. Counter Animation
  ═══════════════════════════════════════════ */
  let countersStarted = false;

  function animateCounters() {
    if (countersStarted) return;
    countersStarted = true;

    $('.counter[data-target]').each(function () {
      const $el    = $(this);
      const target = parseInt($el.attr('data-target'), 10);
      const prefix = $el.attr('data-prefix') || '';
      const suffix = $el.attr('data-suffix') || '';
      const dur    = parseInt($el.attr('data-dur') || '2000', 10);
      const steps  = Math.ceil(dur / 16);
      let   cur    = 0;

      const timer = setInterval(function () {
        cur++;
        const val = Math.round(easeOut(cur, 0, target, steps));
        $el.text(prefix + val.toLocaleString('fa-IR') + suffix);
        if (cur >= steps) {
          $el.text(prefix + target.toLocaleString('fa-IR') + suffix);
          clearInterval(timer);
        }
      }, 16);
    });
  }

  function easeOut(t, b, c, d) {
    t /= d;
    return -c * t * (t - 2) + b;
  }

  if ('IntersectionObserver' in window) {
    const statsObs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { animateCounters(); statsObs.disconnect(); }
    }, { threshold: 0.3 });
    const $stats = $('.stats-section');
    if ($stats.length) statsObs.observe($stats[0]);
  }

  /* ═══════════════════════════════════════════
     7. Hero Particle Dots
  ═══════════════════════════════════════════ */
  const $heroDots = $('.hero-dots');
  if ($heroDots.length) {
    let html = '';
    for (let i = 0; i < 30; i++) {
      const top   = Math.random() * 100;
      const right = Math.random() * 100;
      const delay = (Math.random() * 4).toFixed(2);
      const dur   = (2 + Math.random() * 3).toFixed(2);
      const size  = Math.random() > 0.8 ? 6 : 4;
      html += `<span style="top:${top}%;right:${right}%;animation-delay:${delay}s;animation-duration:${dur}s;width:${size}px;height:${size}px;"></span>`;
    }
    $heroDots.html(html);
  }

  /* ═══════════════════════════════════════════
     8. Portfolio Filter
  ═══════════════════════════════════════════ */
  $(document).on('click', '.filter-btn', function () {
    const $btn   = $(this);
    const filter = $btn.attr('data-filter');

    $btn.siblings('.filter-btn').removeClass('active');
    $btn.addClass('active');

    const $items = $('.portfolio-item');
    if (filter === '*') {
      $items.fadeIn(300);
    } else {
      $items.each(function () {
        const $item = $(this);
        $item.hasClass(filter.replace('.', '')) ? $item.fadeIn(300) : $item.fadeOut(200);
      });
    }
  });

  /* ═══════════════════════════════════════════
     9. Tooltip & Popover Init
  ═══════════════════════════════════════════ */
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    new bootstrap.Tooltip(el, { boundary: 'window' });
  });
  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(function (el) {
    new bootstrap.Popover(el);
  });

  /* ═══════════════════════════════════════════
     10. کرسر اختصاصی مایع (Liquid Custom Cursor)
  ═══════════════════════════════════════════ */
  if (finePointer && !reduceMotion) {
    $html.addClass('cursor-ready');

    const $dot  = $('.cursor-dot');
    const $ring = $('.cursor-ring');
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let ringX = mouseX, ringY = mouseY;
    const EASE = 0.16;

    $(window).on('mousemove.cursor', function (e) {
      mouseX = e.clientX; mouseY = e.clientY;
      $dot[0].style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%,-50%)`;
    });

    (function raf() {
      ringX += (mouseX - ringX) * EASE;
      ringY += (mouseY - ringY) * EASE;
      $ring[0].style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
      requestAnimationFrame(raf);
    })();

    const HOVER_SELECTOR = 'a, button, .btn, .filter-btn, .card-sol, [role="button"], [data-cursor-hover], input, textarea, select';
    $(document).on('mouseenter.cursor', HOVER_SELECTOR, function () { $html.addClass('cursor-hover'); });
    $(document).on('mouseleave.cursor', HOVER_SELECTOR, function () { $html.removeClass('cursor-hover'); });

    $(document).on('mousedown.cursor', function (e) {
      const $ripple = $('<span class="cursor-ripple"></span>').css({ top: e.clientY, left: e.clientX });
      $('body').append($ripple);
      setTimeout(function () { $ripple.remove(); }, 700);
    });

    $(document).on('mouseleave.cursorPage', function () { $dot.add($ring).css('opacity', 0); });
    $(document).on('mouseenter.cursorPage', function () { $dot.add($ring).css('opacity', 1); });
  }

  /* ═══════════════════════════════════════════
     11. روح سیال — پارالاکس هیرو با موس
  ═══════════════════════════════════════════ */
  if (isDesktop && !reduceMotion) {
    const $heroVisual = $('#heroVisual');
    const soulOrb      = document.getElementById('soulOrb');
    if ($heroVisual.length && soulOrb) {
      $heroVisual.on('mousemove.soul', function (e) {
        const rect = this.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        soulOrb.style.setProperty('--rx', (px * 22) + 'deg');
        soulOrb.style.setProperty('--ry', (py * -22) + 'deg');
      }).on('mouseleave.soul', function () {
        soulOrb.style.setProperty('--rx', '0deg');
        soulOrb.style.setProperty('--ry', '0deg');
      });
    }
  }

  /* ═══════════════════════════════════════════
     12. المان‌های معلق پس‌زمینه (Floating Parallax)
  ═══════════════════════════════════════════ */
  if (isDesktop && !reduceMotion) {
    const $floaters = $('.floating-parallax');
    let floatTicking = false;
    function updateFloatParallax() {
      const scrollY = window.scrollY;
      $floaters.each(function () {
        const speed = parseFloat($(this).attr('data-speed')) || 0.1;
        this.style.transform = `translateY(${scrollY * speed}px)`;
      });
      floatTicking = false;
    }
    $(window).on('scroll.floatParallax', function () {
      if (!floatTicking) { requestAnimationFrame(updateFloatParallax); floatTicking = true; }
    });
    updateFloatParallax();
  }

  /* ═══════════════════════════════════════════
     13. مسیر منحنی خط‌چین «چطور کار می‌کنیم؟»
  ═══════════════════════════════════════════ */
  function initWorkflowPaths() {
    document.querySelectorAll('.workflow-progress').forEach(function (path) {
      const len = path.getTotalLength();
      path.style.strokeDasharray  = len;
      path.style.strokeDashoffset = len;
    });
  }
  initWorkflowPaths();
  $(window).on('resize.workflow', debounce(initWorkflowPaths, 250));

  if ('IntersectionObserver' in window) {
    const workflowObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          $(entry.target).addClass('in-view');
          entry.target.querySelectorAll('.workflow-progress').forEach(function (p) {
            p.style.strokeDashoffset = '0';
          });
          workflowObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('.workflow-wrap, .workflow-wrap-mobile').forEach(function (el) {
      workflowObs.observe(el);
    });
  } else {
    $('.workflow-wrap, .workflow-wrap-mobile').addClass('in-view');
    document.querySelectorAll('.workflow-progress').forEach(function (p) { p.style.strokeDashoffset = '0'; });
  }

  /* ═══════════════════════════════════════════
     14. کارت‌های معلق نظرات — پارالاکس پراکنده
  ═══════════════════════════════════════════ */
  if (isDesktop && !reduceMotion) {
    const $testiCards = $('.testimonial-glass');
    if ($testiCards.length) {
      let testiTicking = false;
      function updateTestimonialParallax() {
        const vh = window.innerHeight;
        $testiCards.each(function () {
          const depth = parseFloat($(this).attr('data-depth')) || 0.2;
          const rect  = this.getBoundingClientRect();
          const centerDelta = (rect.top + rect.height / 2) - vh / 2;
          this.style.setProperty('--parallax-y', (centerDelta * depth * -0.05) + 'px');
        });
        testiTicking = false;
      }
      $(window).on('scroll.testiParallax', function () {
        if (!testiTicking) { requestAnimationFrame(updateTestimonialParallax); testiTicking = true; }
      });
      updateTestimonialParallax();
    }
  }

  /* ═══════════════════════════════════════════
     15. Scroll Progress Bar
  ═══════════════════════════════════════════ */
  const $progressBar = $('#scrollProgress');
  if ($progressBar.length) {
    $(window).on('scroll.progress', function () {
      const scrollTop  = $(window).scrollTop();
      const docHeight  = $(document).height() - $(window).height();
      const percent    = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      $progressBar.css('width', percent + '%');
    });
  }

  /* ═══════════════════════════════════════════
     16. Lazy Load Images
  ═══════════════════════════════════════════ */
  if ('IntersectionObserver' in window) {
    const lazyObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const $img = $(entry.target);
          const src  = $img.attr('data-src');
          if (src) $img.attr('src', src).removeAttr('data-src').addClass('img-loaded');
          lazyObs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '100px' });
    $('img[data-src]').each(function () { lazyObs.observe(this); });
  } else {
    $('img[data-src]').each(function () {
      $(this).attr('src', $(this).attr('data-src')).removeAttr('data-src');
    });
  }

  /* ═══════════════════════════════════════════
     17. Toast Notification Helper
  ═══════════════════════════════════════════ */
  function showToast(message, type) {
    type = type || 'info';
    const colors = { success: 'var(--main-500)', error: '#ef4444', info: 'var(--accent-500)', warning: '#f59e0b' };
    const icons  = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-triangle-fill' };

    let $container = $('#toast-container');
    if (!$container.length) {
      $container = $('<div id="toast-container" class="position-fixed bottom-0 start-0 p-3" style="z-index:9999"></div>');
      $('body').append($container);
    }

    const id     = 'toast-' + Date.now();
    const $toast = $(`
      <div id="${id}" class="toast align-items-center show mb-2" role="alert" aria-live="assertive" aria-atomic="true"
           style="min-width:300px;border-right:4px solid ${colors[type]}">
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2 fw-semibold" style="font-family:var(--font-primary)">
            <i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1.1rem;"></i>
            ${message}
          </div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="بستن"></button>
        </div>
      </div>
    `);
    $container.append($toast);
    const bsToast = new bootstrap.Toast($toast[0], { delay: 4000, animation: true });
    bsToast.show();
    $toast[0].addEventListener('hidden.bs.toast', function () { $toast.remove(); });
  }

  /* ═══════════════════════════════════════════
     18. Window Resize Handler
  ═══════════════════════════════════════════ */
  $(window).on('resize', debounce(function () {
    if (window.innerWidth < 992) {
      $('.hero-blob, .float-soft').css('transform', '');
    }
  }, 200));

  /* ═══════════════════════════════════════════
     Init Complete
  ═══════════════════════════════════════════ */
  console.log('%c تیم سُل وب 🚀 Liquid Glass ', 'background:linear-gradient(135deg,#6447f4,#0090e8);color:#fff;font-size:14px;font-weight:bold;font-family: "YekanBakh", "Tahoma", sans-serif;padding:8px 16px;border-radius:8px;');

}); // end document.ready