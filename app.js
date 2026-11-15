// RESAN On the go — المرحلة 1: الحسابات، المشاريع، الموقف التنفيذي بالمراحل، التقرير اليومي، المراجعة والاعتماد، إدارة المستخدمين
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (x, d = 2) => (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const money = v => v >= 1e6 ? nf(v / 1e6, 2) + ' مليون' : nf(v, 0);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const toast = t => { const m = $('#msg'); m.textContent = t; m.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => m.classList.remove('on'), 2800); };
const bar = p => `<div class="pct"><div class="bar${p >= 1 ? ' full' : ''}" style="flex:1"><u style="width:${Math.min(Math.max(p, 0), 1) * 100}%"></u></div><span>${Math.round(p * 100)}%</span></div>`;

const ROLE = { site: 'مهندس الموقع', tech: 'المكتب الفني', consultant: 'الاستشاري', owner: 'المالك', finance: 'الماليات', management: 'الإدارة' };
const CAN = {
  items: ['site', 'tech', 'consultant', 'finance', 'management'],
  report: ['site', 'tech'],
  review: ['tech', 'management'],
  log: ['site', 'tech', 'management'],
  editBoq: ['tech', 'management'],
  ledger: ['finance', 'management'],
  boq: ['tech', 'finance', 'management'],
};
const FLOORS = { sheraton: { ground: 2, list: [['البدروم السفلي', 'SH-4-04', 'SH-4-06'], ['البدروم العلوي', 'SH-4-07', 'SH-4-08'], ['الأرضي', 'SH-4-09', 'SH-4-10'], ['الأول', 'SH-4-11', 'SH-4-12'], ['الثاني', 'SH-4-14', 'SH-4-15'], ['الثالث', 'SH-4-16', 'SH-4-17'], ['الرابع', 'SH-4-18', 'SH-4-19'], ['الخامس', 'SH-4-20', 'SH-4-21'], ['السطح', null, 'SH-4-22']] } };
const DISC = ['انشائي', 'مباني', 'معماري / تشطيبات', 'كهرباء', 'ميكانيكا / صحي', 'واجهات', 'لاندسكيب', 'عام'];
const ST = { submitted: ['pend', 'بانتظار المراجعة'], approved: ['appr', 'معتمد'], returned: ['ret', 'مرتجع للمهندس'] };

const S = { bq: { ph: '', b: '', miss: false, q: '', edit: false, pend: new Map() }, sb: null, user: null, profile: null, admin: false, projects: [], roles: {}, names: {}, P: null, open: new Set(), q: '', bsel: '' };
const role = pid => S.admin ? 'management' : S.roles[pid];
const can = (what, pid) => S.admin || CAN[what].includes(role(pid));

/* ---------------- boot & auth ---------------- */
async function boot() {
  const cfg = window.RESAN_CONFIG || {};
  if (window.__SB_MOCK__) S.sb = window.__SB_MOCK__;
  else {
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT')) return fatal('لازم تحط بيانات Supabase في ملف config.js الأول.');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    S.sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  S.sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') return renderSetPassword();
    if (ev === 'SIGNED_OUT') { S.user = null; renderLogin(); }
  });
  const { data } = await S.sb.auth.getSession();
  if (data?.session?.user) await afterLogin(data.session.user); else renderLogin();
}
const LOGO = (cls = '') => `<span class="logo ${cls}"><img class="lg lw" src="logo-light.png" alt="ريسان للمقاولات"><img class="lg lk" src="logo-dark.png" alt="ريسان للمقاولات"></span>`;
const fatal = t => { $('#app').innerHTML = `<div class="login">${LOGO()}<div class="otgl">On the go</div><div class="note">${esc(t)}</div></div>`; };

