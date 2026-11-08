/* admin.js — رفتار پنل مدیریت سُل وب (/sw-admin). بدون وابستگی (jQuery/Bootstrap فقط برای بخش‌های دیگر صفحات).
   ۱) Shell: تم (افشای دایره‌ای) · Sidebar (جمع‌شدن/Drawer + سوایپ) · منوی کاربر · تمام‌صفحه · Modal (+Bottom-sheet) · شمارنده‌ها
   ۲) SW.island/toast/loading (Dynamic Island) · SW.confirm · اعلان‌های زنده · جستجوی سریع (Ctrl/⌘+K) · آفلاین/آنلاین
   ۳) ابزارها: SW.table · SW.validate · SW.csv · SW.fmt · SW.h · data-sw-confirm · data-validate · دسترس‌پذیری
   اصل کارایی: فقط کلاس‌ها/transform تغییر می‌کنند؛ listenerها delegated؛ polling فقط وقتی تب دیده می‌شود. */
(function () {
  'use strict';
  var d = document, body = d.body, root = d.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; }
  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  function haptic(t) { try { if (navigator.vibrate) navigator.vibrate(t === 'error' ? [14, 40, 14] : t === 'success' ? 10 : 6); } catch (_) {} }
  var fa = function (n) { return Number(n).toLocaleString('fa-IR'); };
  var mobile = function () { return matchMedia('(max-width:991.98px)').matches; };
  function norm(s) { return String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).toLowerCase(); }

  /* ═══════════ تم (کلید sol-theme مشترک با سایت اصلی) ═══════════ */
  function applyTheme(t) {
    root.setAttribute('data-bs-theme', t);
    var i = $('#themeToggle i'); if (i) i.className = 'bi ' + (t === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill');
  }
  applyTheme(store('sol-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  function switchTheme(btn) {
    var n = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    store('sol-theme', n);
    if (reduce || !d.startViewTransition) return applyTheme(n);
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('sw-theme-vt');
    var vt = d.startViewTransition(function () { applyTheme(n); });
    vt.ready.then(function () {
      root.animate({ clipPath: ['circle(0 at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
    vt.finished.then(function () { root.classList.remove('sw-theme-vt'); }, function () { root.classList.remove('sw-theme-vt'); });
  }

  /* ═══════════ Sidebar: دسکتاپ = جمع/باز (ذخیره می‌شود)، موبایل = Drawer با سوایپ ═══════════ */
  if (!mobile() && store('sw-sidebar') === 'collapsed') body.classList.add('sidebar-collapsed');
  var overlay = $('#sidebarOverlay');
  if (!overlay && $('.sidebar')) { overlay = el('div', 'sidebar-overlay'); overlay.id = 'sidebarOverlay'; body.appendChild(overlay); }
  function syncNav() {
    var t = $('#sidebarToggle');
    if (t) t.setAttribute('aria-expanded', mobile() ? String(body.classList.contains('sidebar-open')) : String(!body.classList.contains('sidebar-collapsed')));
    var collapsed = body.classList.contains('sidebar-collapsed') && !mobile();
    $$('.nav-item-sol').forEach(function (a) {
      var tx = $('.nav-text', a); if (!tx) return;
      if (collapsed) a.setAttribute('title', tx.textContent.trim()); else a.removeAttribute('title');
    });
  }
  function closeDrawer() { body.classList.remove('sidebar-open'); syncNav(); }

  var tg = { a: false }, sb, SW_W = 264;
  d.addEventListener('touchstart', function (e) {
    if (!mobile() || e.touches.length !== 1) return;
    var t = e.touches[0], open = body.classList.contains('sidebar-open');
    if (open ? !e.target.closest('.sidebar') : t.clientX < innerWidth - 24) return;   // باز: فقط روی خود سایدبار · بسته: فقط لبه‌ی راست
    tg = { a: true, open: open, x: t.clientX, y: t.clientY, dx: 0, t: Date.now(), lock: null };
  }, { passive: true });
  d.addEventListener('touchmove', function (e) {
    if (!tg.a) return;
    var t = e.touches[0], dx = t.clientX - tg.x, dy = t.clientY - tg.y;
    if (tg.lock === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      tg.lock = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!tg.lock) { tg.a = false; return; }
      sb = $('.sidebar'); SW_W = sb.offsetWidth; body.classList.add('sidebar-dragging');
    }
    tg.dx = dx;
    var p = tg.open ? Math.max(0, Math.min(SW_W, dx)) : Math.max(0, Math.min(SW_W, SW_W + dx));
    sb.style.transform = 'translateX(' + p + 'px)';
    if (overlay) overlay.style.opacity = String(1 - p / SW_W);
  }, { passive: true });
  function endDrag() {
    if (!tg.a) return;
    var wasLocked = tg.lock; tg.a = false;
    if (!wasLocked) return;
    var v = tg.dx / Math.max(1, Date.now() - tg.t);
    var openIt = tg.open ? !(tg.dx > SW_W * .3 || v > .6) : (tg.dx < -SW_W * .3 || v < -.6);
    body.classList.remove('sidebar-dragging'); sb.style.transform = ''; if (overlay) overlay.style.opacity = '';
    body.classList.toggle('sidebar-open', openIt); syncNav();
  }
  d.addEventListener('touchend', endDrag, { passive: true });
  d.addEventListener('touchcancel', endDrag, { passive: true });

  /* ═══════════ منوی کاربر (Drop-up) — capture تا اسکریپت inline قدیمی پارشیال دوباره toggle نکند ═══════════ */
  var dd = $('#userDropdown'), ddTr = $('#userDropdownTrigger'), ddMenu = $('#userDropdownMenu');
  function setMenu(o) { if (!dd) return; dd.classList.toggle('open', o); ddTr.setAttribute('aria-expanded', String(o)); }
  d.addEventListener('click', function (e) {
    if (!dd) return;
    if (e.target.closest('#userDropdownTrigger')) { e.stopImmediatePropagation(); setMenu(!dd.classList.contains('open')); return; }
    if (!dd.contains(e.target) || e.target.closest('.user-dropdown-item')) setMenu(false);
  }, true);
  d.addEventListener('keydown', function (e) {
    if (!dd) return;
    var open = dd.classList.contains('open');
    if (e.key === 'Escape' && open) { setMenu(false); ddTr.focus(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (open || e.target === ddTr)) {
      e.preventDefault(); if (!open) setMenu(true);
      var it = $$('.user-dropdown-item', ddMenu), i = it.indexOf(d.activeElement);
      (it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length] || it[0]).focus();
    }
  });

  /* ═══════════ کلیک‌های سراسری: تم · سایدبار · تمام‌صفحه ═══════════ */
  d.addEventListener('click', function (e) {
    var th = e.target.closest('#themeToggle'); if (th) { switchTheme(th); return; }
    if (e.target.closest('#sidebarToggle')) {
      if (mobile()) body.classList.toggle('sidebar-open');
      else { body.classList.toggle('sidebar-collapsed'); store('sw-sidebar', body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'open'); }
      syncNav();
    } else if (e.target.closest('#sidebarOverlay') || (mobile() && e.target.closest('.nav-item-sol'))) closeDrawer();
    if (e.target.closest('#fullscreenBtn')) { if (!d.fullscreenElement) root.requestFullscreen && root.requestFullscreen(); else d.exitFullscreen && d.exitFullscreen(); }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('sidebar-open')) closeDrawer(); });
  addEventListener('resize', function () { if (!mobile()) body.classList.remove('sidebar-open'); syncNav(); });

  /* ═══════════ Modal: [data-modal-open="id"] / [data-modal-close] / openModal(id) / closeModal(id) ═══════════ */
  var MODAL_CLS = ['active', 'show', 'open'];
  function isOpen(m) { return MODAL_CLS.some(function (c) { return m.classList.contains(c); }); }
  function openModal(id) { var m = d.getElementById(id); if (!m) return; m.classList.add('active'); body.style.overflow = 'hidden'; }
  function closeModal(id) {
    var m = typeof id === 'string' ? d.getElementById(id) : id; if (!m) return;
    MODAL_CLS.forEach(function (c) { m.classList.remove(c); });
    if (!$$('.modal-overlay').some(isOpen)) body.style.overflow = '';
  }
  window.openModal = openModal; window.closeModal = closeModal;
  d.addEventListener('click', function (e) {
    var o = e.target.closest('[data-modal-open]');
    if (o) {
      e.preventDefault();
      var m = d.getElementById(o.getAttribute('data-modal-open'));
      if (m) {   // مبدأ انیمیشن = مرکز دکمه‌ی کلیک‌شده
        var r = o.getBoundingClientRect();
        m.style.setProperty('--sw-ox', Math.round(r.left + r.width / 2 - innerWidth / 2) + 'px');
        m.style.setProperty('--sw-oy', Math.round(r.top + r.height / 2 - innerHeight / 2) + 'px');
        m.__swTrigger = o;
      }
      openModal(o.getAttribute('data-modal-open')); return;
    }
    var c = e.target.closest('[data-modal-close]');
    if (c) { closeModal(c.closest('.modal-overlay')); return; }
    if (e.target.classList && e.target.classList.contains('modal-overlay')) closeModal(e.target);
  });

  // Bottom-sheet موبایل: کشیدن هدر/دستگیره به پایین = بستن
  (function () {
    var s = null;
    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch' || innerWidth > 575) return;
      var box = e.target.closest('.modal-box'); if (!box) return;
      var r = box.getBoundingClientRect();
      if (!(e.target.closest('.modal-head') || e.clientY - r.top < 36)) return;
      s = { box: box, y: e.clientY, dy: 0, t: Date.now() };
    });
    d.addEventListener('pointermove', function (e) {
      if (!s) return;
      s.dy = Math.max(0, e.clientY - s.y);
      if (s.dy > 4) { s.box.classList.add('dragging'); s.box.style.transform = 'translateY(' + s.dy + 'px)'; }
    });
    function end() {
      if (!s) return;
      var box = s.box, dy = s.dy, v = dy / Math.max(1, Date.now() - s.t); s = null;
      box.classList.remove('dragging'); box.style.transform = '';
      if (dy > 110 || v > .7) closeModal(box.closest('.modal-overlay'));
    }
    d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
  })();

  /* دسترس‌پذیری modalها: role/aria، فوکوس اولیه، Esc، focus trap، بازگشت فوکوس */
  function watchModals() {
    $$('.modal-overlay').forEach(function (m) {
      var box = $('.modal-box', m) || m; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      var ttl = $('.modal-title', m); if (ttl) { if (!ttl.id) ttl.id = (m.id || 'm') + '-t'; box.setAttribute('aria-labelledby', ttl.id); }
      new MutationObserver(function () {
        if (isOpen(m) && !m.__swOpen) { m.__swOpen = true; var f = $('input:not([type=hidden]),select,textarea,button', m); if (f) setTimeout(function () { f.focus(); }, 90); }
        else if (!isOpen(m) && m.__swOpen) { m.__swOpen = false; var t = m.__swTrigger; if (t && t.focus) t.focus(); }
      }).observe(m, { attributes: true, attributeFilter: ['class'] });
    });
  }
  d.addEventListener('keydown', function (e) {
    var m = $$('.modal-overlay').filter(isOpen).pop(); if (!m) return;
    if (e.key === 'Escape') { closeModal(m); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href],button:not(:disabled),input:not([type=hidden]):not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])', m); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  /* ═══════════ شمارنده‌ی آماری: data-count + data-suffix (وقتی وارد دید می‌شود) ═══════════ */
  function count(el) {
    var t = parseFloat(el.getAttribute('data-count')); if (isNaN(t)) return;
    var s = el.getAttribute('data-suffix'), sfx = s === 'K' ? 'هزار' : (s || '');
    if (reduce) { el.textContent = fa(t) + sfx; return; }
    var t0 = performance.now(), dur = 1000;
    (function tick(now) {
      var p = Math.min((now - t0) / dur, 1);
      el.textContent = fa(Math.round(t * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)))) + sfx;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function initCounters() {
    var els = $$('[data-count]');
    if (!('IntersectionObserver' in window)) return els.forEach(count);
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { count(en.target); io.unobserve(en.target); } }); }, { threshold: .3 });
    els.forEach(function (x) { io.observe(x); });
  }
  // ریتم ورود: --i برای لیست‌ها و ستون‌های نمودار (CSS با آن delay می‌دهد)
  function stagger() {
    var seen = new Map();
    $$('.feed-item,.msg-item,.task-item').forEach(function (x) { var i = seen.get(x.parentNode) || 0; x.style.setProperty('--i', Math.min(i, 10)); seen.set(x.parentNode, i + 1); });
    $$('.chart-bars').forEach(function (c) { $$('.chart-col', c).forEach(function (col, i) { col.style.setProperty('--i', i); $$('.chart-bar', col).forEach(function (b) { b.style.setProperty('--i', i); }); }); });
  }

  /* ═══════════ Dynamic Island ═══════════
     SW.island(text,{type,detail,ms,icon,actions:[{label,href|fn,ghost}],loading})  → { close, update, done, el }
     سوایپ به بالا = بستن · کلیک = باز/بسته‌شدن جزئیات · با نگه‌داشتن موس/لمس تایمر مکث می‌کند */
  var IC = { info: 'info-lg', success: 'check-lg', error: 'x-lg', warning: 'exclamation-lg' };
  var host, lastKey = '', lastAt = 0;
  function island(text, o) {
    o = o || {};
    var type = o.type || 'info', detail = o.detail || '', acts = o.actions || (o.action ? [o.action] : []);
    var ms = o.loading ? 0 : (o.ms != null ? o.ms : (detail || acts.length ? 6000 : 3800));
    var key = type + '|' + text;
    if (!o.loading && key === lastKey && Date.now() - lastAt < 1200) return { close: function () {}, update: function () {}, done: function () {}, el: null };
    lastKey = key; lastAt = Date.now();
    if (!host || !host.isConnected) { host = el('div', 'sw-isl-host'); host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); body.appendChild(host); }

    var slot = el('div', 'sw-slot'), wrap = el('div'), n = el('div', 'sw-island ' + type);
    var ic = el('span', 'ic' + (o.loading ? ' spin' : '')), ico = el('i', 'bi bi-' + (o.icon || IC[type] || IC.info)); ic.appendChild(ico);
    var bd = el('div', 'bd'), t = el('div', 't', text), dtw = el('div', 'dtw'), din = el('div', 'dt-in'), dt = el('div', 'dt', detail);
    var closed = false, timer = 0, bar = null, started = 0, remain = ms;
    function close() {
      if (closed) return; closed = true; clearTimeout(timer);
      slot.classList.remove('in'); slot.classList.add('out'); setTimeout(function () { slot.remove(); }, reduce ? 0 : 340);
    }
    din.appendChild(dt);
    if (acts.length) {
      var ab = el('div', 'acts');
      acts.forEach(function (a, i) {
        var b = el('button', 'ab' + (a.ghost || (i && !a.primary) ? ' ghost' : ''), a.label); b.type = 'button';
        b.addEventListener('click', function (ev) { ev.stopPropagation(); try { if (a.fn) a.fn(); } catch (_) {} close(); if (a.href) location.href = a.href; });
        ab.appendChild(b);
      });
      din.appendChild(ab);
    }
    dtw.appendChild(din); bd.appendChild(t); bd.appendChild(dtw); n.appendChild(ic); n.appendChild(bd);
    function mkBar() { if (bar) bar.remove(); if (!ms) return; bar = el('span', 'bar'); n.style.setProperty('--ms', ms + 'ms'); n.appendChild(bar); }
    function arm() { if (!ms || closed) return; started = Date.now(); clearTimeout(timer); timer = setTimeout(close, remain); n.classList.remove('paused'); }
    function pause() { if (!ms || closed || !timer) return; remain -= Date.now() - started; clearTimeout(timer); timer = 0; n.classList.add('paused'); }
    mkBar(); wrap.appendChild(n); slot.appendChild(wrap); host.appendChild(slot);
    var live = $$('.sw-slot:not(.out)', host); while (live.length > 3) { var old = live.shift(); old.classList.remove('in'); old.classList.add('out'); (function (s) { setTimeout(function () { s.remove(); }, 340); })(old); }
    raf2(function () { slot.classList.add('in'); arm(); });
    if (detail || acts.length) setTimeout(function () { if (!closed) n.classList.add('ex'); }, reduce ? 0 : 380);
    haptic(type);

    n.tabIndex = 0;
    n.addEventListener('pointerenter', pause); n.addEventListener('pointerleave', function () { if (!n.classList.contains('drag')) arm(); });
    n.addEventListener('focus', pause); n.addEventListener('blur', arm);
    var moved = false, sy = 0, sx = 0, down = false;
    n.addEventListener('pointerdown', function (e) { down = true; moved = false; sy = e.clientY; sx = e.clientX; pause(); try { n.setPointerCapture(e.pointerId); } catch (_) {} });
    n.addEventListener('pointermove', function (e) {
      if (!down) return; var dy = Math.min(0, e.clientY - sy);
      if (dy < -4) { moved = true; n.classList.add('drag'); n.style.transform = 'translateY(' + dy + 'px) scale(' + (1 + dy / 500) + ')'; n.style.opacity = String(1 + dy / 120); }
    });
    function up(e) {
      if (!down) return; down = false;
      var dy = e.clientY - sy; n.classList.remove('drag'); n.style.transform = ''; n.style.opacity = '';
      if (dy < -28) close(); else arm();
    }
    n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
    n.addEventListener('click', function () {
      if (moved) { moved = false; return; }
      if (!detail && !acts.length) return close();
      n.classList.toggle('ex');
    });
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.click(); } if (e.key === 'Escape') close(); });

    function update(txt, p) {
      p = p || {};
      if (txt != null) t.textContent = txt;
      if (p.type) { n.classList.remove('info', 'success', 'error', 'warning'); n.classList.add(p.type); ico.className = 'bi bi-' + (p.icon || IC[p.type] || IC.info); haptic(p.type); }
      if (p.loading === false) ic.classList.remove('spin');
      if (p.detail != null) { dt.textContent = p.detail; if (p.detail) n.classList.add('ex'); }
      if (p.ms != null) { ms = p.ms; remain = ms; mkBar(); arm(); }
    }
    return { close: close, update: update, el: n, done: function (txt, ty, det) { update(txt, { type: ty || 'success', loading: false, detail: det || '', ms: 3200 }); } };
  }
  function toast(text, o) { return island(text, o); }
  function loading(text, o) { o = o || {}; o.loading = true; return island(text, o); }

  /* ═══════════ دیالوگ تایید (Alert در دسکتاپ · Action-sheet در موبایل) ═══════════ */
  function confirmBox(o) {
    return new Promise(function (res) {
      var prev = d.activeElement, no = el('button', 'btn-ghost-sm', o.cancel || 'انصراف'), ok = el('button', o.danger === false ? 'btn-sol-sm' : 'btn-danger-sm', o.ok || 'تایید');
      no.type = ok.type = 'button';
      var dlg = el('div', 'sw-dialog'), ov = el('div', 'sw-ov'), act = el('div', 'act');
      dlg.setAttribute('role', 'alertdialog'); dlg.setAttribute('aria-modal', 'true');
      dlg.appendChild(el('h4', '', o.title || 'تایید')); dlg.appendChild(el('p', '', o.text || '')); act.appendChild(no); act.appendChild(ok); dlg.appendChild(act); ov.appendChild(dlg);
      function done(v) { ov.classList.remove('on'); d.removeEventListener('keydown', key); setTimeout(function () { ov.remove(); if (prev && prev.focus) prev.focus(); }, reduce ? 0 : 260); res(v); }
      function key(e) { if (e.key === 'Escape') done(false); if (e.key === 'Tab') { e.preventDefault(); (d.activeElement === no ? ok : no).focus(); } }
      no.onclick = function () { done(false); }; ok.onclick = function () { done(true); }; ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
      d.addEventListener('keydown', key); body.appendChild(ov);
      if (o.from && o.from.getBoundingClientRect && innerWidth > 575) { var r = o.from.getBoundingClientRect(), b = dlg.getBoundingClientRect(); dlg.style.transformOrigin = (r.left + r.width / 2 - b.left) + 'px ' + (r.top + r.height / 2 - b.top) + 'px'; }
      raf2(function () { ov.classList.add('on'); no.focus(); });
    });
  }
  // فرم‌های data-sw-confirm="متن": به‌جای confirm() مرورگر
  d.addEventListener('submit', function (e) {
    var f = e.target, msg = f.getAttribute && f.getAttribute('data-sw-confirm');
    if (!msg || f.dataset.swOk) return;
    e.preventDefault();
    var trigger = e.submitter || f.querySelector('[type=submit],button');
    confirmBox({ title: 'تایید عملیات', text: msg, ok: 'تایید', from: trigger }).then(function (yes) {
      if (yes) { f.dataset.swOk = 1; f.requestSubmit ? f.requestSubmit(trigger && trigger.form === f ? trigger : undefined) : f.submit(); }
    });
  }, true);
  // loading دکمه‌ی submit (فقط وقتی ارسال واقعی انجام می‌شود)
  d.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var b = e.target.querySelector && e.target.querySelector('button[type=submit]');
    if (b) setTimeout(function () { b.classList.add('sw-loading'); }, 0);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) $$('.sw-loading').forEach(function (b) { b.classList.remove('sw-loading'); }); });

  /* ═══════════ جستجوی سریع هدر: صفحات پنل + فیلتر زنده‌ی ردیف‌های جدول ═══════════ */
  function initSearch() {
    var box = $('.header-search'), inp = box && $('input', box); if (!inp) return;
    var pages = $$('.nav-item-sol').map(function (a) {
      var ic = $('.nav-icon i', a), tx = $('.nav-text', a);
      return { href: a.getAttribute('href'), label: (tx || a).textContent.trim(), icon: ic ? ic.className : 'bi bi-arrow-left-short' };
    });
    var pop = el('div', 'sw-pop sw-spot'); pop.setAttribute('role', 'listbox'); box.appendChild(pop);
    box.appendChild(el('kbd', '', isMac ? '⌘K' : 'Ctrl K'));
    var idx = 0, list = [], tm = 0;
    function show(o) { if (o) pop.setAttribute('data-open', ''); else pop.removeAttribute('data-open'); }
    function mark() { $$('.sw-si', pop).forEach(function (a, i) { a.classList.toggle('on', i === idx); }); }
    function filterRows(qn) {
      $$('table.sol-table tbody tr').forEach(function (tr) {
        if (tr.querySelector('.sw-empty')) return;
        var hide = !!qn && norm(tr.textContent).indexOf(qn) < 0;
        if (hide) { tr.hidden = true; tr.dataset.swHid = 1; } else if (tr.dataset.swHid) { tr.hidden = false; delete tr.dataset.swHid; }
      });
    }
    function render() {
      var q = inp.value.trim(), qn = norm(q); filterRows(qn);
      list = q ? pages.filter(function (p) { return norm(p.label).indexOf(qn) > -1; }) : []; idx = 0;
      if (!list.length) return show(false);
      pop.replaceChildren.apply(pop, list.map(function (p) {
        var a = el('a', 'sw-si'), ic = el('span', 'ico'); ic.appendChild(el('i', p.icon)); a.href = p.href; a.setAttribute('role', 'option');
        a.appendChild(ic); a.appendChild(el('b', '', p.label)); return a;
      }));
      mark(); show(true);
    }
    inp.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(render, 90); });
    inp.addEventListener('focus', function () { if (inp.value.trim()) render(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); idx = (idx + 1) % list.length; mark(); }
      else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); idx = (idx - 1 + list.length) % list.length; mark(); }
      else if (e.key === 'Enter' && list[idx]) { e.preventDefault(); location.href = list[idx].href; }
      else if (e.key === 'Escape') { inp.value = ''; filterRows(''); show(false); inp.blur(); }
    });
    d.addEventListener('click', function (e) { if (!box.contains(e.target)) show(false); });
    d.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((d.activeElement || {}).tagName) || (d.activeElement && d.activeElement.isContentEditable);
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }

  /* ═══════════ اعلان‌های زنده: زنگ هدر + Island + بج سایدبار ═══════════
     نیاز به GET /sw-admin/api/notifications → { tickets:n, items:[{id,title,body,href,at}] }
     اگر مسیر 404/401 بدهد، polling خودکار برای همین صفحه متوقف می‌شود. */
  var NF = { url: '/sw-admin/api/notifications', items: [], seen: null, off: false, timer: 0, last: 0, every: 45000 };
  function relTime(v) {
    var s = Math.round((Date.now() - new Date(v).getTime()) / 1000); if (!isFinite(s)) return '';
    if (s < 45) return 'همین الان'; var m = Math.round(s / 60); if (m < 60) return fa(m) + ' دقیقه پیش';
    var h = Math.round(m / 60); if (h < 24) return fa(h) + ' ساعت پیش'; return fa(Math.round(h / 24)) + ' روز پیش';
  }
  function initNotif() {
    var ico = $('.hdr-btn .bi-bell-fill'), bell = ico && ico.closest('.hdr-btn'); if (!bell || !$('.sidebar')) return;
    var panel = el('div', 'sw-pop sw-notif'); panel.id = 'swNotif'; bell.parentNode.appendChild(panel);
    bell.setAttribute('aria-haspopup', 'true'); bell.setAttribute('aria-expanded', 'false');
    function lastOpen() { return Number(store('sw-notif-open')) || 0; }
    function unseen() { var lo = lastOpen(); return NF.items.filter(function (i) { return new Date(i.at).getTime() > lo; }).length; }
    function dot() {
      var dotEl = $('.hdr-notif-dot', bell), u = NF.seen ? unseen() : 0;
      if (!NF.seen) return;
      if (u > 0 && !dotEl) bell.appendChild(el('span', 'hdr-notif-dot')); else if (!u && dotEl) dotEl.remove();
    }
    function badge(n) {
      var a = $('.nav-item-sol[href$="/tickets"]'); if (!a) return;
      var b = $('.nav-badge', a);
      if (n > 0) { if (!b) { b = el('span', 'nav-badge'); a.appendChild(b); } if (b.textContent !== fa(n)) { b.textContent = fa(n); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; } }
      else if (b) b.remove();
    }
    function render() {
      var lo = lastOpen(), head = el('div', 'hd'), lnk = el('a', '', 'همه تیکت‌ها'); head.appendChild(el('span', '', 'اعلان‌ها')); lnk.href = '/sw-admin/tickets'; head.appendChild(lnk);
      var kids = [head];
      if (!NF.items.length) { var em = el('div', 'sw-empty'); em.appendChild(el('i', 'bi bi-bell-slash')); em.appendChild(el('div', '', 'اعلان جدیدی ندارید')); kids.push(em); }
      NF.items.slice(0, 6).forEach(function (i) {
        var a = el('a', 'sw-ni' + (new Date(i.at).getTime() > lo ? ' new' : '')), ic = el('span', 'ico'), tx = el('span', 'tx'), b = el('b', '', i.title || 'اعلان'), s = el('small', '', relTime(i.at));
        ic.appendChild(el('i', 'bi bi-ticket-detailed-fill')); tx.appendChild(b); tx.appendChild(s); a.href = i.href || '/sw-admin/tickets'; a.appendChild(ic); a.appendChild(tx); kids.push(a);
      });
      panel.replaceChildren.apply(panel, kids);
    }
    function setOpen(o) {
      if (o) { render(); panel.setAttribute('data-open', ''); store('sw-notif-open', String(Date.now())); setTimeout(dot, 400); }
      else panel.removeAttribute('data-open');
      bell.setAttribute('aria-expanded', String(o));
    }
    bell.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!panel.hasAttribute('data-open')); });
    d.addEventListener('click', function (e) { if (!panel.contains(e.target)) setOpen(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.hasAttribute('data-open')) { setOpen(false); bell.focus(); } });

    function apply(j) {
      if (!j) return;
      var items = (j.items || []).slice(), ids = items.map(function (i) { return String(i.id); });
      if (NF.seen) {
        var fresh = items.filter(function (i) { return NF.seen.indexOf(String(i.id)) < 0; });
        if (fresh.length) {
          var f = fresh[0];
          island(fresh.length === 1 ? (f.title || 'اعلان جدید') : fa(fresh.length) + ' اعلان جدید', {
            type: 'info', icon: 'ticket-detailed-fill', detail: fresh.length === 1 ? (f.body || '') : (f.title || ''), ms: 7000,
            actions: [{ label: 'مشاهده', href: f.href || '/sw-admin/tickets', primary: true }, { label: 'بعداً', ghost: true }]
          });
          if (!reduce) { bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring'); }
        }
      }
      NF.seen = ids; NF.items = items;
      badge(Number(j.tickets != null ? j.tickets : items.length) || 0); dot();
      if (panel.hasAttribute('data-open')) render();
    }
    function schedule() { clearTimeout(NF.timer); if (!NF.off) NF.timer = setTimeout(poll, NF.every); }
    function poll() {
      if (NF.off) return;
      if (d.hidden) return schedule();
      NF.last = Date.now();
      fetch(NF.url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { if (r.status === 401 || r.status === 404) { NF.off = true; return null; } return r.ok ? r.json() : null; })
        .then(apply).catch(function () {}).then(schedule);
    }
    d.addEventListener('visibilitychange', function () { if (!d.hidden && !NF.off && Date.now() - NF.last > 30000) poll(); });
    setTimeout(poll, 1500);
  }

  /* ═══════════ اتصال اینترنت ═══════════ */
  var offIsl;
  addEventListener('offline', function () { offIsl = island('اتصال اینترنت قطع است', { type: 'warning', icon: 'wifi-off', ms: 0, detail: 'تا وصل‌شدن دوباره، ذخیره و دریافت اطلاعات انجام نمی‌شود.' }); });
  addEventListener('online', function () { if (offIsl) offIsl.close(); offIsl = null; island('دوباره آنلاین شدید', { type: 'success', icon: 'wifi' }); });

  // پیام‌های redirect سرور (?success=… / ?error=…) → Island، سپس پاک‌کردن از آدرس
  function flashFromQuery() {
    try {
      var u = new URL(location.href), s = u.searchParams.get('success'), er = u.searchParams.get('error');
      if (!s && !er) return;
      if (s) island(s, { type: 'success' }); if (er) island(er, { type: 'error', ms: 6000 });
      u.searchParams.delete('success'); u.searchParams.delete('error'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (_) {}
  }

  /* ═══════════ ارتقای صفحات موجود ═══════════ */
  var ICON_LABELS = { 'bi-pencil': 'ویرایش', 'bi-trash': 'حذف', 'bi-eye': 'مشاهده', 'bi-x-lg': 'بستن', 'bi-plus-lg': 'افزودن', 'bi-download': 'دانلود', 'bi-three-dots': 'گزینه‌ها', 'bi-three-dots-vertical': 'گزینه‌ها', 'bi-check-lg': 'تایید', 'bi-search': 'جستجو', 'bi-bell-fill': 'اعلان‌ها', 'bi-moon-stars-fill': 'تغییر تم', 'bi-sun-fill': 'تغییر تم', 'bi-chevron-right': 'قبلی', 'bi-chevron-left': 'بعدی', 'bi-fullscreen': 'تمام‌صفحه', 'bi-layout-sidebar-reverse': 'منو' };
  function labelIcons(r) {
    $$('button,a', r).forEach(function (b) {
      if (b.hasAttribute('aria-label') || (b.textContent || '').trim()) return;
      var i = $('i.bi', b); if (!i) return;
      var t = b.getAttribute('title'), k = Object.keys(ICON_LABELS).filter(function (c) { return i.classList.contains(c); })[0];
      if (t || k) b.setAttribute('aria-label', t || ICON_LABELS[k]);
    });
  }
  function wrapTables() {
    $$('table.sol-table').forEach(function (t) {
      var p = t.parentElement; if (!p || p.classList.contains('sw-tw') || /(auto|scroll)/.test(getComputedStyle(p).overflowX)) return;
      var w = el('div', 'sw-tw'); p.insertBefore(w, t); w.appendChild(t);
    });
  }
  d.addEventListener('DOMContentLoaded', function () {
    syncNav(); initCounters(); stagger(); labelIcons(); wrapTables(); watchModals(); initSearch(); initNotif(); flashFromQuery();
  });

  /* ═══════════ ابزارهای مشترک صفحات: SW.table · SW.validate · SW.csv · SW.fmt (DOM امن؛ بدون innerHTML) ═══════════ */
  function h(tag, attrs) {
    var e = d.createElement(tag), k, a = attrs || {};
    for (k in a) { if (a[k] == null || a[k] === false) continue; if (k === 'class') e.className = a[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), a[k]); else e.setAttribute(k, a[k] === true ? '' : a[k]); }
    for (var i = 2; i < arguments.length; i++) [].concat(arguments[i]).forEach(function (c) { if (c != null && c !== false) e.appendChild(c.nodeType ? c : d.createTextNode(String(c))); });
    return e;
  }
  var fmt = {
    fa: fa,
    money: function (n) { return Number(Math.round(n)).toLocaleString('fa-IR') + ' تومان'; },
    date: function (v) { return v ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(new Date(v)) : '—'; }
  };
  function chip(text, kind) { return h('span', { class: 'badge-status ' + (kind || '') }, text); }
  function csv(name, cols, rows) {
    var q = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var txt = [cols.map(function (c) { return q(c.label); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(c.text ? c.text(r) : r[c.k]); }).join(','); })).join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8' })), download: name + '.csv' });
    body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  // جدول: جستجو، فیلتر، مرتب‌سازی، Pagination، CSV
  function table(o) {
    var S = { q: '', f: {}, sort: null, dir: 1, page: 1 }, ps = o.pageSize || 8, rows = o.rows;
    var tb = h('tbody'), pg = h('div', { class: 'sw-pager' }), cnt = h('span', { class: 'badge-status' });
    var q = h('input', { class: 'sol-input', type: 'search', placeholder: 'جستجو…', 'aria-label': 'جستجو', oninput: function (e) { S.q = e.target.value.trim(); S.page = 1; draw(); } });
    var fs = (o.filters || []).map(function (f) {
      return h('select', { class: 'sol-select', 'aria-label': f.label, onchange: function (e) { S.f[f.k] = e.target.value; S.page = 1; draw(); } }, h('option', { value: '' }, f.label + ': همه'), f.options.map(function (op) { return h('option', { value: op[0] }, op[1]); }));
    });
    var th = h('tr', {}, o.columns.map(function (c) {
      return h('th', { scope: 'col', tabindex: c.sort === false ? null : 0, 'aria-sort': 'none', onclick: function () { if (c.sort !== false) sortBy(c.k); }, onkeydown: function (e) { if (e.key === 'Enter' && c.sort !== false) sortBy(c.k); } }, c.label);
    }).concat(o.actions ? [h('th', {}, '')] : []));
    function sortBy(k) { S.dir = S.sort === k ? -S.dir : 1; S.sort = k; draw(); }
    function view() {
      var qn = norm(S.q);
      var r = rows.filter(function (x) { return (!qn || (o.search || []).some(function (k) { return norm(x[k]).indexOf(qn) > -1; })) && (o.filters || []).every(function (f) { return !S.f[f.k] || x[f.k] === S.f[f.k]; }); });
      if (S.sort) r = r.slice().sort(function (a, b) { return (a[S.sort] > b[S.sort] ? 1 : -1) * S.dir; });
      return r;
    }
    function draw() {
      var r = view(), pages = Math.max(1, Math.ceil(r.length / ps)); S.page = Math.min(S.page, pages);
      var cur = r.slice((S.page - 1) * ps, S.page * ps);
      tb.replaceChildren.apply(tb, cur.length ? cur.map(function (x) { return h('tr', {}, o.columns.map(function (c) { return h('td', {}, c.render ? c.render(x) : x[c.k]); }).concat(o.actions ? [h('td', { style: 'white-space:nowrap' }, o.actions(x))] : [])); })
        : [h('tr', {}, h('td', { colspan: o.columns.length + (o.actions ? 1 : 0) }, h('div', { class: 'sw-empty' }, h('i', { class: 'bi bi-inbox' }), h('strong', {}, o.empty || 'موردی یافت نشد'), h('div', {}, o.emptyHint || 'فیلترها یا عبارت جستجو را تغییر دهید.'))))]);
      cnt.textContent = fa(r.length) + ' مورد';
      var btn = function (t, dis, fn, on, label) { return h('button', { type: 'button', class: on ? 'pg-btn active' : 'pg-btn', disabled: dis, 'aria-label': label, 'aria-current': on ? 'page' : null, onclick: fn }, t); };
      var nums = []; for (var i = 1; i <= pages; i++) (function (i) { nums.push(btn(fa(i), false, function () { S.page = i; draw(); }, i === S.page)); })(i);
      pg.replaceChildren.apply(pg, [btn(h('i', { class: 'bi bi-chevron-right' }), S.page === 1, function () { S.page--; draw(); }, false, 'قبلی')].concat(nums, [btn(h('i', { class: 'bi bi-chevron-left' }), S.page === pages, function () { S.page++; draw(); }, false, 'بعدی')]));
      var hs = th.children; for (var j = 0; j < o.columns.length; j++) hs[j].setAttribute('aria-sort', S.sort === o.columns[j].k ? (S.dir > 0 ? 'ascending' : 'descending') : 'none');
    }
    var exp = o.csvName ? h('button', { type: 'button', class: 'btn-ghost-sm', onclick: function () { csv(o.csvName, o.columns.filter(function (c) { return c.csv !== false; }), view()); toast('فایل CSV ساخته شد', { type: 'success' }); } }, h('i', { class: 'bi bi-download' }), 'CSV') : null;
    var rootEl = h('div', {}, h('div', { class: 'sw-bar' }, q, fs, cnt, exp), h('div', { class: 'sw-tw' }, h('table', { class: 'sol-table' }, h('thead', {}, th), tb)), pg);
    o.mount.replaceChildren(rootEl); draw();
    return { refresh: function (nr) { if (nr) rows = nr; draw(); } };
  }
  // اعتبارسنجی فرم کلاینتی: data-rule="required|email|phone|min:0|max:100|url|num" (جایگزین اعتبارسنجی سرور نیست)
  var RULES = { email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'ایمیل معتبر نیست.'], phone: [/^0?9\d{9}$|^0\d{10}$/, 'شماره تماس معتبر نیست.'], url: [/^https?:\/\/[^\s]+$/i, 'آدرس باید با http:// یا https:// شروع شود.'] };
  function validate(form) {
    var first = null;
    $$('[data-rule]', form).forEach(function (x) {
      var v = (x.value || '').trim(), msg = '';
      x.getAttribute('data-rule').split('|').forEach(function (r) {
        if (msg) return; var p = r.split(':'), n = p[0];
        if (n === 'required' && !v) msg = 'این فیلد الزامی است.';
        else if (v && RULES[n] && !RULES[n][0].test(v)) msg = RULES[n][1];
        else if (v && n === 'min' && Number(v) < Number(p[1])) msg = 'مقدار نمی‌تواند کمتر از ' + fa(p[1]) + ' باشد.';
        else if (v && n === 'max' && Number(v) > Number(p[1])) msg = 'مقدار نمی‌تواند بیشتر از ' + fa(p[1]) + ' باشد.';
        else if (v && n === 'num' && isNaN(Number(v))) msg = 'فقط عدد وارد کنید.';
      });
      var err = x.parentNode.querySelector('.sw-err') || x.parentNode.appendChild(h('div', { class: 'sw-err', role: 'alert' }));
      err.textContent = msg; x.classList.toggle('is-invalid', !!msg); x.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && !first) first = x;
    });
    if (first) { first.focus(); island('فرم را بررسی کنید', { type: 'error', detail: 'برخی فیلدها نامعتبرند.' }); }
    return !first;
  }
  // فرم‌های data-mock: تا وصل‌شدن Backend، ذخیره‌ی واقعی انجام نمی‌شود و فقط بازخورد نمایشی می‌دهند
  d.addEventListener('submit', function (e) {
    var f = e.target; if (!f.matches || !f.matches('form[data-validate]')) return;
    if (!validate(f)) { e.preventDefault(); e.stopImmediatePropagation(); $$('.sw-loading', f).forEach(function (b) { b.classList.remove('sw-loading'); }); return; }
    if (f.hasAttribute('data-mock')) { e.preventDefault(); e.stopImmediatePropagation(); island(f.getAttribute('data-mock-msg') || 'ذخیره شد (حالت نمایشی)', { type: 'success', detail: 'هنوز Backend متصل نیست؛ داده‌ای به سرور ارسال نشد.' }); }
  }, true);

  window.SW = { toast: toast, island: island, loading: loading, confirm: confirmBox, h: h, fmt: fmt, chip: chip, csv: csv, table: table, validate: validate };
  window.swNotify = function (m, type) { try { island(m, { type: type || 'error' }); } catch (_) { alert(m); } };
})();