/* admin.js — رفتار پنل مدیریت سُل وب (/sw-admin). بدون وابستگی؛ jQuery/Bootstrap فقط برای اجزای دیگر صفحات لازم است.
   ۱) Shell: تم، Sidebar (جمع‌شدن/Drawer)، تمام‌صفحه، Modalها، شمارنده‌ها
   ۲) افزونه‌ها: Dynamic Island، دیالوگ تایید، data-sw-confirm، دسترس‌پذیری، جدول واکنش‌گرا */
(function () {
  'use strict';
  var d = document, body = d.body, root = d.documentElement;
  var reduceM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; }

  /* ── تم (کلید sol-theme مشترک با سایت اصلی) ── */
  function applyTheme(t) {
    root.setAttribute('data-bs-theme', t);
    var i = $('#themeToggle i'); if (i) i.className = 'bi ' + (t === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill');
  }
  applyTheme(store('sol-theme') === 'dark' ? 'dark' : 'light');
  d.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle')) { var n = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'; applyTheme(n); store('sol-theme', n); }
  });

  /* ── Sidebar: دسکتاپ = جمع/باز (ذخیره می‌شود)، موبایل = Drawer ── */
  var mobile = function () { return matchMedia('(max-width:991.98px)').matches; };
  if (!mobile() && store('sw-sidebar') === 'collapsed') body.classList.add('sidebar-collapsed');
  function syncNav() {
    var t = $('#sidebarToggle'); if (t) t.setAttribute('aria-expanded', mobile() ? String(body.classList.contains('sidebar-open')) : String(!body.classList.contains('sidebar-collapsed')));
    $$('.nav-item-sol').forEach(function (a) { var tx = $('.nav-text', a); if (tx) { if (body.classList.contains('sidebar-collapsed') && !mobile()) a.setAttribute('title', tx.textContent.trim()); else a.removeAttribute('title'); } });
  }
  d.addEventListener('click', function (e) {
    if (e.target.closest('#sidebarToggle')) {
      if (mobile()) body.classList.toggle('sidebar-open');
      else { body.classList.toggle('sidebar-collapsed'); store('sw-sidebar', body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'open'); }
      syncNav();
    } else if (e.target.closest('#sidebarOverlay') || (mobile() && e.target.closest('.nav-item-sol'))) { body.classList.remove('sidebar-open'); syncNav(); }
    if (e.target.closest('#fullscreenBtn')) { if (!d.fullscreenElement) root.requestFullscreen && root.requestFullscreen(); else d.exitFullscreen && d.exitFullscreen(); }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('sidebar-open')) { body.classList.remove('sidebar-open'); syncNav(); } });
  addEventListener('resize', function () { if (!mobile()) body.classList.remove('sidebar-open'); syncNav(); });

  /* ── Modal: [data-modal-open="id"] / [data-modal-close] / openModal(id) / closeModal(id) ── */
  var MODAL_CLS = ['active', 'show', 'open'];
  function openModal(id) {
    var m = d.getElementById(id); if (!m) return;
    m.classList.add('active'); body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    var m = typeof id === 'string' ? d.getElementById(id) : id; if (!m) return;
    MODAL_CLS.forEach(function (c) { m.classList.remove(c); });
    if (!$$('.modal-overlay').some(function (x) { return MODAL_CLS.some(function (c) { return x.classList.contains(c); }); })) body.style.overflow = '';
  }
  window.openModal = openModal; window.closeModal = closeModal;
  d.addEventListener('click', function (e) {
    var o = e.target.closest('[data-modal-open]');
    if (o) { e.preventDefault(); openModal(o.getAttribute('data-modal-open')); return; }
    var c = e.target.closest('[data-modal-close]');
    if (c) { closeModal(c.closest('.modal-overlay')); return; }
    if (e.target.classList && e.target.classList.contains('modal-overlay')) closeModal(e.target);
  });

  /* ── شمارنده‌ی آماری: data-count + data-suffix (وقتی وارد دید می‌شود) ── */
  var fa = function (n) { return Number(n).toLocaleString('fa-IR'); };
  function suffixText(s) { return s === 'K' ? 'هزار' : (s || ''); }
  function count(el) {
    var t = parseFloat(el.getAttribute('data-count')); if (isNaN(t)) return;
    var sfx = suffixText(el.getAttribute('data-suffix'));
    if (reduceM) { el.textContent = fa(t) + sfx; return; }
    var t0 = performance.now(), dur = 900;
    (function tick(now) { var p = Math.min((now - t0) / dur, 1); el.textContent = fa(Math.round(t * (1 - Math.pow(1 - p, 3)))) + sfx; if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function initCounters() {
    var els = $$('[data-count]');
    if (!('IntersectionObserver' in window)) return els.forEach(count);
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { count(en.target); io.unobserve(en.target); } }); }, { threshold: .3 });
    els.forEach(function (el) { io.observe(el); });
  }
  d.addEventListener('DOMContentLoaded', function () { syncNav(); initCounters(); });
})();

