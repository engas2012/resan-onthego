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
  docs: ['site', 'tech', 'finance', 'management'],
  tasks: ['tech', 'finance', 'management', 'consultant'],
  docsUp: ['site', 'tech', 'management'],
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
  <button class="p" type="submit">دخول</button><button type="button" id="forgot">نسيت الباسورد</button><p class="mut" style="margin:0;font-size:12px;text-align:center">إصدار 2.3.0</p></form>`;
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
const VIEWS = [['status', 'الموقف التنفيذي', null], ['schedule', 'الجدول الزمني', null], ['tasks', 'مهام المكتب الفني', 'tasks'], ['boq', 'المقايسة والتكلفة', 'boq'], ['report', 'تقرير يومي', 'report'], ['review', 'مراجعة المكتب الفني', 'review'], ['log', 'سجل التقارير', 'log'], ['docs', 'المستندات', 'docs']];
function shell(pid, view) {
  const p = pid && S.projects.find(x => x.id === pid);
  return `<header><div class="hbar"><a class="brandlink" href="#home" title="الصفحة الرئيسية">${LOGO()}<span class="otg">On the go</span></a>
  <div class="who2"><a class="homeb${!p && view !== 'admin' && view !== 'staff' ? ' on' : ''}" href="#home"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>الرئيسية</a>${p ? `<span class="roleTag">${ROLE[role(pid)] || ''}</span>` : ''}<span class="uname">${esc(S.profile.full_name || S.profile.email)}</span>${S.admin ? '<a href="#staff" class="adm">فريق العمل</a><a href="#admin" class="adm">المستخدمين</a>' : ''}<button id="out">خروج</button></div></div>
  ${p ? `<div class="ptitle"><h1>${esc(p.name + ' – ' + p.place)}</h1><p>المالك: ${esc(p.owner_name)} · المقاول العام: ${esc(p.contractor_name)} · الاستشاري: ${esc(p.consultant_name)}</p></div>` : '<div class="ptitle"><h1>متابعة مشروعات الغردقة</h1></div>'}
  <nav>${p ? VIEWS.filter(v => !v[2] || can(v[2], pid)).map(([v, l]) => `<a href="#p/${pid}/${v}" class="${v === view ? 'on' : ''}">${l}${v === 'review' ? ' <span class="badge" id="pendN" hidden></span>' : ''}${v === 'tasks' ? ' <span class="badge" id="taskN" hidden></span>' : ''}</a>`).join('') : ''}</nav></header><main id="main"><p class="mut">جاري التحميل…</p></main>`;
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
    if (view === 'docs' && can('docs', pid)) return renderDocs();
    if (view === 'tasks' && can('tasks', pid)) return renderTasks();
    return renderStatus();
  }
  $('#app').innerHTML = shell(null, h); bindOut();
  if (h === 'admin' && S.admin) return renderAdmin();
  if (h === 'staff' && S.admin) return renderStaff();
  renderHome();
}
const bindOut = () => { $('#out').onclick = () => S.sb.auth.signOut(); };

/* ---------------- data ---------------- */
async function loadProject(pid) {
  const P = S.P, wantItems = can('items', pid), wantReports = can('log', pid);
  const jobs = [S.sb.rpc('phase_progress', { p_project: pid }), S.sb.from('phases').select('*').eq('project_id', pid).order('n')];
  jobs.push(wantItems ? S.sb.from('boq_progress').select('*').eq('project_id', pid).order('sort') : Promise.resolve({ data: [] }));
  jobs.push(wantItems ? S.sb.from('boq_rates').select('item_id,rate,contract_amount') : Promise.resolve({ data: [] }));
  jobs.push(wantReports ? S.sb.from('daily_reports').select('*').eq('project_id', pid).order('report_date', { ascending: false }).limit(400) : Promise.resolve({ data: [] }));
  const [pp, ph, it, rt, rp] = await Promise.all(jobs);
  P.phaseProg = pp.data || []; P.phases = ph.data || [];
  const rates = Object.fromEntries((rt.data || []).map(r => [r.item_id, +r.rate])), camts = Object.fromEntries((rt.data || []).map(r => [r.item_id, +r.contract_amount || 0]));
  P.showRates = ['tech', 'finance', 'management'].includes(role(pid));
  P.items = (it.data || []).map(i => { const q = +i.qty || 0, ex = +i.executed || 0, rate = rates[i.id] || 0; const pct = q > 0 ? ex / q : (i.pct_override != null ? +i.pct_override : 0); const camt = camts[i.id] || 0; return { ...i, ex, rate, camt, crate: q > 0 ? camt / q : camt, pct: Math.max(0, pct), rem: q - ex, val: q * rate, w: camt > 0 ? camt : q * rate, known: q > 0 || i.pct_override != null }; });
  P.reports = rp.data || [];
  P.docs = can('docs', pid) ? ((await S.sb.from('documents').select('*').eq('project_id', pid).order('doc_date', { ascending: false }).order('created_at', { ascending: false })).data || []) : [];
  P.proj = S.projects.find(x => x.id === pid);
  const ids = [...new Set([...P.reports.flatMap(r => [r.created_by, r.reviewed_by]), ...P.docs.map(d => d.uploaded_by)].filter(x => x && !(x in S.names)))];
  if (ids.length) { const { data } = await S.sb.from('profiles').select('id,full_name,email').in('id', ids); (data || []).forEach(u => S.names[u.id] = u.full_name || u.email); }
  const pend = P.reports.filter(r => r.status === 'submitted').length, b = $('#pendN'); if (b) { b.hidden = !pend; b.textContent = pend; }
  P.check = can('tasks', pid) ? ((await S.sb.from('phase_checklist').select('*').eq('project_id', pid).order('phase_n').order('sort').order('created_at')).data || []) : [];
  const open = can('tasks', pid) ? P.items.filter(lacks).length + P.check.filter(c => c.status !== 'approved').length : 0, tb = $('#taskN'); if (tb) { tb.hidden = !open; tb.textContent = open > 999 ? '999+' : open; }
}
const overall = list => { const W = list.reduce((s, x) => s + (+x.weight || 0), 0); return W ? list.reduce((s, x) => s + (+x.pct || 0) * (+x.weight || 0), 0) / W : 0; };
const groupPct = rows => { const v = rows.filter(r => r.w > 0), avg = v.length ? v.reduce((s, r) => s + r.w, 0) / v.length : 1; let a = 0, b = 0; rows.forEach(r => { const w = r.w > 0 ? r.w : avg; a += w * Math.min(r.pct, 1); b += w; }); return b ? a / b : 0; };

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
  const actHtml = acts.map(a => { const has = a.progress != null && a.progress !== '', pr = Math.max(0, Math.min(+a.progress || 0, 100)), d = has ? pr - (pm[key(a)] ?? pr) : 0;
    return `<li><div class="lt">${a.building ? `<span class="chip">${esc(a.building)}</span>` : ''}<span class="lw">${esc(a.work)}</span>${d > 0 ? `<span class="up">+${d}%</span>` : ''}</div>${has ? `<div class="lbar${pr >= 100 ? ' done' : ''}"><u style="--w:${pr}%"></u></div><em>${pr}%</em>` : '<div class="lbar ind"><u></u></div><em class="mut">جاري</em>'}</li>`; }).join('');
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
    return `<details class="ph" data-k="${ko}"${isOpen ? ' open' : ''}><summary><span class="num">${x.n}</span><div><div class="phn">${esc(x.name)}</div><div class="phm">${x.items} بند · وزن ${Math.round(x.weight * 1000) / 10}%${x.missing ? ` · <span class="tag">${x.missing} ناقص مستند</span>` : ''}${x.manual ? ' · <span class="tag">نسبة يدوية</span>' : ''}${can('tasks', pid) ? ' ' + readyChips(x.n, true) : ''}</div></div>${bar(x.pct)}</summary><div class="phb">
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
  labor: { box: '#lRows', f: [['building', 'المبنى', 'bld'], ['trade', 'التخصص', 'text'], ['count', 'العدد', 'num'], ['hours', 'ساعات', 'num', 8], ['contractor', 'المقاول', 'text'], ['work', 'البيان (بيشتغلوا في إيه)', 'text', null, 1]] },
  equip: { box: '#eRows', f: [['building', 'المبنى', 'bld'], ['name', 'المعدة', 'text'], ['count', 'العدد', 'num', 1], ['hours', 'ساعات', 'num', 8], ['work', 'البيان', 'text', null, 1]] },
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
  <form id="rf"><div class="card grid"><label>التاريخ<input type="date" id="fDate" value="${r ? r.report_date : today()}" required></label><label>موعد الوصول<input type="time" id="fArr"></label><label>حالة الطقس<select id="fSky"><option value="">—</option><option value="sunny">مشمس</option><option value="cloudy">غائم</option><option value="windy">رياح</option><option value="rain">ممطر</option></select></label><label>درجة الحرارة<input type="number" id="fTemp" inputmode="numeric" placeholder="°م"></label></div>
  <h3>الطاقم الفني للمقاول بالموقع</h3><div class="card staffgrid">${STAFF_POS.map(([k, l]) => `<label>${l}<input type="number" min="0" inputmode="numeric" data-sp="${k}"></label>`).join('')}</div>
  <h3>الأعمال اللي اتنفذت</h3><div class="rows" id="aRows"></div><button type="button" data-add="act">+ إضافة نشاط</button>
  <div class="card grid" style="margin-top:14px"><label>المعوقات<textarea id="fObs"></textarea></label><label>الإجراء المتخذ<textarea id="fAct"></textarea></label><label>ملاحظات<textarea id="fNotes"></textarea></label><label>التوصيات (الاستشاري)<textarea id="fRec"></textarea></label></div>
  <h3>الكميات المنفذة على بنود المقايسة</h3><div class="rows" id="qRows"></div><button type="button" data-add="qty">+ إضافة كمية</button>
  <h3>صبات الخرسانة</h3><p class="mut" style="margin-top:-6px">لو ربطت الصبة ببند، المكعب بيتحسب عليه. ماتكتبهوش تاني في الكميات.</p><div class="rows" id="pRows"></div><button type="button" data-add="pour">+ إضافة صبة</button>
  <h3>العمالة</h3><div class="rows" id="lRows"></div><button type="button" data-add="labor">+ إضافة عمالة</button>
  <h3>المعدات</h3><div class="rows" id="eRows"></div><button type="button" data-add="equip">+ إضافة معدة</button>
  <h3>التوريدات</h3><div class="rows" id="sRows"></div><button type="button" data-add="supply">+ إضافة توريد</button>
  <h3>المرفقات</h3><p class="mut" style="margin-top:-6px">ملفات Excel أو PDF أو صور (لحد 25 ميجا للملف). بتترفع مع إرسال التقرير.</p><input type="file" id="fFiles" accept="${DOC_ACCEPT}" multiple>
  <div class="acts"><button class="p" type="submit" id="fSave">إرسال للمكتب الفني</button><button type="button" id="fNew">تقرير جديد</button>${r ? `<button type="button" data-print="${r.id}">🖨 طباعة نموذج الاستشاري</button>` : ''}</div></form>`;
  fill(r);
  $('#main').onclick = e => { const a = e.target.closest('[data-add]'); if (a) addRow(a.dataset.add); const x = e.target.closest('.row .x'); if (x) x.closest('.row').remove(); };
  $('#qRows').addEventListener('change', e => { const row = e.target.closest('.row'); if (row) hint(row); });
  $('#fDate').onchange = () => fill(P.reports.find(x => x.report_date === $('#fDate').value), true);
  $('#fNew').onclick = () => { $('#fDate').value = today(); fill(null); };
  $('#rf').onsubmit = submitReport;
}
function fill(r, keepDate) {
  const b = r?.body || {}; $('#fObs').value = b.obstacles || ''; $('#fAct').value = b.action || ''; $('#fNotes').value = b.notes || ''; $('#fRec').value = b.recommend || '';
  $('#fArr').value = b.arrival || ''; $('#fSky').value = b.weather?.sky || ''; $('#fTemp').value = b.weather?.temp ?? ''; document.querySelectorAll('[data-sp]').forEach(i => i.value = b.staff?.[i.dataset.sp] ?? '');
  Object.keys(ROW).forEach(k => { $(ROW[k].box).innerHTML = ''; (k === 'act' ? (b.acts || []) : (b[{ qty: 'qty', pour: 'pours', labor: 'labor', equip: 'equip', supply: 'supply' }[k]] || [])).forEach(v => addRow(k, v)); });
  if (!r) { addRow('act'); addRow('qty'); }
  const n = $('#fState'); if (!r) { n.hidden = true; return; } n.hidden = false;
  n.textContent = r.imported ? 'اليوم ده متسجل من الإكسل القديم. لو بعته هيروح للمراجعة كتقرير جديد.' : r.status === 'approved' ? 'التقرير ده معتمد. أي تعديل هيرجّعه للمراجعة، والكميات المعتمدة تفضل لحد ما يتعتمد تاني.' : r.status === 'returned' ? 'راجع من المكتب الفني: ' + (r.review_comment || '') : 'التقرير ده بانتظار المراجعة، واللي هتبعته هيحل محله.';
}
async function submitReport(e) {
  e.preventDefault(); const P = S.P, d = $('#fDate').value, A = collect('act').filter(a => a.work); if (!A.length) return toast('اكتب الأعمال اللي اتنفذت');
  const Q = collect('qty'); if (Q.some(q => q.qty && !q.item)) return toast('فيه كمية من غير بند');
  const staff = Object.fromEntries([...document.querySelectorAll('[data-sp]')].filter(i => i.value !== '').map(i => [i.dataset.sp, +i.value]));
  const body = { acts: A, obstacles: $('#fObs').value.trim(), action: $('#fAct').value.trim(), notes: $('#fNotes').value.trim(), recommend: $('#fRec').value.trim(), arrival: $('#fArr').value || null, weather: { sky: $('#fSky').value || null, temp: $('#fTemp').value === '' ? null : +$('#fTemp').value }, staff, qty: Q.filter(q => q.item && q.qty), pours: collect('pour'), labor: collect('labor'), equip: collect('equip'), supply: collect('supply') };
  const ex = P.reports.find(x => x.report_date === d); $('#fSave').disabled = true;
  const { error } = ex ? await S.sb.from('daily_reports').update({ body }).eq('id', ex.id) : await S.sb.from('daily_reports').insert({ project_id: P.id, report_date: d, body });
  $('#fSave').disabled = false; if (error) return toast('مقدرتش أبعت: ' + error.message);
  const files = [...($('#fFiles')?.files || [])];
  if (files.length) { await loadProject(P.id); const rr = P.reports.find(x => x.report_date === d); if (rr) await uploadDocs(files, { kind: 'report', report_id: rr.id, doc_date: d }); }
  toast('التقرير اتبعت للمكتب الفني'); await loadProject(P.id); renderReport(P.reports.find(x => x.report_date === d));
}

/* ---------------- review ---------------- */
const itemName = id => { const i = S.P.items.find(x => x.id === id); return i ? i.code + ' ' + i.name + ((S.P.proj.buildings || []).length > 1 ? ' – ' + i.building : '') : id; };
const mini = (rows, cols) => rows && rows.length ? `<div class="scroll"><table><thead><tr>${cols.map(c => `<th${c[2] ? ' class="n"' : ''}>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td${c[2] ? ' class="n"' : ''}>${c[3] ? esc(itemName(r[c[0]])) : c[2] ? nf(r[c[0]]) : esc(r[c[0]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
function details(r, withQty = true) {
  const b = r.body || {}, A = b.acts || [], att = (S.P?.docs || []).filter(d => d.report_id === r.id);
  return `${b.arrival ? `<p style="margin:0 0 6px"><b>موعد الوصول:</b> ${esc(b.arrival)}</p>` : ''}<b>الأعمال</b>${mini(A.map(a => ({ ...a, progress: a.progress ?? '' })), [...(A.some(a => a.building) ? [['building', 'المبنى']] : []), ['discipline', 'التخصص'], ['work', 'الأعمال'], ['progress', '%']])}
  ${b.obstacles ? `<p><b>المعوقات:</b> ${esc(b.obstacles)}</p>` : ''}${b.action ? `<p><b>الإجراء:</b> ${esc(b.action)}</p>` : ''}${b.notes ? `<p><b>ملاحظات:</b> ${esc(b.notes)}</p>` : ''}
  ${withQty && b.qty?.length ? '<b>الكميات</b>' + mini(b.qty, [['item', 'البند', 0, 1], ['qty', 'الكمية', 1]]) : ''}${b.pours?.length ? '<b>صبات الخرسانة</b>' + mini(b.pours, [['element', 'العنصر'], ['vol', 'م3', 1], ['supplier', 'المحطة']]) : ''}
  ${b.labor?.length ? `<b>العمالة (${b.labor.reduce((s, l) => s + (+l.count || 0), 0)} فرد)</b>` + mini(b.labor, [['building', 'المبنى'], ['trade', 'التخصص'], ['count', 'العدد', 1], ['contractor', 'المقاول']]) : ''}
  ${b.equip?.length ? '<b>المعدات</b>' + mini(b.equip, [['name', 'المعدة'], ['count', 'العدد', 1], ['hours', 'ساعات', 1]]) : ''}${b.supply?.length ? '<b>التوريدات</b>' + mini(b.supply, [['item', 'الصنف'], ['unit', 'الوحدة'], ['req', 'المطلوب', 1], ['got', 'المورّد', 1], ['supplier', 'المورد']]) : ''}${att.length ? `<b>المرفقات</b><div class="dchips">${att.map(docChip).join('')}</div>` : ''}${b.wa ? `<details class="wa"><summary class="mut">رسالة الواتساب الأصلية · ${esc(b.wa.from || '')} · ${esc(b.wa.posted || '')}</summary><pre>${esc(b.wa.text || '')}</pre></details>` : ''}`;
}
function renderReview() {
  const P = S.P, L = P.reports.filter(r => r.status === 'submitted').sort((a, b) => a.report_date.localeCompare(b.report_date));
  $('#main').innerHTML = `<h2>مراجعة المكتب الفني</h2><p class="mut">تقدر تعدّل الكميات قبل الاعتماد، والموقف بيتحدّث أول ما تعتمد.</p>${L.length ? L.map(r => { const lines = [...(r.body.qty || []), ...(r.body.pours || []).filter(x => x.item).map(x => ({ item: x.item, qty: x.vol, pour: 1 }))];
    return `<div class="card" data-id="${r.id}"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${r.report_date}</b><span class="mut">${esc(S.names[r.created_by] || '')}</span></div>${details(r, false)}
    <div class="aibar"><button type="button" class="aib" data-ai="${r.id}">🔎 مراجعة تلقائية</button><span class="mut">بيقترح المبنى والبند لكل نشاط، ويطلّع الكميات المكتوبة، وينبّه على المشاكل. القرار في الآخر ليك.</span></div><div class="aibox" data-aibox="${r.id}"></div>
    <b>الكميات اللي هتتضاف للموقف</b><div class="scroll"><table><thead><tr><th>البند</th><th class="n">الكمية</th><th></th></tr></thead><tbody data-lines>${lines.map((q, k) => `<tr><td>${esc(itemName(q.item))}${q.pour ? ' <span class="mut">(صبة)</span>' : ''}</td><td class="n"><input type="number" step="any" data-k="${k}" data-item="${esc(q.item)}" value="${q.qty}" style="width:110px;min-height:36px"></td><td></td></tr>`).join('')}</tbody></table></div>${lines.length ? '' : '<p class="mut" data-nolines>مفيش كميات في التقرير.</p>'}
    <label style="margin-top:10px">تعليق للمهندس (مطلوب لو هترجّعه)<input data-c></label><div class="acts"><button class="ok" data-a="approve">اعتماد وتحديث الموقف</button><button data-a="return">إرجاع للمهندس</button></div></div>`; }).join('') : '<p class="mut">مفيش تقارير مستنية مراجعة.</p>'}`;
  $('#main').onclick = async e => {
    const ai = e.target.closest('[data-ai]'); if (ai) { showAi(ai.dataset.ai, localReview(S.P.reports.find(x => x.id === ai.dataset.ai))); ai.textContent = '🔎 مراجعة تاني'; return; }
    const add = e.target.closest('[data-aiadd]'); if (add) return addAiLine(add);
    const b = e.target.closest('button[data-a]'); if (!b) return; const c = b.closest('[data-id]'), id = c.dataset.id, comment = c.querySelector('[data-c]').value.trim(); b.disabled = true;
    const { error } = b.dataset.a === 'approve'
      ? await S.sb.rpc('approve_report', { p_report: id, p_lines: [...c.querySelectorAll('input[data-k]')].map(i => ({ item: i.dataset.item, qty: +i.value || 0 })), p_comment: comment || null })
      : await S.sb.rpc('return_report', { p_report: id, p_comment: comment });
    if (error) { b.disabled = false; return toast(error.message); }
    toast(b.dataset.a === 'approve' ? 'اتعتمد والموقف اتحدّث' : 'التقرير رجع للمهندس'); await loadProject(P.id); renderReview();
  };
}



/* ---------------- printable consultant daily-report form ---------------- */
const STAFF_POS = [['pm', 'مدير المشروع'], ['exec', 'مدير التنفيذ'], ['tech', 'مهندس مكتب فني'], ['elec', 'مهندس كهرباء'], ['acct', 'محاسب'], ['sup', 'مشرف'], ['store', 'أمين مخزن'], ['surv', 'مساح']];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function printReport(r) {
  const P = S.P, p = P.proj, b = r.body || {}, L = b.labor || [], E = b.equip || [], dt = new Date(r.report_date + 'T12:00:00Z');
  const sum = (arr, re) => arr.filter(x => re.test((x.trade || x.name || '') + ' ')).reduce((s, x) => s + (+x.count || 0), 0) || '';
  const lab = [['نجار مسلح', /نجار/], ['حداد مسلح', /حداد/], ['عامل', /عامل|عمال|عماله|عمالة/], ['سائق', /سائق|سواق/]], used = x => lab.some(([, re]) => re.test(x.trade || ''));
  const otherL = L.filter(x => !used(x)).reduce((s, x) => s + (+x.count || 0), 0);
  const eqc = [['لودر', /لودر/], ['حفار', /حفار/], ['سيارة مياه', /مياه/], ['سيارة', /سيار|قلاب|نقل/]], usedE = x => eqc.some(([, re]) => re.test(x.name || ''));
  const otherE = E.filter(x => !usedE(x));
  const acts = (b.acts || []).filter(a => a.work), rows = n => Math.max(n, 16), sky = b.weather?.sky;
  const lines = (arr, n, f) => Array.from({ length: rows(n) }, (_, k) => f(arr[k], k)).join('');
  const sig = (a, bb, c) => `<div class="sigs"><div>${a}</div><div>${bb}</div><div>${c}</div></div>`;
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير يومي ${esc(p.name)} ${r.report_date}</title><style>
  @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font:12px/1.35 "IBM Plex Sans Arabic",Tahoma,sans-serif;margin:0;color:#111}
  .pg{page-break-after:always;min-height:188mm;display:flex;flex-direction:column;gap:6px}.pg:last-child{page-break-after:auto}
  .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:4px}.hd img{height:42px}.hd h1{font-size:17px;margin:0}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:3px 5px;vertical-align:top}th{background:#e9e4da;font-weight:700}
  .k{background:#e9e4da;font-weight:700;width:110px}.c{text-align:center}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .box{border:1px solid #333;min-height:18px}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:auto;padding-top:14px}.sigs div{border-top:1px solid #333;padding-top:4px;text-align:center;font-weight:700;min-height:44px}
  .chk{display:inline-block;width:11px;height:11px;border:1px solid #111;margin:0 3px;vertical-align:-1px;text-align:center;line-height:9px;font-size:10px}
  td.w{height:17px}.muted{color:#666}</style></head><body>
  <div class="pg"><div class="hd"><img src="${location.origin}${location.pathname.replace(/[^/]*$/, '')}logo-dark.png" alt="ريسان"><h1>تقرير يومي: ${esc(p.name)}</h1><div><b>الموافق:</b> ${DAYS[dt.getUTCDay()]} ${r.report_date.split('-').reverse().join('/')}</div></div>
  <table><tr><td class="k">المالك</td><td>${esc(p.owner_name)}</td><td class="k">حالة الطقس</td><td><span class="chk">${sky === 'sunny' ? '✓' : ''}</span>مشمس <span class="chk">${sky === 'rain' ? '✓' : ''}</span>ممطر ${sky && !['sunny', 'rain'].includes(sky) ? `<span class="chk">✓</span>${({ cloudy: 'غائم', windy: 'رياح' })[sky]}` : ''} &nbsp; درجة الحرارة: ${b.weather?.temp ?? '……'}°</td></tr>
  <tr><td class="k">الاستشاري</td><td>${esc(p.consultant_name)}</td><td class="k">موعد الوصول</td><td>${esc(b.arrival || '')}</td></tr><tr><td class="k">الشركة المنفذة</td><td colspan="3">${esc(p.contractor_name)}</td></tr></table>
  <table><tr><th colspan="8">الطاقم الفني للمقاول بالموقع</th></tr><tr>${STAFF_POS.map(([, l]) => `<th>${l}</th>`).join('')}</tr><tr>${STAFF_POS.map(([k]) => `<td class="c">${b.staff?.[k] ?? ''}</td>`).join('')}</tr></table>
  <div class="grid2"><table><tr><th colspan="${lab.length + 1}">طاقم العمالة والفنيين بالموقع</th></tr><tr>${lab.map(([l]) => `<th>${l}</th>`).join('')}<th>أخرى</th></tr><tr>${lab.map(([, re]) => `<td class="c">${sum(L, re)}</td>`).join('')}<td class="c">${otherL || ''}</td></tr></table>
  <table><tr><th colspan="${eqc.length + 1}">معدات المقاول</th></tr><tr>${eqc.map(([l]) => `<th>${l}</th>`).join('')}<th>أخرى</th></tr><tr>${eqc.map(([, re]) => `<td class="c">${sum(E, re)}</td>`).join('')}<td class="c">${otherE.map(x => esc(x.name) + (x.count > 1 ? ' ' + x.count : '')).join('، ')}</td></tr></table></div>
  <table><tr><th style="width:55%">الأعمال الجارية في المشروع</th><th>المشاكل والمعوقات</th></tr>${lines(acts, Math.max(acts.length, 10), (a, k) => `<tr><td class="w">${a ? `${k + 1}. ${a.building ? '<b>' + esc(a.building) + ':</b> ' : ''}${esc(a.work)}${a.progress != null && a.progress !== '' ? ` <span class="muted">(${a.progress}%)</span>` : ''}` : ''}</td><td class="w">${k === 0 ? esc(b.obstacles || '').replace(/\n/g, '<br>') : ''}</td></tr>`).slice(0, 999)}</table>
  <table><tr><th>التوصيات</th></tr><tr><td style="height:46px">${esc(b.recommend || '').replace(/\n/g, '<br>')}</td></tr></table>
  ${sig('مهندس التنفيذ للمقاول', 'مدير المشروع للمقاول', 'مدير المشروع للاستشاري')}</div>
  <div class="pg"><div class="hd"><img src="${location.origin}${location.pathname.replace(/[^/]*$/, '')}logo-dark.png" alt="ريسان"><h1>تقرير يومي: ${esc(p.name)} — العمالة والمعدات والتوريدات</h1><div>${DAYS[dt.getUTCDay()]} ${r.report_date.split('-').reverse().join('/')}</div></div>
  <div class="grid2"><table><tr><th colspan="3">العمالة</th></tr><tr><th style="width:28px">م</th><th style="width:44px">عدد</th><th>البيان</th></tr>${lines(L, 18, (x, k) => `<tr><td class="c w">${x ? k + 1 : ''}</td><td class="c">${x ? x.count ?? '' : ''}</td><td>${x ? esc([x.trade, x.contractor && 'مقاول ' + x.contractor, x.building, x.work].filter(Boolean).join(' – ')) : ''}</td></tr>`)}</table>
  <table><tr><th colspan="4">المعدات</th></tr><tr><th style="width:28px">م</th><th style="width:90px">المعدة</th><th style="width:44px">عدد</th><th>البيان</th></tr>${lines(E, 18, (x, k) => `<tr><td class="c w">${x ? k + 1 : ''}</td><td>${x ? esc(x.name || '') : ''}</td><td class="c">${x ? x.count ?? '' : ''}</td><td>${x ? esc([x.building, x.work, x.hours && x.hours + ' ساعة'].filter(Boolean).join(' – ')) : ''}</td></tr>`)}</table></div>
  <table><tr><th colspan="${Math.max((b.supply || []).length, 8) + 1}">التوريدات</th></tr>${[['الصنف', 'item'], ['الوحدة', 'unit'], ['كمية', 'got']].map(([l, k]) => `<tr><th style="width:70px">${l}</th>${Array.from({ length: Math.max((b.supply || []).length, 8) }, (_, i) => `<td class="c">${esc(b.supply?.[i]?.[k] ?? (k === 'got' ? b.supply?.[i]?.req ?? '' : ''))}</td>`).join('')}</tr>`).join('')}</table>
  ${sig('مهندس تنفيذ', 'مدير المشروع', 'مهندس الاستشاري')}</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('المتصفح منع فتح نافذة الطباعة، اسمح بالنوافذ المنبثقة'); w.document.write(html); w.document.close();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-print]'); if (!b || !S.P) return; e.preventDefault(); const r = S.P.reports.find(x => x.id === b.dataset.print); if (r) printReport(r); });

/* ---------------- AI reviewer ---------------- */
async function runAi(btn) {
  const id = btn.dataset.ai, box = document.querySelector(`[data-aibox="${id}"]`); btn.disabled = true; btn.textContent = '🤖 بيراجع…';
  box.innerHTML = '<div class="aiload"><i></i><i></i><i></i> Claude بيقرا التقرير والمقايسة…</div>';
  const { data, error } = await S.sb.functions.invoke('ai-review', { body: { report_id: id } });
  btn.disabled = false; btn.textContent = '🤖 مراجعة AI تاني';
  let msg = data?.error; if (error && !msg) { try { msg = (await error.context?.json())?.error; } catch { } msg = msg || error.message; }
  if (msg) return box.innerHTML = `<div class="note">${msg === 'NO_KEY' ? 'المراجع الذكي لسه مش متفعّل: محتاج مفتاح Claude API يتحط في إعدادات Supabase (Edge Functions ← Secrets ← ANTHROPIC_API_KEY).' : esc(msg)}</div>`;
  showAi(id, data.result);
}
function showAi(id, res, at) {
  const P = S.P, box = document.querySelector(`[data-aibox="${id}"]`), r = P.reports.find(x => x.id === id); if (!box || !r) return;
  const acts = r.body.acts || [], it = iid => P.items.find(x => x.id === iid), sev = { high: ['ret', 'مهم'], medium: ['pend', 'متوسط'], low: ['imp', 'ملاحظة'] };
  const existing = new Set([...(r.body.qty || []), ...(r.body.pours || []).filter(x => x.item)].map(q => q.item));
  box.innerHTML = `<div class="aires"><div class="aih"><b>🔎 نتيجة المراجعة</b>${at ? `<span class="mut">${fmtD(at.slice(0, 10))}</span>` : ''}</div><p>${esc(res.summary || '')}</p>
  ${(res.issues || []).length ? `<ul class="aiiss">${res.issues.map(x => `<li><span class="st ${(sev[x.severity] || sev.low)[0]}">${(sev[x.severity] || sev.low)[1]}</span> ${esc(x.text)}</li>`).join('')}</ul>` : '<p class="mut">مفيش مشاكل واضحة.</p>'}
  ${(res.acts || []).length ? `<div class="scroll"><table class="aitbl"><thead><tr><th>النشاط</th><th>المكان</th><th>التخصص</th><th>البنود</th></tr></thead><tbody>${res.acts.map(a => { const o = acts[a.index] || {}, chB = !!o.building && o.building !== (a.building || ''), chD = o.discipline && o.discipline !== a.discipline;
    return `<tr><td>${esc(o.work || '')}${a.note ? `<div class="mut" style="font-size:12px">${esc(a.note)}</div>` : ''}</td><td>${chB ? `<s class="mut">${esc(o.building || '—')}</s> ` : ''}<b>${esc(a.building || '—')}</b></td><td>${chD ? `<s class="mut">${esc(o.discipline)}</s> ` : ''}${esc(a.discipline)}</td><td>${(a.items || []).map(x => { const i = it(x.item_id); return i ? `<span class="aichip" title="${esc(i.name)}">${esc(i.code)} <small>${Math.round(x.confidence * 100)}%</small> ${esc(i.name.slice(0, 34))}${i.name.length > 34 ? '…' : ''}${i.building ? ' – ' + esc(i.building) : ''}</span>` : ''; }).join('') || '<span class="mut">مش لاقي بند مناسب</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
  ${(res.qty_lines || []).length ? `<b>كميات مقترحة</b><div class="scroll"><table><tbody>${res.qty_lines.map((q, k) => { const i = it(q.item_id), rem = i ? (+i.qty || 0) - i.ex : 0, over = i && +i.qty > 0 && q.qty > rem;
    return `<tr><td>${i ? esc(i.code + ' ' + i.name.slice(0, 50)) : esc(q.item_id)}<div class="mut" style="font-size:12px">«${esc(q.basis)}»</div></td><td class="n"><b>${nf(q.qty)}</b> ${esc(i?.unit || '')}${over ? `<div style="color:var(--bad);font-size:12px">أكبر من المتبقي (${nf(rem)})</div>` : ''}</td><td>${existing.has(q.item_id) ? '<span class="mut">موجودة في التقرير</span>' : `<button type="button" data-aiadd="${id}" data-item="${esc(q.item_id)}" data-qty="${q.qty}" style="min-height:34px;font-size:13px">+ للاعتماد</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : ''}</div>`;
}
function addAiLine(b) {
  const card = b.closest('[data-id]'), tb = card.querySelector('[data-lines]'), k = tb.querySelectorAll('input[data-k]').length + 100;
  tb.insertAdjacentHTML('beforeend', `<tr class="aiadded"><td>${esc(itemName(b.dataset.item))} <span class="st appr">مقترح</span></td><td class="n"><input type="number" step="any" data-k="${k}" data-item="${esc(b.dataset.item)}" value="${b.dataset.qty}" style="width:110px;min-height:36px"></td><td><button type="button" class="x" onclick="this.closest('tr').remove()" style="min-height:30px;padding:0 10px">✕</button></td></tr>`);
  card.querySelector('[data-nolines]')?.remove(); b.replaceWith(Object.assign(document.createElement('span'), { className: 'mut', textContent: 'اتضافت' })); toast('اتضافت للكميات. راجعها قبل الاعتماد');
}


/* free rule-based reviewer (no API cost) */
const normAr = t => AR(String(t || '')).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '').replace(/land\s*0?(\d)/g, 'لاند $1');
const STOP = new Set(['جاري', 'جارى', 'تم', 'اعمال', 'عمل', 'في', 'من', 'علي', 'الي', 'و', 'مع', 'لزوم', 'بالموقع', 'الموقع', 'اليوم', 'غدا', 'بند', 'شامل', 'شاملا', 'طبقا', 'جميع', 'كافه', 'وجاري', 'استكمال']);
const SYN = { 'اسقف': 'سقف', 'اعمده': 'عمود', 'عمدان': 'عمود', 'حوائط': 'حائط', 'حيطان': 'حائط', 'اساسات': 'اساس', 'قواعد': 'اساس', 'سلالم': 'سلم', 'كمرات': 'كمره', 'خرسانات': 'خرسانه', 'نجاره': 'خرسانه', 'حداده': 'خرسانه', 'صب': 'خرسانه', 'مبانى': 'مباني', 'بياض': 'محاره' };
const toks = t => normAr(t).replace(/[^ء-ي0-9\s]/g, ' ').split(/\s+/).map(w => w.replace(/^(وال|بال|فال|كال|لل|ال)(?=..)/, '')).map(w => SYN[w] || w).filter(w => w.length > 1 && !STOP.has(w));
const FLOOR = { 'ارضي': 'ارضي', 'الارضي': 'ارضي', 'اول': 'اول', 'الاول': 'اول', 'ثاني': 'ثاني', 'تاني': 'ثاني', 'الثاني': 'ثاني', 'ثالث': 'ثالث', 'تالت': 'ثالث', 'رابع': 'رابع', 'خامس': 'خامس', 'بدروم': 'بدروم', 'سطح': 'سطح' };
function localReview(r) {
  const P = S.P, b = r.body || {}, acts = b.acts || [], bs = P.proj.buildings || [], multi = bs.length > 1, issues = [], out = [], qty = [];
  const idx = P.items.map(i => ({ i, t: new Set(toks(i.name + ' ' + i.group_name + ' ' + (i.description || '').slice(0, 120))), fl: Object.values(FLOOR).filter(f => normAr(i.name + ' ' + i.group_name).includes(f)) }));
  const findB = txt => { const n = normAr(txt); let best = ''; bs.forEach(x => { const nx = normAr(x); if (n.includes(nx) && nx.length > best.length) best = x; }); if (!best) { const m = /لاند\s*(\d)/.exec(n), v = /فيلا\s*(\d)/.exec(n); if (m) { const c = bs.filter(x => normAr(x).startsWith('لاند ' + m[1])); best = (v && c.find(x => new RegExp('فيلا\\s*' + v[1]).test(normAr(x)))) || c.find(x => normAr(x).replace(/\s/g, '') === 'لاند' + m[1]) || (c.length === 1 ? c[0] : ''); } } return best; };
  const KEY = new Set(['سقف', 'عمود', 'حائط', 'اساس', 'سلم', 'كمره', 'دكه', 'سور', 'مباني', 'محاره', 'عزل', 'ردم', 'حفر', 'احلال', 'خوازيق', 'نزح']);
  const match = (txt, bld) => { const T = [...new Set(toks(txt))], fl = T.map(w => FLOOR[w]).filter(Boolean);
    return idx.map(o => { let sc = 0; T.forEach(w => { if (o.t.has(w)) sc += KEY.has(w) ? 2 : 1; else if ([...o.t].some(x => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))) sc += .5; });
      if (fl.length && o.fl.some(f => fl.includes(f))) sc += 1.5; else if (fl.length && o.fl.length) sc -= 1; if (bld && o.i.building) sc += normAr(o.i.building).startsWith(normAr(bld)) ? 1 : -2; return { o, sc }; })
      .filter(x => x.sc >= 2).sort((a, b) => b.sc - a.sc).slice(0, 2).map((x, k, a) => ({ item_id: x.o.i.id, confidence: Math.min(.95, x.sc / (a[0].sc + 2)) })); };
  acts.forEach((a, k) => { const bld = multi ? findB(a.work + ' ' + (a.building || '')) || (bs.includes(a.building) ? a.building : '') || a.building || '' : '';
    const its = match(a.work, bld); out.push({ index: k, building: bld, discipline: a.discipline || waDisc(a.work), items: its, note: multi && !bld ? 'مش واضح المبنى' : '' });
    const q = /(\d+(?:[.,]\d+)?)\s*(م3|م³|م ?مكعب|م2|م²|م\.?ط|طن)/.exec(AR(a.work)); if (q && its[0]) qty.push({ item_id: its[0].item_id, qty: +q[1].replace(',', '.'), basis: a.work });
    if (multi && !bld && (a.discipline || waDisc(a.work)) !== 'عام') issues.push({ severity: 'medium', text: `النشاط "${a.work.slice(0, 50)}" مش محدد له مبنى` });
    if (!its.length && (a.discipline || waDisc(a.work)) !== 'عام') issues.push({ severity: 'low', text: `مش لاقي بند في المقايسة لنشاط "${a.work.slice(0, 50)}"` }); });
  (b.pours || []).filter(p => p.vol && !p.item).forEach(p => { const its = match('خرسانه ' + (p.element || ''), multi ? findB(p.building || p.element || '') : ''); if (its[0]) qty.push({ item_id: its[0].item_id, qty: +p.vol, basis: 'صبة ' + (p.element || '') + ' ' + p.vol + ' م3' }); else issues.push({ severity: 'medium', text: `صبة ${p.element || ''} (${p.vol} م3) مش مربوطة ببند` }); });
  const lines = [...(b.qty || []), ...(b.pours || []).filter(p => p.item).map(p => ({ item: p.item, qty: p.vol }))], prev = P.reports.filter(x => x.id !== r.id && x.report_date < r.report_date).sort((a, c) => c.report_date.localeCompare(a.report_date)).slice(0, 5);
  lines.forEach(l => { const i = P.items.find(x => x.id === l.item); if (!i) return; const rem = (+i.qty || 0) - i.ex;
    if (+i.qty > 0 && +l.qty > rem + 1e-6) issues.push({ severity: 'high', text: `${i.code}: الكمية ${nf(l.qty)} أكبر من المتبقي ${nf(rem)} ${i.unit || ''}` });
    const dup = prev.find(x => [...(x.body?.qty || []), ...(x.body?.pours || []).filter(p => p.item).map(p => ({ item: p.item, qty: p.vol }))].some(q => q.item === l.item && +q.qty === +l.qty));
    if (dup) issues.push({ severity: 'medium', text: `${i.code}: نفس الكمية ${nf(l.qty)} متسجلة في تقرير ${dup.report_date}، اتأكد إنها مش متكررة` }); });
  if (acts.length && !(b.labor || []).length) issues.push({ severity: 'low', text: 'مفيش عمالة مكتوبة في التقرير' });
  const seen = new Set(lines.map(l => l.item)), Q = qty.filter(q => !seen.has(q.item_id) && (seen.add(q.item_id), true));
  return { summary: `${acts.length} نشاط · ${lines.length} كمية في التقرير · ${Q.length} كمية مقترحة · ${issues.filter(x => x.severity === 'high').length} مشكلة مهمة`, issues, acts: out, qty_lines: Q };
}

/* ---------------- log ---------------- */
function renderLog() {
  const P = S.P;
  $('#main').innerHTML = `<h2>سجل التقارير اليومية</h2>${can('review', P.id) ? `<div class="acts" style="margin-top:0"><label class="btn">استيراد من جروب واتساب<input type="file" id="waF" accept=".txt,.zip" hidden></label></div><p class="mut" style="margin-top:-4px">من الجروب: ⋮ ← المزيد ← تصدير الدردشة ← بدون وسائط. ارفع الملف (zip أو txt) كما هو.</p><div id="waBox"></div>` : ''}<div class="filters"><select id="lState"><option value="">كل الحالات</option><option value="submitted">بانتظار المراجعة</option><option value="approved">معتمد</option><option value="returned">مرتجع</option></select><input id="lSearch" type="search" placeholder="بحث في الأعمال"></div><div id="logList"></div>`;
  const draw = () => { const st = $('#lState').value, q = $('#lSearch').value.trim();
    const L = P.reports.filter(r => (!st || r.status === st) && (!q || JSON.stringify(r.body.acts || []).includes(q))).slice(0, 150);
    $('#logList').innerHTML = L.length ? L.map(r => { const [cls, lbl] = r.imported ? ['imp', r.body?.source === 'whatsapp' ? 'مُرحّل من واتساب' : r.body?.wa ? 'إكسل + واتساب' : 'مُرحّل من الإكسل'] : ST[r.status]; const w = (r.body.acts || []).map(a => (a.building ? a.building + ': ' : '') + a.work).join(' — ');
      return `<details class="rep"><summary><b>${r.report_date}</b><span class="w">${esc(w)}</span><span class="st ${cls}">${lbl}</span></summary><div class="body">${r.status === 'returned' ? `<div class="note">سبب الإرجاع: ${esc(r.review_comment)}</div>` : ''}${details(r)}<p class="mut">${r.created_by ? 'كتبه: ' + esc(S.names[r.created_by] || '') : ''}${r.reviewed_by && r.status === 'approved' ? ' · اعتمده: ' + esc(S.names[r.reviewed_by] || '') + ' ' + (r.reviewed_at || '').slice(0, 10) : ''}</p><div class="acts" style="margin-bottom:0"><button type="button" data-print="${r.id}">🖨 طباعة نموذج الاستشاري</button></div>${canUp(P.id, 'report') ? `<div class="acts" style="margin-bottom:0"><label class="btn">📎 إرفاق ملف<input type="file" data-att="${r.id}" accept="${DOC_ACCEPT}" multiple hidden></label></div>` : ''}${can('report', P.id) ? `<div class="acts"><button data-e="${r.id}">فتح في النموذج</button></div>` : ''}</div></details>`; }).join('') : '<p class="mut">مفيش تقارير.</p>'; };
  draw(); $('#lState').onchange = draw; $('#lSearch').oninput = draw;
  $('#waF') && ($('#waF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importWhatsApp(f); });
  $('#logList').addEventListener('change', async e => { const i = e.target.closest('input[data-att]'); if (!i) return; const r = P.reports.find(x => x.id === i.dataset.att), files = [...i.files]; i.value = ''; if (await uploadDocs(files, { kind: 'report', report_id: r.id, doc_date: r.report_date })) { await loadProject(P.id); renderLog(); } });
  $('#logList').addEventListener('click', docClick);
  $('#logList').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; history.replaceState(null, '', `#p/${P.id}/report`); document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#p/${P.id}/report`)); renderReport(P.reports.find(r => r.id === b.dataset.e)); };
}

// WhatsApp chat export → daily report drafts (rule-based, tolerant of the formats used in the RESAN groups)
const AR = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
function waMessages(text) {
  const out = [], re = /^‎?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}:\d{2})(?::\d{2})?\s?([apAP]\.?[mM]\.?|ص|م)?\]? (?:- )?([^:]+?): ([\s\S]*)$/;
  for (const line of text.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; out.push({ date: `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, time: m[4] + (m[5] ? ' ' + m[5] : ''), from: m[6].trim(), text: m[7] }); }
    else if (out.length && !/^‎?\[?\d{1,2}\/\d{1,2}\/\d{2,4}, /.test(line)) out[out.length - 1].text += '\n' + line;
  }
  return out.map(m => ({ ...m, text: m.text.replace(/<This message was edited>|<تم تعديل هذه الرسالة>/g, '').trim() }));
}
const WA_SG = /لاند|land|ف[يى]لا|ڤيلا|سهل ?جيت|مجاويش|سيلز|السور|شخشيخ/gi, WA_SH = /شير[اي]?تون|المول|غرفة الكهرباء|الدور (الرابع|الخامس|السادس)|البدروم (السفلي|العلوي)/gi;
const WA_TRADE = /^(?:عدد\s+)?(العمال(ة)?( بالموقع)?|صنايع|نجار|حداد|عامل|عمال|بنا|بنّا|فني|فنيين|سباك|مساح|كهربائ|مبيض|مُبيض|سواق|نقاش|مبلط|لحام)/;
const WA_BLD = /^(?:(لاند|land)\s*0?([0-9]+)|(السور(?: امام الكر[فڤ]ان)?|سور الفيلات|سيلز ?اوفيس|السيلز ?اوفيس|sales office|الموقع العام|غرفة الكهرباء|البوابة))\s*[:：]?\s*$/i;
const waDisc = w => /كهرب|كابل/.test(w) ? 'كهرباء' : /سباك|صرف صحي|تغذية|تكييف/.test(w) ? 'ميكانيكا / صحي' : /مبان|مبانى|محار|بياض/.test(w) ? 'مباني' : /دهان|سيراميك|رخام|بلاط/.test(w) ? 'معماري / تشطيبات' : /واجه/.test(w) ? 'واجهات' : /زراع|لاندسكيب/.test(w) ? 'لاندسكيب' : /نظاف|تحميل|مخلفات|تشوين/.test(w) ? 'عام' : 'انشائي';
function waParse(m, defaults) {
  const raw = AR(m.text), lines = raw.split('\n').map(l => l.replace(/\*/g, '').replace(/[‎‏⁦-⁩️]/g, '').replace(/^[\u{1F300}-\u{1FAFF}☀-➿]+\s*/u, '').trim()).filter(Boolean);
  const head = lines[0] || ''; if (!/تقرير/.test(head) || raw.length < 100 || !/(موقف|نجار|حداد|عمال|وصول|الاعمال|الأعمال|جار[يى])/.test(raw)) return null;
  let date = m.date; const d = /(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/.exec(raw.slice(0, 160));
  if (d) { const hd = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`, diff = (Date.parse(m.date) - Date.parse(hd)) / 864e5; if (diff >= -1 && diff <= 4) date = hd; }
  const sg = (raw.match(WA_SG) || []).length, sh = (raw.match(WA_SH) || []).length;
  let project = sg > sh ? 'sahlgate' : sh > sg ? 'sheraton' : defaults[m.from] || null, sure = sg !== sh;
  if (/شير[اي]?تون/.test(head)) { project = 'sheraton'; sure = true; } else if (/سهل ?جيت|مجاويش/.test(head)) { project = 'sahlgate'; sure = true; }
  let arrival = null; const a = /(?:وصول|الوصول)[^0-9\n]{0,15}\n?\s*([0-9]{1,2})[.:]([0-9]{2})/.exec(raw); if (a) arrival = a[1].padStart(2, '0') + ':' + a[2];
  const labor = [], equip = [], acts = [], notes = [], obst = [], plan = []; let sec = 'labor', bld = '', total = null, eqTotal = null;
  const after = l => l.split(/[:：]/).slice(1).join(':').trim(), none = s => /^لا ?يوجد\.?$/.test(s);
  const addEq = s => s.split(/\s+-\s+|،|\+/).map(x => x.trim()).filter(x => x && !none(x)).forEach(x => { const p = /^(\d{1,2})\s*(.+)$/.exec(x), q = /^(.+?)\s*[:\-]?\s*(\d{1,2})$/.exec(x); equip.push(p ? { building: '', name: p[2], count: +p[1], hours: 8 } : q && !/^\d/.test(q[1]) ? { building: '', name: q[1], count: +q[2], hours: 8 } : { building: '', name: x, count: 1, hours: 8 }); });
  const laborLine = l => { const n = /^(.+?)\s*[:：\-]?\s*(\d{1,3})(?:\s+(.*))?$/.exec(l); if (!n || !WA_TRADE.test(n[1]) || /سقف|اعمد|أعمد|الدور|فيلا|لاند|land/i.test(n[1])) return false;
    const w = n[1].replace(/\s*تبع\s*/g, ' ').replace(/^عدد\s+/, '').trim().split(/\s+/); let trade = w.shift(); if (/صنايع/.test(trade) && w.length > 1) trade = ({ 'النجارة': 'نجارين', 'الحدادة': 'حدادين', 'المباني': 'بنايين' })[w[0]] || w[0], w.shift(); labor.push({ building: '', trade, count: +n[2], hours: 8, contractor: w.join(' ').replace(/^(الحج|حج|م\.?|ا\.?)\s+/, '').replace(/[.،,]+$/, '').trim() }); return true; };
  for (let i = 1; i < lines.length; i++) {
    let l = lines[i];
    if (/موقف ال[اأ]عمال|^ال[اأ]عمال(\s+المنفذة|\s+اليوم)?\s*[:：]?\s*$|^[اأ]عمال اليوم/.test(l)) { sec = 'acts'; l = after(l); if (!l) continue; }
    else if (/^(عدد )?(ال)?معدات/.test(l)) { const r = after(l); if (/^\d+$/.test(r)) { eqTotal = +r; sec = 'equip'; continue; } sec = 'equip'; if (r) addEq(r); continue; }
    else if (/^(ال)?معوقات|المعوقات أو|^المشاكل/.test(l)) { sec = 'obst'; const r = after(l); if (r && !none(r)) obst.push(r); continue; }
    else if (/^(احتياجات|خطة العمل|خطة الغد|المطلوب)/.test(l)) { sec = 'plan'; const r = after(l); if (r) plan.push(r); continue; }
    else if (/^(ال)?ملاحظات/.test(l)) { sec = 'notes'; const r = after(l); if (r && !none(r)) notes.push(r); continue; }
    else if (/عدد الف?ني/.test(l) && /\d/.test(l)) { total = +/(\d{1,3})/.exec(l)[1]; continue; }
    if (/موعد الوصول|^وصول|^الحضور/.test(l) || /^[0-9]{1,2}[.:][0-9]{2}\s*(ص|صباح[اًا]?|م|مساء)?$/.test(l)) continue;
    l = l.replace(/^[.\-–•·]+\s*|^\d{1,2}\s*[.)]\s*/, '').trim(); if (!l) continue;
    if (sec === 'labor' || sec === 'equip') { if (laborLine(l)) continue; }
    if (sec === 'labor') { if (/جار[يى]|^تم |تسليم|نجارة|حدادة|صب |ردم|فك /.test(l) || WA_BLD.test(l)) { sec = 'acts'; i--; } continue; }
    if (sec === 'equip') { if (WA_BLD.test(l) || /جار[يى]|^تم |تسليم/.test(l)) { sec = 'acts'; i--; continue; } addEq(l); continue; }
    if (sec === 'obst') { if (!none(l)) obst.push(l); continue; }
    if (sec === 'plan') { plan.push(l); continue; }
    if (sec === 'notes') { if (!none(l)) notes.push(l); continue; }
    if (sec === 'acts') {
      if (!acts.length && laborLine(l)) continue;
      const b = WA_BLD.exec(l); if (b) { bld = b[1] ? 'لاند ' + b[2] : b[3].replace(/^السيلز/, 'سيلز').replace(/sales office/i, 'سيلز اوفيس'); continue; }
      const bi = /^(لاند|land)\s*0?(\d+)\s*[:\-–]\s*(.+)$/i.exec(l); let b2 = bld; if (bi) { b2 = bld = 'لاند ' + bi[2]; l = bi[3]; }
      const inl = /(?:لاند|land)\s*0?(\d)/i.exec(l); if (inl && !bi) b2 = 'لاند ' + inl[1];
      acts.push({ building: b2, discipline: waDisc(l), work: l, progress: null });
    }
  }
  if (!labor.length && total) labor.push({ building: '', trade: 'فنيين', count: total, hours: 8, contractor: '' });
  if (!equip.length && eqTotal) equip.push({ building: '', name: 'معدات', count: eqTotal, hours: 8 });
  if (!acts.length && !labor.length) return null;
  return { project, sure, date, from: m.from, body: { acts, labor, equip, arrival, obstacles: obst.join('\n'), action: plan.join('\n'), notes: notes.join('\n'), qty: [], pours: [], supply: [], source: 'whatsapp', wa: { from: m.from, posted: m.date + ' ' + m.time, text: m.text.slice(0, 4000) } } };
}
function waReports(text, defaults = {}) {
  const by = {};
  waMessages(text).map(m => waParse(m, defaults)).filter(Boolean).forEach(r => { const k = (r.project || '?') + '|' + r.date; if (!by[k] || r.body.wa.text.length >= by[k].body.wa.text.length * 0.6) by[k] = r; });
  return Object.values(by).sort((a, b) => a.date.localeCompare(b.date));
}

async function unzipText(buf, pick = n => /\.txt$/i.test(n)) {
  const u = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ملف zip غير صالح');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true), dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    const meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), name = dec.decode(u.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!pick(name)) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u.subarray(ds, ds + cs);
    if (meth === 0) return dec.decode(data);
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer(); return dec.decode(out);
  }
  throw new Error('مفيش ملف محادثة txt جوه الـ zip');
}

/* ---------------- WhatsApp import ---------------- */
async function importWhatsApp(file) {
  const box = $('#waBox'); box.innerHTML = '<p class="mut">جاري قراءة المحادثة…</p>';
  let text; try { text = /\.zip$/i.test(file.name) ? await unzipText(await file.arrayBuffer()) : await file.text(); } catch (e) { return box.innerHTML = `<div class="note">${esc(e.message)}</div>`; }
  let R = waReports(text); const vote = {};
  R.filter(r => r.sure && r.project).forEach(r => { (vote[r.from] ||= {})[r.project] = (vote[r.from][r.project] || 0) + 1; });
  const defs = Object.fromEntries(Object.entries(vote).map(([k, v]) => [k, Object.entries(v).sort((a, b) => b[1] - a[1])[0][0]]));
  R = waReports(text, defs).filter(r => S.projects.some(p => p.id === r.project) ? can('review', r.project) : true);
  if (!R.length) return box.innerHTML = '<div class="note">مش لاقي تقارير موقع في الملف. التقرير لازم أول سطر فيه كلمة "تقرير".</div>';
  const ex = {}; await Promise.all(S.projects.filter(p => can('review', p.id)).map(async p => { const { data } = await S.sb.from('daily_reports').select('report_date,imported').eq('project_id', p.id); ex[p.id] = Object.fromEntries((data || []).map(x => [x.report_date, x.imported])); }));
  const fate = r => !r.project ? 'none' : !(r.date in (ex[r.project] || {})) ? 'new' : ex[r.project][r.date] ? 'merge' : 'skip';
  const FT = { new: ['appr', 'جديد'], merge: ['pend', 'دمج مع الموجود'], skip: ['imp', 'فيه تقرير من النظام'], none: ['ret', 'حدد المشروع'] };
  const draw = () => { const c = {}; R.forEach(r => { const k = (r.project || '?') + '|' + fate(r); c[k] = (c[k] || 0) + 1; });
    box.innerHTML = `<div class="card"><b>${esc(file.name)}</b>: ${R.length} تقرير من ${R[0].date} لـ ${R[R.length - 1].date}
    <div class="mut" style="margin:6px 0">${S.projects.map(p => { const n = k => c[p.id + '|' + k] || 0; return `${esc(p.name)}: ${n('new')} جديد · ${n('merge')} دمج · ${n('skip')} متساب`; }).join('<br>')}${c['?|none'] ? `<br><span style="color:var(--bad)">${c['?|none']} تقرير محتاج تحدد مشروعه</span>` : ''}</div>
    <p class="mut">التقارير الجديدة بتدخل معتمدة كأرشيف (من غير كميات، فمش بتغيّر نسب الإنجاز). الأيام اللي فيها تقرير مُرحّل من الإكسل بيتضاف لها الوصول والعمالة والمعدات من الواتساب. التقارير اللي اتكتبت على النظام مش بتتلمس.</p>
    <div class="scroll" style="max-height:340px;overflow:auto"><table><thead><tr><th>التاريخ</th><th>المشروع</th><th>كتبه</th><th>الوصول</th><th class="n">العمالة</th><th>الأعمال</th><th>الحالة</th></tr></thead><tbody>${R.map((r, k) => { const f = fate(r);
      return `<tr><td>${r.date}</td><td><select data-wp="${k}" style="min-height:32px;padding:2px 6px;font-size:13px${r.sure ? '' : ';border-color:var(--warn)'}"><option value="">؟</option>${S.projects.map(p => `<option value="${p.id}"${p.id === r.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td><td class="mut">${esc(r.from.replace(/^Eng\s+/, '').replace(/\s+Resan.*$/, ''))}</td><td>${r.body.arrival || '–'}</td><td class="n">${r.body.labor.reduce((s, l) => s + (+l.count || 0), 0) || '–'}</td><td title="${esc(r.body.acts.map(a => a.work).join(' — '))}">${esc((r.body.acts[0]?.work || '').slice(0, 50))}${r.body.acts.length > 1 ? ` <span class="mut">+${r.body.acts.length - 1}</span>` : ''}</td><td><span class="st ${FT[f][0]}">${FT[f][1]}</span></td></tr>`; }).join('')}</tbody></table></div>
    <div class="acts"><button class="ok" id="waGo">استيراد</button><button id="waNo">إلغاء</button></div></div>`;
    box.querySelectorAll('[data-wp]').forEach(sel => sel.onchange = () => { R[+sel.dataset.wp].project = sel.value || null; R[+sel.dataset.wp].sure = true; draw(); });
    $('#waNo').onclick = () => box.innerHTML = '';
    $('#waGo').onclick = async () => { $('#waGo').disabled = true; $('#waGo').textContent = 'جاري الاستيراد…'; const tot = { inserted: 0, merged: 0, skipped: 0 }; let err = null;
      for (const p of S.projects) { const L = R.filter(r => r.project === p.id && fate(r) !== 'skip').map(r => ({ date: r.date, body: r.body }));
        for (let k = 0; k < L.length && !err; k += 40) { const { data, error } = await S.sb.rpc('import_whatsapp_reports', { p_project: p.id, p_rows: L.slice(k, k + 40) }); if (error) err = error; else Object.keys(tot).forEach(x => tot[x] += data?.[0]?.[x] || 0); } }
      if (err) { $('#waGo').disabled = false; $('#waGo').textContent = 'استيراد'; return toast('الاستيراد وقف: ' + err.message); }
      toast(`اتسجل ${tot.inserted} تقرير جديد واتدمج ${tot.merged}`); box.innerHTML = ''; await loadProject(S.P.id); renderLog(); };
  };
  draw();
}




/* ---------------- tech-office tasks: pricing, designs, materials ---------------- */
const CST = { missing: ['ret', 'ناقص'], in_progress: ['pend', 'جاري'], submitted: ['run', 'مقدّم للاستشاري'], rejected: ['ret', 'عليه ملاحظات'], approved: ['appr', 'معتمد'] };
const CCAT = { design: 'التصاميم', material: 'اعتماد الخامات' };
const TPL = {
  design: { 1: ['اللوحات المعمارية', 'اللوحات الإنشائية', 'لوحات الكهروميكانيك', 'لوحات اللاندسكيب', 'الرخصة والتصاريح'], 2: ['لوحة تجهيز الموقع والمرافق المؤقتة'], 3: ['لوحات السند ونزح المياه', 'لوحات الحفر والإحلال', 'تفاصيل عزل الأجزاء المدفونة'], 4: ['لوحات الأساسات', 'لوحات الأعمدة والحوائط', 'لوحات الأسقف والسلالم'], 5: ['لوحات التشطيبات الداخلية', 'لوحات الأرضيات', 'لوحات الأسقف المعلقة', 'جداول الأبواب والشبابيك'], 6: ['لوحات الواجهات', 'رسومات تنفيذية للواجهات (Shop drawings)'], 7: ['لوحات الكهرباء', 'لوحات الصحي والصرف', 'لوحات التكييف والتهوية', 'لوحات الحريق', 'لوحات التيار الخفيف'], 8: ['لوحات اللاندسكيب التنفيذية', 'لوحات الري والإضاءة الخارجية'], 9: ['خطة الاختبار والتشغيل'] },
  material: { 3: ['مواد الإحلال', 'مواد عزل الأساسات'], 4: ['حديد التسليح', 'الخرسانة الجاهزة (المحطة والخلطة)', 'الأسمنت المقاوم'], 5: ['الطوب', 'البورسلين والسيراميك', 'الدهانات', 'الأسقف المعلقة', 'الأبواب الداخلية', 'الأدوات الصحية'], 6: ['قطاعات الألوميتال', 'الزجاج والسيكوريت', 'الرخام والجرانيت', 'دهانات الواجهات'], 7: ['الكابلات', 'اللوحات الكهربائية', 'المواسير والقطع', 'وحدات التكييف', 'المصاعد', 'منظومة الحريق', 'الإضاءة'], 8: ['الإنترلوك والبردورات', 'النباتات والتربة الزراعية', 'الإضاءة الخارجية'] },
};
function readiness(n, cat) {
  const L = (S.P.check || []).filter(c => c.phase_n === n && c.category === cat), ok = L.filter(c => c.status === 'approved').length;
  return { n: L.length, ok, state: !L.length ? 'none' : ok === L.length ? 'done' : ok ? 'part' : 'miss' };
}
function readyChips(n, compact) {
  const P = S.P, it = P.items.filter(i => i.phase_n === n), pr = it.filter(i => !lacks(i)).length;
  const chip = (lbl, st, txt) => `<span class="rchip ${st}" title="${lbl}">${compact ? ({ 'التسعير': 'تسعير', 'التصاميم': 'تصاميم', 'اعتماد الخامات': 'خامات' })[lbl] : lbl}: ${txt}</span> `;
  const t = cat => { const r = readiness(n, cat); return r.state === 'none' ? '' : chip(CCAT[cat], r.state, r.state === 'done' ? 'مكتملة' : r.state === 'part' ? `ناقصها جزء ${r.ok}/${r.n}` : `ناقصة 0/${r.n}`); };
  return (it.length ? chip('التسعير', pr === it.length ? 'done' : pr ? 'part' : 'miss', pr === it.length ? 'كامل' : `${pr}/${it.length}`) : '') + t('design') + t('material');
}
function renderTasks() {
  const P = S.P, ed = can('editBoq', P.id), T = (S.tk ||= { tab: 'price', ph: '' }), C = P.check;
  const miss = P.items.filter(lacks), phOpt = sel => P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === String(sel) ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('');
  const openN = cat => C.filter(c => c.category === cat && c.status !== 'approved').length, overdue = c => c.due_date && c.due_date < today() && c.status !== 'approved';
  const sum = `<div class="scroll"><table class="stack rtab"><thead><tr><th>المرحلة</th><th>التسعير</th><th>التصاميم</th><th>اعتماد الخامات</th></tr></thead><tbody>${P.phaseProg.map(x => { const it = P.items.filter(i => i.phase_n === x.n), pr = it.filter(i => !lacks(i)).length, d = readiness(x.n, 'design'), m = readiness(x.n, 'material');
    const cell = (r, cat) => r.state === 'none' ? `<span class="mut">مش متحدد</span>` : `<button type="button" class="rchip ${r.state}" data-go="${cat}|${x.n}">${r.state === 'done' ? '✓ مكتملة' : r.state === 'part' ? 'ناقصها جزء' : 'ناقصة'} · ${r.ok}/${r.n}</button>`;
    return `<tr><td data-l="المرحلة"><b>${x.n}. ${esc(x.name)}</b></td><td data-l="التسعير">${it.length ? `<button type="button" class="rchip ${pr === it.length ? 'done' : pr ? 'part' : 'miss'}" data-go="price|${x.n}">${pr === it.length ? '✓ كامل' : `ناقص ${it.length - pr}`} · ${pr}/${it.length}</button>` : '<span class="mut">مفيش بنود</span>'}</td><td data-l="التصاميم">${cell(d, 'design')}</td><td data-l="الخامات">${cell(m, 'material')}</td></tr>`; }).join('')}</tbody></table></div>`;
  let body = '';
  if (T.tab === 'price') {
    const L = miss.filter(i => !T.ph || String(i.phase_n) === T.ph), grp = [...new Set(L.map(i => i.phase_n))];
    body = `<p class="mut">البنود دي ناقصها سعر أو كمية، وهتفضل هنا لحد ما تكمل. اكتب الناقص واضغط "حفظ" جنب البند.</p>${L.length ? grp.map(n => `<h4>${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} <span class="mut">(${L.filter(i => i.phase_n === n).length})</span></h4><div class="tlist">${L.filter(i => i.phase_n === n).slice(0, 80).map(i => `<div class="trow" data-id="${esc(i.id)}"><span class="tchk">☐</span><div class="tt"><b>${esc(i.code)}</b> ${esc(i.name.length > 90 ? i.name.slice(0, 90) + '…' : i.name)}<div class="mut">${esc(i.group_name)}${i.building ? ' · ' + esc(i.building) : ''} · ${esc(i.unit || '')} · ناقص ${!(+i.qty > 0) && !(i.rate > 0) ? 'الكمية والسعر' : !(+i.qty > 0) ? 'الكمية' : 'السعر'}</div></div>${ed ? `<label>الكمية<input type="number" step="any" data-f="qty" value="${+i.qty || ''}"></label><label>السعر<input type="number" step="any" data-f="rate" value="${i.rate || ''}"></label><button type="button" class="p" data-savep>حفظ</button>` : ''}</div>`).join('')}</div>`).join('') : '<div class="note">✓ كل البنود متسعّرة.</div>'}`;
  } else {
    const cat = T.tab, L = C.filter(c => c.category === cat && (!T.ph || String(c.phase_n) === T.ph)), ph = [...new Set(L.map(c => c.phase_n))];
    const docs = P.docs || [];
    body = `${ed ? `<details class="card"><summary><b>+ إضافة ${cat === 'design' ? 'لوحة / تصميم' : 'خامة للاعتماد'}</b></summary><form id="cF" class="grid" style="margin-top:10px"><label>المرحلة<select name="ph">${phOpt(T.ph || P.phaseProg[0]?.n)}</select></label><label class="wide">البيان<input name="title" required placeholder="${cat === 'design' ? 'مثلاً: لوحات أسقف الدور الأول' : 'مثلاً: عينة البورسلين للحمامات'}"></label>${(P.proj.buildings || []).length > 1 ? `<label>المبنى<select name="bld"><option value="">الكل</option>${P.proj.buildings.map(b => `<option>${esc(b)}</option>`).join('')}</select></label>` : ''}<label>الحالة<select name="st">${Object.entries(CST).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>مطلوب قبل<input type="date" name="due"></label><label>المسؤول<input name="owner"></label><div class="acts" style="margin:0;align-self:end"><button class="p">إضافة</button></div></form></details>
      ${!C.some(c => c.category === cat) ? `<div class="note">لسه مفيش قائمة ${CCAT[cat]}. <button type="button" id="cTpl" class="p" style="margin-inline-start:8px">إضافة القائمة الافتراضية لكل المراحل</button> <span class="mut">وبعدها امسح اللي مش لازم وضيف الناقص.</span></div>` : ''}` : ''}
      ${L.length ? ph.map(n => { const r = readiness(n, cat); return `<h4>${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} <span class="rchip ${r.state}">${r.state === 'done' ? '✓ مكتملة' : r.state === 'part' ? 'ناقصها جزء' : 'ناقصة'} ${r.ok}/${r.n}</span></h4><div class="tlist">${L.filter(c => c.phase_n === n).map(c => `<div class="trow${c.status === 'approved' ? ' done' : ''}${overdue(c) ? ' late' : ''}" data-cid="${c.id}"><span class="tchk">${c.status === 'approved' ? '☑' : '☐'}</span><div class="tt"><b>${esc(c.title)}</b>${c.building ? ` <span class="chip2">${esc(c.building)}</span>` : ''}<div class="mut">${c.owner ? 'المسؤول: ' + esc(c.owner) + ' · ' : ''}${c.due_date ? `مطلوب قبل ${fmtD(c.due_date)}${overdue(c) ? ' <b style="color:var(--bad)">متأخر</b>' : ''} · ` : ''}${c.notes ? esc(c.notes) : ''}${c.doc_id && docs.find(d => d.id === c.doc_id) ? ' ' + docChip(docs.find(d => d.id === c.doc_id)) : ''}</div></div>
        ${ed ? `<select data-cst class="cst ${CST[c.status][0]}">${Object.entries(CST).map(([k, [, l]]) => `<option value="${k}"${k === c.status ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-cdoc title="ربط بمستند"><option value="">📎 —</option>${docs.map(d => `<option value="${d.id}"${d.id === c.doc_id ? ' selected' : ''}>📎 ${esc(d.title.slice(0, 30))}</option>`).join('')}</select><button type="button" data-cdel class="danger" title="حذف">✕</button>` : `<span class="st ${CST[c.status][0]}">${CST[c.status][1]}</span>`}</div>`).join('')}</div>`; }).join('') : C.some(c => c.category === cat) ? '<p class="mut">مفيش بنود في المرحلة دي.</p>' : ''}`;
  }
  $('#main').innerHTML = `<h2>مهام المكتب الفني</h2><p class="mut">جاهزية كل مرحلة: التسعير والتصاميم واعتماد الخامات. اضغط على أي خانة عشان تروح للناقص فيها.</p>${sum}
  <div class="filters" style="margin-top:18px"><div class="seg" style="flex:0 0 auto"><button type="button" data-tab="price" class="${T.tab === 'price' ? 'on' : ''}">التسعير (${miss.length})</button><button type="button" data-tab="design" class="${T.tab === 'design' ? 'on' : ''}">التصاميم (${openN('design')})</button><button type="button" data-tab="material" class="${T.tab === 'material' ? 'on' : ''}">اعتماد الخامات (${openN('material')})</button></div><select id="tPh" style="max-width:260px"><option value="">كل المراحل</option>${phOpt(T.ph)}</select></div>${body}`;
  const re = async () => { await loadProject(P.id); renderTasks(); };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; renderTasks(); });
  $('#tPh').onchange = e => { T.ph = e.target.value; renderTasks(); };
  $('#main').onclick = async e => {
    const g = e.target.closest('[data-go]'); if (g) { const [t, n] = g.dataset.go.split('|'); T.tab = t; T.ph = n; renderTasks(); return document.querySelector('.filters')?.scrollIntoView({ behavior: 'smooth' }); }
    const sp = e.target.closest('[data-savep]'); if (sp) { const row = sp.closest('.trow'), id = row.dataset.id, v = f => { const x = row.querySelector(`[data-f=${f}]`).value; return x === '' ? null : +x; }; sp.disabled = true;
      const q = v('qty'), r = v('rate'), i = P.items.find(x => x.id === id); let err = null;
      if (r != null && r !== i.rate) ({ error: err } = await S.sb.from('boq_rates').upsert({ item_id: id, rate: r }));
      if (!err && q != null && q !== (+i.qty || 0)) ({ error: err } = await S.sb.from('boq_items').update({ qty: q }).eq('id', id));
      if (err) { sp.disabled = false; return toast('مقدرتش أحفظ: ' + err.message); } toast('اتحفظ'); return re(); }
    const del = e.target.closest('[data-cdel]'); if (del) { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('phase_checklist').delete().eq('id', del.closest('[data-cid]').dataset.cid); if (error) return toast(error.message); return re(); }
    if (e.target.closest('[data-open]')) return docClick(e);
    if (e.target.id === 'cTpl') { const rows = []; Object.entries(TPL[T.tab]).forEach(([n, L]) => P.phaseProg.some(x => x.n === +n) && L.forEach((t, k) => rows.push({ project_id: P.id, phase_n: +n, category: T.tab, title: t, sort: k }))); const { error } = await S.sb.from('phase_checklist').insert(rows); if (error) return toast(error.message); toast(`اتضاف ${rows.length} بند`); return re(); }
  };
  $('#main').onchange = async e => { const row = e.target.closest('[data-cid]'); if (!row) return; const patch = e.target.matches('[data-cst]') ? { status: e.target.value } : e.target.matches('[data-cdoc]') ? { doc_id: e.target.value || null } : null; if (!patch) return;
    const { error } = await S.sb.from('phase_checklist').update({ ...patch, updated_at: new Date().toISOString(), updated_by: S.user.id }).eq('id', row.dataset.cid); if (error) return toast(error.message); toast('اتحدّث'); re(); };
  const cf = $('#cF'); if (cf) cf.onsubmit = async e => { e.preventDefault(); const f = new FormData(cf);
    const { error } = await S.sb.from('phase_checklist').insert({ project_id: P.id, phase_n: +f.get('ph'), category: T.tab, title: f.get('title').trim(), building: f.get('bld') || null, status: f.get('st'), due_date: f.get('due') || null, owner: f.get('owner')?.trim() || null, sort: 999 });
    if (error) return toast(error.message); toast('اتضاف'); re(); };
}

/* ---------------- documents ---------------- */
const DOC_ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv,.docx,.doc,.jpg,.jpeg,.png,.webp';
const DOC_MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const DOC_KIND = { report: 'تقارير', boq: 'مقايسات', quote: 'عروض أسعار', other: 'أخرى' };
const canUp = (pid, kind) => S.admin || (kind === 'report' ? can('docsUp', pid) : ['tech', 'management'].includes(role(pid)));
const fsize = b => b > 1048576 ? nf(b / 1048576, 1) + ' MB' : nf(b / 1024, 0) + ' KB';
const ftype = d => { const e = (d.file_name || d.path).split('.').pop().toLowerCase(); return /pdf/.test(e) ? ['PDF', 'pdf'] : /xls|csv/.test(e) ? ['XLS', 'xls'] : /doc/.test(e) ? ['DOC', 'doc'] : ['IMG', 'img']; };
const docChip = d => { const [t, c] = ftype(d); return `<a href="#" class="dchip" data-open="${d.id}" title="${esc(d.file_name || '')}"><i class="fi ${c}">${t}</i>${esc(d.title)}</a>`; };
async function uploadDocs(files, meta) {
  const P = S.P; let ok = 0;
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase(), mime = DOC_MIME[ext];
    if (!mime) { toast(`نوع الملف ${f.name} مش مسموح`); continue; } if (f.size > 25 * 1048576) { toast(`${f.name} أكبر من 25 ميجا`); continue; }
    toast(`جاري رفع ${f.name}…`); const path = `${P.id}/${meta.kind}/${crypto.randomUUID()}.${ext}`;
    const up = await S.sb.storage.from('docs').upload(path, f, { contentType: mime }); if (up.error) { toast('مقدرتش أرفع: ' + up.error.message); continue; }
    const { error } = await S.sb.from('documents').insert({ project_id: P.id, path, file_name: f.name, mime, size: f.size, title: meta.title && files.length === 1 ? meta.title : f.name.replace(/\.[^.]+$/, ''), kind: meta.kind, doc_date: meta.doc_date || today(), report_id: meta.report_id || null, item_id: meta.item_id || null, supplier: meta.supplier || null, amount: meta.amount ?? null, notes: meta.notes || null });
    if (error) { await S.sb.storage.from('docs').remove([path]); toast('مقدرتش أسجل الملف: ' + error.message); continue; } ok++;
  }
  if (ok) toast(ok === 1 ? 'اترفع الملف' : `اترفع ${ok} ملف`); return ok;
}
async function docClick(e) {
  const o = e.target.closest('[data-open],[data-dl]'); if (!o) return; e.preventDefault(); const id = o.dataset.open || o.dataset.dl, d = S.P.docs.find(x => x.id === id); if (!d) return;
  const w = o.dataset.open ? window.open('', '_blank') : null;
  const { data, error } = await S.sb.storage.from('docs').createSignedUrl(d.path, 600, o.dataset.dl ? { download: d.file_name || true } : undefined);
  if (error) { w?.close(); return toast('مقدرتش أفتح الملف: ' + error.message); }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}
function renderDocs() {
  const P = S.P, F = (S.docF ||= { kind: '', q: '', item: '' }), up = ['report', 'boq', 'quote', 'other'].filter(k => canUp(P.id, k)), D = P.docs;
  const itemOpt = (sel = '') => '<option value="">— من غير بند —</option>' + P.items.map(i => `<option value="${esc(i.id)}"${i.id === sel ? ' selected' : ''}>${esc(i.code + ' ' + (i.name.length > 60 ? i.name.slice(0, 60) + '…' : i.name) + (i.building ? ' – ' + i.building : ''))}</option>`).join('');
  const L = D.filter(d => (!F.kind || d.kind === F.kind) && (!F.item || d.item_id === F.item) && (!F.q || (d.title + ' ' + (d.supplier || '') + ' ' + (d.file_name || '') + ' ' + (d.notes || '')).includes(F.q)));
  const itemName = id => { const i = P.items.find(x => x.id === id); return i ? i.code + ' ' + (i.name.length > 40 ? i.name.slice(0, 40) + '…' : i.name) : ''; };
  const quotesBy = {}; D.filter(d => d.kind === 'quote' && d.item_id && d.amount != null).forEach(d => (quotesBy[d.item_id] ||= []).push(d));
  const cmp = Object.entries(quotesBy).filter(([, q]) => q.length > 1);
  $('#main').innerHTML = `<h2>المستندات</h2><p class="mut">التقارير والمقايسات وعروض الأسعار وأي ملفات تانية للمشروع. عروض الأسعار بتظهر للمكتب الفني والماليات والإدارة بس.</p>
  ${up.length ? `<details class="card"${D.length ? '' : ' open'}><summary><b>+ رفع مستند</b></summary><form id="dF" class="grid" style="margin-top:10px">
    <label>النوع<select name="kind">${up.map(k => `<option value="${k}"${k === (F.kind || 'quote') ? ' selected' : ''}>${DOC_KIND[k]}</option>`).join('')}</select></label>
    <label>العنوان<input name="title" placeholder="لو فاضي هياخد اسم الملف"></label><label>التاريخ<input type="date" name="date" value="${today()}"></label>
    <label data-for="report">تقرير يوم<select name="report"><option value="">—</option>${P.reports.slice(0, 120).map(r => `<option value="${r.id}">${r.report_date}</option>`).join('')}</select></label>
    <label data-for="quote boq" class="wide">بند المقايسة<select name="item">${itemOpt(F.item)}</select></label>
    <label data-for="quote">المورد / المقاول<input name="supplier" list="supL"><datalist id="supL">${[...new Set(D.map(d => d.supplier).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label data-for="quote">قيمة العرض (ج.م)<input name="amount" type="number" step="any" inputmode="decimal"></label>
    <label class="wide">ملاحظات<input name="notes"></label>
    <label class="wide">الملفات<input type="file" name="files" accept="${DOC_ACCEPT}" multiple required></label>
    <div class="acts" style="margin:0"><button class="p" id="dGo">رفع</button></div></form></details>` : ''}
  <div class="filters" style="margin-top:14px"><div class="seg" style="flex:0 0 auto"><button type="button" data-k="" class="${!F.kind ? 'on' : ''}">الكل (${D.length})</button>${Object.entries(DOC_KIND).map(([k, l]) => { const n = D.filter(d => d.kind === k).length; return n || up.includes(k) ? `<button type="button" data-k="${k}" class="${F.kind === k ? 'on' : ''}">${l} (${n})</button>` : ''; }).join('')}</div><input id="dQ" type="search" placeholder="بحث بالعنوان أو المورد" value="${esc(F.q)}">${F.item ? `<button id="dXi">✕ ${esc(itemName(F.item))}</button>` : ''}</div>
  ${cmp.length && (!F.kind || F.kind === 'quote') ? `<div class="card"><b>مقارنة عروض الأسعار</b>${cmp.map(([it, q]) => { const s2 = [...q].sort((a, b) => a.amount - b.amount), lo = s2[0].amount; return `<div style="margin-top:8px"><div class="mut">${esc(itemName(it))}</div><div class="scroll"><table><tbody>${s2.map((d, k) => `<tr><td>${k === 0 ? '<span class="st appr">الأقل</span> ' : ''}${esc(d.supplier || d.title)}</td><td class="n"><b>${nf(d.amount, 0)}</b>${k ? ` <small class="mut">(+${Math.round((d.amount - lo) / lo * 100)}%)</small>` : ''}</td><td>${fmtD(d.doc_date)}</td><td>${docChip(d)}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('')}</div>` : ''}
  <div class="dlist">${L.length ? L.map(d => { const [t, c] = ftype(d), r = d.report_id && P.reports.find(x => x.id === d.report_id), mine = d.uploaded_by === S.user.id || role(P.id) === 'management';
    return `<div class="drow"><i class="fi ${c}">${t}</i><div class="dm"><a href="#" data-open="${d.id}"><b>${esc(d.title)}</b></a><div class="mut">${DOC_KIND[d.kind]} · ${fmtD(d.doc_date)}${d.supplier ? ' · ' + esc(d.supplier) : ''}${d.amount != null ? ' · <b>' + nf(d.amount, 0) + ' ج.م</b>' : ''}${r ? ' · تقرير ' + r.report_date : ''}${d.item_id ? ` · <a href="#" data-item="${esc(d.item_id)}">${esc(itemName(d.item_id))}</a>` : ''}${d.notes ? ' · ' + esc(d.notes) : ''}</div><div class="mut" style="font-size:12px">${esc(d.file_name || '')} · ${fsize(d.size || 0)}${S.names[d.uploaded_by] ? ' · رفعه ' + esc(S.names[d.uploaded_by]) : ''}</div></div>
    <div class="da"><button data-dl="${d.id}">تحميل</button>${mine ? `<button class="danger" data-del="${d.id}">حذف</button>` : ''}</div></div>`; }).join('') : '<p class="mut">مفيش مستندات.</p>'}</div>`;
  const f = $('#dF'); if (f) { const sync = () => f.querySelectorAll('[data-for]').forEach(x => x.hidden = !x.dataset.for.split(' ').includes(f.kind.value)); f.kind.onchange = sync; sync();
    f.onsubmit = async e => { e.preventDefault(); const g = n => f[n].value, files = [...f.files.files]; if (!files.length) return; $('#dGo').disabled = true;
      const n = await uploadDocs(files, { kind: g('kind'), title: g('title').trim(), doc_date: g('date'), report_id: g('kind') === 'report' ? g('report') || null : null, item_id: ['quote', 'boq'].includes(g('kind')) ? g('item') || null : null, supplier: g('kind') === 'quote' ? g('supplier').trim() : null, amount: g('kind') === 'quote' && g('amount') !== '' ? +g('amount') : null, notes: g('notes').trim() });
      $('#dGo').disabled = false; if (n) { F.kind = g('kind'); await loadProject(P.id); renderDocs(); } }; }
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { F.kind = b.dataset.k; renderDocs(); });
  $('#dQ').onchange = e => { F.q = e.target.value.trim(); renderDocs(); }; $('#dXi') && ($('#dXi').onclick = () => { F.item = ''; renderDocs(); });
  $('#main').onclick = async e => { const it = e.target.closest('[data-item]'); if (it) { e.preventDefault(); F.item = it.dataset.item; return renderDocs(); }
    const del = e.target.closest('[data-del]'); if (del) { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'متأكد؟'; return; } const d = P.docs.find(x => x.id === del.dataset.del);
      const { error } = await S.sb.from('documents').delete().eq('id', d.id); if (error) return toast(error.message); await S.sb.storage.from('docs').remove([d.path]); toast('اتحذف'); await loadProject(P.id); return renderDocs(); }
    docClick(e); };
}

/* ---------------- staff & attendance (admin only) ---------------- */
const tmin = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }, tfmt = m => m == null ? '–' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
function deriveAttendance(reports, staff) {
  const out = {}, put = (st, r, arr, how) => { const k = st.id + '|' + r.report_date, m = tmin(arr); if (m == null) return; if (!out[k] || m < out[k].m) out[k] = { staff_id: st.id, date: r.report_date, m, project_id: r.project_id, how, src: 'report' }; };
  const byWa = Object.fromEntries(staff.filter(x => x.wa_name).map(x => [x.wa_name, x]));
  reports.forEach(r => { const b = r.body || {}; if (!b.arrival) return;
    const txt = AR(b.wa?.text || ''), lines = txt.split('\n').map(l => l.replace(/\*/g, '').trim()), i = lines.findIndex(l => /وصول/.test(l)); let seg = '';
    if (i >= 0) { seg = lines[i].replace(/.*وصول/, '').replace(/[0-9]{1,2}[.:][0-9]{2}\s*(ص|صباح[اً]?)?/, ' '); const nx = lines[i + 1] || ''; if (nx && !/\d/.test(nx) && nx.length < 45 && /(^|\s)(م|ا|أ)[.\/]?\s/.test(nx)) seg += ' ' + nx; }
    const toks = [...seg.matchAll(/(?:^|\s)(?:م|ا|أ|مهندس|المهندس|استاذ|الاستاذ)\s*[.\/]?\s*([ء-ي]{3,}(?:\s+[ء-ي]{3,})?)/g)].map(x => x[1].trim());
    let hit = staff.filter(st => st.active && (st.aliases || []).some(a => toks.some(t => t === a || t.split(/\s+/)[0] === a || (a.includes(' ') && seg.includes(a)))));
    if (hit.length) hit.forEach(st => put(st, r, b.arrival, 'مذكور في سطر الوصول'));
    else if (b.wa?.from && byWa[b.wa.from]) put(byWa[b.wa.from], r, b.arrival, 'كاتب التقرير'); });
  return Object.values(out);
}
async function renderStaff() {
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const [st, at, rp] = await Promise.all([S.sb.from('staff').select('*').order('sort'), S.sb.from('staff_attendance').select('*'), S.sb.from('daily_reports').select('id,project_id,report_date,body').gte('report_date', DS(TD(today()) - 200 * 864e5)).order('report_date')]);
  if (st.error) return $('#main').innerHTML = `<div class="note">${esc(st.error.message)}</div>`;
  S.staff = { list: st.data || [], manual: at.data || [], reports: rp.data || [], tab: S.staff?.tab || 'eval', range: S.staff?.range || 60, open: S.staff?.open || null };
  drawStaff();
}
function staffRecords() {
  const T = S.staff, auto = deriveAttendance(T.reports, T.list), man = Object.fromEntries(T.manual.map(x => [x.staff_id + '|' + x.work_date, x]));
  const all = auto.filter(a => !man[a.staff_id + '|' + a.date]).concat(T.manual.map(x => ({ staff_id: x.staff_id, date: x.work_date, m: tmin(x.arrival), status: x.status, project_id: x.project_id, how: x.note || 'تسجيل يدوي', src: 'manual', id: x.id })));
  return all;
}
function drawStaff() {
  const T = S.staff, from = DS(TD(today()) - T.range * 864e5), R = staffRecords().filter(r => r.date >= from), byS = {};
  R.forEach(r => (byS[r.staff_id] ||= []).push(r));
  const pj = id => S.projects.find(p => p.id === id)?.name || '—';
  const ev = T.list.filter(x => x.active).map(x => { const L = (byS[x.id] || []).filter(r => (r.status || 'present') === 'present' && r.m != null), lim = tmin(x.shift_start) + x.grace_min, start = tmin(x.shift_start);
    const late = L.filter(r => r.m > lim), on = L.length - late.length;
    return { x, L, days: L.length, on, late: late.length, pct: L.length ? on / L.length : null, avg: L.length ? L.reduce((s, r) => s + r.m, 0) / L.length : null, avgLate: late.length ? late.reduce((s, r) => s + (r.m - start), 0) / late.length : null, other: (byS[x.id] || []).filter(r => r.status && r.status !== 'present').length }; });
  const scored = ev.filter(e => e.days >= 3), team = scored.length ? scored.reduce((s, e) => s + e.on, 0) / scored.reduce((s, e) => s + e.days, 0) : null;
  const best = [...scored].sort((a, b) => b.pct - a.pct || a.avg - b.avg)[0], worst = [...scored].sort((a, b) => a.pct - b.pct || b.avg - a.avg)[0];
  const days30 = Array.from({ length: 30 }, (_, k) => DS(TD(today()) - (29 - k) * 864e5));
  const strip = e => { const m = Object.fromEntries((byS[e.x.id] || []).map(r => [r.date, r])), lim = tmin(e.x.shift_start) + e.x.grace_min;
    return `<div class="dstrip">${days30.map(d => { const r = m[d]; const c = !r ? 'no' : r.status && r.status !== 'present' ? 'lv' : r.m <= lim ? 'ok' : r.m <= lim + 30 ? 'lt' : 'vl'; return `<i class="${c}" title="${d}${r ? ' · ' + (r.status && r.status !== 'present' ? ({ absent: 'غياب', leave: 'إجازة', mission: 'مأمورية' })[r.status] : tfmt(r.m)) : ''}"></i>`; }).join('')}</div>`; };
  const sc = p => p == null ? '<span class="mut">–</span>' : `<b style="color:${p >= .85 ? 'var(--ok)' : p >= .6 ? 'var(--warn)' : 'var(--bad)'}">${Math.round(p * 100)}%</b>`;
  const evalHtml = `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="k"><b>${ev.length}</b><span>فرد نشط</span></div><div class="k"><b>${team == null ? '–' : Math.round(team * 100) + '%'}</b><span>الالتزام بالمواعيد للفريق</span></div><div class="k"><b>${best ? esc(best.x.full_name) : '–'}</b><span>الأكثر انضباطاً${best ? ' · ' + Math.round(best.pct * 100) + '%' : ''}</span></div><div class="k"><b>${worst && worst !== best ? esc(worst.x.full_name) : '–'}</b><span>محتاج متابعة${worst && worst !== best ? ' · ' + Math.round(worst.pct * 100) + '%' : ''}</span></div></div>
  <div class="scroll" style="margin-top:14px"><table class="stack sev"><thead><tr><th>الاسم</th><th>المشروع</th><th class="n">أيام مسجلة</th><th class="n">في الميعاد</th><th class="n">متوسط الوصول</th><th class="n">مرات التأخير</th><th class="n">متوسط التأخير</th><th>آخر 30 يوم</th></tr></thead><tbody>${ev.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)).map(e => `<tr class="pick" data-sid="${e.x.id}"><td data-l="الاسم"><b>${esc(e.x.full_name)}</b><div class="mut" style="font-size:12px">${esc(e.x.title || '')} · بداية ${String(e.x.shift_start).slice(0, 5)}</div></td><td data-l="المشروع">${esc(pj(e.x.project_id))}</td><td class="n" data-l="أيام">${e.days}${e.other ? ` <span class="mut">+${e.other}</span>` : ''}</td><td class="n" data-l="في الميعاد">${sc(e.pct)}</td><td class="n" data-l="متوسط الوصول">${tfmt(e.avg)}</td><td class="n" data-l="تأخير">${e.late}</td><td class="n" data-l="متوسط التأخير">${e.avgLate == null ? '–' : Math.round(e.avgLate) + ' د'}</td><td data-l="آخر 30 يوم">${strip(e)}</td></tr>${T.open === e.x.id ? `<tr class="sdet"><td colspan="8">${staffDetail(e, byS[e.x.id] || [])}</td></tr>` : ''}`).join('')}</tbody></table></div>
  <div class="leg"><span><i style="background:var(--ok)"></i>في الميعاد</span><span><i style="background:var(--warn)"></i>تأخير لحد 30 دقيقة</span><span><i style="background:var(--bad)"></i>تأخير أكتر</span><span><i style="background:#5b8def"></i>إجازة/غياب/مأمورية</span><span><i style="background:var(--conc)"></i>مفيش تسجيل</span></div>
  <p class="mut">مواعيد الوصول بتتسحب لوحدها من التقارير اليومية: اللي اسمه مذكور في سطر "الوصول"، ولو مفيش أسماء بتتحسب لكاتب التقرير. ايام الجمعة اللي مفيهاش تسجيل مش بتتحسب غياب. تقدر تصحح أو تضيف أي يوم يدوي من تفاصيل الشخص.</p>`;
  const opts = (sel, list, empty = '—') => `<option value="">${empty}</option>` + list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const tree = (pid, lvl = 0) => T.list.filter(x => (x.manager_id || null) === pid && x.active).map(x => `<div class="onode" style="--l:${lvl}"><div class="ocard"><b>${esc(x.full_name)}</b><span>${esc(x.title || '')}${x.project_id ? ' · ' + esc(pj(x.project_id)) : ''}</span></div>${tree(x.id, lvl + 1)}</div>`).join('');
  const structHtml = `<div class="otree">${tree(null) || '<p class="mut">مفيش أفراد.</p>'}</div>
  <h3>بيانات الأفراد</h3><p class="mut">"الأسماء في التقارير" = الطريقة اللي الاسم بيتكتب بيها في سطر الوصول (مثلاً: محمود، طارق). "اسم الواتساب" = اسمه في الجروب عشان التقارير اللي هو كاتبها.</p>
  <div class="scroll"><table class="stack sedt"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>القسم</th><th>المشروع</th><th>المدير المباشر</th><th>الأسماء في التقارير</th><th>اسم الواتساب</th><th>بداية الدوام</th><th>سماح (د)</th><th>نشط</th></tr></thead><tbody>${T.list.map(x => `<tr data-sid="${x.id}"><td data-l="الاسم"><input data-k="full_name" value="${esc(x.full_name)}"></td><td data-l="الوظيفة"><input data-k="title" value="${esc(x.title || '')}"></td><td data-l="القسم"><input data-k="department" value="${esc(x.department || '')}" list="deptL"></td><td data-l="المشروع"><select data-k="project_id">${opts(x.project_id, S.projects.map(p => [p.id, p.name]), 'الشركة')}</select></td><td data-l="المدير"><select data-k="manager_id">${opts(x.manager_id, T.list.filter(y => y.id !== x.id).map(y => [y.id, y.full_name]))}</select></td><td data-l="أسماء التقارير"><input data-k="aliases" value="${esc((x.aliases || []).join('، '))}"></td><td data-l="واتساب"><input data-k="wa_name" value="${esc(x.wa_name || '')}" dir="ltr"></td><td data-l="بداية الدوام"><input data-k="shift_start" type="time" value="${String(x.shift_start).slice(0, 5)}"></td><td data-l="سماح"><input data-k="grace_min" type="number" min="0" value="${x.grace_min}" style="width:70px"></td><td data-l="نشط"><input data-k="active" type="checkbox"${x.active ? ' checked' : ''} style="width:auto;min-height:0"></td></tr>`).join('')}</tbody></table></div>
  <datalist id="deptL">${[...new Set(T.list.map(x => x.department).filter(Boolean)).add('الإدارة').add('التنفيذ').add('المكتب الفني').add('الماليات')].map(d => `<option value="${esc(d)}">`).join('')}</datalist>
  <div class="acts"><button class="p" id="stSave">حفظ التعديلات</button><button id="stAdd">+ فرد جديد</button></div>`;
  $('#main').innerHTML = `<h2>فريق العمل</h2><p class="mut">🔒 الصفحة دي بتظهر لمدير النظام بس، ومحدش تاني يقدر يشوفها أو يقرا بياناتها.</p>
  <div class="filters"><div class="seg" style="flex:0 0 auto"><button type="button" data-tab="eval" class="${T.tab === 'eval' ? 'on' : ''}">تقييم المواعيد</button><button type="button" data-tab="struct" class="${T.tab === 'struct' ? 'on' : ''}">الهيكل والبيانات</button></div>${T.tab === 'eval' ? `<select id="stR" style="max-width:200px">${[[30, 'آخر 30 يوم'], [60, 'آخر 60 يوم'], [90, 'آخر 90 يوم'], [180, 'آخر 6 شهور']].map(([v, l]) => `<option value="${v}"${v === T.range ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
  ${T.tab === 'eval' ? evalHtml : structHtml}`;
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; drawStaff(); });
  $('#stR') && ($('#stR').onchange = e => { T.range = +e.target.value; drawStaff(); });
  if (T.tab === 'eval') {
    $('#main').querySelector('.sev').onclick = e => { const tr = e.target.closest('tr.pick'); if (tr && !e.target.closest('.sdet')) { T.open = T.open === tr.dataset.sid ? null : tr.dataset.sid; drawStaff(); } };
    const f = $('#manF'); if (f) f.onsubmit = async ev => { ev.preventDefault(); const d = new FormData(f), row = { staff_id: T.open, work_date: d.get('date'), status: d.get('status'), arrival: d.get('status') === 'present' ? d.get('arrival') || null : null, note: d.get('note') || null };
      const { error } = await S.sb.from('staff_attendance').upsert(row, { onConflict: 'staff_id,work_date' }); if (error) return toast(error.message); toast('اتسجل'); renderStaff(); };
    $('#main').querySelectorAll('[data-delman]').forEach(b => b.onclick = async () => { const { error } = await S.sb.from('staff_attendance').delete().eq('id', b.dataset.delman); if (error) return toast(error.message); toast('اتمسح التسجيل اليدوي'); renderStaff(); });
  } else {
    $('#stAdd').onclick = async () => { const { error } = await S.sb.from('staff').insert({ full_name: 'فرد جديد', sort: Math.max(0, ...T.list.map(x => x.sort)) + 1 }); if (error) return toast(error.message); renderStaff(); };
    $('#stSave').onclick = async () => { const rows = [...document.querySelectorAll('.sedt tr[data-sid]')].map(tr => { const g = k => tr.querySelector(`[data-k=${k}]`);
        return { id: tr.dataset.sid, full_name: g('full_name').value.trim() || 'بدون اسم', title: g('title').value.trim() || null, department: g('department').value.trim() || null, project_id: g('project_id').value || null, manager_id: g('manager_id').value || null, aliases: g('aliases').value.split(/[،,]/).map(x => x.trim()).filter(Boolean), wa_name: g('wa_name').value.trim() || null, shift_start: g('shift_start').value || '08:00', grace_min: +g('grace_min').value || 0, active: g('active').checked }; });
      const { error } = await S.sb.from('staff').upsert(rows); if (error) return toast('مقدرتش أحفظ: ' + error.message); toast('اتحفظ الهيكل'); renderStaff(); };
  }
}
function staffDetail(e, recs) {
  const L = [...recs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), lim = tmin(e.x.shift_start) + e.x.grace_min, pj = id => S.projects.find(p => p.id === id)?.name || '';
  return `<div class="sdbox"><form id="manF" class="grid"><label>اليوم<input type="date" name="date" value="${today()}" required></label><label>الحالة<select name="status"><option value="present">حضور</option><option value="absent">غياب</option><option value="leave">إجازة</option><option value="mission">مأمورية</option></select></label><label>موعد الوصول<input type="time" name="arrival"></label><label>ملاحظة<input name="note"></label><div class="acts" style="margin:0;align-self:end"><button class="p">تسجيل / تصحيح يوم</button></div></form>
  <div class="scroll" style="margin-top:10px;max-height:320px;overflow:auto"><table><thead><tr><th>اليوم</th><th>المشروع</th><th class="n">الوصول</th><th>المصدر</th><th></th></tr></thead><tbody>${L.map(r => `<tr><td>${r.date}</td><td>${esc(pj(r.project_id))}</td><td class="n" style="color:${r.status && r.status !== 'present' ? 'inherit' : r.m > lim ? 'var(--bad)' : 'var(--ok)'}">${r.status && r.status !== 'present' ? ({ absent: 'غياب', leave: 'إجازة', mission: 'مأمورية' })[r.status] : tfmt(r.m)}</td><td class="mut">${esc(r.how)}</td><td>${r.src === 'manual' ? `<button type="button" data-delman="${r.id}" style="min-height:30px;padding:0 10px;font-size:12px">مسح</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">مفيش تسجيلات في الفترة دي.</td></tr>'}</tbody></table></div></div>`;
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
  $('#bqSum').innerHTML = `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${hasC ? `<div class="k"><b>${money(ctot)}</b><span>قيمة العقد (ج.م)${(() => { const ci = rows.reduce((s2, r) => s2 + r.camt, 0), nz = rows.filter(r => !(r.camt > 0)).length; return ci ? ` · موزّعة على البنود ${Math.round(ci / ctot * 100)}%${nz ? ` · ${nz} بند من غير سعر تعاقدي` : ''}` : ' · لسه مش موزّعة على البنود'; })()}</span></div>` : ''}${bud ? `<div class="k"><b>${money(bud)}</b><span>الميزانية الحالية للمراحل${hasC ? ` · ${bud > ctot ? '+' : ''}${Math.round((bud - ctot) / ctot * 100)}% عن العقد` : ''}</span></div>` : ''}${hasA ? `<div class="k"><b style="color:var(--acc)">${money(atot)}</b><span>التكلفة الفعلية المصروفة${hasC ? ` · ${Math.round(atot / ctot * 100)}% من قيمة العقد` : ''}</span></div>${rtot ? `<div class="k"><b>${money(rtot)}</b><span>المحصّل من المالك</span></div>` : ''}` : ''}<div class="k"><b>${money(tot)}</b><span>التكلفة التقديرية من البنود المسعّرة</span></div><div class="k"><b>${pr} / ${rows.length}</b><span>بند متسعّر (${rows.length ? Math.round(pr / rows.length * 100) : 0}%) · ${nq} من غير كمية</span></div></div>
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
  <div class="acts" style="margin-top:0">${ed ? `<button id="bqE" class="p"${F.edit ? ' hidden' : ''}>تعديل الكميات والأسعار</button><button id="bqDist" title="بيوزّع قيمة العقد لكل مرحلة على بنودها اللي ملهاش سعر تعاقدي، بنسبة قيمتها الحالية، وبيحدّث أوزان المراحل من العقد">توزيع قيمة العقد على البنود</button>` : ''}<button id="bqX">تحميل المقايسة Excel</button>${ed ? '<label class="btn">رفع ملف أسعار<input type="file" id="bqF" accept=".xlsx,.xls" hidden></label>' : ''}${can('ledger', P.id) ? '<label class="btn" title="شيت الحسابات بنفس شكل شيت الغردقة: المشروع والمرحلة الأساسية والفرعية والإيرادات والمصروفات. بيستبدل بيانات الإكسل القديمة.">رفع شيت الحسابات<input type="file" id="lgF" accept=".xlsx,.xls" hidden></label>' : ''}</div><div id="lgBox"></div>
  ${ed ? '<p class="mut" style="margin-top:-4px">للتعديل: اضغط "تعديل الكميات والأسعار"، واكتب التعديلات، وبعدين "حفظ". أو حمّل المقايسة Excel، واملاها، وارفعها تاني.</p>' : ''}<div id="bqImp"></div>${ed ? addItemForm() : ''}<div id="bqT"></div>${ed ? `<div class="editbar" id="bqBar"${F.edit ? '' : ' hidden'}><span id="bqN"></span><label class="edd">تاريخ المنفذ<input type="date" id="bqD" value="${today()}"></label><button class="ok" id="bqS">حفظ التعديلات</button><button id="bqC">إلغاء</button></div>` : ''}`;
  boqSummary(); boqTable();
  $('#lgF') && ($('#lgF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLedger(f); });
  const set = (k, v) => { F[k] = v; if (k === 'b') boqSummary(); boqTable(); };
  $('#bqPh').onchange = e => set('ph', e.target.value); $('#bqB') && ($('#bqB').onchange = e => set('b', e.target.value));
  $('#bqQ').onchange = e => set('q', e.target.value.trim()); $('#bqM').onchange = e => set('miss', e.target.checked);
  $('#bqSum').onclick = e => { const t = e.target.closest('tr[data-ph]'); if (!t) return; F.ph = F.ph === t.dataset.ph ? '' : t.dataset.ph; $('#bqPh').value = F.ph; boqSummary(); boqTable(); };
  $('#addF') && bindAddItem();
  $('#bqT').addEventListener('click', e => { const a = e.target.closest('[data-docitem]'); if (a) { (S.docF ||= { kind: '', q: '', item: '' }).item = a.dataset.docitem; S.docF.kind = ''; } });
  $('#bqDist') && ($('#bqDist').onclick = async e => { const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟ اضغط تاني للتوزيع'; return; } b.disabled = true;
    const { data, error } = await S.sb.rpc('distribute_contract', { p_project: P.id, p_overwrite: false }); if (error) { b.disabled = false; return toast(error.message); }
    toast(`اتوزعت قيمة العقد: ${data.reduce((s, x) => s + x.filled, 0)} بند ليه سعر تعاقدي`); S.P.contract = null; await refresh(); });
  $('#bqX').onclick = exportBoq; $('#bqF') && ($('#bqF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBoq(f); });
  const bar = () => { const n = F.pend.size; if ($('#bqN')) $('#bqN').textContent = n ? `${n} بند متعدّل ومش محفوظ` : 'وضع التعديل: اكتب الكميات والأسعار وبعدين احفظ'; if ($('#bqS')) $('#bqS').disabled = !n; };
  const mode = on => { F.edit = on; if (!on) F.pend.clear(); $('#bqE') && ($('#bqE').hidden = on); $('#bqBar') && ($('#bqBar').hidden = !on); boqTable(); bar(); };
  $('#bqE') && ($('#bqE').onclick = () => mode(true)); $('#bqC') && ($('#bqC').onclick = () => mode(false)); bar();
  $('#bqT').addEventListener('input', e => {
    const i = e.target.closest('input[data-f]'); if (!i) return; const tr = i.closest('tr'), r = P.items.find(x => x.id === tr.dataset.id), f = i.dataset.f, v = i.value === '' ? 0 : +i.value;
    const orig = f === 'rate' ? r.rate : f === 'crate' ? Math.round(r.crate * 100) / 100 : f === 'ex' ? Math.round(r.ex * 1000) / 1000 : f === 'pov' ? (r.pct_override != null ? Math.round(+r.pct_override * 1000) / 10 : null) : +r.qty || 0, pe = { ...(F.pend.get(r.id) || {}) };
    const nv = f === 'pov' && i.value === '' ? null : v; if (nv === orig) delete pe[f]; else pe[f] = nv; Object.keys(pe).length ? F.pend.set(r.id, pe) : F.pend.delete(r.id);
    i.closest('td').classList.toggle('chg', f in pe); const q = pe.qty ?? (+r.qty || 0), rt = pe.rate ?? r.rate, cr = pe.crate ?? r.crate; tr.querySelector('.tot').textContent = q * rt ? nf(q * rt, 0) : '–'; tr.querySelector('.ctot').textContent = (q > 0 ? q * cr : cr) ? nf(q > 0 ? q * cr : cr, 0) : '–'; bar();
  });
  $('#bqS') && ($('#bqS').onclick = async () => {
    const btn = $('#bqS'); btn.disabled = true; btn.textContent = 'جاري الحفظ…'; const ch = [...F.pend.entries()]; let err = null;
    const R = ch.filter(([, v]) => 'rate' in v).map(([item_id, v]) => ({ item_id, rate: v.rate })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = error; }
    const camtOf = (id, v) => { const r = P.items.find(x => x.id === id), q = v.qty ?? (+r.qty || 0), cr = v.crate ?? r.crate; return Math.round((q > 0 ? q * cr : cr) * 100) / 100; };
    const CR = ch.filter(([id, v]) => 'crate' in v || ('qty' in v && P.items.find(x => x.id === id)?.camt)).map(([item_id, v]) => ({ item_id, contract_amount: camtOf(item_id, v) })); if (CR.length && !err) { const { error } = await S.sb.from('boq_rates').upsert(CR); err = error; }
    const ad = $('#bqD')?.value || today(), EX = ch.filter(([, v]) => 'ex' in v); for (const [id, v] of EX) { if (err) break; const { error } = await S.sb.rpc('adjust_executed', { p_item: id, p_total: v.ex, p_date: ad }); err = error; }
    const PO = ch.filter(([, v]) => 'pov' in v); for (const [id, v] of PO) { if (err) break; const { error } = await S.sb.from('boq_items').update({ pct_override: v.pov == null ? null : Math.min(Math.max(v.pov, 0), 100) / 100 }).eq('id', id); err = error; }
    const Q = ch.filter(([, v]) => 'qty' in v); for (let k = 0; k < Q.length && !err; k += 10) { const res = await Promise.all(Q.slice(k, k + 10).map(([id, v]) => S.sb.from('boq_items').update({ qty: v.qty }).eq('id', id))); err = res.find(x => x.error)?.error; }
    btn.textContent = 'حفظ التعديلات'; if (err) { btn.disabled = false; return toast('مقدرتش أحفظ: ' + err.message); }
    if (EX.length || PO.length) { toast(`اتحفظ تعديل ${ch.length} بند`); F.edit = false; F.pend.clear(); return refresh(); }
    ch.forEach(([id, v]) => { const r = P.items.find(x => x.id === id); if ('crate' in v) r.camt = camtOf(id, v); if ('rate' in v) r.rate = v.rate; if ('qty' in v) { r.qty = v.qty; r.rem = v.qty - r.ex; r.pct = v.qty > 0 ? r.ex / v.qty : 0; r.known = v.qty > 0 || r.pct_override != null; } r.val = (+r.qty || 0) * r.rate; r.crate = +r.qty > 0 ? r.camt / +r.qty : r.camt; r.w = r.camt > 0 ? r.camt : r.val; });
    toast(`اتحفظ تعديل ${ch.length} بند`); mode(false); boqSummary();
  });
}
function boqTable() {
  const P = S.P, F = S.bq, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id) && F.edit;
  const rows = P.items.filter(r => (!F.ph || String(r.phase_n) === F.ph) && (!F.b || r.building === F.b) && (!F.miss || lacks(r)) && (!F.q || (r.code + ' ' + r.name + ' ' + (r.description || '')).includes(F.q)));
  if (!rows.length) return $('#bqT').innerHTML = '<p class="mut">مفيش بنود بالفلتر ده.</p>';
  const cols = 9 + (multi ? 1 : 0), keys = [...new Set(rows.map(r => r.phase_n + '|' + r.group_name))];
  const base = (r, f) => f === 'qty' ? +r.qty : f === 'crate' ? Math.round(r.crate * 100) / 100 : f === 'ex' ? Math.round(r.ex * 1000) / 1000 : f === 'pov' ? (r.pct_override != null ? Math.round(+r.pct_override * 1000) / 10 : '') : r.rate;
  const pv = (r, f) => { const pe = F.pend.get(r.id); return pe && f in pe ? pe[f] : base(r, f); }, chg = (r, f) => F.pend.get(r.id) && f in F.pend.get(r.id);
  const cell = (r, f) => ed ? `<input type="number" step="any" inputmode="decimal" data-f="${f}" value="${pv(r, f) || ''}">` : (base(r, f) ? nf(base(r, f)) + (f === 'crate' && !(+r.qty > 0) ? ' <small class="mut">مقطوع</small>' : '') : '–');
  const exCell = r => { const lump = !(pv(r, 'qty') > 0), f = lump ? 'pov' : 'ex';
    if (ed) return `<td class="n ed${chg(r, f) ? ' chg' : ''}" data-l="المنفذ"><input type="number" step="any" min="0" inputmode="decimal" data-f="${f}" value="${pv(r, f) === '' ? '' : pv(r, f)}" placeholder="${lump ? '%' : 'كمية'}">${lump ? '<small class="mut"> %</small>' : ''}</td>`;
    return `<td class="n" data-l="المنفذ">${lump ? (r.pct_override != null ? Math.round(r.pct_override * 100) + '%' : '–') : r.ex ? nf(r.ex) : '–'}</td>`; };
  const ctot = r => { const q = pv(r, 'qty') || 0, c = pv(r, 'crate') || 0; return q > 0 ? q * c : c; };
  $('#bqT').innerHTML = `<div class="scroll"><table class="stack it bq"><thead><tr><th>الكود</th><th>البند</th>${multi ? '<th>المبنى</th>' : ''}<th>الوحدة</th><th class="n">الكمية</th><th class="n">المنفذ</th><th class="n">السعر التعاقدي</th><th class="n">السعر الحالي</th><th class="n">الإجمالي التعاقدي</th><th class="n">الإجمالي الحالي</th></tr></thead><tbody>${keys.map(k => { const L = rows.filter(r => r.phase_n + '|' + r.group_name === k), [n, g] = [L[0].phase_n, L[0].group_name], sub = L.reduce((s, r) => s + r.val, 0), csub = L.reduce((s, r) => s + r.camt, 0);
    return `<tr class="gh"><td colspan="${cols - 2}">${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} – ${esc(g)} <span class="mut">(${L.length})</span></td><td class="n">${csub ? nf(csub, 0) : ''}</td><td class="n">${sub ? nf(sub, 0) : ''}</td></tr>` + L.map(r => `<tr data-id="${esc(r.id)}" class="${lacks(r) ? 'lack' : ''}"><td data-l="الكود">${esc(r.code)}</td><td data-l="البند" title="${esc(r.description || '')}">${esc(r.name)}${(() => { const n = (P.docs || []).filter(d => d.item_id === r.id).length; return n ? ` <a href="#p/${P.id}/docs" class="clip" data-docitem="${esc(r.id)}" title="مستندات وعروض أسعار البند">📎${n}</a>` : ''; })()}${r.note ? `<div class="mut" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>${multi ? `<td data-l="المبنى">${esc(r.building)}</td>` : ''}<td data-l="الوحدة">${esc(r.unit)}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'qty') ? ' chg' : ''}" data-l="الكمية">${cell(r, 'qty')}</td>${exCell(r)}<td class="n${ed ? ' ed' : ''}${ed && chg(r, 'crate') ? ' chg' : ''}" data-l="السعر التعاقدي">${cell(r, 'crate')}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'rate') ? ' chg' : ''}" data-l="السعر الحالي">${cell(r, 'rate')}</td><td class="n ctot" data-l="الإجمالي التعاقدي">${ctot(r) ? nf(ctot(r), 0) : '–'}</td><td class="n tot" data-l="الإجمالي الحالي">${(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val) ? nf(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val, 0) : '–'}</td></tr>`).join(''); }).join('')}</tbody></table></div>`;
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
const BQH = ['المعرّف', 'المرحلة', 'المجموعة', 'الكود', 'البند', 'المبنى', 'الوحدة', 'الكمية', 'السعر التعاقدي', 'السعر الحالي', 'الإجمالي التعاقدي', 'الإجمالي الحالي'];
function exportBoq() {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const X = XLSX, P = S.P, aoa = [BQH, ...P.items.map(r => [r.id, r.phase_n, r.group_name, r.code, r.name, r.building || '', r.unit, +r.qty || '', r.crate ? Math.round(r.crate * 100) / 100 : '', r.rate || '', null, null])];
  const ws = X.utils.aoa_to_sheet(aoa); for (let k = 2; k <= aoa.length; k++) { ws['K' + k] = { t: 'n', f: `IF(H${k}>0,H${k}*I${k},I${k})` }; ws['L' + k] = { t: 'n', f: `H${k}*J${k}` }; }
  ws['!ref'] = 'A1:L' + aoa.length; ws['!cols'] = [{ hidden: true }, { wch: 7 }, { wch: 22 }, { wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 15 }];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'المقايسة'); wb.Workbook = { Views: [{ RTL: true }] }; X.writeFile(wb, 'مقايسة ' + P.proj.name + ' ' + today() + '.xlsx');
}
async function importBoq(file) {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const P = S.P, wb = XLSX.read(await file.arrayBuffer()), A = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const hi = A.findIndex(r => r.some(c => String(c).trim() === 'الكود')); if (hi < 0) return toast('مش لاقي عمود "الكود" في الملف');
  const H = A[hi].map(c => String(c).trim()), col = (...n) => H.findIndex(h => n.includes(h)), cI = col('المعرّف', 'المعرف'), cC = col('الكود'), cB = col('المبنى'), cQ = col('الكمية'), cR = col('السعر الحالي', 'السعر', 'سعر الوحدة'), cCR = col('السعر التعاقدي');
  if (cQ < 0 && cR < 0 && cCR < 0) return toast('مش لاقي عمود الكمية أو السعر');
  const num = v => { if (v === '' || v == null) return null; const x = +String(v).replace(/,/g, ''); return isFinite(x) ? x : null; };
  const ch = [], miss = [];
  A.slice(hi + 1).forEach(row => { const id = cI >= 0 ? String(row[cI]).trim() : '', code = String(row[cC] ?? '').trim(); if (!id && !code) return;
    const r = (id && P.items.find(x => x.id === id)) || P.items.find(x => x.code === code && (cB < 0 || !(P.proj.buildings || []).length || (x.building || '') === String(row[cB]).trim()));
    if (!r) return miss.push(code || id); const q = cQ >= 0 ? num(row[cQ]) : null, rt = cR >= 0 ? num(row[cR]) : null, cr = cCR >= 0 ? num(row[cCR]) : null;
    const c = { r }; if (q != null && q !== (+r.qty || 0)) c.qty = q; if (rt != null && rt !== r.rate) c.rate = rt; if (cr != null && Math.abs(cr - r.crate) > 0.005) c.crate = cr; if ('qty' in c || 'rate' in c || 'crate' in c) ch.push(c); });
  const box = $('#bqImp');
  if (!ch.length) { box.innerHTML = `<div class="note">مفيش تغييرات في الملف${miss.length ? ` · ${miss.length} كود مش موجود في المقايسة` : ''}.</div>`; return; }
  box.innerHTML = `<div class="card"><b>الملف فيه ${ch.length} تعديل</b> <span class="mut">(${ch.filter(c => 'rate' in c).length} سعر حالي · ${ch.filter(c => 'crate' in c).length} سعر تعاقدي · ${ch.filter(c => 'qty' in c).length} كمية)</span>${miss.length ? `<div class="mut">${miss.length} كود مش موجود في المقايسة واتجاهل: ${esc(miss.slice(0, 8).join('، '))}${miss.length > 8 ? '…' : ''}</div>` : ''}
  <div class="scroll" style="max-height:300px;overflow:auto"><table><thead><tr><th>الكود</th><th>البند</th><th class="n">الكمية</th><th class="n">السعر الحالي</th><th class="n">السعر التعاقدي</th></tr></thead><tbody>${ch.slice(0, 200).map(c => `<tr><td>${esc(c.r.code)}</td><td>${esc(c.r.name.slice(0, 60))}${c.r.building ? ' – ' + esc(c.r.building) : ''}</td><td class="n">${'qty' in c ? nf(+c.r.qty || 0) + ' ← <b>' + nf(c.qty) + '</b>' : ''}</td><td class="n">${'rate' in c ? nf(c.r.rate) + ' ← <b>' + nf(c.rate) + '</b>' : ''}</td><td class="n">${'crate' in c ? nf(c.r.crate) + ' ← <b>' + nf(c.crate) + '</b>' : ''}</td></tr>`).join('')}</tbody></table></div>
  <div class="acts"><button class="ok" id="impGo">تطبيق التعديلات</button><button id="impNo">إلغاء</button></div></div>`;
  $('#impNo').onclick = () => box.innerHTML = '';
  $('#impGo').onclick = async () => { $('#impGo').disabled = true; let err = null;
    const R = ch.filter(c => 'rate' in c).map(c => ({ item_id: c.r.id, rate: c.rate })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = err || error; }
    const CR = ch.filter(c => 'crate' in c || ('qty' in c && c.r.camt)).map(c => { const q = c.qty ?? (+c.r.qty || 0), cr = c.crate ?? c.r.crate; return { item_id: c.r.id, contract_amount: Math.round((q > 0 ? q * cr : cr) * 100) / 100 }; }); if (CR.length) { const { error } = await S.sb.from('boq_rates').upsert(CR); err = err || error; }
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
