/**
 * سُل وب — admin.js
 * اسکریپت‌های مشترک پنل مدیریت
 * ══════════════════════════════════════════
 */

(function () {
  'use strict';

  /* ── Theme Toggle ── */
  const html     = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const TKEY     = 'sol-admin-theme';

  applyTheme(localStorage.getItem(TKEY) || 'light');

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(TKEY, next);
    });
  }

  function applyTheme(t) {
    html.setAttribute('data-bs-theme', t);
    if (themeBtn) {
      themeBtn.innerHTML = t === 'dark'
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-stars-fill"></i>';
    }
  }

  /* ── Sidebar Toggle ── */
  const sidebar     = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const toggleBtn   = document.getElementById('sidebarToggle');
  const overlay     = document.getElementById('sidebarOverlay');

  let isMini   = false;
  let isMobile = window.innerWidth <= 768;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      if (isMobile) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('show');
      } else {
        isMini = !isMini;
        sidebar.classList.toggle('mini', isMini);
        mainContent.classList.toggle('mini', isMini);
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('show');
    });
  }

  window.addEventListener('resize', function () {
    isMobile = window.innerWidth <= 768;
    if (!isMobile && overlay) {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('show');
    }
  });

  /* ── Active Nav Item ── */
  // فقط کلیک روی آیتم‌های #hash را مدیریت می‌کند
  // آیتم‌های واقعی (href دار) از سرور active می‌شوند
  document.querySelectorAll('.nav-item-sol[href="#"]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });

  /* ── Fullscreen ── */
  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
        fsBtn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
      } else {
        document.exitFullscreen();
        fsBtn.innerHTML = '<i class="bi bi-fullscreen"></i>';
      }
    });
  }

  /* ── Fade-Up Scroll Animation ── */
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.style.animationPlayState = 'running';
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    document.querySelectorAll('.fade-up').forEach(function (el) {
      el.style.animationPlayState = 'paused';
      obs.observe(el);
    });
  }

  /* ── Modal Helper (global) ── */
  // هر دکمه‌ای با data-modal-open="ID" مودال را باز می‌کند
  // هر دکمه‌ای با data-modal-close مودال را می‌بندد
  document.addEventListener('click', function (e) {
    const openBtn = e.target.closest('[data-modal-open]');
    if (openBtn) {
      const modal = document.getElementById(openBtn.dataset.modalOpen);
      if (modal) modal.classList.add('open');
    }

    const closeBtn = e.target.closest('[data-modal-close]');
    if (closeBtn) {
      const modal = closeBtn.closest('.modal-overlay');
      if (modal) modal.classList.remove('open');
    }

    // کلیک روی backdrop
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // بستن با Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(function (m) {
        m.classList.remove('open');
      });
    }
  });

  /* ── Task Checkboxes (اگر در صفحه باشند) ── */
  document.addEventListener('click', function (e) {
    const check = e.target.closest('.task-check');
    if (!check) return;
    const isDone = check.classList.toggle('done');
    check.innerHTML = isDone ? '<i class="bi bi-check-lg"></i>' : '';
    const text = check.nextElementSibling;
    if (text && text.classList.contains('task-text')) {
      text.classList.toggle('done', isDone);
    }
  });

  /* ── Counter Animation ── */
  function animateCounters() {
    document.querySelectorAll('.stat-value[data-count]').forEach(function (el) {
      const target   = parseInt(el.getAttribute('data-count'), 10);
      const suffix   = el.getAttribute('data-suffix') || '';
      const steps    = Math.ceil(1200 / 16);
      let   cur      = 0;
      const timer    = setInterval(function () {
        cur++;
        const v = Math.round(easeOut(cur, 0, target, steps));
        el.textContent = v.toLocaleString('fa-IR') + suffix;
        if (cur >= steps) { el.textContent = target.toLocaleString('fa-IR') + suffix; clearInterval(timer); }
      }, 16);
    });
  }
  function easeOut(t, b, c, d) { t /= d; return -c * t * (t - 2) + b; }

  if ('IntersectionObserver' in window) {
    const sg = document.querySelector('.stat-grid');
    if (sg) {
      const cObs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { animateCounters(); cObs.disconnect(); }
      }, { threshold: 0.2 });
      cObs.observe(sg);
    }
  }

  /* ── Chart Bars (اگر در صفحه باشند) ── */
  document.querySelectorAll('.chart-bar').forEach(function (bar) {
    bar.addEventListener('click', function () {
      document.querySelectorAll('.chart-bar').forEach(function (b) { b.classList.remove('active'); });
      bar.classList.add('active');
    });
  });

  /* ── Filter Chips ── */
  document.querySelectorAll('.filter-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const group = chip.closest('[data-filter-group]') || chip.parentElement;
      group.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
    });
  });

  /* ── View Toggle (Kanban / Table) ── */
  const viewKanban = document.getElementById('viewKanban');
  const viewTable  = document.getElementById('viewTable');
  const kanbanView = document.getElementById('kanbanView');
  const tableView  = document.getElementById('tableView');

  if (viewKanban && viewTable) {
    viewKanban.addEventListener('click', function () {
      if (kanbanView) kanbanView.style.display = '';
      if (tableView)  tableView.style.display  = 'none';
      viewKanban.classList.add('active');
      viewTable.classList.remove('active');
    });
    viewTable.addEventListener('click', function () {
      if (tableView)  tableView.style.display  = '';
      if (kanbanView) kanbanView.style.display  = 'none';
      viewTable.classList.add('active');
      viewKanban.classList.remove('active');
    });
  }

})();


