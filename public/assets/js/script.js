/**
 * تیم سُل وب — script.js v2
 * بر پایه jQuery 3.7.1 + Bootstrap 5.3 RTL
 * ═══════════════════════════════════════════
 */

$(function () {
  'use strict';

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
     1. Navbar: Scroll State + Floating Effect
  ═══════════════════════════════════════════ */
  const $navbar          = $('.navbar-sol');
  const SCROLL_THRESHOLD = 60;

  function handleNavbarScroll() {
    $navbar.toggleClass('scrolled', $(window).scrollTop() > SCROLL_THRESHOLD);
  }
  $(window).on('scroll.navbar', handleNavbarScroll);
  handleNavbarScroll();

  /* ═══════════════════════════════════════════
     2. Theme Toggle (Dark / Light)
  ═══════════════════════════════════════════ */
  const $html        = $('html');
  const $themeToggle = $('#themeToggle');
  const STORAGE_KEY  = 'sol-theme';

  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(savedTheme);

  $themeToggle.on('click', function () {
    const next = $html.attr('data-bs-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });

  function applyTheme(theme) {
    $html.attr('data-bs-theme', theme);
    $themeToggle.find('i').attr('class', 'bi ' + (theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'));
  }

  /* ═══════════════════════════════════════════
     3. Smooth Scroll — Anchor Links
  ═══════════════════════════════════════════ */
  $(document).on('click', 'a[href^="#"]', function (e) {
    const target = $(this).attr('href');
    if (!target || target === '#') return;
    const $target = $(target);
    if (!$target.length) return;

    e.preventDefault();

    // Close mobile nav
    const $collapse = $('.navbar-collapse');
    if ($collapse.hasClass('show')) {
      bootstrap.Collapse.getInstance($collapse[0])?.hide();
    }

    const offset = $navbar.outerHeight() + 20;
    $('html, body').animate({ scrollTop: $target.offset().top - offset }, 600, 'swing');
  });

  /* ═══════════════════════════════════════════
     4. Back To Top
  ═══════════════════════════════════════════ */
  const $backToTop = $('#backToTop');
  $(window).on('scroll.btt', function () {
    $backToTop.toggleClass('visible', $(this).scrollTop() > 400);
  });
  $backToTop.on('click', function () {
    $('html, body').animate({ scrollTop: 0 }, 600, 'swing');
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
     10. Card Tilt Effect (desktop)
  ═══════════════════════════════════════════ */
  if (window.innerWidth >= 992) {
    $(document).on('mousemove', '.card-sol', function (e) {
      const $card  = $(this);
      const offset = $card.offset();
      const cw     = $card.outerWidth();
      const ch     = $card.outerHeight();
      const mx     = e.pageX - offset.left;
      const my     = e.pageY - offset.top;
      const tiltX  = ((my / ch) - 0.5) * 8;
      const tiltY  = ((mx / cw) - 0.5) * -8;
      $card.css({
        transform : `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`,
        transition: 'transform 0.1s ease'
      });
    });
    $(document).on('mouseleave', '.card-sol', function () {
      $(this).css({ transform: '', transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1)' });
    });
  }

  /* ═══════════════════════════════════════════
     11. Navbar Mobile — Close on Link Click
  ═══════════════════════════════════════════ */
  $('.navbar-nav .nav-link').on('click', function () {
    const $col = $('#navbarNav');
    if ($col.hasClass('show')) {
      bootstrap.Collapse.getOrCreateInstance($col[0]).hide();
    }
  });

  /* ═══════════════════════════════════════════
     12. Scroll Progress Bar
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
     13. Parallax Hero Background
  ═══════════════════════════════════════════ */
  if (window.innerWidth >= 992) {
    const $heroBlobs = $('.hero-blob');
    $(window).on('scroll.parallax', function () {
      const scrollY = $(window).scrollTop();
      $heroBlobs.each(function (i) {
        $(this).css('transform', `translateY(${scrollY * (i + 1) * 0.1}px)`);
      });
    });
  }

  /* ═══════════════════════════════════════════
     14. Section Active Highlight (ScrollSpy)
  ═══════════════════════════════════════════ */
  const $body = $('body');
  if ($body.attr('data-bs-spy')) {
    bootstrap.ScrollSpy.getOrCreateInstance($body[0]).refresh();
  }

  /* ═══════════════════════════════════════════
     15. Lazy Load Images
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
     16. Bootstrap Carousel — RTL Fix
  ═══════════════════════════════════════════ */
  $('.carousel').each(function () {
    bootstrap.Carousel.getOrCreateInstance(this, { ride: false, touch: true });
  });

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
     Utility: Debounce
  ═══════════════════════════════════════════ */
  function debounce(fn, delay) {
    let timer;
    return function () { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, arguments), delay); };
  }

  /* ═══════════════════════════════════════════
     18. Window Resize Handler
  ═══════════════════════════════════════════ */
  $(window).on('resize', debounce(function () {
    if (window.innerWidth < 992) $('.hero-blob').css('transform', '');
  }, 200));

  /* ═══════════════════════════════════════════
     Init Complete
  ═══════════════════════════════════════════ */
  console.log('%c تیم سُل وب 🚀 ', 'background:linear-gradient(135deg,#6447f4,#0090e8);color:#fff;font-size:14px;font-weight:bold;font-family: "YekanBakh", "Tahoma", sans-serif;padding:8px 16px;border-radius:8px;');

}); // end document.ready
