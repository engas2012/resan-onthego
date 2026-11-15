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
  boq: ['tech', 'finance', 'management'],
};
const FLOORS = { sheraton: { ground: 2, list: [['البدروم السفلي', 'SH-4-04', 'SH-4-06'], ['البدروم العلوي', 'SH-4-07', 'SH-4-08'], ['الأرضي', 'SH-4-09', 'SH-4-10'], ['الأول', 'SH-4-11', 'SH-4-12'], ['الثاني', 'SH-4-14', 'SH-4-15'], ['الثالث', 'SH-4-16', 'SH-4-17'], ['الرابع', 'SH-4-18', 'SH-4-19'], ['الخامس', 'SH-4-20', 'SH-4-21'], ['السطح', null, 'SH-4-22']] } };
const DISC = ['انشائي', 'مباني', 'معماري / تشطيبات', 'كهرباء', 'ميكانيكا / صحي', 'واجهات', 'لاندسكيب', 'عام'];
const ST = { submitted: ['pend', 'بانتظار المراجعة'], approved: ['appr', 'معتمد'], returned: ['ret', 'مرتجع للمهندس'] };

const S = { bq: { ph: '', b: '', miss: false, q: '' }, sb: null, user: null, profile: null, admin: false, projects: [], roles: {}, names: {}, P: null, open: new Set(), q: '', bsel: '' };
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
const fatal = t => { $('#app').innerHTML = `<div class="login"><h1><span class="brand">RESAN</span> On the go</h1><div class="note">${esc(t)}</div></div>`; };