/* sw-admin.js — فقط فرانت‌اند؛ با admin.js تداخل ندارد (تم/سایدبار/modalهای فعلی را کنترل نمی‌کند).
   SW.toast (Dynamic Island) · SW.confirm · swNotify (جایگزین alert) · data-sw-confirm (جایگزین confirm در فرم‌ها) */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, host;
  var IC = { info: 'info-lg', success: 'check-lg', error: 'x-lg', warning: 'exclamation-lg' };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function toast(text, o) {
    o = o || {}; var type = o.type || 'info', detail = o.detail || '';
    if (!host) { host = el('div', 'sw-isl-host'); host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    var n = el('div', 'sw-island ' + type), ic = el('span', 'ic'), i = el('i', 'bi bi-' + (IC[type] || IC.info)), box = el('div');
    n.tabIndex = 0; ic.appendChild(i); box.appendChild(el('div', 't', text)); box.appendChild(el('div', 'dt', detail)); n.appendChild(ic); n.appendChild(box);
    host.appendChild(n); while (host.children.length > 3) gone(host.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { n.classList.add('in'); }); });
    var t = setTimeout(function () { gone(n); }, o.ms || 4000);
    function tap() { if (!detail) return gone(n); clearTimeout(t); n.classList.toggle('ex'); if (!n.classList.contains('ex')) t = setTimeout(function () { gone(n); }, 2000); }
    n.addEventListener('click', tap);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') tap(); if (e.key === 'Escape') gone(n); });
  }
  function gone(n) { if (!n || n.dataset.g) return; n.dataset.g = 1; n.classList.remove('in'); n.classList.add('out'); setTimeout(function () { n.remove(); }, reduce ? 0 : 260); }

  function confirmBox(o) {
    return new Promise(function (res) {
      var prev = document.activeElement, no = el('button', 'btn-ghost-sm', 'انصراف'), ok = el('button', o.danger === false ? 'btn-sol-sm' : 'btn-danger-sm', o.ok || 'تایید');
      no.type = ok.type = 'button';
      var dlg = el('div', 'sw-dialog'), ov = el('div', 'sw-ov'), act = el('div', 'act');
      dlg.setAttribute('role', 'alertdialog'); dlg.setAttribute('aria-modal', 'true');
      dlg.appendChild(el('h4', '', o.title || 'تایید')); dlg.appendChild(el('p', '', o.text || '')); act.appendChild(no); act.appendChild(ok); dlg.appendChild(act); ov.appendChild(dlg);
      function done(v) { ov.classList.remove('on'); document.removeEventListener('keydown', key); setTimeout(function () { ov.remove(); if (prev && prev.focus) prev.focus(); }, reduce ? 0 : 230); res(v); }
      function key(e) { if (e.key === 'Escape') done(false); if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === no ? ok : no).focus(); } }
      no.onclick = function () { done(false); }; ok.onclick = function () { done(true); }; ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
      document.addEventListener('keydown', key); document.body.appendChild(ov);
      if (o.from && o.from.getBoundingClientRect) { var r = o.from.getBoundingClientRect(), b = dlg.getBoundingClientRect(); dlg.style.transformOrigin = (r.left + r.width / 2 - b.left) + 'px ' + (r.top + r.height / 2 - b.top) + 'px'; }
      requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('on'); no.focus(); }); });
    });
  }

  // فرم‌های دارای data-sw-confirm="متن": به‌جای confirm() مرورگر، دیالوگ سفارشی نمایش داده می‌شود.
  document.addEventListener('submit', function (e) {
    var f = e.target, msg = f.getAttribute && f.getAttribute('data-sw-confirm');
    if (!msg || f.dataset.swOk) return;
    e.preventDefault();
    var trigger = e.submitter || f.querySelector('[type=submit],button');
    confirmBox({ title: 'تایید عملیات', text: msg, ok: 'تایید', from: trigger }).then(function (yes) { if (yes) { f.dataset.swOk = 1; f.requestSubmit ? f.requestSubmit(trigger && trigger.form === f ? trigger : undefined) : f.submit(); } });
  }, true);

  // loading دکمه‌ی submit برای فرم‌های معمولی (فقط وقتی ارسال واقعی انجام می‌شود)
  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var b = e.target.querySelector && e.target.querySelector('button[type=submit]');
    if (b) setTimeout(function () { b.classList.add('sw-loading'); }, 0);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) document.querySelectorAll('.sw-loading').forEach(function (b) { b.classList.remove('sw-loading'); }); });


  /* ── ارتقای صفحات موجود (بدون دست‌زدن به admin.js) ── */
  var ICON_LABELS = { 'bi-pencil': 'ویرایش', 'bi-trash': 'حذف', 'bi-eye': 'مشاهده', 'bi-x-lg': 'بستن', 'bi-plus-lg': 'افزودن', 'bi-download': 'دانلود', 'bi-three-dots': 'گزینه‌ها', 'bi-three-dots-vertical': 'گزینه‌ها', 'bi-check-lg': 'تایید', 'bi-search': 'جستجو', 'bi-bell-fill': 'اعلان‌ها', 'bi-moon-stars-fill': 'تغییر تم', 'bi-chevron-right': 'قبلی', 'bi-chevron-left': 'بعدی', 'bi-fullscreen': 'تمام‌صفحه' };
  function labelIcons(root) {
    (root || document).querySelectorAll('button,a').forEach(function (b) {
      if (b.hasAttribute('aria-label') || (b.textContent || '').trim()) return;
      var i = b.querySelector('i.bi'); if (!i) return;
      var t = b.getAttribute('title'), k = Object.keys(ICON_LABELS).filter(function (c) { return i.classList.contains(c); })[0];
      if (t || k) b.setAttribute('aria-label', t || ICON_LABELS[k]);
    });
  }
  function wrapTables() {
    document.querySelectorAll('table.sol-table').forEach(function (t) {
      var p = t.parentElement; if (!p || p.classList.contains('sw-tw') || /(auto|scroll)/.test(getComputedStyle(p).overflowX)) return;
      var w = el('div', 'sw-tw'); p.insertBefore(w, t); w.appendChild(t);
    });
  }
  // مبدأ انیمیشن modal = مرکز دکمه‌ی کلیک‌شده (فقط متغیر CSS ست می‌شود؛ باز/بسته‌کردن با admin.js است)
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-modal-open]'); if (!t) return;
    var m = document.getElementById(t.getAttribute('data-modal-open')); if (!m) return;
    var r = t.getBoundingClientRect();
    m.style.setProperty('--sw-ox', Math.round(r.left + r.width / 2 - innerWidth / 2) + 'px');
    m.style.setProperty('--sw-oy', Math.round(r.top + r.height / 2 - innerHeight / 2) + 'px');
    m.__swTrigger = t;
  }, true);
  // دسترس‌پذیری modalهای فعلی: role/aria، فوکوس اولیه، Esc، focus trap، بازگشت فوکوس
  function isOpen(m) { return m.classList.contains('active') || m.classList.contains('show') || m.classList.contains('open'); }
  function closeLegacy(m) { if (window.closeModal) window.closeModal(m); else m.classList.remove('active', 'show', 'open'); } // مستقیم بسته می‌شود؛ روی لینک «انصراف» کلیک نمی‌شود تا صفحه جابه‌جا نشود
  function watchModals() {
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
      var box = m.querySelector('.modal-box') || m; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      var ttl = m.querySelector('.modal-title'); if (ttl) { if (!ttl.id) ttl.id = (m.id || 'm') + '-t'; box.setAttribute('aria-labelledby', ttl.id); }
      new MutationObserver(function () {
        if (isOpen(m) && !m.__swOpen) { m.__swOpen = true; var f = m.querySelector('input:not([type=hidden]),select,textarea,button'); if (f) setTimeout(function () { f.focus(); }, 80); }
        else if (!isOpen(m) && m.__swOpen) { m.__swOpen = false; var t = m.__swTrigger; if (t && t.focus) t.focus(); }
      }).observe(m, { attributes: true, attributeFilter: ['class'] });
    });
  }
  document.addEventListener('keydown', function (e) {
    var m = Array.prototype.filter.call(document.querySelectorAll('.modal-overlay'), isOpen).pop(); if (!m) return;
    if (e.key === 'Escape') { closeLegacy(m); return; }
    if (e.key === 'Tab') {
      var f = m.querySelectorAll('a[href],button:not(:disabled),input:not([type=hidden]):not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])'); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  document.addEventListener('DOMContentLoaded', function () { labelIcons(); wrapTables(); watchModals(); });


  var d = document, $ = function (q, c) { return (c || document).querySelector(q); }, $$ = function (q, c) { return [].slice.call((c || document).querySelectorAll(q)); };
  /* ── ابزارهای مشترک صفحات: SW.table · SW.validate · SW.csv · SW.fmt (DOM امن؛ بدون innerHTML) ── */
  function h(tag, attrs) {
    var e = d.createElement(tag), k, a = attrs || {};
    for (k in a) { if (a[k] == null || a[k] === false) continue; if (k === 'class') e.className = a[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), a[k]); else e.setAttribute(k, a[k] === true ? '' : a[k]); }
    for (var i = 2; i < arguments.length; i++) [].concat(arguments[i]).forEach(function (c) { if (c != null && c !== false) e.appendChild(c.nodeType ? c : d.createTextNode(String(c))); });
    return e;
  }
  var fmt = {
    fa: function (n) { return Number(n).toLocaleString('fa-IR'); },
    money: function (n) { return Number(Math.round(n)).toLocaleString('fa-IR') + ' تومان'; },
    date: function (v) { return v ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(new Date(v)) : '—'; }
  };
  function chip(text, kind) { return h('span', { class: 'badge-status ' + (kind || '') }, text); }
  function csv(name, cols, rows) {
    var q = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var txt = [cols.map(function (c) { return q(c.label); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(c.text ? c.text(r) : r[c.k]); }).join(','); })).join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8' })), download: name + '.csv' });
    d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
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
      var r = rows.filter(function (x) { return (!S.q || (o.search || []).some(function (k) { return String(x[k] == null ? '' : x[k]).indexOf(S.q) > -1; })) && (o.filters || []).every(function (f) { return !S.f[f.k] || x[f.k] === S.f[f.k]; }); });
      if (S.sort) r = r.slice().sort(function (a, b) { return (a[S.sort] > b[S.sort] ? 1 : -1) * S.dir; });
      return r;
    }
    function draw() {
      var r = view(), pages = Math.max(1, Math.ceil(r.length / ps)); S.page = Math.min(S.page, pages);
      var cur = r.slice((S.page - 1) * ps, S.page * ps);
      tb.replaceChildren.apply(tb, cur.length ? cur.map(function (x) { return h('tr', {}, o.columns.map(function (c) { return h('td', {}, c.render ? c.render(x) : x[c.k]); }).concat(o.actions ? [h('td', { style: 'white-space:nowrap' }, o.actions(x))] : [])); })
        : [h('tr', {}, h('td', { colspan: o.columns.length + (o.actions ? 1 : 0) }, h('div', { class: 'sw-empty' }, h('i', { class: 'bi bi-inbox' }), h('strong', {}, o.empty || 'موردی یافت نشد'), h('div', {}, o.emptyHint || 'فیلترها یا عبارت جستجو را تغییر دهید.'))))]);
      cnt.textContent = fmt.fa(r.length) + ' مورد';
      var btn = function (t, dis, fn, on, label) { return h('button', { type: 'button', class: on ? 'pg-btn active' : 'pg-btn', disabled: dis, 'aria-label': label, 'aria-current': on ? 'page' : null, onclick: fn }, t); };
      var nums = []; for (var i = 1; i <= pages; i++) (function (i) { nums.push(btn(fmt.fa(i), false, function () { S.page = i; draw(); }, i === S.page)); })(i);
      pg.replaceChildren.apply(pg, [btn(h('i', { class: 'bi bi-chevron-right' }), S.page === 1, function () { S.page--; draw(); }, false, 'قبلی')].concat(nums, [btn(h('i', { class: 'bi bi-chevron-left' }), S.page === pages, function () { S.page++; draw(); }, false, 'بعدی')]));
      var hs = th.children; for (var j = 0; j < o.columns.length; j++) hs[j].setAttribute('aria-sort', S.sort === o.columns[j].k ? (S.dir > 0 ? 'ascending' : 'descending') : 'none');
    }
    var exp = o.csvName ? h('button', { type: 'button', class: 'btn-ghost-sm', onclick: function () { csv(o.csvName, o.columns.filter(function (c) { return c.csv !== false; }), view()); toast('فایل CSV ساخته شد', { type: 'success' }); } }, h('i', { class: 'bi bi-download' }), 'CSV') : null;
    var root = h('div', {}, h('div', { class: 'sw-bar' }, q, fs, cnt, exp), h('div', { class: 'sw-tw' }, h('table', { class: 'sol-table' }, h('thead', {}, th), tb)), pg);
    o.mount.replaceChildren(root); draw();
    return { refresh: function (nr) { if (nr) rows = nr; draw(); } };
  }
  // اعتبارسنجی فرم کلاینتی: data-rule="required|email|phone|min:0|max:100|url" (جایگزین اعتبارسنجی سرور نیست)
  var RULES = { email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'ایمیل معتبر نیست.'], phone: [/^0?9\d{9}$|^0\d{10}$/, 'شماره تماس معتبر نیست.'], url: [/^https?:\/\/[^\s]+$/i, 'آدرس باید با http:// یا https:// شروع شود.'] };
  function validate(form) {
    var first = null;
    $$('[data-rule]', form).forEach(function (el) {
      var v = (el.value || '').trim(), msg = '';
      el.getAttribute('data-rule').split('|').forEach(function (r) {
        if (msg) return; var p = r.split(':'), n = p[0];
        if (n === 'required' && !v) msg = 'این فیلد الزامی است.';
        else if (v && RULES[n] && !RULES[n][0].test(v)) msg = RULES[n][1];
        else if (v && n === 'min' && Number(v) < Number(p[1])) msg = 'مقدار نمی‌تواند کمتر از ' + fmt.fa(p[1]) + ' باشد.';
        else if (v && n === 'max' && Number(v) > Number(p[1])) msg = 'مقدار نمی‌تواند بیشتر از ' + fmt.fa(p[1]) + ' باشد.';
        else if (v && n === 'num' && isNaN(Number(v))) msg = 'فقط عدد وارد کنید.';
      });
      var err = el.parentNode.querySelector('.sw-err') || el.parentNode.appendChild(h('div', { class: 'sw-err', role: 'alert' }));
      err.textContent = msg; el.classList.toggle('is-invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && !first) first = el;
    });
    if (first) { first.focus(); toast('فرم را بررسی کنید', { type: 'error', detail: 'برخی فیلدها نامعتبرند.' }); }
    return !first;
  }
  // فرم‌های data-mock: تا وصل‌شدن Backend، ذخیره‌ی واقعی انجام نمی‌شود و فقط بازخورد نمایشی می‌دهند
  d.addEventListener('submit', function (e) {
    var f = e.target; if (!f.matches || !f.matches('form[data-validate]')) return;
    if (!validate(f)) { e.preventDefault(); e.stopImmediatePropagation(); f.querySelectorAll('.sw-loading').forEach(function (b) { b.classList.remove('sw-loading'); }); return; }
    if (f.hasAttribute('data-mock')) { e.preventDefault(); e.stopImmediatePropagation(); toast(f.getAttribute('data-mock-msg') || 'ذخیره شد (حالت نمایشی)', { type: 'success', detail: 'هنوز Backend متصل نیست؛ داده‌ای به سرور ارسال نشد.' }); }
  }, true);

  window.SW = { toast: toast, confirm: confirmBox, h: h, fmt: fmt, chip: chip, csv: csv, table: table, validate: validate };
  window.swNotify = function (m, type) { try { toast(m, { type: type || 'error' }); } catch (_) { alert(m); } };
})();