function renderLogin(msg = '') {
  $('#app').innerHTML = `<form class="login" id="lf">${LOGO()}<div class="otgl">On the go</div><p class="mut" style="margin:-8px 0 0;text-align:center">متابعة مشروعات الغردقة</p>
  ${msg ? `<div class="note">${esc(msg)}</div>` : ''}
  <label>الإيميل<input type="email" id="le" required autocomplete="username"></label>
  <label>الباسورد<input type="password" id="lp" required autocomplete="current-password"></label>
  <button class="p" type="submit">دخول</button><button type="button" id="forgot">نسيت الباسورد</button><p class="mut" style="margin:0;font-size:12px;text-align:center">إصدار 1.6.0</p></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await S.sb.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value });
    if (error) return renderLogin('الإيميل أو الباسورد غلط.');
    await afterLogin(data.user);
  };
  $('#forgot').onclick = async () => {
    const em = $('#le').value.trim(); if (!em) return toast('اكتب الإيميل الأول');
    await S.sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    toast('لو الإيميل متسجل، هيوصلك لينك تغيير الباسورد');
  };
}
function renderSetPassword() {
  $('#app').innerHTML = `<form class="login" id="pf"><h1>باسورد جديد</h1><label>الباسورد الجديد<input type="password" id="np" minlength="8" required></label><button class="p">حفظ</button></form>`;
  $('#pf').onsubmit = async e => { e.preventDefault(); const { error } = await S.sb.auth.updateUser({ password: $('#np').value }); if (error) return toast('مقدرتش أغيّر الباسورد'); toast('اتغيّر الباسورد'); const { data } = await S.sb.auth.getSession(); afterLogin(data.session.user); };
}

async function afterLogin(user) {
  S.user = user;
  const [{ data: prof }, { data: mem }, { data: projs }] = await Promise.all([
    S.sb.from('profiles').select('*').eq('id', user.id).single(),
    S.sb.from('project_members').select('project_id,role').eq('user_id', user.id),
    S.sb.from('projects').select('*').order('sort'),
  ]);
  S.profile = prof || { email: user.email }; S.admin = !!prof?.is_admin;
  S.roles = Object.fromEntries((mem || []).map(m => [m.project_id, m.role]));
  S.projects = projs || [];
  if (!S.projects.length) return fatal('حسابك لسه مش مضاف على أي مشروع. كلّم مدير النظام.');
  if (!S.routed) { addEventListener('hashchange', route); S.routed = true; } route();
}

/* ---------------- layout & routing ---------------- */
const VIEWS = [['status', 'الموقف التنفيذي', null], ['schedule', 'الجدول الزمني', null], ['boq', 'المقايسة والتكلفة', 'boq'], ['report', 'تقرير يومي', 'report'], ['review', 'مراجعة المكتب الفني', 'review'], ['log', 'سجل التقارير', 'log']];
function shell(pid, view) {
  const p = pid && S.projects.find(x => x.id === pid);
  return `<header><div class="hbar"><a class="brandlink" href="#home" title="الصفحة الرئيسية">${LOGO()}<span class="otg">On the go</span></a>
  <div class="who2"><a class="homeb${!p && view !== 'admin' ? ' on' : ''}" href="#home"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>الرئيسية</a>${p ? `<span class="roleTag">${ROLE[role(pid)] || ''}</span>` : ''}<span class="uname">${esc(S.profile.full_name || S.profile.email)}</span>${S.admin ? '<a href="#admin" class="adm">المستخدمين</a>' : ''}<button id="out">خروج</button></div></div>
  ${p ? `<div class="ptitle"><h1>${esc(p.name + ' – ' + p.place)}</h1><p>المالك: ${esc(p.owner_name)} · المقاول العام: ${esc(p.contractor_name)} · الاستشاري: ${esc(p.consultant_name)}</p></div>` : '<div class="ptitle"><h1>متابعة مشروعات الغردقة</h1></div>'}
  <nav>${p ? VIEWS.filter(v => !v[2] || can(v[2], pid)).map(([v, l]) => `<a href="#p/${pid}/${v}" class="${v === view ? 'on' : ''}">${l}${v === 'review' ? ' <span class="badge" id="pendN" hidden></span>' : ''}</a>`).join('') : ''}</nav></header><main id="main"><p class="mut">جاري التحميل…</p></main>`;
}
async function route() {
  const h = location.hash.slice(1) || 'home', m = h.match(/^p\/([a-z0-9_-]+)\/([a-z]+)$/);
  if (m && S.projects.some(p => p.id === m[1])) {
    const [, pid, view] = m;
    $('#app').innerHTML = shell(pid, view); bindOut();
    if (!S.P || S.P.id !== pid) { S.P = { id: pid }; S.open.clear(); S.q = ''; S.bsel = ''; S.bq = { ph: '', b: '', miss: false, q: '', edit: false, pend: new Map() }; }
    await loadProject(pid);
    if (view === 'report' && can('report', pid)) return renderReport();
    if (view === 'review' && can('review', pid)) return renderReview();
    if (view === 'log' && can('log', pid)) return renderLog();
    if (view === 'boq' && can('boq', pid)) return renderBoq();
    if (view === 'schedule') return renderSchedule();
    return renderStatus();
  }
  $('#app').innerHTML = shell(null, h); bindOut();
  if (h === 'admin' && S.admin) return renderAdmin();
  renderHome();
}
const bindOut = () => { $('#out').onclick = () => S.sb.auth.signOut(); };

/* ---------------- data ---------------- */
async function loadProject(pid) {
  const P = S.P, wantItems = can('items', pid), wantReports = can('log', pid);
  const jobs = [S.sb.rpc('phase_progress', { p_project: pid }), S.sb.from('phases').select('*').eq('project_id', pid).order('n')];
  jobs.push(wantItems ? S.sb.from('boq_progress').select('*').eq('project_id', pid).order('sort') : Promise.resolve({ data: [] }));
  jobs.push(wantItems ? S.sb.from('boq_rates').select('item_id,rate') : Promise.resolve({ data: [] }));
  jobs.push(wantReports ? S.sb.from('daily_reports').select('*').eq('project_id', pid).order('report_date', { ascending: false }).limit(400) : Promise.resolve({ data: [] }));
  const [pp, ph, it, rt, rp] = await Promise.all(jobs);
  P.phaseProg = pp.data || []; P.phases = ph.data || [];
  const rates = Object.fromEntries((rt.data || []).map(r => [r.item_id, +r.rate]));
  P.showRates = ['tech', 'finance', 'management'].includes(role(pid));
  P.items = (it.data || []).map(i => { const q = +i.qty || 0, ex = +i.executed || 0, rate = rates[i.id] || 0; const pct = q > 0 ? ex / q : (i.pct_override != null ? +i.pct_override : 0); return { ...i, ex, rate, pct: Math.max(0, pct), rem: q - ex, val: q * rate, known: q > 0 || i.pct_override != null }; });
  P.reports = rp.data || [];
  P.proj = S.projects.find(x => x.id === pid);
  const ids = [...new Set(P.reports.flatMap(r => [r.created_by, r.reviewed_by]).filter(x => x && !(x in S.names)))];
  if (ids.length) { const { data } = await S.sb.from('profiles').select('id,full_name,email').in('id', ids); (data || []).forEach(u => S.names[u.id] = u.full_name || u.email); }
  const pend = P.reports.filter(r => r.status === 'submitted').length, b = $('#pendN'); if (b) { b.hidden = !pend; b.textContent = pend; }
}
const overall = list => { const W = list.reduce((s, x) => s + (+x.weight || 0), 0); return W ? list.reduce((s, x) => s + (+x.pct || 0) * (+x.weight || 0), 0) / W : 0; };
const groupPct = rows => { const v = rows.filter(r => r.val > 0), avg = v.length ? v.reduce((s, r) => s + r.val, 0) / v.length : 1; let a = 0, b = 0; rows.forEach(r => { const w = r.val > 0 ? r.val : avg; a += w * Math.min(r.pct, 1); b += w; }); return b ? a / b : 0; };

/* ---------------- home ---------------- */
async function renderHome() {
  const cards = await Promise.all(S.projects.map(async p => { const [a, w, u] = await Promise.all([S.sb.rpc('phase_progress', { p_project: p.id }), S.sb.rpc('active_work', { p_project: p.id, p_limit: 8 }), S.sb.rpc('site_updates', { p_project: p.id, p_n: 2 })]); return { p, list: a.data || [], work: w.data || [], upd: u.data || [] }; }));
  $('#main').innerHTML = `<h2>المشاريع</h2><div class="pgrid">${cards.map(({ p, list, work, upd }) => `<article class="pc"><div class="row2"><div><h2>${esc(p.name)}</h2><div class="mut">${esc(p.place)}${p.land ? ' · أرض ' + esc(p.land) : ''} · <span class="roleTag">${ROLE[role(p.id)] || ''}</span></div></div><div class="pbig">${list.length ? Math.round(overall(list) * 100) + '%' : '–'}</div></div>
  <dl class="who"><dt>المالك</dt><dd>${esc(p.owner_name)}</dd><dt>المقاول العام</dt><dd>${esc(p.contractor_name)}</dd><dt>الاستشاري</dt><dd>${esc(p.consultant_name)}</dd></dl>
  <div class="mbars">${list.map(x => `<div><span>${x.n}. ${esc(x.name)}</span><div class="bar${x.pct >= 1 ? ' full' : ''}"><u style="width:${Math.min(x.pct, 1) * 100}%"></u></div><em>${Math.round(x.pct * 100)}%</em></div>`).join('')}</div>
  ${liveWork(p, work, upd)}
  <div class="acts" style="margin-top:0"><a class="btn p" href="#p/${p.id}/status">فتح المشروع</a>${can('report', p.id) ? `<a class="btn" href="#p/${p.id}/report">تقرير يومي</a>` : ''}${can('review', p.id) ? `<a class="btn" href="#p/${p.id}/review">المراجعة</a>` : ''}</div></article>`).join('')}</div>`;
  $('#main').onclick = e => { const t = e.target.closest('[data-lt]'); if (!t) return; const box = t.closest('.live'); box.querySelectorAll('[data-lt]').forEach(b => b.classList.toggle('on', b === t)); box.querySelectorAll('[data-lp]').forEach(x => x.hidden = x.dataset.lp !== t.dataset.lt); };
}
const CRANE = `<svg class="crane" viewBox="0 0 64 56" aria-hidden="true"><path d="M10 54V8M4 54h14M10 8l44 0M10 8 22 2l32 6M10 18l12-10M18 8v0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><g class="trolley"><rect x="36" y="6" width="8" height="5" rx="1" fill="currentColor"/><line class="cable" x1="40" y1="11" x2="40" y2="30" stroke="currentColor" stroke-width="1.4"/><g class="hook"><rect x="35" y="30" width="10" height="8" rx="1.5" fill="var(--acc)"/></g></g></svg>`;
function liveWork(p, work, upd) {
  const [cur, prev] = upd, acts = (cur?.acts || []).filter(a => a.work), key = a => (a.building || '') + '|' + (a.work || '').replace(/^جاري\s+/, '').trim();
  const pm = Object.fromEntries((prev?.acts || []).map(a => [key(a), +a.progress || 0]));
  const days = cur ? Math.round((Date.parse(today()) - Date.parse(cur.report_date)) / 864e5) : null;
  const ago = days == null ? '' : days <= 0 ? 'النهارده' : days === 1 ? 'امبارح' : `من ${days} يوم`;
  if (!acts.length && !work.length) return `<div class="live idle"><div class="lh">${CRANE}<div><b>جاري التنفيذ</b><span class="mut">مفيش تقارير معتمدة لسه</span></div></div></div>`;
  const fresh = days != null && days <= 10;
  const actHtml = acts.map(a => { const pr = Math.max(0, Math.min(+a.progress || 0, 100)), d = pr - (pm[key(a)] ?? pr);
    return `<li><div class="lt">${a.building ? `<span class="chip">${esc(a.building)}</span>` : ''}<span class="lw">${esc(a.work)}</span>${d > 0 ? `<span class="up">+${d}%</span>` : ''}</div><div class="lbar${pr >= 100 ? ' done' : ''}"><u style="--w:${pr}%"></u></div><em>${pr}%</em></li>`; }).join('');
  const itemHtml = work.map(w => { const pc = Math.round(+w.pct * 100);
    return `<li><a class="lt" href="#p/${p.id}/status" title="${esc(w.name)}">${w.building ? `<span class="chip">${esc(w.building)}</span>` : ''}<span class="lw">${esc(w.code)} · ${esc(w.name.length > 46 ? w.name.slice(0, 46) + '…' : w.name)}</span>${+w.recent_qty > 0 ? `<span class="up">+${nf(w.recent_qty, 1)} ${esc(w.unit || '')}</span>` : ''}</a><div class="lbar"><u style="--w:${pc}%"></u></div><em>${pc}%</em></li>`; }).join('');
  return `<div class="live${fresh ? '' : ' stale'}"><div class="lh">${CRANE}<div><b><i class="dot"></i>جاري التنفيذ الآن</b><span class="mut">${cur ? `آخر تقرير معتمد ${ago} · ${fmtD(cur.report_date)}${cur.labor ? ` · ${cur.labor} عامل` : ''}` : 'من بنود المقايسة'}</span></div>
  ${acts.length && work.length ? `<div class="seg sm"><button type="button" data-lt="a" class="on">من الموقع (${acts.length})</button><button type="button" data-lt="i">بنود المقايسة (${work.length})</button></div>` : ''}</div>
  ${acts.length ? `<ul data-lp="a">${actHtml}</ul>` : ''}${work.length ? `<ul data-lp="i"${acts.length ? ' hidden' : ''}>${itemHtml}</ul>` : ''}</div>`;
}

/* ---------------- status ---------------- */
function renderStatus() {
  const P = S.P, pid = P.id, proj = P.proj, multi = (proj.buildings || []).length > 1, ed = can('editBoq', pid), showItems = can('items', pid);
  const rows = S.bsel ? P.items.filter(r => r.building === S.bsel) : P.items;
  const list = P.phaseProg, ov = overall(list), cur = (list.find(x => x.pct > 0 && x.pct < 1) || list.find(x => x.pct < 1) || {}).n;
  const val = rows.reduce((s, r) => s + r.val, 0), exv = rows.reduce((s, r) => s + Math.min(r.ex, +r.qty || 0) * r.rate, 0), miss = rows.filter(r => /ينقص/.test(r.qty_status || '')).length;
  const conc = rows.filter(r => /م3|م³/.test(r.unit || '') && /خرسان|اساس|أساس|اعمد|أعمد|حوائط|اسقف|أسقف|دك/.test(r.group_name + r.name)).reduce((s, r) => s + (r.qty > 0 ? Math.min(r.ex, r.qty) : r.ex), 0);
  const kp = [];
  if (P.showRates) kp.push([money(val), 'قيمة البنود المسعّرة (ج.م)'], [money(exv), 'قيمة المنفذ من البنود المسعّرة']);
  if (showItems) kp.push([nf(conc, 1) + ' م3', 'خرسانة منفذة حسب الموقف'], [miss + ' بند', 'ناقصها مستند']);
  const fl = FLOORS[pid];
  let pic = '';
  if (showItems && fl) { const byC = c => c && P.items.find(r => r.id === c), fp = r => r ? Math.min(r.pct, 1) : 0;
    pic = fl.list.slice().reverse().map(([f, c, s], k) => { const i = fl.list.length - 1 - k, cp = fp(byC(c)), sp = fp(byC(s)); return `<div class="fl"><span>${esc(f)}</span><div class="bx"><div class="cols">${c ? Array.from({ length: 6 }, () => `<i><u style="height:${cp * 100}%"></u></i>`).join('') : ''}</div><div class="slab"><u style="width:${sp * 100}%"></u></div></div><em>${c ? 'أعمدة ' + Math.round(cp * 100) + '% · ' : ''}سقف ${Math.round(sp * 100)}%</em></div>${i === fl.ground ? '<div class="ground">منسوب الأرض</div>' : ''}`; }).join('') + `<div class="leg"><span><i style="background:var(--acc)"></i>الأعمدة والحوائط</span><span><i style="background:var(--ink)"></i>السقف</span><span><i style="background:var(--conc)"></i>لم يُنفّذ</span></div>`; }
  else if (showItems && multi) pic = `<div class="mut" style="margin-bottom:6px">مباني المشروع – اضغط على مبنى لعرض بنوده</div><div class="plan">${proj.buildings.map(b => { const v = groupPct(P.items.filter(r => r.building === b)); return `<button type="button" class="blk${b === S.bsel ? ' on' : ''}" data-b="${esc(b)}"><u style="height:${v * 100}%"></u><b>${esc(b)}</b><span>${Math.round(v * 100)}%</span></button>`; }).join('')}</div>`;
  else pic = `<div class="mbars">${list.map(x => `<div><span>${x.n}. ${esc(x.name)}</span><div class="bar${x.pct >= 1 ? ' full' : ''}"><u style="width:${Math.min(x.pct, 1) * 100}%"></u></div><em>${Math.round(x.pct * 100)}%</em></div>`).join('')}</div>`;
  const q = S.q.trim();
  const ledger = !showItems ? '' : list.map(x => {
    const L = rows.filter(r => r.phase_n === x.n), groups = [...new Set(L.map(r => r.group_name))].map(g => ({ name: g, rows: L.filter(r => r.group_name === g) }))
      .map(g => ({ ...g, pct: groupPct(g.rows), shown: q ? g.rows.filter(r => (r.code + ' ' + r.name + ' ' + (r.description || '')).includes(q)) : g.rows })).filter(g => g.shown.length);
    if (q && !groups.length) return ''; const ko = 'p' + x.n, isOpen = q || S.open.has(ko);
    return `<details class="ph" data-k="${ko}"${isOpen ? ' open' : ''}><summary><span class="num">${x.n}</span><div><div class="phn">${esc(x.name)}</div><div class="phm">${x.items} بند · وزن ${Math.round(x.weight * 1000) / 10}%${x.missing ? ` · <span class="tag">${x.missing} ناقص مستند</span>` : ''}${x.manual ? ' · <span class="tag">نسبة يدوية</span>' : ''}</div></div>${bar(x.pct)}</summary><div class="phb">
    ${ed ? `<div class="phset" data-ph="${x.n}"><label>وزن المرحلة %<input type="number" step="any" data-pf="weight" value="${Math.round(x.weight * 10000) / 100}"></label><label>نسبة يدوية %<input type="number" step="any" data-pf="manual" value="${x.manual ? Math.round(x.pct * 1000) / 10 : ''}" placeholder="${x.auto_pct != null ? 'محسوبة: ' + Math.round(x.auto_pct * 100) : '—'}"></label><label>المخطط حتى اليوم %<input type="number" step="any" data-pf="planned" value="${x.planned_pct ?? ''}"></label><button data-savewph="${x.n}">حفظ</button></div>` : ''}
    ${groups.map(g => { const kg = ko + '|' + g.name, go = q || S.open.has(kg); return `<details class="gp" data-k="${esc(kg)}"${go ? ' open' : ''}><summary><span>${esc(g.name)} <span class="mut">(${g.rows.length})</span></span>${bar(g.pct)}</summary>${go ? itemTable(g.shown, multi, false) : ''}</details>`; }).join('') || '<p class="mut">مفيش بنود في المرحلة دي.</p>'}</div></details>`;
  }).join('');
  $('#main').innerHTML = `<div class="top"><div><h2>الموقف التنفيذي${S.bsel ? ' – ' + esc(S.bsel) : ''}</h2><div class="big">${list.length ? Math.round(ov * 100) + '%' : '–'}</div><div class="mut">نسبة الإنجاز الكلية = مجموع (نسبة كل مرحلة × وزنها)</div><div class="kp">${kp.map(k => `<div class="k"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('')}</div></div><div class="sec">${pic}</div></div>
  <div class="strip">${list.map(x => `<button type="button" class="pcell${x.n === cur ? ' cur' : ''}" data-goph="${x.n}"><i>المرحلة ${x.n} · وزن ${Math.round(x.weight * 1000) / 10}%</i><b>${esc(x.name)}</b><span>${Math.round(x.pct * 100)}%</span><div class="fill"><u style="width:${Math.min(x.pct, 1) * 100}%"></u></div></button>`).join('')}</div>
  ${showItems ? `<div class="acts">${multi ? `<select id="bFilter" style="max-width:240px"><option value="">كل المباني</option>${proj.buildings.map(b => `<option${b === S.bsel ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}<input id="iSearch" type="search" placeholder="بحث في البنود أو الكود" value="${esc(S.q)}" style="max-width:260px"><button id="xls" class="p">تحميل الموقف Excel</button></div>
  <h3>المراحل والبنود</h3><p class="mut" style="margin-top:-6px">نسبة البند = المنفذ ÷ الكمية. المجموعة والمرحلة متوسط مرجّح بقيمة البنود، والبند اللي لسه ماتسعّرش بيتحسب بمتوسط قيمة بنود مرحلته.</p><div id="ledger">${ledger}</div>` : ''}`;
  bindStatus();
}
function itemTable(rows, multi, ed) {
  const P = S.P, sr = P.showRates;
  return `<div class="scroll"><table class="stack it"><thead><tr><th>الكود</th><th>البند</th>${multi ? '<th>المبنى</th>' : ''}<th>الوحدة</th><th class="n">الكمية</th>${sr ? '<th class="n">السعر</th>' : ''}<th class="n">المنفذ</th><th class="n">المتبقي</th><th>النسبة</th></tr></thead><tbody>${rows.map(r => `<tr data-id="${esc(r.id)}"><td data-l="الكود">${esc(r.code)}</td><td data-l="البند" title="${esc(r.description || '')}">${esc(r.name)}${+r.from_reports ? ` <span class="mut">(+${nf(r.from_reports)} من التقارير)</span>` : ''}${/ينقص/.test(r.qty_status || '') ? ' <span class="tag">ينقص مستند</span>' : ''}${r.note ? `<div class="mut" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>${multi ? `<td data-l="المبنى">${esc(r.building)}</td>` : ''}<td data-l="الوحدة">${esc(r.unit)}</td>
  <td class="n${ed ? ' ed' : ''}" data-l="الكمية">${ed ? `<input type="number" step="any" data-f="qty" value="${+r.qty || ''}">` : (+r.qty ? nf(r.qty) : '–')}</td>${sr ? `<td class="n${ed ? ' ed' : ''}" data-l="السعر">${ed ? `<input type="number" step="any" data-f="rate" value="${r.rate || ''}">` : (r.rate ? nf(r.rate) : '–')}</td>` : ''}
  <td class="n" data-l="المنفذ">${nf(r.ex)}</td><td class="n" data-l="المتبقي" style="${r.rem < 0 ? 'color:var(--bad)' : ''}">${+r.qty > 0 ? nf(r.rem) : '–'}</td><td data-l="النسبة">${r.survey && !(+r.qty > 0) ? '<span class="mut">اتنفذ – جاري الحصر</span>' : ''}${r.known ? bar(r.pct) : '<span class="mut">لم تُحدد الكمية</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindStatus() {
  const P = S.P;
  $('#bFilter') && ($('#bFilter').onchange = e => { S.bsel = e.target.value; renderStatus(); });
  $('#iSearch') && $('#iSearch').addEventListener('change', e => { S.q = e.target.value; renderStatus(); });
  $('.sec').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) { S.bsel = S.bsel === b.dataset.b ? '' : b.dataset.b; renderStatus(); } });
  $('.strip').addEventListener('click', e => { const b = e.target.closest('[data-goph]'); if (!b || !$('#ledger')) return; const k = 'p' + b.dataset.goph; S.open.add(k); renderStatus(); document.querySelector(`details[data-k="${k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const L = $('#ledger'); if (!L) return;
  L.addEventListener('toggle', e => { const d = e.target; if (!d.matches?.('details[data-k]') || S.q) return; const k = d.dataset.k, was = S.open.has(k); d.open ? S.open.add(k) : S.open.delete(k); if (d.classList.contains('gp') && d.open && !was) renderStatus(); }, true);
  L.addEventListener('change', async e => {
    const i = e.target.closest('input[data-f]'); if (!i) return; const id = i.closest('tr').dataset.id, v = i.value === '' ? 0 : +i.value;
    const { error } = i.dataset.f === 'rate' ? await S.sb.from('boq_rates').upsert({ item_id: id, rate: v }) : await S.sb.from('boq_items').update({ qty: v }).eq('id', id);
    if (error) return toast('مقدرتش أحفظ: ' + error.message); toast('اتحفظ التعديل'); await refresh();
  });
  L.addEventListener('click', async e => {
    const b = e.target.closest('[data-savewph]'); if (!b) return; e.preventDefault(); const box = b.closest('.phset'), g = k => box.querySelector(`[data-pf=${k}]`).value;
    const { error } = await S.sb.from('phases').update({ weight: (+g('weight') || 0) / 100, manual_pct: g('manual') === '' ? null : +g('manual'), planned_pct: g('planned') === '' ? null : +g('planned') }).eq('project_id', P.id).eq('n', +b.dataset.savewph);
    if (error) return toast('مقدرتش أحفظ: ' + error.message); toast('اتحفظت إعدادات المرحلة'); await refresh();
  });
  $('#xls') && ($('#xls').onclick = exportXlsx);
}
async function refresh() { await route(); }

/* ---------------- report form ---------------- */
const ROW = {
  act: { box: '#aRows', f: [['building', 'المبنى', 'bld'], ['discipline', 'التخصص', 'disc'], ['work', 'الأعمال', 'text', null, 1], ['progress', 'نسبة الإنجاز %', 'num']] },
  qty: { box: '#qRows', f: [['item', 'البند', 'item', null, 1], ['qty', 'الكمية', 'num']] },
  pour: { box: '#pRows', f: [['element', 'العنصر', 'text'], ['building', 'المبنى', 'bld'], ['vol', 'الكمية م3', 'num'], ['supplier', 'المحطة', 'text'], ['item', 'يتحسب على بند', 'item']] },
  labor: { box: '#lRows', f: [['building', 'المبنى', 'bld'], ['trade', 'التخصص', 'text'], ['count', 'العدد', 'num'], ['hours', 'ساعات', 'num', 8], ['contractor', 'المقاول', 'text']] },
  equip: { box: '#eRows', f: [['building', 'المبنى', 'bld'], ['name', 'المعدة', 'text'], ['count', 'العدد', 'num', 1], ['hours', 'ساعات', 'num', 8]] },
  supply: { box: '#sRows', f: [['building', 'المبنى', 'bld'], ['item', 'الصنف', 'text'], ['unit', 'الوحدة', 'text'], ['req', 'المطلوب', 'num'], ['got', 'المورّد', 'num'], ['supplier', 'المورد', 'text']] },
};
const itemOpts = sel => { const P = S.P, multi = (P.proj.buildings || []).length > 1; return '<option value="">— اختار البند —</option>' + P.phaseProg.map(x => { const L = P.items.filter(i => i.phase_n === x.n); return [...new Set(L.map(i => i.group_name))].map(g => `<optgroup label="${x.n}. ${esc(x.name)} – ${esc(g)}">${L.filter(i => i.group_name === g).map(i => `<option value="${esc(i.id)}"${i.id === sel ? ' selected' : ''}>${esc(i.code + ' ' + (i.name.length > 70 ? i.name.slice(0, 70) + '…' : i.name) + (multi ? ' – ' + i.building : ''))} (${esc(i.unit)})</option>`).join('')}</optgroup>`).join(''); }).join(''); };
function addRow(k, v = {}) {
  const R = ROW[k], bs = S.P.proj.buildings || [], F = R.f.filter(f => f[2] !== 'bld' || bs.length > 1), d = document.createElement('div');
  d.className = 'row'; d.dataset.k = k; d.style.setProperty('--c', F.reduce((s, f) => s + (f[4] ? 2 : 1), 0));
  d.innerHTML = F.map(([n, l, t, def, w]) => `<label${w ? ' class="wide"' : ''}>${l}${t === 'item' ? `<select data-n="${n}">${itemOpts(v[n])}</select>` : t === 'bld' ? `<select data-n="${n}">${['', ...bs].map(b => `<option value="${esc(b)}"${b === (v[n] || '') ? ' selected' : ''}>${b ? esc(b) : '—'}</option>`).join('')}${v[n] && !bs.includes(v[n]) ? `<option selected>${esc(v[n])}</option>` : ''}</select>` : t === 'disc' ? `<select data-n="${n}">${[...new Set([...DISC, v[n] || 'انشائي'])].map(x => `<option${x === (v[n] || 'انشائي') ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input data-n="${n}" ${t === 'num' ? 'type="number" step="any" inputmode="decimal"' : 'type="text"'} value="${esc(v[n] ?? def ?? '')}">`}</label>`).join('') + `<button type="button" class="x">حذف</button>` + (k === 'qty' ? '<div class="hint"></div>' : '');
  $(R.box).append(d); if (k === 'qty') hint(d);
}
function hint(d) { const r = S.P.items.find(x => x.id === d.querySelector('[data-n=item]').value); d.querySelector('.hint').textContent = r ? `المنفذ لحد دلوقتي ${nf(r.ex)} من ${nf(r.qty)} ${r.unit} · المتبقي ${nf(r.rem)}` : ''; }
const collect = k => [...document.querySelectorAll(ROW[k].box + ' .row')].map(d => { const o = {}; d.querySelectorAll('[data-n]').forEach(i => o[i.dataset.n] = i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim()); return o; }).filter(o => Object.entries(o).some(([k2, v]) => !['building', 'discipline', 'hours'].includes(k2) && v !== null && v !== '' && v !== 0));
function renderReport(r) {
  const P = S.P; r = r || P.reports.find(x => x.report_date === today());
  $('#main').innerHTML = `<h2>${r ? 'تقرير ' + r.report_date : 'تقرير يومي جديد'}</h2><p class="mut">يكتبه مهندس الموقع ويوصل للمكتب الفني. الكميات بتتحسب على الموقف بعد الاعتماد بس.</p><div class="note" id="fState" hidden></div>
  <form id="rf"><div class="card grid"><label>التاريخ<input type="date" id="fDate" value="${r ? r.report_date : today()}" required></label></div>
  <h3>الأعمال اللي اتنفذت</h3><div class="rows" id="aRows"></div><button type="button" data-add="act">+ إضافة نشاط</button>
  <div class="card grid" style="margin-top:14px"><label>المعوقات<textarea id="fObs"></textarea></label><label>الإجراء المتخذ<textarea id="fAct"></textarea></label><label>ملاحظات<textarea id="fNotes"></textarea></label></div>
  <h3>الكميات المنفذة على بنود المقايسة</h3><div class="rows" id="qRows"></div><button type="button" data-add="qty">+ إضافة كمية</button>
  <h3>صبات الخرسانة</h3><p class="mut" style="margin-top:-6px">لو ربطت الصبة ببند، المكعب بيتحسب عليه. ماتكتبهوش تاني في الكميات.</p><div class="rows" id="pRows"></div><button type="button" data-add="pour">+ إضافة صبة</button>
  <h3>العمالة</h3><div class="rows" id="lRows"></div><button type="button" data-add="labor">+ إضافة عمالة</button>
  <h3>المعدات</h3><div class="rows" id="eRows"></div><button type="button" data-add="equip">+ إضافة معدة</button>
  <h3>التوريدات</h3><div class="rows" id="sRows"></div><button type="button" data-add="supply">+ إضافة توريد</button>
  <div class="acts"><button class="p" type="submit" id="fSave">إرسال للمكتب الفني</button><button type="button" id="fNew">تقرير جديد</button></div></form>`;
  fill(r);
  $('#main').onclick = e => { const a = e.target.closest('[data-add]'); if (a) addRow(a.dataset.add); const x = e.target.closest('.row .x'); if (x) x.closest('.row').remove(); };
  $('#qRows').addEventListener('change', e => { const row = e.target.closest('.row'); if (row) hint(row); });
  $('#fDate').onchange = () => fill(P.reports.find(x => x.report_date === $('#fDate').value), true);
  $('#fNew').onclick = () => { $('#fDate').value = today(); fill(null); };
  $('#rf').onsubmit = submitReport;
}
function fill(r, keepDate) {
  const b = r?.body || {}; $('#fObs').value = b.obstacles || ''; $('#fAct').value = b.action || ''; $('#fNotes').value = b.notes || '';
  Object.keys(ROW).forEach(k => { $(ROW[k].box).innerHTML = ''; (k === 'act' ? (b.acts || []) : (b[{ qty: 'qty', pour: 'pours', labor: 'labor', equip: 'equip', supply: 'supply' }[k]] || [])).forEach(v => addRow(k, v)); });
  if (!r) { addRow('act'); addRow('qty'); }
  const n = $('#fState'); if (!r) { n.hidden = true; return; } n.hidden = false;
  n.textContent = r.imported ? 'اليوم ده متسجل من الإكسل القديم. لو بعته هيروح للمراجعة كتقرير جديد.' : r.status === 'approved' ? 'التقرير ده معتمد. أي تعديل هيرجّعه للمراجعة، والكميات المعتمدة تفضل لحد ما يتعتمد تاني.' : r.status === 'returned' ? 'راجع من المكتب الفني: ' + (r.review_comment || '') : 'التقرير ده بانتظار المراجعة، واللي هتبعته هيحل محله.';
}
async function submitReport(e) {
  e.preventDefault(); const P = S.P, d = $('#fDate').value, A = collect('act').filter(a => a.work); if (!A.length) return toast('اكتب الأعمال اللي اتنفذت');
  const Q = collect('qty'); if (Q.some(q => q.qty && !q.item)) return toast('فيه كمية من غير بند');
  const body = { acts: A, obstacles: $('#fObs').value.trim(), action: $('#fAct').value.trim(), notes: $('#fNotes').value.trim(), qty: Q.filter(q => q.item && q.qty), pours: collect('pour'), labor: collect('labor'), equip: collect('equip'), supply: collect('supply') };
  const ex = P.reports.find(x => x.report_date === d); $('#fSave').disabled = true;
  const { error } = ex ? await S.sb.from('daily_reports').update({ body }).eq('id', ex.id) : await S.sb.from('daily_reports').insert({ project_id: P.id, report_date: d, body });
  $('#fSave').disabled = false; if (error) return toast('مقدرتش أبعت: ' + error.message);
  toast('التقرير اتبعت للمكتب الفني'); await loadProject(P.id); renderReport(P.reports.find(x => x.report_date === d));
}

/* ---------------- review ---------------- */
const itemName = id => { const i = S.P.items.find(x => x.id === id); return i ? i.code + ' ' + i.name + ((S.P.proj.buildings || []).length > 1 ? ' – ' + i.building : '') : id; };
const mini = (rows, cols) => rows && rows.length ? `<div class="scroll"><table><thead><tr>${cols.map(c => `<th${c[2] ? ' class="n"' : ''}>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td${c[2] ? ' class="n"' : ''}>${c[3] ? esc(itemName(r[c[0]])) : c[2] ? nf(r[c[0]]) : esc(r[c[0]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
function details(r, withQty = true) {
  const b = r.body || {}, A = b.acts || [];
  return `<b>الأعمال</b>${mini(A.map(a => ({ ...a, progress: a.progress ?? '' })), [...(A.some(a => a.building) ? [['building', 'المبنى']] : []), ['discipline', 'التخصص'], ['work', 'الأعمال'], ['progress', '%']])}
  ${b.obstacles ? `<p><b>المعوقات:</b> ${esc(b.obstacles)}</p>` : ''}${b.action ? `<p><b>الإجراء:</b> ${esc(b.action)}</p>` : ''}${b.notes ? `<p><b>ملاحظات:</b> ${esc(b.notes)}</p>` : ''}
  ${withQty && b.qty?.length ? '<b>الكميات</b>' + mini(b.qty, [['item', 'البند', 0, 1], ['qty', 'الكمية', 1]]) : ''}${b.pours?.length ? '<b>صبات الخرسانة</b>' + mini(b.pours, [['element', 'العنصر'], ['vol', 'م3', 1], ['supplier', 'المحطة']]) : ''}
  ${b.labor?.length ? `<b>العمالة (${b.labor.reduce((s, l) => s + (+l.count || 0), 0)} فرد)</b>` + mini(b.labor, [['building', 'المبنى'], ['trade', 'التخصص'], ['count', 'العدد', 1], ['contractor', 'المقاول']]) : ''}
  ${b.equip?.length ? '<b>المعدات</b>' + mini(b.equip, [['name', 'المعدة'], ['count', 'العدد', 1], ['hours', 'ساعات', 1]]) : ''}${b.supply?.length ? '<b>التوريدات</b>' + mini(b.supply, [['item', 'الصنف'], ['unit', 'الوحدة'], ['req', 'المطلوب', 1], ['got', 'المورّد', 1], ['supplier', 'المورد']]) : ''}`;
}
function renderReview() {
  const P = S.P, L = P.reports.filter(r => r.status === 'submitted').sort((a, b) => a.report_date.localeCompare(b.report_date));
  $('#main').innerHTML = `<h2>مراجعة المكتب الفني</h2><p class="mut">تقدر تعدّل الكميات قبل الاعتماد، والموقف بيتحدّث أول ما تعتمد.</p>${L.length ? L.map(r => { const lines = [...(r.body.qty || []), ...(r.body.pours || []).filter(x => x.item).map(x => ({ item: x.item, qty: x.vol, pour: 1 }))];
    return `<div class="card" data-id="${r.id}"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${r.report_date}</b><span class="mut">${esc(S.names[r.created_by] || '')}</span></div>${details(r, false)}
    <b>الكميات اللي هتتضاف للموقف</b>${lines.length ? `<div class="scroll"><table><thead><tr><th>البند</th><th class="n">الكمية</th></tr></thead><tbody>${lines.map((q, k) => `<tr><td>${esc(itemName(q.item))}${q.pour ? ' <span class="mut">(صبة)</span>' : ''}</td><td class="n"><input type="number" step="any" data-k="${k}" data-item="${esc(q.item)}" value="${q.qty}" style="width:110px;min-height:36px"></td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">مفيش كميات.</p>'}
    <label style="margin-top:10px">تعليق للمهندس (مطلوب لو هترجّعه)<input data-c></label><div class="acts"><button class="ok" data-a="approve">اعتماد وتحديث الموقف</button><button data-a="return">إرجاع للمهندس</button></div></div>`; }).join('') : '<p class="mut">مفيش تقارير مستنية مراجعة.</p>'}`;
  $('#main').onclick = async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const c = b.closest('[data-id]'), id = c.dataset.id, comment = c.querySelector('[data-c]').value.trim(); b.disabled = true;
    const { error } = b.dataset.a === 'approve'
      ? await S.sb.rpc('approve_report', { p_report: id, p_lines: [...c.querySelectorAll('input[data-k]')].map(i => ({ item: i.dataset.item, qty: +i.value || 0 })), p_comment: comment || null })
      : await S.sb.rpc('return_report', { p_report: id, p_comment: comment });
    if (error) { b.disabled = false; return toast(error.message); }
    toast(b.dataset.a === 'approve' ? 'اتعتمد والموقف اتحدّث' : 'التقرير رجع للمهندس'); await loadProject(P.id); renderReview();
  };
}

/* ---------------- log ---------------- */
function renderLog() {
  const P = S.P;
  $('#main').innerHTML = `<h2>سجل التقارير اليومية</h2><div class="filters"><select id="lState"><option value="">كل الحالات</option><option value="submitted">بانتظار المراجعة</option><option value="approved">معتمد</option><option value="returned">مرتجع</option></select><input id="lSearch" type="search" placeholder="بحث في الأعمال"></div><div id="logList"></div>`;
  const draw = () => { const st = $('#lState').value, q = $('#lSearch').value.trim();
    const L = P.reports.filter(r => (!st || r.status === st) && (!q || JSON.stringify(r.body.acts || []).includes(q))).slice(0, 150);
    $('#logList').innerHTML = L.length ? L.map(r => { const [cls, lbl] = r.imported ? ['imp', 'مُرحّل من الإكسل'] : ST[r.status]; const w = (r.body.acts || []).map(a => (a.building ? a.building + ': ' : '') + a.work).join(' — ');
      return `<details class="rep"><summary><b>${r.report_date}</b><span class="w">${esc(w)}</span><span class="st ${cls}">${lbl}</span></summary><div class="body">${r.status === 'returned' ? `<div class="note">سبب الإرجاع: ${esc(r.review_comment)}</div>` : ''}${details(r)}<p class="mut">${r.created_by ? 'كتبه: ' + esc(S.names[r.created_by] || '') : ''}${r.reviewed_by && r.status === 'approved' ? ' · اعتمده: ' + esc(S.names[r.reviewed_by] || '') + ' ' + (r.reviewed_at || '').slice(0, 10) : ''}</p>${can('report', P.id) ? `<div class="acts"><button data-e="${r.id}">فتح في النموذج</button></div>` : ''}</div></details>`; }).join('') : '<p class="mut">مفيش تقارير.</p>'; };
  draw(); $('#lState').onchange = draw; $('#lSearch').oninput = draw;
  $('#logList').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; history.replaceState(null, '', `#p/${P.id}/report`); document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#p/${P.id}/report`)); renderReport(P.reports.find(r => r.id === b.dataset.e)); };
}

/* ---------------- admin: members ---------------- */
async function renderAdmin() {
  const [{ data: users }, { data: mem }] = await Promise.all([S.sb.from('profiles').select('*').order('email'), S.sb.from('project_members').select('*')]);
  const M = {}; (mem || []).forEach(m => M[m.user_id + '|' + m.project_id] = m.role);
  $('#main').innerHTML = `<h2>المستخدمين والصلاحيات</h2><p class="mut">ضيف المستخدم الأول من لوحة Supabase (Authentication ← Add user)، وبعدين حدد دوره في كل مشروع هنا. "—" يعني ملوش دخول على المشروع.</p>
  <div class="scroll"><table class="adm"><thead><tr><th>المستخدم</th>${S.projects.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${(users || []).map(u => `<tr><td>${esc(u.full_name || '')}<div class="mut" style="font-size:12px">${esc(u.email || '')}${u.is_admin ? ' · مدير النظام' : ''}</div></td>${S.projects.map(p => `<td><select data-u="${u.id}" data-p="${p.id}"><option value="">—</option>${Object.entries(ROLE).map(([k, l]) => `<option value="${k}"${M[u.id + '|' + p.id] === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#main').onchange = async e => {
    const s = e.target.closest('select[data-u]'); if (!s) return; const k = { user_id: s.dataset.u, project_id: s.dataset.p };
    const { error } = s.value ? await S.sb.from('project_members').upsert({ ...k, role: s.value }) : await S.sb.from('project_members').delete().eq('user_id', k.user_id).eq('project_id', k.project_id);
    toast(error ? 'مقدرتش أحفظ: ' + error.message : 'اتحفظت الصلاحية');
  };
}

/* ---------------- BOQ & cost ---------------- */
const lacks = r => !(+r.qty > 0) || !(r.rate > 0);
function boqSummary() {
  const P = S.P, rows = S.bq.b ? P.items.filter(r => r.building === S.bq.b) : P.items, tot = rows.reduce((s, r) => s + r.val, 0), pr = rows.filter(r => r.rate > 0).length, nq = rows.filter(r => !(+r.qty > 0)).length;
  const CL = S.bq.b ? [] : P.contract || [], ctot = CL.reduce((s, l) => s + +l.value, 0), bud = S.bq.b ? 0 : P.phases.reduce((s, x) => s + (+x.budget || 0), 0);
  // comparison groups: contract sections can span several system phases (e.g. 3+4) → merge overlapping phase sets
  const grp = P.phaseProg.map(x => ({ ns: [x.n], c: 0 }));
  CL.forEach(l => { const ns = (l.phase_ns || []).map(Number); if (!ns.length) return; const hit = grp.filter(g => g.ns.some(n => ns.includes(n))); const m = { ns: [...new Set([...ns, ...hit.flatMap(g => g.ns)])].sort((a, b) => a - b), c: hit.reduce((s, g) => s + g.c, 0) + +l.value };
    hit.forEach(g => grp.splice(grp.indexOf(g), 1)); grp.push(m); });
  grp.sort((a, b) => a.ns[0] - b.ns[0]);
  const G = grp.map(g => { const L = rows.filter(r => g.ns.includes(r.phase_n)), est = L.reduce((s, r) => s + r.val, 0), b = S.bq.b ? 0 : g.ns.reduce((s, n) => s + (+(P.phases.find(y => y.n === n)?.budget) || 0), 0);
    return { ...g, name: g.ns.map(n => n + '. ' + (P.phaseProg.find(x => x.n === n)?.name || '')).join(' + '), L, est, b, pr: L.filter(r => r.rate > 0).length }; });
  const dv = (a, c) => c ? `<span dir="ltr" style="unicode-bidi:isolate;color:${a > c ? 'var(--bad)' : 'var(--ok)'}">${a > c ? '+' : ''}${nf(a - c, 0)}<small> (${a > c ? '+' : ''}${Math.round((a - c) / c * 100)}%)</small></span>` : '–';
  const hasC = CL.length > 0, LG = S.bq.b ? [] : P.ledger || [], hasA = LG.length > 0, act = ns => LG.filter(x => ns.includes(x.phase_n)).reduce((s, x) => s + x.expense, 0), atot = LG.reduce((s, x) => s + x.expense, 0), unph = LG.filter(x => x.phase_n == null).reduce((s, x) => s + x.expense, 0), rtot = LG.reduce((s, x) => s + x.revenue, 0);
  G.forEach(g => g.a = act(g.ns));
  $('#bqSum').innerHTML = `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${hasC ? `<div class="k"><b>${money(ctot)}</b><span>قيمة العقد (ج.م)</span></div>` : ''}${bud ? `<div class="k"><b>${money(bud)}</b><span>الميزانية الحالية للمراحل${hasC ? ` · ${bud > ctot ? '+' : ''}${Math.round((bud - ctot) / ctot * 100)}% عن العقد` : ''}</span></div>` : ''}${hasA ? `<div class="k"><b style="color:var(--acc)">${money(atot)}</b><span>التكلفة الفعلية المصروفة${hasC ? ` · ${Math.round(atot / ctot * 100)}% من قيمة العقد` : ''}</span></div>${rtot ? `<div class="k"><b>${money(rtot)}</b><span>المحصّل من المالك</span></div>` : ''}` : ''}<div class="k"><b>${money(tot)}</b><span>التكلفة التقديرية من البنود المسعّرة</span></div><div class="k"><b>${pr} / ${rows.length}</b><span>بند متسعّر (${rows.length ? Math.round(pr / rows.length * 100) : 0}%) · ${nq} من غير كمية</span></div></div>
  <div class="scroll" style="margin-top:14px"><table class="stack"><thead><tr><th>المرحلة</th><th class="n">البنود</th><th class="n">متسعّر</th>${hasC ? '<th class="n">قيمة العقد</th>' : ''}${bud ? `<th class="n">الميزانية الحالية</th>${hasC ? '<th class="n">الفرق عن العقد</th>' : ''}` : ''}${hasA ? `<th class="n">الفعلي المصروف</th>${hasC ? '<th class="n">المصروف من العقد</th>' : ''}` : ''}<th class="n">من البنود</th>${hasC ? '<th class="n">الفرق عن العقد</th>' : ''}</tr></thead><tbody>${G.map(x => `<tr class="pick${x.ns.length === 1 && String(x.ns[0]) === S.bq.ph ? ' on' : ''}" data-ph="${x.ns[0]}"><td data-l="المرحلة">${esc(x.name)}${x.ns.length > 1 ? ' <span class="tag">مجمّعة في العقد</span>' : ''}${hasC && !x.c ? ' <span class="tag">مش في العقد</span>' : ''}</td><td class="n" data-l="البنود">${x.L.length}</td><td class="n" data-l="متسعّر">${x.pr}</td>${hasC ? `<td class="n" data-l="قيمة العقد">${x.c ? nf(x.c, 0) : '–'}</td>` : ''}${bud ? `<td class="n" data-l="الميزانية">${x.b ? nf(x.b, 0) : '–'}</td>${hasC ? `<td class="n" data-l="فرق الميزانية">${x.b ? dv(x.b, x.c) : '–'}</td>` : ''}` : ''}${hasA ? `<td class="n" data-l="الفعلي">${x.a ? nf(x.a, 0) : '–'}</td>${hasC ? `<td class="n" data-l="من العقد">${x.a && x.c ? pctTag(x.a / x.c) : '–'}</td>` : ''}` : ''}<td class="n" data-l="من البنود">${x.est ? nf(x.est, 0) : '–'}</td>${hasC ? `<td class="n" data-l="فرق البنود">${x.est ? dv(x.est, x.c) : '–'}</td>` : ''}</tr>`).join('')}
  <tr class="tot"><td data-l="">الإجمالي</td><td class="n" data-l="البنود">${rows.length}</td><td class="n" data-l="متسعّر">${pr}</td>${hasC ? `<td class="n" data-l="قيمة العقد">${nf(ctot, 0)}</td>` : ''}${bud ? `<td class="n" data-l="الميزانية">${nf(bud, 0)}</td>${hasC ? `<td class="n" data-l="فرق الميزانية">${dv(bud, ctot)}</td>` : ''}` : ''}${hasA ? `<td class="n" data-l="الفعلي">${nf(atot, 0)}</td>${hasC ? `<td class="n" data-l="من العقد">${pctTag(atot / ctot)}</td>` : ''}` : ''}<td class="n" data-l="من البنود">${nf(tot, 0)}</td>${hasC ? `<td class="n" data-l="فرق البنود">${tot ? dv(tot, ctot) : '–'}</td>` : ''}</tr></tbody></table></div>
  ${hasA ? actualDetails(LG, unph) : ''}
  ${hasC ? `<details class="card" style="margin-top:12px"><summary><b>تفاصيل قيمة العقد</b> <span class="mut">(${CL.length} بند)</span></summary><div class="scroll"><table><thead><tr><th>القسم</th><th>الأعمال</th><th class="n">القيمة</th><th>من</th><th>إلى</th><th class="n">دفعة مقدمة</th></tr></thead><tbody>${CL.map(l => `<tr><td>${l.sec}. ${esc(l.section)}</td><td>${esc(l.line || '')}</td><td class="n">${nf(l.value, 0)}</td><td>${l.start ? fmtD(l.start) : '–'}</td><td>${l.finish ? fmtD(l.finish) : '–'}</td><td class="n">${l.advance_pct != null ? +l.advance_pct + '%' : '–'}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
}
const pctTag = r => `<span dir="ltr" style="unicode-bidi:isolate;color:${r > 1 ? 'var(--bad)' : r > 0.85 ? 'var(--warn)' : 'inherit'}">${Math.round(r * 100)}%</span>`;
function actualDetails(LG, unph) {
  const P = S.P, ph = [...new Set(LG.filter(x => x.expense).map(x => x.phase_n))].sort((a, b) => (a ?? 99) - (b ?? 99)), b = LG.find(x => x.batch)?.batch;
  return `<details class="card" style="margin-top:12px"><summary><b>تفاصيل التكلفة الفعلية من الحسابات</b> <span class="mut">${b ? '· ' + esc(b) : ''}</span></summary>
  <p class="mut">مقسّمة على المرحلة الأساسية والفرعية زي ما المحاسب صنّفها.${unph ? ` فيه ${nf(unph, 0)} ج.م مصروفة على المشروع من غير مرحلة.` : ''}</p>
  <div class="scroll"><table><thead><tr><th>المرحلة</th><th>المرحلة الفرعية في الحسابات</th><th class="n">القيود</th><th class="n">المصروف</th></tr></thead><tbody>${ph.map(n => { const L = LG.filter(x => x.phase_n === n && x.expense).sort((a, b) => b.expense - a.expense);
    return `<tr class="gh2"><td colspan="3"><b>${n ? n + '. ' + esc(P.phaseProg.find(x => x.n === n)?.name || '') : 'من غير مرحلة'}</b></td><td class="n"><b>${nf(L.reduce((s, x) => s + x.expense, 0), 0)}</b></td></tr>` + L.map(x => `<tr><td class="mut">${esc(x.main_phase || '')}</td><td>${esc(x.sub_phase || '—')}</td><td class="n">${x.lines}</td><td class="n">${nf(x.expense, 0)}</td></tr>`).join(''); }).join('')}</tbody></table></div>
  </details>`;
}
async function importLedger(file) {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true }), box = $('#lgBox'), PM = { 'شيراتون': 'sheraton', 'مجاويش': 'sahlgate', 'سهل جيت': 'sahlgate' };
  const PH = { 'التصميم_والتراخيص': 1, 'اعمال_تجهيز_الموقع': 2, 'اسفل_منسوب_الارض': 3, 'الهيكل_الخرساني': 4, 'التشطيبات_الداخلية': 5, 'الواجهات_الخارجية': 6, 'الاعمال_الكهروميكانيكية': 7, 'الأعمال_الكهروميكانيكية': 7, 'اللاندسكيب': 8, 'اللاند_سكيب': 8, 'الاختبار_والتشغيل': 9, 'التشغيل_والتجريب': 9 };
  const T = v => String(v ?? '').trim(), num = v => typeof v === 'number' ? v : 0, out = [];
  for (const sn of wb.SheetNames) {
    const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }); let hi = -1;
    for (let i = 0; i < Math.min(A.length, 15); i++) { const r = A[i].map(T); if (r.includes('المشروع') && r.includes('مرحلة اساسية') && r.includes('مصروفات') && r.includes('ايرادات')) hi = i; }
    if (hi < 0) continue; const H = A[hi].map(T), c = n => H.indexOf(n), cP = c('المشروع'), cM = c('مرحلة اساسية'), cS = c('مرحلة فرعية'), cE = c('مصروفات'), cR = c('ايرادات'), cD = c('بيان') >= 0 ? c('بيان') : c('البيان');
    const H0 = (A[1] || []).map(T), cDt = H0.indexOf('التاريخ'), cSup = H0.indexOf('مقاول/مورد');
    A.slice(hi + 1).forEach(r => { const pid = PM[T(r[cP])]; if (!pid) return; const e = num(r[cE]), rv = num(r[cR]); if (!e && !rv) return;
      const m = T(r[cM]), d = r[cDt]; let dt = null; if (d instanceof Date) dt = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); else { const x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(T(d)); if (x) dt = `${x[3]}-${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}`; }
      out.push({ project_id: pid, entry_date: dt, description: T(r[cD]).slice(0, 300) || null, supplier: cSup >= 0 ? T(r[cSup]) || null : null, main_phase: m && m !== '=' ? m : null, sub_phase: T(r[cS]) && T(r[cS]) !== '=' ? T(r[cS]) : null, expense: e, revenue: rv, phase_n: PH[m.replace(/\s+/g, '_')] ?? null, source: 'excel', batch: file.name + ' · ' + today() }); });
    if (out.length) break;
  }
  if (!out.length) return box.innerHTML = '<div class="note">مش لاقي في الملف شيت فيه أعمدة المشروع والمرحلة الأساسية والإيرادات والمصروفات.</div>';
  const sum = pid => out.filter(x => x.project_id === pid), tot = (L, k) => nf(L.reduce((s, x) => s + x[k], 0), 0);
  box.innerHTML = `<div class="card">${S.projects.map(p => { const L = sum(p.id); return L.length ? `<div><b>${esc(p.name)}</b>: ${L.length} قيد · مصروف ${tot(L, 'expense')} · إيراد ${tot(L, 'revenue')}</div>` : ''; }).join('')}<div class="acts"><button class="ok" id="lgGo">استبدال بيانات الحسابات</button><button id="lgNo">إلغاء</button></div></div>`;
  $('#lgNo').onclick = () => box.innerHTML = '';
  $('#lgGo').onclick = async () => { $('#lgGo').disabled = true; const pids = [...new Set(out.map(x => x.project_id))]; let err = null;
    for (const pid of pids) { if (!can('ledger', pid)) continue; const { error } = await S.sb.from('ledger_entries').delete().eq('project_id', pid).eq('source', 'excel'); err = err || error;
      const L = out.filter(x => x.project_id === pid); for (let k = 0; k < L.length && !err; k += 500) { const { error: e2 } = await S.sb.from('ledger_entries').insert(L.slice(k, k + 500)); err = e2; } }
    if (err) { $('#lgGo').disabled = false; return toast('حصلت مشكلة: ' + err.message); } toast('اتحدثت بيانات الحسابات'); S.P.contract = null; renderBoq(); };
}
async function renderBoq() {
  if (!S.P.contract) { const [c, l] = await Promise.all([S.sb.from('contract_lines').select('*').eq('project_id', S.P.id).order('sort'), S.sb.rpc('ledger_summary', { p_project: S.P.id })]); S.P.contract = c.data || []; S.P.ledger = (l.data || []).map(x => ({ ...x, expense: +x.expense, revenue: +x.revenue })); }
  const P = S.P, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id), F = S.bq;
  $('#main').innerHTML = `<h2>المقايسة والتكلفة</h2><p class="mut">سعر البند هنا هو تكلفة الوحدة التقديرية. التكلفة التقديرية = الكمية × السعر. التكلفة الفعلية هتيجي من أودو في مرحلة لاحقة.</p><div id="bqSum"></div>
  <div class="filters" style="margin-top:16px"><select id="bqPh"><option value="">كل المراحل</option>${P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === F.ph ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select>${multi ? `<select id="bqB"><option value="">كل المباني</option>${P.proj.buildings.map(b => `<option${b === F.b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}<input id="bqQ" type="search" placeholder="بحث في البنود أو الكود" value="${esc(F.q)}"><label class="chk"><input type="checkbox" id="bqM"${F.miss ? ' checked' : ''}> الناقص سعر أو كمية بس</label></div>
  <div class="acts" style="margin-top:0">${ed ? `<button id="bqE" class="p"${F.edit ? ' hidden' : ''}>تعديل الكميات والأسعار</button>` : ''}<button id="bqX">تحميل المقايسة Excel</button>${ed ? '<label class="btn">رفع ملف أسعار<input type="file" id="bqF" accept=".xlsx,.xls" hidden></label>' : ''}${can('ledger', P.id) ? '<label class="btn" title="شيت الحسابات بنفس شكل شيت الغردقة: المشروع والمرحلة الأساسية والفرعية والإيرادات والمصروفات. بيستبدل بيانات الإكسل القديمة.">رفع شيت الحسابات<input type="file" id="lgF" accept=".xlsx,.xls" hidden></label>' : ''}</div><div id="lgBox"></div>
  ${ed ? '<p class="mut" style="margin-top:-4px">للتعديل: اضغط "تعديل الكميات والأسعار"، واكتب التعديلات، وبعدين "حفظ". أو حمّل المقايسة Excel، واملاها، وارفعها تاني.</p>' : ''}<div id="bqImp"></div>${ed ? addItemForm() : ''}<div id="bqT"></div>${ed ? `<div class="editbar" id="bqBar"${F.edit ? '' : ' hidden'}><span id="bqN"></span><button class="ok" id="bqS">حفظ التعديلات</button><button id="bqC">إلغاء</button></div>` : ''}`;
  boqSummary(); boqTable();
  $('#lgF') && ($('#lgF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLedger(f); });
  const set = (k, v) => { F[k] = v; if (k === 'b') boqSummary(); boqTable(); };
  $('#bqPh').onchange = e => set('ph', e.target.value); $('#bqB') && ($('#bqB').onchange = e => set('b', e.target.value));
  $('#bqQ').onchange = e => set('q', e.target.value.trim()); $('#bqM').onchange = e => set('miss', e.target.checked);
  $('#bqSum').onclick = e => { const t = e.target.closest('tr[data-ph]'); if (!t) return; F.ph = F.ph === t.dataset.ph ? '' : t.dataset.ph; $('#bqPh').value = F.ph; boqSummary(); boqTable(); };
  $('#addF') && bindAddItem();
  $('#bqX').onclick = exportBoq; $('#bqF') && ($('#bqF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBoq(f); });
  const bar = () => { const n = F.pend.size; if ($('#bqN')) $('#bqN').textContent = n ? `${n} بند متعدّل ومش محفوظ` : 'وضع التعديل: اكتب الكميات والأسعار وبعدين احفظ'; if ($('#bqS')) $('#bqS').disabled = !n; };
  const mode = on => { F.edit = on; if (!on) F.pend.clear(); $('#bqE') && ($('#bqE').hidden = on); $('#bqBar') && ($('#bqBar').hidden = !on); boqTable(); bar(); };
  $('#bqE') && ($('#bqE').onclick = () => mode(true)); $('#bqC') && ($('#bqC').onclick = () => mode(false)); bar();
  $('#bqT').addEventListener('input', e => {
    const i = e.target.closest('input[data-f]'); if (!i) return; const tr = i.closest('tr'), r = P.items.find(x => x.id === tr.dataset.id), f = i.dataset.f, v = i.value === '' ? 0 : +i.value;
    const orig = f === 'rate' ? r.rate : +r.qty || 0, pe = { ...(F.pend.get(r.id) || {}) };
    if (v === orig) delete pe[f]; else pe[f] = v; Object.keys(pe).length ? F.pend.set(r.id, pe) : F.pend.delete(r.id);
    i.closest('td').classList.toggle('chg', f in pe); const q = pe.qty ?? (+r.qty || 0), rt = pe.rate ?? r.rate; tr.querySelector('.tot').textContent = q * rt ? nf(q * rt, 0) : '–'; bar();
  });
  $('#bqS') && ($('#bqS').onclick = async () => {
    const btn = $('#bqS'); btn.disabled = true; btn.textContent = 'جاري الحفظ…'; const ch = [...F.pend.entries()]; let err = null;
    const R = ch.filter(([, v]) => 'rate' in v).map(([item_id, v]) => ({ item_id, rate: v.rate })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = error; }
    const Q = ch.filter(([, v]) => 'qty' in v); for (let k = 0; k < Q.length && !err; k += 10) { const res = await Promise.all(Q.slice(k, k + 10).map(([id, v]) => S.sb.from('boq_items').update({ qty: v.qty }).eq('id', id))); err = res.find(x => x.error)?.error; }
    btn.textContent = 'حفظ التعديلات'; if (err) { btn.disabled = false; return toast('مقدرتش أحفظ: ' + err.message); }
    ch.forEach(([id, v]) => { const r = P.items.find(x => x.id === id); if ('rate' in v) r.rate = v.rate; if ('qty' in v) { r.qty = v.qty; r.rem = v.qty - r.ex; r.pct = v.qty > 0 ? r.ex / v.qty : 0; r.known = v.qty > 0 || r.pct_override != null; } r.val = (+r.qty || 0) * r.rate; });
    toast(`اتحفظ تعديل ${ch.length} بند`); mode(false); boqSummary();
  });
}
function boqTable() {
  const P = S.P, F = S.bq, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id) && F.edit;
  const rows = P.items.filter(r => (!F.ph || String(r.phase_n) === F.ph) && (!F.b || r.building === F.b) && (!F.miss || lacks(r)) && (!F.q || (r.code + ' ' + r.name + ' ' + (r.description || '')).includes(F.q)));
  if (!rows.length) return $('#bqT').innerHTML = '<p class="mut">مفيش بنود بالفلتر ده.</p>';
  const cols = 6 + (multi ? 1 : 0), keys = [...new Set(rows.map(r => r.phase_n + '|' + r.group_name))];
  const pv = (r, f) => { const pe = F.pend.get(r.id); return pe && f in pe ? pe[f] : (f === 'qty' ? +r.qty : r.rate); }, chg = (r, f) => F.pend.get(r.id) && f in F.pend.get(r.id);
  const cell = (r, f) => ed ? `<input type="number" step="any" inputmode="decimal" data-f="${f}" value="${pv(r, f) || ''}">` : ((f === 'qty' ? +r.qty : r.rate) ? nf(f === 'qty' ? r.qty : r.rate) : '–');
  $('#bqT').innerHTML = `<div class="scroll"><table class="stack it bq"><thead><tr><th>الكود</th><th>البند</th>${multi ? '<th>المبنى</th>' : ''}<th>الوحدة</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">الإجمالي</th></tr></thead><tbody>${keys.map(k => { const L = rows.filter(r => r.phase_n + '|' + r.group_name === k), [n, g] = [L[0].phase_n, L[0].group_name], sub = L.reduce((s, r) => s + r.val, 0);
    return `<tr class="gh"><td colspan="${cols - 1}">${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} – ${esc(g)} <span class="mut">(${L.length})</span></td><td class="n">${sub ? nf(sub, 0) : ''}</td></tr>` + L.map(r => `<tr data-id="${esc(r.id)}" class="${lacks(r) ? 'lack' : ''}"><td data-l="الكود">${esc(r.code)}</td><td data-l="البند" title="${esc(r.description || '')}">${esc(r.name)}${r.note ? `<div class="mut" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>${multi ? `<td data-l="المبنى">${esc(r.building)}</td>` : ''}<td data-l="الوحدة">${esc(r.unit)}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'qty') ? ' chg' : ''}" data-l="الكمية">${cell(r, 'qty')}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'rate') ? ' chg' : ''}" data-l="السعر">${cell(r, 'rate')}</td><td class="n tot" data-l="الإجمالي">${(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val) ? nf(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val, 0) : '–'}</td></tr>`).join(''); }).join('')}</tbody></table></div>`;
}
function addItemForm() {
  const P = S.P, bs = P.proj.buildings || [], grp = [...new Set(P.items.map(r => r.group_name))];
  return `<details class="card addi"><summary><b>+ إضافة بند جديد للمقايسة</b></summary><form id="addF" class="grid" style="margin-top:10px">
  <label>المرحلة<select name="phase" required>${P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === S.bq.ph ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select></label>
  <label>المجموعة<input name="group" list="grpL" required placeholder="مثلاً: خرسانة الأسقف"><datalist id="grpL">${grp.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
  ${bs.length > 1 ? `<label>المبنى<select name="building"><option value="">— عام —</option>${bs.map(b => `<option>${esc(b)}</option>`).join('')}</select></label>` : ''}
  <label class="wide">بيان البند<input name="name" required></label>
  <label>الوحدة<input name="unit" list="unitL" required><datalist id="unitL">${['م3', 'م2', 'م.ط', 'طن', 'عدد', 'مقطوعية'].map(u => `<option value="${u}">`).join('')}</datalist></label>
  <label>الكمية<input name="qty" type="number" step="any" inputmode="decimal"></label><label>السعر<input name="rate" type="number" step="any" inputmode="decimal"></label>
  <div class="acts" style="margin:0;align-self:end"><button class="p">إضافة</button></div></form><p class="mut" style="margin:6px 0 0">الكود بيتعمل لوحده حسب المرحلة.</p></details>`;
}
function bindAddItem() {
  const P = S.P;
  $('#addF').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), n = +f.get('phase'), pre = (P.items[0]?.code || P.id.slice(0, 2).toUpperCase()).split('-')[0];
    const nums = P.items.map(r => (r.code.match(new RegExp('^' + pre + '-' + n + '-(\\d+)$')) || [])[1]).filter(Boolean).map(Number);
    let k = nums.length ? Math.max(...nums) + 1 : 1, code; do code = `${pre}-${n}-${String(k++).padStart(2, '0')}`; while (P.items.some(r => r.id === code || r.code === code));
    const row = { id: code, project_id: P.id, phase_n: n, group_name: f.get('group').trim(), building: f.get('building') || null, code, name: f.get('name').trim(), unit: f.get('unit').trim(), qty: +f.get('qty') || 0, sort: Math.max(0, ...P.items.map(r => +r.sort || 0)) + 1 };
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const { error } = await S.sb.from('boq_items').insert(row); if (error) { btn.disabled = false; return toast('مقدرتش أضيف: ' + error.message); }
    const rate = +f.get('rate'); if (rate > 0) { const r2 = await S.sb.from('boq_rates').upsert({ item_id: code, rate }); if (r2.error) toast('البند اتضاف بس السعر ماتحفظش: ' + r2.error.message); }
    toast('اتضاف البند ' + code); S.bq.ph = String(n); await refresh();
  };
}
const BQH = ['المعرّف', 'المرحلة', 'المجموعة', 'الكود', 'البند', 'المبنى', 'الوحدة', 'الكمية', 'السعر', 'الإجمالي'];
function exportBoq() {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const X = XLSX, P = S.P, aoa = [BQH, ...P.items.map(r => [r.id, r.phase_n, r.group_name, r.code, r.name, r.building || '', r.unit, +r.qty || '', r.rate || '', null])];
  const ws = X.utils.aoa_to_sheet(aoa); for (let k = 2; k <= aoa.length; k++) ws['J' + k] = { t: 'n', f: `H${k}*I${k}` };
  ws['!cols'] = [{ hidden: true }, { wch: 7 }, { wch: 22 }, { wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'المقايسة'); wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, 'مقايسة ' + P.proj.name + ' ' + today() + '.xlsx');
}
async function importBoq(file) {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const P = S.P, wb = XLSX.read(await file.arrayBuffer()), A = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const hi = A.findIndex(r => r.some(c => String(c).trim() === 'الكود')); if (hi < 0) return toast('مش لاقي عمود "الكود" في الملف');
  const H = A[hi].map(c => String(c).trim()), col = (...n) => H.findIndex(h => n.includes(h)), cI = col('المعرّف', 'المعرف'), cC = col('الكود'), cB = col('المبنى'), cQ = col('الكمية'), cR = col('السعر', 'سعر الوحدة');
  if (cQ < 0 && cR < 0) return toast('مش لاقي عمود الكمية أو السعر');
  const num = v => { if (v === '' || v == null) return null; const x = +String(v).replace(/,/g, ''); return isFinite(x) ? x : null; };
  const ch = [], miss = [];
  A.slice(hi + 1).forEach(row => { const id = cI >= 0 ? String(row[cI]).trim() : '', code = String(row[cC] ?? '').trim(); if (!id && !code) return;
    const r = (id && P.items.find(x => x.id === id)) || P.items.find(x => x.code === code && (cB < 0 || !(P.proj.buildings || []).length || (x.building || '') === String(row[cB]).trim()));
    if (!r) return miss.push(code || id); const q = cQ >= 0 ? num(row[cQ]) : null, rt = cR >= 0 ? num(row[cR]) : null;
    const c = { r }; if (q != null && q !== (+r.qty || 0)) c.qty = q; if (rt != null && rt !== r.rate) c.rate = rt; if ('qty' in c || 'rate' in c) ch.push(c); });
  const box = $('#bqImp');
  if (!ch.length) { box.innerHTML = `<div class="note">مفيش تغييرات في الملف${miss.length ? ` · ${miss.length} كود مش موجود في المقايسة` : ''}.</div>`; return; }
  box.innerHTML = `<div class="card"><b>الملف فيه ${ch.length} تعديل</b> <span class="mut">(${ch.filter(c => 'rate' in c).length} سعر · ${ch.filter(c => 'qty' in c).length} كمية)</span>${miss.length ? `<div class="mut">${miss.length} كود مش موجود في المقايسة واتجاهل: ${esc(miss.slice(0, 8).join('، '))}${miss.length > 8 ? '…' : ''}</div>` : ''}
  <div class="scroll" style="max-height:300px;overflow:auto"><table><thead><tr><th>الكود</th><th>البند</th><th class="n">الكمية</th><th class="n">السعر</th></tr></thead><tbody>${ch.slice(0, 200).map(c => `<tr><td>${esc(c.r.code)}</td><td>${esc(c.r.name.slice(0, 60))}${c.r.building ? ' – ' + esc(c.r.building) : ''}</td><td class="n">${'qty' in c ? nf(+c.r.qty || 0) + ' ← <b>' + nf(c.qty) + '</b>' : ''}</td><td class="n">${'rate' in c ? nf(c.r.rate) + ' ← <b>' + nf(c.rate) + '</b>' : ''}</td></tr>`).join('')}</tbody></table></div>
  <div class="acts"><button class="ok" id="impGo">تطبيق التعديلات</button><button id="impNo">إلغاء</button></div></div>`;
  $('#impNo').onclick = () => box.innerHTML = '';
  $('#impGo').onclick = async () => { $('#impGo').disabled = true; let err = null;
    const R = ch.filter(c => 'rate' in c).map(c => ({ item_id: c.r.id, rate: c.rate })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = err || error; }
    const Q = ch.filter(c => 'qty' in c); for (let k = 0; k < Q.length; k += 10) { const res = await Promise.all(Q.slice(k, k + 10).map(c => S.sb.from('boq_items').update({ qty: c.qty }).eq('id', c.r.id))); err = err || res.find(x => x.error)?.error; }
    if (err) toast('حصلت مشكلة في جزء من التعديلات: ' + err.message); else toast('اتطبقت ' + ch.length + ' تعديل'); await refresh(); };
}

/* ---------------- schedule (الجدول الزمني) ---------------- */
const DAY = 864e5, TD = s => s ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null, DS = t => t == null ? null : new Date(t).toISOString().slice(0, 10);
const isWork = t => new Date(t).getUTCDay() !== 5;   // الجمعة إجازة
const addWork = (t, n) => { if (!Number.isFinite(t)) return t; n = Math.round(+n || 0); const st = n < 0 ? -DAY : DAY; while (!isWork(t)) t += st; while (n) { t += st; if (isWork(t)) n -= Math.sign(n); } return t; };
const workDays = (a, b) => { if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0; const days = Math.round((b - a) / DAY) + 1, wk = Math.floor(days / 7); let n = wk * 6; for (let t = a + wk * 7 * DAY; t <= b; t += DAY) if (isWork(t)) n++; return n; };
const fmtD = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) : '–';
const SCH = { rowH: 34, zoom: { 'يوم': 22, 'أسبوع': 7, 'شهر': 2.4 } };
if (!S.sc) S.sc = { zoom: 'أسبوع', closed: new Set(), late: false, q: '', b: '' };

async function loadSchedule() {
  const P = S.P, ed = can('editBoq', P.id);
  const [a, l, pr, li] = await Promise.all([
    S.sb.from('schedule_activities').select('*').eq('project_id', P.id).order('sort'),
    S.sb.from('schedule_links').select('*').eq('project_id', P.id),
    S.sb.rpc('schedule_progress', { p_project: P.id }),
    ed ? S.sb.from('schedule_activity_items').select('activity_id,item_id') : Promise.resolve({ data: [] }),
  ]);
  if (a.error) toast('مقدرتش أحمّل الجدول: ' + a.error.message);
  const prog = Object.fromEntries((pr.data || []).map(x => [x.activity_id, x]));
  const A = (a.data || []).map(x => ({ ...x, s: TD(x.start), f: TD(x.finish), bs: TD(x.bl_start), bf: TD(x.bl_finish), pr: prog[x.id] || {}, kids: [] }));
  const byId = Object.fromEntries(A.map(x => [x.id, x]));
  A.forEach(x => { if (x.parent_id && byId[x.parent_id]) byId[x.parent_id].kids.push(x); });
  P.sch = { A, byId, links: l.data || [], items: {} };
  (li.data || []).forEach(r => (P.sch.items[r.activity_id] ||= []).push(r.item_id));
  schCompute();
}
function schCompute() {
  const { A } = S.P.sch, now = TD(today());
  const leafs = x => x.kids.length ? x.kids.flatMap(leafs) : [x];
  A.forEach(x => { x.dur = x.is_milestone ? 0 : (x.duration_days != null ? +x.duration_days : workDays(x.s, x.f)); });
  A.forEach(x => {
    const L = x.kids.length ? leafs(x) : [x], w = y => Math.max(y.dur, 1);
    const plan = y => y.s == null ? 0 : now < y.s ? 0 : now >= (y.f ?? y.s) ? 1 : (now - y.s + DAY) / ((y.f - y.s) + DAY);
    const W = L.reduce((s, y) => s + w(y), 0); x.plan = W ? L.reduce((s, y) => s + w(y) * plan(y), 0) / W : 0;
    const K = L.filter(y => y.pr.pct != null), WK = K.reduce((s, y) => s + w(y), 0);
    x.act = x.kids.length ? (WK ? K.reduce((s, y) => s + w(y) * +y.pr.pct, 0) / WK : null) : (x.pr.pct != null ? +x.pr.pct : null);
    x.st = x.act != null && x.act >= 0.999 ? 'done' : x.s == null || now < x.s ? 'wait' : x.act == null ? 'nodata' : (x.f != null && now > x.f) || x.act < x.plan - 0.05 ? 'late' : 'run';
  });
}
const SST = { done: ['appr', 'خلص'], run: ['run', 'شغال'], late: ['ret', 'متأخر'], wait: ['imp', 'لسه'], nodata: ['imp', 'بدون ربط'] };

async function renderSchedule() {
  const P = S.P, ed = can('editBoq', P.id);
  $('#main').innerHTML = '<p class="mut">جاري تحميل الجدول الزمني…</p>';
  await loadSchedule(); const { A } = P.sch, F = S.sc;
  const top = A.filter(x => !x.parent_id), leafs = A.filter(x => !x.kids.length);
  const W = leafs.reduce((s, y) => s + Math.max(y.dur, 1), 0), plan = W ? leafs.reduce((s, y) => s + Math.max(y.dur, 1) * y.plan, 0) / W : 0;
  const K = leafs.filter(y => y.act != null), WK = K.reduce((s, y) => s + Math.max(y.dur, 1), 0), act = WK ? K.reduce((s, y) => s + Math.max(y.dur, 1) * y.act, 0) / WK : null, planK = WK ? K.reduce((s, y) => s + Math.max(y.dur, 1) * y.plan, 0) / WK : 0;
  const fin = Math.max(0, ...A.map(x => x.f || 0)), bfin = Math.max(0, ...A.map(x => x.bf || 0)), slip = fin && bfin ? workDays(Math.min(fin, bfin), Math.max(fin, bfin)) * Math.sign(fin - bfin) : 0;
  const lateN = leafs.filter(x => x.st === 'late').length, linked = leafs.filter(x => x.pr.items > 0 || x.manual_pct != null).length;
  $('#main').innerHTML = `<h2>الجدول الزمني</h2>
  ${A.length ? `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="k"><b>${Math.round(plan * 100)}%</b><span>المخطط حتى النهارده</span></div><div class="k"><b style="color:var(--acc)">${act == null ? '–' : Math.round(act * 100) + '%'}</b><span>الفعلي (من الأنشطة المربوطة)</span></div><div class="k"><b>${act == null || !planK ? '–' : nf(act / planK, 2)}</b><span>مؤشر الأداء الزمني SPI</span></div><div class="k"><b style="${lateN ? 'color:var(--bad)' : ''}">${lateN}</b><span>نشاط متأخر</span></div><div class="k"><b>${fin ? fmtD(DS(fin)) : '–'}</b><span>نهاية المشروع${bfin ? ` · ${slip > 0 ? 'متأخر ' + slip + ' يوم عن' : slip < 0 ? 'متقدم ' + -slip + ' يوم عن' : 'مطابق لـ'} خط الأساس` : ''}</span></div></div>
  <p class="mut" style="margin-top:8px">${linked} من ${leafs.length} نشاط مربوطين ببنود المقايسة أو ليهم نسبة يدوية. نسبة النشاط بتتحسب لوحدها من كميات التقارير المعتمدة. أيام العمل من السبت للخميس.</p>` : `<div class="note">لسه مفيش جدول زمني للمشروع ده.${ed ? ' ارفع ملف MS Project، أو ابدأ تضيف أنشطة.' : ' المكتب الفني هيرفعه قريب.'}</div>`}
  <div class="acts">${ed ? `<button class="p" id="scAdd">+ نشاط</button><label class="btn">استيراد MS Project (XML)<input type="file" id="scImp" accept=".xml" hidden></label>${A.length ? '<button id="scCalc">إعادة حساب التواريخ</button><button id="scBase">حفظ خط الأساس</button>' : ''}` : ''}${A.length ? '<button id="scX">تحميل Excel</button>' : ''}</div>
  ${ed ? '<p class="mut" style="margin-top:-4px">من برنامج MS Project احفظ الجدول بصيغة XML (من Save As اختار XML Format). لو رفعت نسخة أحدث بعدين، الأنشطة بتتحدّث وربطها بالبنود بيفضل زي ما هو.</p>' : ''}<div id="scImpBox"></div>
  ${A.length ? `<div class="filters" style="margin-top:12px">${(P.proj.buildings || []).length > 1 ? `<select id="scB"><option value="">كل المباني</option>${P.proj.buildings.map(b => `<option${b === F.b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}<input id="scQ" type="search" placeholder="بحث في الأنشطة" value="${esc(F.q)}"><label class="chk"><input type="checkbox" id="scL"${F.late ? ' checked' : ''}> المتأخر بس</label><div class="seg">${Object.keys(SCH.zoom).map(z => `<button type="button" data-z="${z}" class="${z === F.zoom ? 'on' : ''}">${z}</button>`).join('')}</div></div><div id="gantt"></div>` : ''}`;
  if (A.length) drawGantt();
  const on = (id, ev, fn) => { const e = $(id); if (e) e[ev] = fn; };
  on('#scQ', 'onchange', e => { F.q = e.target.value.trim(); drawGantt(); }); on('#scL', 'onchange', e => { F.late = e.target.checked; drawGantt(); }); on('#scB', 'onchange', e => { F.b = e.target.value; drawGantt(); });
  document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { F.zoom = b.dataset.z; document.querySelectorAll('[data-z]').forEach(x => x.classList.toggle('on', x === b)); drawGantt(); });
  on('#scAdd', 'onclick', () => editActivity(null)); on('#scX', 'onclick', exportSchedule); on('#scCalc', 'onclick', recalcSchedule); on('#scBase', 'onclick', saveBaseline);
  on('#scImp', 'onchange', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importMsp(f); });
}

function drawGantt() {
  const P = S.P, { A } = P.sch, F = S.sc, px = SCH.zoom[F.zoom], now = TD(today());
  const match = x => (!F.q || x.name.includes(F.q) || (x.wbs || '').startsWith(F.q)) && (!F.b || x.building === F.b || x.kids.length) && (!F.late || x.st === 'late');
  const keep = new Set(); const mark = x => { let ok = match(x); x.kids.forEach(k => { if (mark(k)) ok = true; }); if (ok && (F.q || F.late || F.b ? (match(x) || x.kids.some(k => keep.has(k.id))) : true)) keep.add(x.id); return keep.has(x.id); };
  A.filter(x => !x.parent_id).forEach(mark);
  const rows = []; const walk = x => { if (!keep.has(x.id)) return; rows.push(x); if (!F.closed.has(x.id) || F.q || F.late) x.kids.forEach(walk); };
  A.filter(x => !x.parent_id).forEach(walk);
  const ds = A.flatMap(x => [x.s, x.f, x.bs, x.bf]).filter(Boolean); if (!ds.length) return $('#gantt').innerHTML = '<p class="mut">الأنشطة مفيهاش تواريخ.</p>';
  let t0 = Math.min(...ds, now), t1 = Math.max(...ds, now); t0 = Date.UTC(new Date(t0).getUTCFullYear(), new Date(t0).getUTCMonth(), 1); t1 = Date.UTC(new Date(t1).getUTCFullYear(), new Date(t1).getUTCMonth() + 1, 1);
  const TW = Math.round((t1 - t0) / DAY * px), X = t => Math.round((t - t0) / DAY * px);
  const months = []; for (let t = t0; t < t1;) { const d = new Date(t), n = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); months.push([t, n]); t = n; }
  const MN = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const head = months.map(([a, b]) => `<i style="right:${X(a)}px;width:${X(b) - X(a)}px">${X(b) - X(a) > 46 ? MN[new Date(a).getUTCMonth()] + ' ' + String(new Date(a).getUTCFullYear()).slice(2) : ''}</i>`).join('');
  const grid = months.map(([a]) => `<b style="right:${X(a)}px"></b>`).join('');
  const bar = x => { if (x.s == null) return '';
    const r = X(x.s), w = Math.max(X((x.f ?? x.s) + DAY) - r, 3), bl = x.bs != null ? `<em class="bl" style="right:${X(x.bs)}px;width:${Math.max(X((x.bf ?? x.bs) + DAY) - X(x.bs), 3)}px"></em>` : '';
    if (x.is_milestone) return `${bl}<span class="ms ${x.st}" style="right:${r - 7}px" title="${esc(x.name)} ${fmtD(x.start)}"></span>`;
    if (x.kids.length) return `${bl}<span class="sm" style="right:${r}px;width:${w}px"><u style="width:${(x.act || 0) * 100}%"></u></span>`;
    return `${bl}<span class="br ${x.st}" style="right:${r}px;width:${w}px" title="${esc(x.name)}: ${fmtD(x.start)} → ${fmtD(x.finish)} · مخطط ${Math.round(x.plan * 100)}% · فعلي ${x.act == null ? '–' : Math.round(x.act * 100) + '%'}"><u style="width:${(x.act || 0) * 100}%"></u></span>`; };
  $('#gantt').innerHTML = `<div class="gwrap"><div class="gt" style="--tw:${TW}px">
  <div class="gr gh"><div class="gi"><span class="gn">النشاط</span><span class="gd">البداية</span><span class="gd">النهاية</span><span class="gp">الفعلي</span></div><div class="gl">${head}</div></div>
  ${rows.map(x => `<div class="gr${x.kids.length ? ' sum' : ''}" data-id="${x.id}"><div class="gi"><span class="gn" style="padding-inline-start:${(x.outline_level - 1) * 14 + 6}px">${x.kids.length ? `<button type="button" class="tg" data-tg="${x.id}">${F.closed.has(x.id) && !F.q && !F.late ? '◂' : '▾'}</button>` : ''}<a href="#" data-open="${x.id}" title="${esc(x.name)}">${x.wbs ? `<small>${esc(x.wbs)}</small> ` : ''}${esc(x.name)}</a></span><span class="gd">${fmtD(x.start)}</span><span class="gd">${fmtD(x.finish)}</span><span class="gp">${x.act == null ? '<span class="mut">–</span>' : Math.round(x.act * 100) + '%'}${!x.kids.length ? ` <span class="st ${SST[x.st][0]}">${SST[x.st][1]}</span>` : ''}</span></div><div class="gl">${bar(x)}</div></div>`).join('')}
  <div class="gbg" style="height:${(rows.length + 1) * SCH.rowH}px">${grid}${now >= t0 && now <= t1 ? `<s style="right:${X(now)}px" title="النهارده"></s>` : ''}</div></div></div>
  <div class="leg"><span><i style="background:var(--acc)"></i>الفعلي</span><span><i style="background:var(--conc)"></i>المخطط</span><span><i style="background:var(--bad)"></i>متأخر</span><span><i style="background:var(--mut);height:3px"></i>خط الأساس</span><span><i style="background:var(--acc);width:2px"></i>النهارده</span></div>`;
  const wrap = $('#gantt .gwrap'); if (!S.sc.scrolled) { wrap.scrollLeft = -(X(now) - wrap.clientWidth / 2); }
  $('#gantt').onclick = e => { const tg = e.target.closest('[data-tg]'); if (tg) { F.closed.has(tg.dataset.tg) ? F.closed.delete(tg.dataset.tg) : F.closed.add(tg.dataset.tg); return drawGantt(); }
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); editActivity(P.sch.byId[o.dataset.open]); } };
}

/* activity editor / details */
function editActivity(x) {
  const P = S.P, ed = can('editBoq', P.id), { A, links, items } = P.sch, sumOpts = A.filter(y => (y.kids.length || y.is_summary) && (!x || y.id !== x.id));
  const preds = x ? links.filter(l => l.succ_id === x.id) : [], sel = new Set(x ? items[x.id] || [] : []), bs = P.proj.buildings || [];
  const dlg = document.createElement('dialog'); dlg.className = 'adlg';
  const ro = !ed;
  dlg.innerHTML = `<form method="dialog" id="aF"><div class="dh"><h3 style="margin:0">${x ? esc(x.name) : 'نشاط جديد'}</h3><button value="x" type="button" class="dx">✕</button></div>
  ${x ? `<div class="mut">${x.wbs ? 'WBS ' + esc(x.wbs) + ' · ' : ''}مخطط ${Math.round(x.plan * 100)}% · فعلي ${x.act == null ? '–' : Math.round(x.act * 100) + '%'}${x.pr.act_start ? ' · أول كمية ' + fmtD(x.pr.act_start) : ''}${x.pr.act_finish ? ' · خلص ' + fmtD(x.pr.act_finish) : ''}${x.bs ? ' · خط الأساس ' + fmtD(x.bl_start) + ' → ' + fmtD(x.bl_finish) : ''}</div>` : ''}
  <div class="grid" style="margin-top:10px"><label class="wide">اسم النشاط<input name="name" required value="${esc(x?.name || '')}" ${ro ? 'disabled' : ''}></label>
  <label>تحت (نشاط رئيسي)<select name="parent" ${ro ? 'disabled' : ''}><option value="">— مستوى أول —</option>${sumOpts.map(y => `<option value="${y.id}"${x?.parent_id === y.id ? ' selected' : ''}>${esc((y.wbs ? y.wbs + ' ' : '') + y.name)}</option>`).join('')}</select></label>
  <label>البداية<input type="date" name="start" value="${x?.start || today()}" ${ro || x?.kids.length ? 'disabled' : ''}></label>
  <label>المدة (أيام عمل)<input type="number" name="dur" min="0" step="1" value="${x ? x.dur : 5}" ${ro || x?.kids.length ? 'disabled' : ''}></label>
  <label>النهاية<input type="date" name="finish" value="${x?.finish || ''}" disabled></label>
  ${bs.length > 1 ? `<label>المبنى<select name="building" ${ro ? 'disabled' : ''}><option value="">—</option>${bs.map(b => `<option${x?.building === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>` : ''}
  <label>نسبة يدوية %<input type="number" name="manual" min="0" max="100" step="any" value="${x?.manual_pct ?? ''}" placeholder="من البنود" ${ro ? 'disabled' : ''}></label>
  <label class="chk" style="align-self:end"><input type="checkbox" name="ms"${x?.is_milestone ? ' checked' : ''} ${ro ? 'disabled' : ''}> حدث (Milestone)</label></div>
  ${x?.kids.length ? '<p class="mut">ده نشاط رئيسي: تواريخه ونسبته بتتحسب من الأنشطة اللي تحته.</p>' : `
  <h4>الأنشطة السابقة</h4><div id="pL">${preds.map(l => predRow(l, x)).join('')}</div>${ed ? '<button type="button" id="pAdd">+ نشاط سابق</button>' : ''}
  ${ed ? `<h4>بنود المقايسة المربوطة <span class="mut" id="iN">(${sel.size})</span></h4><p class="mut" style="margin-top:-6px">نسبة النشاط بتتحسب من الكميات المعتمدة للبنود دي.</p><input type="search" id="iQ" placeholder="بحث بالكود أو الاسم"><div class="ilist" id="iL"></div>` : `<p class="mut">${x?.pr.items || 0} بند مربوط بالنشاط.</p>`}`}
  <div class="acts">${ed ? `<button class="p" value="save" type="submit">حفظ</button>${x ? '<button type="button" id="aDel" class="danger">حذف النشاط</button>' : ''}` : ''}<button type="button" class="dx">إغلاق</button></div></form>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); }; dlg.querySelectorAll('.dx').forEach(b => b.onclick = close); dlg.addEventListener('cancel', () => dlg.remove());
  const f = dlg.querySelector('form'), fin = () => { const s = f.start.value, d = +f.dur.value || 0; f.finish.value = s ? DS(f.ms.checked || d <= 1 ? addWork(TD(s), 0) : addWork(TD(s), d - 1)) : ''; };
  if (!x?.kids.length) { if (!x?.finish) fin(); f.start.oninput = fin; f.dur.oninput = fin; f.ms.onchange = () => { if (f.ms.checked) f.dur.value = 0; fin(); }; }
  if (!ed) return;
  const pA = dlg.querySelector('#pAdd'); if (pA) pA.onclick = () => dlg.querySelector('#pL').insertAdjacentHTML('beforeend', predRow({ type: 'FS', lag_days: 0 }, x));
  dlg.querySelector('#pL')?.addEventListener('click', e => { const b = e.target.closest('.prx'); if (b) b.closest('.prow').remove(); });
  const iL = dlg.querySelector('#iL'); if (iL) { const draw = () => { const q = dlg.querySelector('#iQ').value.trim(), L = P.items.filter(i => sel.has(i.id) || (q && (i.code + ' ' + i.name + ' ' + (i.building || '')).includes(q))).slice(0, 80);
    iL.innerHTML = L.length ? L.map(i => `<label class="chk"><input type="checkbox" value="${esc(i.id)}"${sel.has(i.id) ? ' checked' : ''}> <span><b>${esc(i.code)}</b> ${esc(i.name)}${i.building ? ' – ' + esc(i.building) : ''} <span class="mut">(${esc(i.unit || '')})</span></span></label>`).join('') : '<p class="mut">اكتب في البحث عشان تختار بنود.</p>'; };
    draw(); dlg.querySelector('#iQ').oninput = draw; iL.onchange = e => { const c = e.target; c.checked ? sel.add(c.value) : sel.delete(c.value); dlg.querySelector('#iN').textContent = `(${sel.size})`; }; }
  const del = dlg.querySelector('#aDel'); if (del) del.onclick = async () => { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'متأكد؟ اضغط تاني للحذف'; return; }
    const { error } = await S.sb.from('schedule_activities').delete().eq('id', x.id); if (error) return toast('مقدرتش أحذف: ' + error.message); close(); toast('اتحذف النشاط'); renderSchedule(); };
  f.onsubmit = async e => { e.preventDefault(); const btn = f.querySelector('button.p'); btn.disabled = true;
    const id = x?.id || crypto.randomUUID(), par = f.parent.value || null, pa = par && P.sch.byId[par];
    const row = { id, project_id: P.id, name: f.name.value.trim(), parent_id: par, outline_level: pa ? pa.outline_level + 1 : 1, is_milestone: f.ms.checked, manual_pct: f.manual.value === '' ? null : +f.manual.value, building: f.building ? f.building.value || null : x?.building ?? null, updated_at: new Date().toISOString() };
    if (!x?.kids.length) Object.assign(row, { start: f.start.value || null, finish: f.finish.value || null, duration_days: f.ms.checked ? 0 : +f.dur.value || 0 });
    if (!x) row.sort = Math.max(0, ...A.map(y => y.sort)) + 1;
    let { error } = await S.sb.from('schedule_activities').upsert(row); if (error) { btn.disabled = false; return toast('مقدرتش أحفظ: ' + error.message); }
    if (pa && !pa.is_summary) await S.sb.from('schedule_activities').update({ is_summary: true }).eq('id', pa.id);
    if (!x?.kids.length) {
      const P2 = [...dlg.querySelectorAll('.prow')].map(r => ({ project_id: P.id, pred_id: r.querySelector('[data-p]').value, succ_id: id, type: r.querySelector('[data-t]').value, lag_days: +r.querySelector('[data-l]').value || 0 })).filter(l => l.pred_id && l.pred_id !== id);
      const uniq = Object.values(Object.fromEntries(P2.map(l => [l.pred_id, l])));
      if (x) await S.sb.from('schedule_links').delete().eq('succ_id', id); if (uniq.length) ({ error } = await S.sb.from('schedule_links').insert(uniq));
      if (error) toast('النشاط اتحفظ بس فيه مشكلة في السوابق: ' + error.message);
      if (x) await S.sb.from('schedule_activity_items').delete().eq('activity_id', id); if (sel.size) ({ error } = await S.sb.from('schedule_activity_items').insert([...sel].map(item_id => ({ activity_id: id, item_id }))));
      if (error) toast('النشاط اتحفظ بس فيه مشكلة في ربط البنود: ' + error.message);
    }
    close(); toast('اتحفظ النشاط'); renderSchedule(); };
}
function predRow(l, x) {
  const A = S.P.sch.A.filter(y => !y.kids.length && (!x || y.id !== x.id)), ro = !can('editBoq', S.P.id);
  return `<div class="prow"><select data-p ${ro ? 'disabled' : ''}><option value="">— اختار —</option>${A.map(y => `<option value="${y.id}"${l.pred_id === y.id ? ' selected' : ''}>${esc((y.wbs ? y.wbs + ' ' : '') + y.name)}</option>`).join('')}</select><select data-t ${ro ? 'disabled' : ''}>${[['FS', 'نهاية ← بداية'], ['SS', 'بداية ← بداية'], ['FF', 'نهاية ← نهاية'], ['SF', 'بداية ← نهاية']].map(([v, t]) => `<option value="${v}"${l.type === v ? ' selected' : ''}>${t}</option>`).join('')}</select><input data-l type="number" step="1" value="${+l.lag_days || 0}" title="تأخير بالأيام" ${ro ? 'disabled' : ''}>${ro ? '' : '<button type="button" class="prx">✕</button>'}</div>`;
}

/* CPM forward pass on working days, then roll summaries up */
async function recalcSchedule() {
  const P = S.P, { A, links, byId } = P.sch, leaves = A.filter(x => !x.kids.length), inN = {}, out = {};
  links.forEach(l => { inN[l.succ_id] = (inN[l.succ_id] || 0) + 1; (out[l.pred_id] ||= []).push(l); });
  const q = leaves.filter(x => !inN[x.id]), done = new Set(), ns = {}, nf = {};
  leaves.forEach(x => { ns[x.id] = x.s; nf[x.id] = x.f; });
  const pending = Object.fromEntries(leaves.map(x => [x.id, links.filter(l => l.succ_id === x.id)]));
  while (q.length) { const x = q.shift(); done.add(x.id); const P1 = pending[x.id], d = x.is_milestone ? 0 : Math.max(x.dur, 1);
    if (P1.length && P1.every(l => byId[l.pred_id])) { let st = null; P1.forEach(l => { const ps = ns[l.pred_id], pf = nf[l.pred_id], lag = +l.lag_days || 0; if (ps == null) return;
        let c = l.type === 'FS' ? addWork(pf, 1 + lag) : l.type === 'SS' ? addWork(ps, lag) : l.type === 'FF' ? addWork(addWork(pf, lag), -(d ? d - 1 : 0)) : addWork(addWork(ps, lag), -(d ? d - 1 : 0));
        if (byId[l.pred_id].is_milestone && l.type === 'FS') c = addWork(pf, lag); st = st == null ? c : Math.max(st, c); });
      if (st != null) { ns[x.id] = st; nf[x.id] = d ? addWork(st, d - 1) : st; } }
    else if (ns[x.id] != null && x.dur != null) nf[x.id] = d ? addWork(ns[x.id], d - 1) : ns[x.id];
    (out[x.id] || []).forEach(l => { if (--inN[l.succ_id] === 0 && byId[l.succ_id] && !byId[l.succ_id].kids.length) q.push(byId[l.succ_id]); }); }
  if (done.size < leaves.length) return toast('فيه حلقة في العلاقات بين الأنشطة، راجع السوابق');
  const ss = {}, sf = {}, roll = x => { if (!x.kids.length) return [ns[x.id], nf[x.id]]; const r = x.kids.map(roll).filter(v => v[0] != null); ss[x.id] = r.length ? Math.min(...r.map(v => v[0])) : x.s; sf[x.id] = r.length ? Math.max(...r.map(v => v[1])) : x.f; return [ss[x.id], sf[x.id]]; };
  A.filter(x => !x.parent_id).forEach(roll);
  const ch = A.map(x => { const s1 = x.kids.length ? ss[x.id] : ns[x.id], f1 = x.kids.length ? sf[x.id] : nf[x.id]; return s1 !== x.s || f1 !== x.f ? { x, start: DS(s1), finish: DS(f1) } : null; }).filter(Boolean);
  if (!ch.length) return toast('التواريخ مظبوطة، مفيش تغيير');
  const res = await Promise.all(ch.map(c => S.sb.from('schedule_activities').update({ start: c.start, finish: c.finish, ...(c.x.kids.length ? { duration_days: workDays(TD(c.start), TD(c.finish)) } : {}) }).eq('id', c.x.id)));
  const err = res.find(r => r.error); toast(err ? 'حصلت مشكلة: ' + err.error.message : `اتعدّلت تواريخ ${ch.length} نشاط`); renderSchedule();
}
async function saveBaseline() {
  const b = $('#scBase'); if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟ هيستبدل خط الأساس القديم'; return; }
  const { A } = S.P.sch, res = await Promise.all(A.map(x => S.sb.from('schedule_activities').update({ bl_start: x.start, bl_finish: x.finish }).eq('id', x.id)));
  const err = res.find(r => r.error); toast(err ? 'حصلت مشكلة: ' + err.error.message : 'اتحفظ خط الأساس'); renderSchedule();
}

/* MS Project XML import */
async function importMsp(file) {
  const P = S.P, doc = new DOMParser().parseFromString(await file.text(), 'application/xml'), box = $('#scImpBox');
  if (doc.querySelector('parsererror') || !doc.getElementsByTagName('Task').length) return box.innerHTML = '<div class="note">الملف ده مش ملف MS Project XML. من MS Project اختار File ← Save As ← XML Format.</div>';
  const kid = (el, n) => { for (const c of el.children) if (c.localName === n) return c.textContent; return null; };
  const hrs = d => { const m = /PT(\d+(?:\.\d+)?)H(\d+)M/.exec(d || ''); return m ? +m[1] + +m[2] / 60 : 0; };
  const T = [...doc.getElementsByTagName('Task')].filter(t => kid(t, 'UID') !== '0' && kid(t, 'IsNull') !== '1' && kid(t, 'Name'));
  const old = Object.fromEntries(P.sch.A.filter(x => x.ext_uid).map(x => [x.ext_uid, x.id]));
  const stack = [], rows = [], ln = [], ids = {}; let usePct = 0;
  T.forEach((t, k) => { const uid = kid(t, 'UID'), lvl = +kid(t, 'OutlineLevel') || 1, id = old[uid] || crypto.randomUUID(); ids[uid] = id;
    while (stack.length && stack[stack.length - 1].lvl >= lvl) stack.pop(); const par = stack[stack.length - 1];
    let bs = null, bf = null; for (const b of t.children) if (b.localName === 'Baseline' && kid(b, 'Number') === '0') { bs = (kid(b, 'Start') || '').slice(0, 10) || null; bf = (kid(b, 'Finish') || '').slice(0, 10) || null; }
    const pc = +kid(t, 'PercentComplete') || 0; if (pc) usePct++;
    rows.push({ id, project_id: P.id, ext_uid: uid, wbs: kid(t, 'WBS') || kid(t, 'OutlineNumber'), outline_level: lvl, parent_id: par ? par.id : null, name: kid(t, 'Name').trim(), is_summary: kid(t, 'Summary') === '1', is_milestone: kid(t, 'Milestone') === '1',
      start: (kid(t, 'Start') || '').slice(0, 10) || null, finish: (kid(t, 'Finish') || '').slice(0, 10) || null, duration_days: Math.round(hrs(kid(t, 'Duration')) / 8 * 10) / 10, bl_start: bs, bl_finish: bf, sort: k + 1, updated_at: new Date().toISOString(), _pc: pc });
    stack.push({ lvl, id });
    for (const l of t.children) if (l.localName === 'PredecessorLink') ln.push({ pu: kid(l, 'PredecessorUID'), su: uid, type: ['FF', 'FS', 'SF', 'SS'][+kid(l, 'Type')] || 'FS', lag: Math.round((+kid(l, 'LinkLag') || 0) / 4800 * 10) / 10 }); });
  const gone = P.sch.A.filter(x => x.ext_uid && !rows.some(r => r.ext_uid === x.ext_uid)), fresh = rows.filter(r => !old[r.ext_uid]).length;
  box.innerHTML = `<div class="card"><b>${esc(file.name)}</b>: ${rows.length} نشاط و${ln.length} علاقة. <span class="mut">(${fresh} جديد · ${rows.length - fresh} تحديث${gone.length ? ` · ${gone.length} هيتشال لأنه مش في الملف` : ''})</span>
  ${usePct ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="impPct"> استخدم نسب الإنجاز اللي في الملف للأنشطة اللي مش مربوطة ببنود (${usePct} نشاط)</label>` : ''}
  <label class="chk"><input type="checkbox" id="impBl"${P.sch.A.some(x => x.bs) ? '' : ' checked'}> احفظ تواريخ الملف كخط أساس للأنشطة اللي ملهاش خط أساس في الملف</label>
  <div class="acts"><button class="ok" id="impGo2">استيراد</button><button id="impNo2">إلغاء</button></div></div>`;
  $('#impNo2').onclick = () => box.innerHTML = '';
  $('#impGo2').onclick = async () => { $('#impGo2').disabled = true; const pct = $('#impPct')?.checked, bl = $('#impBl').checked, items = P.sch.items;
    const up = rows.map(({ _pc, ...r }) => ({ ...r, ...(bl && !r.bl_start ? { bl_start: r.start, bl_finish: r.finish } : {}), ...(pct && _pc && !(items[r.id] || []).length ? { manual_pct: _pc } : {}) }));
    let { error } = await S.sb.from('schedule_activities').upsert(up, { onConflict: 'id' });
    if (!error && gone.length) ({ error } = await S.sb.from('schedule_activities').delete().in('id', gone.map(x => x.id)));
    if (!error) ({ error } = await S.sb.from('schedule_links').delete().eq('project_id', P.id));
    const L2 = Object.values(Object.fromEntries(ln.filter(l => ids[l.pu] && ids[l.su]).map(l => [l.pu + l.su, { project_id: P.id, pred_id: ids[l.pu], succ_id: ids[l.su], type: l.type, lag_days: l.lag }])));
    if (!error && L2.length) ({ error } = await S.sb.from('schedule_links').insert(L2));
    if (error) { $('#impGo2').disabled = false; return toast('الاستيراد وقف: ' + error.message); }
    toast(`اتستورد ${rows.length} نشاط`); renderSchedule(); };
}
function exportSchedule() {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const P = S.P, rows = [['WBS', 'النشاط', 'البداية', 'النهاية', 'المدة (أيام عمل)', 'بداية خط الأساس', 'نهاية خط الأساس', 'المخطط %', 'الفعلي %', 'الحالة', 'المبنى'], ...P.sch.A.map(x => [x.wbs || '', '  '.repeat(x.outline_level - 1) + x.name, x.start, x.finish, x.dur, x.bl_start, x.bl_finish, Math.round(x.plan * 100), x.act == null ? '' : Math.round(x.act * 100), x.kids.length ? '' : SST[x.st][1], x.building || ''])];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'الجدول الزمني'); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, 'جدول زمني ' + P.proj.name + ' ' + today() + '.xlsx');
}

/* ---------------- excel ---------------- */
function exportXlsx() {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const X = XLSX, P = S.P, p = P.proj, wb = X.utils.book_new(), list = P.phaseProg;
  const head = [[p.name + ' – ' + p.place], ['المالك: ' + p.owner_name + ' · المقاول العام: ' + p.contractor_name + ' · الاستشاري: ' + p.consultant_name], ['بيان الموقف التنفيذي حتى ' + today() + ' – الإنجاز الكلي ' + Math.round(overall(list) * 1000) / 10 + '%'], []];
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([...head, ['م', 'المرحلة', 'الوزن', 'عدد البنود', 'نسبة الإنجاز'], ...list.map(x => [x.n, x.name, +(+x.weight).toFixed(4), x.items, +(+x.pct).toFixed(4)])]), 'المراحل');
  const cols = ['المرحلة', 'المجموعة', 'كود البند', 'بيان الأعمال', 'المبنى', 'الوحدة', 'الكمية', ...(P.showRates ? ['سعر الوحدة'] : []), 'المنفذ', 'المتبقي', 'النسبة', 'حالة الكمية'];
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([...head, cols, ...P.items.map(r => [r.phase_n, r.group_name, r.code, r.name, r.building, r.unit, +r.qty || '', ...(P.showRates ? [r.rate || ''] : []), +r.ex.toFixed(3), +r.qty > 0 ? +r.rem.toFixed(3) : '', r.known ? +r.pct.toFixed(4) : '', r.qty_status || ''])]), 'موقف تنفيذي');
  if (P.reports.length) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['التاريخ', 'الحالة', 'المبنى', 'التخصص', 'الأعمال', '%'], ...P.reports.flatMap(r => (r.body.acts || []).map(a => [r.report_date, r.imported ? 'مُرحّل' : ST[r.status][1], a.building, a.discipline, a.work, a.progress]))]), 'المتابعة اليومية');
  wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, 'موقف تنفيذي ' + p.name + ' ' + today() + '.xlsx');
}

addEventListener('beforeunload', e => { if (S.bq?.pend?.size) { e.preventDefault(); e.returnValue = ''; } });
boot();