function renderLogin(msg = '') {
  $('#app').innerHTML = `<form class="login" id="lf"><h1><span class="brand">RESAN</span> On the go</h1><p class="mut" style="margin:0">متابعة مشروعات الغردقة</p>
  ${msg ? `<div class="note">${esc(msg)}</div>` : ''}
  <label>الإيميل<input type="email" id="le" required autocomplete="username"></label>
  <label>الباسورد<input type="password" id="lp" required autocomplete="current-password"></label>
  <button class="p" type="submit">دخول</button><button type="button" id="forgot">نسيت الباسورد</button><p class="mut" style="margin:0;font-size:12px;text-align:center">إصدار 1.1.0</p></form>`;
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
const VIEWS = [['status', 'الموقف التنفيذي', null], ['boq', 'المقايسة والتكلفة', 'boq'], ['report', 'تقرير يومي', 'report'], ['review', 'مراجعة المكتب الفني', 'review'], ['log', 'سجل التقارير', 'log']];
function shell(pid, view) {
  const p = pid && S.projects.find(x => x.id === pid);
  return `<header><div class="hbar"><div>${p ? '<a class="back" href="#home">→ كل المشاريع</a>' : ''}<h1>${p ? esc(p.name + ' – ' + p.place) : '<span class="brand">RESAN</span> On the go'}</h1>
  <p>${p ? `المالك: ${esc(p.owner_name)} · المقاول العام: ${esc(p.contractor_name)} · الاستشاري: ${esc(p.consultant_name)}` : 'متابعة مشروعات الغردقة'}</p></div>
  <div class="who2">${p ? `<span class="roleTag">${ROLE[role(pid)] || ''}</span>` : ''}<span>${esc(S.profile.full_name || S.profile.email)}</span>${S.admin ? '<a href="#admin" style="color:inherit">المستخدمين</a>' : ''}<button id="out">خروج</button></div></div>
  <nav>${p ? VIEWS.filter(v => !v[2] || can(v[2], pid)).map(([v, l]) => `<a href="#p/${pid}/${v}" class="${v === view ? 'on' : ''}">${l}${v === 'review' ? ' <span class="badge" id="pendN" hidden></span>' : ''}</a>`).join('') : ''}</nav></header><main id="main"><p class="mut">جاري التحميل…</p></main>`;
}
async function route() {
  const h = location.hash.slice(1) || 'home', m = h.match(/^p\/([a-z0-9_-]+)\/([a-z]+)$/);
  if (m && S.projects.some(p => p.id === m[1])) {
    const [, pid, view] = m;
    $('#app').innerHTML = shell(pid, view); bindOut();
    if (!S.P || S.P.id !== pid) { S.P = { id: pid }; S.open.clear(); S.q = ''; S.bsel = ''; S.bq = { ph: '', b: '', miss: false, q: '' }; }
    await loadProject(pid);
    if (view === 'report' && can('report', pid)) return renderReport();
    if (view === 'review' && can('review', pid)) return renderReview();
    if (view === 'log' && can('log', pid)) return renderLog();
    if (view === 'boq' && can('boq', pid)) return renderBoq();
    return renderStatus();
  }
  $('#app').innerHTML = shell(null); bindOut();
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
  const cards = await Promise.all(S.projects.map(async p => { const { data } = await S.sb.rpc('phase_progress', { p_project: p.id }); return { p, list: data || [] }; }));
  $('#main').innerHTML = `<h2>المشاريع</h2><div class="pgrid">${cards.map(({ p, list }) => `<article class="pc"><div class="row2"><div><h2>${esc(p.name)}</h2><div class="mut">${esc(p.place)}${p.land ? ' · أرض ' + esc(p.land) : ''} · <span class="roleTag">${ROLE[role(p.id)] || ''}</span></div></div><div class="pbig">${list.length ? Math.round(overall(list) * 100) + '%' : '–'}</div></div>
  <dl class="who"><dt>المالك</dt><dd>${esc(p.owner_name)}</dd><dt>المقاول العام</dt><dd>${esc(p.contractor_name)}</dd><dt>الاستشاري</dt><dd>${esc(p.consultant_name)}</dd></dl>
  <div class="mbars">${list.map(x => `<div><span>${x.n}. ${esc(x.name)}</span><div class="bar${x.pct >= 1 ? ' full' : ''}"><u style="width:${Math.min(x.pct, 1) * 100}%"></u></div><em>${Math.round(x.pct * 100)}%</em></div>`).join('')}</div>
  <div class="acts" style="margin-top:0"><a class="btn p" href="#p/${p.id}/status">فتح المشروع</a>${can('report', p.id) ? `<a class="btn" href="#p/${p.id}/report">تقرير يومي</a>` : ''}${can('review', p.id) ? `<a class="btn" href="#p/${p.id}/review">المراجعة</a>` : ''}</div></article>`).join('')}</div>`;
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
    ${groups.map(g => { const kg = ko + '|' + g.name, go = q || S.open.has(kg); return `<details class="gp" data-k="${esc(kg)}"${go ? ' open' : ''}><summary><span>${esc(g.name)} <span class="mut">(${g.rows.length})</span></span>${bar(g.pct)}</summary>${go ? itemTable(g.shown, multi, ed) : ''}</details>`; }).join('') || '<p class="mut">مفيش بنود في المرحلة دي.</p>'}</div></details>`;
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
  const bud = S.bq.b ? 0 : P.phases.reduce((s, x) => s + (+x.budget || 0), 0);
  const ph = P.phaseProg.map(x => { const L = rows.filter(r => r.phase_n === x.n), est = L.reduce((s, r) => s + r.val, 0), b = S.bq.b ? 0 : +(P.phases.find(y => y.n === x.n)?.budget) || 0; return { ...x, L, est, b, pr: L.filter(r => r.rate > 0).length }; });
  $('#bqSum').innerHTML = `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="k"><b>${money(tot)}</b><span>التكلفة التقديرية للبنود المسعّرة (ج.م)</span></div><div class="k"><b>${pr} / ${rows.length}</b><span>بند متسعّر (${rows.length ? Math.round(pr / rows.length * 100) : 0}%)</span></div><div class="k"><b>${nq}</b><span>بند من غير كمية</span></div>${bud ? `<div class="k"><b>${money(bud)}</b><span>ميزانية المراحل</span></div>` : ''}</div>
  <div class="scroll" style="margin-top:14px"><table class="stack"><thead><tr><th>المرحلة</th><th class="n">البنود</th><th class="n">متسعّر</th><th class="n">التكلفة التقديرية</th>${bud ? '<th class="n">الميزانية</th><th class="n">الفرق</th>' : ''}</tr></thead><tbody>${ph.map(x => `<tr class="pick${String(x.n) === S.bq.ph ? ' on' : ''}" data-ph="${x.n}"><td data-l="المرحلة">${x.n}. ${esc(x.name)}</td><td class="n" data-l="البنود">${x.L.length}</td><td class="n" data-l="متسعّر">${x.pr}</td><td class="n" data-l="التكلفة">${nf(x.est, 0)}</td>${bud ? `<td class="n" data-l="الميزانية">${x.b ? nf(x.b, 0) : '–'}</td><td class="n" data-l="الفرق" style="${x.b && x.est > x.b ? 'color:var(--bad)' : ''}">${x.b ? nf(x.est - x.b, 0) : '–'}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function renderBoq() {
  const P = S.P, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id), F = S.bq;
  $('#main').innerHTML = `<h2>المقايسة والتكلفة</h2><p class="mut">سعر البند هنا هو تكلفة الوحدة التقديرية. التكلفة التقديرية = الكمية × السعر. التكلفة الفعلية هتيجي من أودو في مرحلة لاحقة.</p><div id="bqSum"></div>
  <div class="filters" style="margin-top:16px"><select id="bqPh"><option value="">كل المراحل</option>${P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === F.ph ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select>${multi ? `<select id="bqB"><option value="">كل المباني</option>${P.proj.buildings.map(b => `<option${b === F.b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}<input id="bqQ" type="search" placeholder="بحث في البنود أو الكود" value="${esc(F.q)}"><label class="chk"><input type="checkbox" id="bqM"${F.miss ? ' checked' : ''}> الناقص سعر أو كمية بس</label></div>
  <div class="acts" style="margin-top:0"><button id="bqX" class="p">تحميل المقايسة Excel</button>${ed ? '<label class="btn">رفع ملف أسعار<input type="file" id="bqF" accept=".xlsx,.xls" hidden></label>' : ''}</div>
  ${ed ? '<p class="mut" style="margin-top:-4px">حمّل المقايسة، واملا عمود الكمية والسعر في الإكسل، وارفع نفس الملف. أو عدّل هنا مباشرة وكل خانة بتتحفظ لوحدها.</p>' : ''}<div id="bqImp"></div>${ed ? addItemForm() : ''}<div id="bqT"></div>`;
  boqSummary(); boqTable();
  const set = (k, v) => { F[k] = v; if (k === 'b') boqSummary(); boqTable(); };
  $('#bqPh').onchange = e => set('ph', e.target.value); $('#bqB') && ($('#bqB').onchange = e => set('b', e.target.value));
  $('#bqQ').onchange = e => set('q', e.target.value.trim()); $('#bqM').onchange = e => set('miss', e.target.checked);
  $('#bqSum').onclick = e => { const t = e.target.closest('tr[data-ph]'); if (!t) return; F.ph = F.ph === t.dataset.ph ? '' : t.dataset.ph; $('#bqPh').value = F.ph; boqSummary(); boqTable(); };
  $('#addF') && bindAddItem();
  $('#bqX').onclick = exportBoq; $('#bqF') && ($('#bqF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBoq(f); });
  $('#bqT').addEventListener('change', async e => {
    const i = e.target.closest('input[data-f]'); if (!i) return; const tr = i.closest('tr'), r = P.items.find(x => x.id === tr.dataset.id), v = i.value === '' ? 0 : +i.value;
    const { error } = i.dataset.f === 'rate' ? await S.sb.from('boq_rates').upsert({ item_id: r.id, rate: v }) : await S.sb.from('boq_items').update({ qty: v }).eq('id', r.id);
    if (error) return toast('مقدرتش أحفظ: ' + error.message);
    if (i.dataset.f === 'rate') r.rate = v; else { r.qty = v; r.rem = v - r.ex; r.pct = v > 0 ? r.ex / v : 0; r.known = v > 0 || r.pct_override != null; }
    r.val = (+r.qty || 0) * r.rate; tr.querySelector('.tot').textContent = r.val ? nf(r.val, 0) : '–'; tr.classList.toggle('lack', lacks(r)); toast('اتحفظ'); boqSummary();
  });
}
function boqTable() {
  const P = S.P, F = S.bq, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id);
  const rows = P.items.filter(r => (!F.ph || String(r.phase_n) === F.ph) && (!F.b || r.building === F.b) && (!F.miss || lacks(r)) && (!F.q || (r.code + ' ' + r.name + ' ' + (r.description || '')).includes(F.q)));
  if (!rows.length) return $('#bqT').innerHTML = '<p class="mut">مفيش بنود بالفلتر ده.</p>';
  const cols = 6 + (multi ? 1 : 0), keys = [...new Set(rows.map(r => r.phase_n + '|' + r.group_name))];
  const cell = (r, f) => ed ? `<input type="number" step="any" inputmode="decimal" data-f="${f}" value="${(f === 'qty' ? +r.qty : r.rate) || ''}">` : ((f === 'qty' ? +r.qty : r.rate) ? nf(f === 'qty' ? r.qty : r.rate) : '–');
  $('#bqT').innerHTML = `<div class="scroll"><table class="stack it bq"><thead><tr><th>الكود</th><th>البند</th>${multi ? '<th>المبنى</th>' : ''}<th>الوحدة</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">الإجمالي</th></tr></thead><tbody>${keys.map(k => { const L = rows.filter(r => r.phase_n + '|' + r.group_name === k), [n, g] = [L[0].phase_n, L[0].group_name], sub = L.reduce((s, r) => s + r.val, 0);
    return `<tr class="gh"><td colspan="${cols - 1}">${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} – ${esc(g)} <span class="mut">(${L.length})</span></td><td class="n">${sub ? nf(sub, 0) : ''}</td></tr>` + L.map(r => `<tr data-id="${esc(r.id)}" class="${lacks(r) ? 'lack' : ''}"><td data-l="الكود">${esc(r.code)}</td><td data-l="البند" title="${esc(r.description || '')}">${esc(r.name)}${r.note ? `<div class="mut" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>${multi ? `<td data-l="المبنى">${esc(r.building)}</td>` : ''}<td data-l="الوحدة">${esc(r.unit)}</td><td class="n${ed ? ' ed' : ''}" data-l="الكمية">${cell(r, 'qty')}</td><td class="n${ed ? ' ed' : ''}" data-l="السعر">${cell(r, 'rate')}</td><td class="n tot" data-l="الإجمالي">${r.val ? nf(r.val, 0) : '–'}</td></tr>`).join(''); }).join('')}</tbody></table></div>`;
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

boot();
