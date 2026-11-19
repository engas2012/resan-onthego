// RESAN On the go — المرحلة 1: الحسابات، المشاريع، الموقف التنفيذي بالمراحل، التقرير اليومي، المراجعة والاعتماد، إدارة المستخدمين
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (x, d = 2) => (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const money = v => Math.abs(v) >= 1e9 ? nf(v / 1e9, 2) + ' مليار' : Math.abs(v) >= 1e6 ? nf(v / 1e6, 2) + ' مليون' : nf(v, 0);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const toast = t => { const m = $('#msg'); m.textContent = t; m.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => m.classList.remove('on'), 2800); };
const bar = p => `<div class="pct"><div class="bar${p >= 1 ? ' full' : ''}" style="flex:1"><u style="width:${Math.min(Math.max(p, 0), 1) * 100}%"></u></div><span>${Math.round(p * 100)}%</span></div>`;

const ROLE = { site: 'مهندس الموقع', tech: 'المكتب الفني', consultant: 'الاستشاري', owner: 'المالك', finance: 'الماليات', management: 'الإدارة', store: 'أمين المخزن' };
const CAN = {
  items: ['site', 'tech', 'consultant', 'finance', 'management'],
  report: ['site', 'tech'],
  review: ['tech', 'management'],
  log: ['site', 'tech', 'management'],
  docs: ['tech', 'finance', 'management'],
  tasks: ['tech', 'finance', 'management', 'consultant'],
  store: ['tech', 'finance', 'management', 'store'],
  sched: ['tech', 'consultant', 'owner', 'finance', 'management', 'store'],
  fullRep: ['tech', 'consultant', 'owner', 'finance', 'management', 'store'],
  storeMove: ['tech', 'management', 'store'],
  docsUp: ['site', 'tech', 'management'],
  editBoq: ['tech', 'management'],
  ledger: ['finance', 'management'],
  boq: ['tech', 'finance', 'management'],
  inv: ['tech', 'finance', 'management', 'owner', 'consultant'],
  invEdit: ['tech', 'finance', 'management'],
  quotes: ['tech', 'finance', 'management', 'consultant', 'owner'],
  acct: ['finance', 'management', 'owner'],
  subs: ['tech', 'finance', 'management'],
  ledgerEd: ['finance', 'management'],
  custody: ['site', 'tech', 'store', 'finance', 'management'],
  acctEdit: ['finance', 'management'],
  quoteEd: ['tech', 'management'],
  quoteRev: ['consultant', 'management'],
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
  <button class="p" type="submit">دخول</button><button type="button" id="forgot">نسيت الباسورد</button><p class="mut" style="margin:0;font-size:12px;text-align:center">إصدار 4.7.0</p></form>`;
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
  const { data: um } = await S.sb.from('user_modules').select('module,position').eq('user_id', user.id); S.mods = Object.fromEntries((um || []).map(x => [x.module, x.position]));
  S.profile = prof || { email: user.email }; S.admin = !!prof?.is_admin; S.opsU = !!(prof?.is_admin || prof?.ops || S.mods.ops); S.opsEdit = !!(prof?.is_admin || prof?.ops || ['manager', 'accountant'].includes(S.mods.ops));
  S.studyU = !!(prof?.is_admin || S.mods.study); S.studyEdit = !!(prof?.is_admin || S.mods.study === 'editor');
  S.roles = Object.fromEntries((mem || []).map(m => [m.project_id, m.role])); S.finAny = S.admin || (mem || []).some(m => ['finance', 'management'].includes(m.role));
  S.projects = projs || [];
  if (!S.projects.length && !S.opsU && !S.studyU) return fatal('حسابك لسه مش مضاف على أي مشروع. كلّم مدير النظام.');
  if (!S.routed) { addEventListener('hashchange', route); S.routed = true; } route();
}

/* ---------------- layout & routing ---------------- */
const VIEWS = [['status', 'الموقف التنفيذي', null], ['schedule', 'الجدول الزمني', 'sched'], ['report', 'تقرير يومي', 'report'], ['review', 'مراجعة التقارير', 'review'], ['log', 'سجل التقارير', 'log'], ['tasks', 'مهام المكتب الفني', 'tasks'], ['boq', 'المقايسة والتكلفة', 'boq'], ['quotes', 'عروض الأسعار', 'quotes'], ['subs', 'عقود المقاولين', 'subs'], ['acct', 'ملخص الحسابات', 'acct'], ['phfin', 'حساب المراحل', 'ledger'], ['ledger', 'القيود والمصروفات', 'ledgerEd'], ['custody', 'العهدة', 'custody'], ['inv', 'المستخلصات', 'inv'], ['store', 'المخزن', 'store'], ['docs', 'المستندات', 'docs']];
const NAVG = [['متابعة المشروع', '📊', ['status', 'schedule']], ['التقارير اليومية', '📝', ['report', 'review', 'log']], ['المكتب الفني والتسعير', '📐', ['tasks', 'boq', 'quotes', 'subs']], ['المخزن والمستندات', '📦', ['store', 'docs']]];
const FINV = ['acct', 'phfin', 'ledger', 'inv'], FINC = { acct: 'acct', phfin: 'ledger', ledger: 'ledgerEd', inv: 'inv' };
const finOn = () => finPids().length > 0 || S.projects.some(p => can('custody', p.id));
const FINCO = () => [['fin', 'ملخص المشروعات', finPids().length > 0], ['fin/bank', 'البنك والخزينة', S.finAny], ['fin/ga', 'المصروفات الإدارية', S.finAny], ['fin/custody', 'العهد', S.projects.some(p => can('custody', p.id))]].filter(x => x[2]);
const FINT = { fin: 'كل المشروعات', 'fin/bank': 'البنك والخزينة', 'fin/ga': 'المصروفات الإدارية والعمومية', 'fin/custody': 'العهد والتصفيات' };
const finViews = pid => FINV.filter(v => can(FINC[v], pid)), finPids = () => S.projects.filter(p => finViews(p.id).length).map(p => p.id);
function finNav(pid, view) {
  const lab = Object.fromEntries(VIEWS.map(v => [v[0], v[1]])), PS = finPids(), bn = id => (S.bn || {})[id] || 0, CO = FINCO();
  const pl = p => { const vs = finViews(p); return vs.includes(view) ? view : vs[0]; };
  return `<div class="ngrp"><a href="#${CO[0]?.[0] || 'fin'}" class="${pid ? '' : 'on'}"><i>🏢</i>الشركة</a>${PS.map(p => `<a href="#p/${p}/${pl(p)}" class="${p === pid ? 'on' : ''}"><i>🏗️</i>${esc(S.projects.find(x => x.id === p).name)}</a>`).join('')}</div>${pid ? `<div class="nsub">${finViews(pid).map(v => `<a href="#p/${pid}/${v}" class="${v === view ? 'on' : ''}">${lab[v]}</a>`).join('')}</div>` : CO.length > 1 ? `<div class="nsub">${CO.map(([h, l]) => `<a href="#${h}" class="${h === view ? 'on' : ''}">${l}${h === 'fin/custody' ? ` <span class="badge" id="custN"${bn('custN') ? '' : ' hidden'}>${bn('custN') || ''}</span>` : ''}</a>`).join('')}</div>` : ''}`;
}
const BADGE = { review: 'pendN', tasks: 'taskN', quotes: 'quoteN', custody: 'custN' };
function projNav(pid, view) {
  const vis = VIEWS.filter(v => !v[2] || can(v[2], pid)), lab = Object.fromEntries(vis.map(v => [v[0], v[1]]));
  const G = NAVG.map(([t, ic, vs]) => [t, ic, vs.filter(v => v in lab)]).filter(g => g[2].length), cur = G.find(g => g[2].includes(view)) || G[0];
  const bn = id => (S.bn || {})[id] || 0, bd = (n, x) => `<span class="badge"${x}${n ? '' : ' hidden'}>${n > 999 ? '999+' : n || ''}</span>`;
  const a = (v, l, cls = '') => `<a href="#p/${pid}/${v}" class="${cls}">${l}${BADGE[v] ? ' ' + bd(bn(BADGE[v]), ` id="${BADGE[v]}"`) : ''}</a>`;
  return `<div class="ngrp">${G.map(g => g[2].length === 1 ? a(g[2][0], `<i>${g[1]}</i>${g[0]}`, g === cur ? 'on' : '') : `<a href="#p/${pid}/${g === cur && g[2].includes(view) ? view : g[2][0]}" class="${g === cur ? 'on' : ''}"><i>${g[1]}</i>${g[0]}${g[2].some(v => BADGE[v]) ? ' ' + bd(g[2].reduce((t, v) => t + bn(BADGE[v]), 0), ` data-gb="${g[2].filter(v => BADGE[v]).join(' ')}"`) : ''}</a>`).join('')}</div>${cur && cur[2].length > 1 ? `<div class="nsub">${cur[2].map(v => a(v, lab[v], v === view ? 'on' : '')).join('')}</div>` : ''}`;
}
const setBadge = (id, n) => { (S.bn ||= {})[id] = n; const b = document.getElementById(id); if (b) { b.hidden = !n; b.textContent = n > 999 ? '999+' : n; }
  document.querySelectorAll('[data-gb]').forEach(g => { const t = g.dataset.gb.split(' ').reduce((a, v) => a + (S.bn[BADGE[v]] || 0), 0); g.hidden = !t; g.textContent = t > 999 ? '999+' : t; }); };
function shell(pid, view) {
  const p = pid && S.projects.find(x => x.id === pid), fin = /^fin(\/|$)/.test(view) || (p && FINV.includes(view));
  return `<header><div class="hbar"><a class="brandlink" href="${hubOn() ? '#start' : '#home'}" title="الصفحة الرئيسية">${LOGO()}<span class="otg">On the go</span></a>
  <div class="who2"><a class="bell${view === 'alerts' ? ' on' : ''}" href="#alerts" title="التنبيهات"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="badge" id="bellN" hidden></span></a><a class="homeb${!p && (view === 'start' || (!hubOn() && !(['admin', 'staff', 'alerts', 'hr', 'ops', 'study'].includes(view) || /^fin/.test(view)))) ? ' on' : ''}" href="${hubOn() ? '#start' : '#home'}"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>الرئيسية</a>${p ? `<span class="roleTag">${ROLE[role(pid)] || ''}</span>` : ''}<span class="uname">${esc(S.profile.full_name || S.profile.email)}</span>${S.admin ? '<a href="#admin" class="adm">المستخدمين</a>' : ''}<button id="out">خروج</button></div></div>
  ${fin ? `<div class="ptitle">${modCrumb('fin')}<h1>الحسابات – ${p ? esc(p.name) : FINT[view] || ''}</h1>${p ? `<p>${esc(p.place || '')} · المالك: ${esc(p.owner_name)}</p>` : ''}</div>` : p ? `<div class="ptitle">${modCrumb('home')}<h1>${esc(p.name + ' – ' + p.place)}</h1><p>المالك: ${esc(p.owner_name)} · المقاول العام: ${esc(p.contractor_name)} · الاستشاري: ${esc(p.consultant_name)}</p></div>` : `<div class="ptitle">${modCrumb(view)}<h1>${esc(MODT[modOf(view)] || 'متابعة مشروعات الغردقة')}</h1></div>`}
  <nav class="${p || fin ? 'pnav' : ''}">${fin ? finNav(p ? pid : null, view) : p ? projNav(pid, view) : ''}</nav></header><main id="main"><p class="mut">جاري التحميل…</p></main>`;
}
async function route() {
  document.querySelector('.selbar')?.remove();
  const h = location.hash.slice(1) || (hubOn() ? 'start' : myMods()[0] || 'home'), m = h.match(/^p\/([a-z0-9_-]+)\/([a-z]+)$/);
  if (m && m[2] === 'custody') { location.hash = '#fin/custody'; return; }
  if (m && S.projects.some(p => p.id === m[1])) {
    const [, pid, view] = m;
    $('#app').innerHTML = shell(pid, view); bindOut(); document.querySelectorAll('nav.pnav a.on').forEach(a => a.scrollIntoView({ block: 'nearest', inline: 'center' }));
    if (!S.P || S.P.id !== pid) { S.P = { id: pid }; S.open.clear(); S.q = ''; S.bsel = ''; S.bq = { ph: '', b: '', miss: false, q: '', edit: false, pend: new Map() }; }
    await loadProject(pid);
    if (view === 'report' && can('report', pid)) return renderReport();
    if (view === 'review' && can('review', pid)) return renderReview();
    if (view === 'log' && can('log', pid)) return renderLog();
    if (view === 'boq' && can('boq', pid)) return renderBoq();
    if (view === 'schedule' && can('sched', pid)) return renderSchedule();
    if (view === 'docs' && can('docs', pid)) return renderDocs();
    if (view === 'quotes' && can('quotes', pid)) return renderQuotes();
    if (view === 'acct' && can('acct', pid)) return renderAcct();
    if (view === 'phfin' && can('ledger', pid)) return renderPhFin();
    if (view === 'subs' && can('subs', pid)) return renderSubs();
    if (view === 'ledger' && can('ledgerEd', pid)) return renderLedger();
    if (view === 'tasks' && can('tasks', pid)) return renderTasks();
    if (view === 'store' && can('store', pid)) return renderStore();
    if (view === 'inv' && can('inv', pid)) return renderInv();
    return renderStatus();
  }
  $('#app').innerHTML = shell(null, h); bindOut();
  if (h === 'admin' && S.admin) return renderAdmin();
  if ((h === 'staff' || h === 'hr') && S.admin) return renderStaff();
  if (h === 'ops' && S.opsU) return renderOps();
  if (h === 'study' && S.studyU) return renderStudy();
  if (h === 'start' && hubOn()) return renderHub();
  if (h === 'alerts') return renderAlerts();
  if (h === 'fin' && finPids().length) return renderFinAll();
  if (h === 'fin' && finOn()) { location.hash = '#fin/custody'; return; }
  if (h === 'fin/bank' && S.finAny) return renderBank();
  if (h === 'fin/ga' && S.finAny) return renderGA();
  if (h === 'fin/custody' && finOn()) return renderCustody();
  if (!S.projects.length && S.opsU) { location.hash = '#ops'; return; }
  if (!S.projects.length && S.studyU) { location.hash = '#study'; return; }
  renderHome();
}
const bindOut = () => { $('#out').onclick = () => S.sb.auth.signOut(); updateBell(); };

/* ---------------- data ---------------- */
async function loadProject(pid) {
  const P = S.P, wantItems = can('items', pid), wantReports = can('log', pid);
  const jobs = [S.sb.rpc('phase_progress', { p_project: pid }), S.sb.from('phases').select('*').eq('project_id', pid).order('n')];
  jobs.push(wantItems ? S.sb.from('boq_progress').select('*').eq('project_id', pid).order('sort') : Promise.resolve({ data: [] }));
  jobs.push(wantItems ? S.sb.from('boq_rates').select('item_id,rate,contract_amount,rate_source,rate_doc_id,rate_quote_id,rate_updated_at') : Promise.resolve({ data: [] }));
  jobs.push(wantReports ? S.sb.from('daily_reports').select('*').eq('project_id', pid).order('report_date', { ascending: false }).limit(400) : Promise.resolve({ data: [] }));
  const [pp, ph, it, rt, rp] = await Promise.all(jobs);
  P.phaseProg = pp.data || []; P.phases = ph.data || [];
  const rates = Object.fromEntries((rt.data || []).map(r => [r.item_id, +r.rate])), camts = Object.fromEntries((rt.data || []).map(r => [r.item_id, +r.contract_amount || 0])), rmeta = Object.fromEntries((rt.data || []).map(r => [r.item_id, r]));
  P.showRates = ['tech', 'finance', 'management'].includes(role(pid));
  P.items = (it.data || []).map(i => { const q = +i.qty || 0, ex = +i.executed || 0, rate = rates[i.id] || 0; const pct = q > 0 ? ex / q : (i.pct_override != null ? +i.pct_override : 0); const camt = camts[i.id] || 0, rm = rmeta[i.id] || {}; return { ...i, ex, rate, camt, rsrc: rm.rate_source, rdoc: rm.rate_doc_id, rqid: rm.rate_quote_id, rdate: rm.rate_updated_at, crate: q > 0 ? camt / q : camt, pct: Math.max(0, pct), rem: q - ex, val: q * rate, w: camt > 0 ? camt : q * rate, known: q > 0 || i.pct_override != null }; });
  P.reports = rp.data || [];
  P.vendors = can('boq', pid) || can('tasks', pid) ? ((await S.sb.from('vendors').select('*').order('trade').order('name')).data || []) : [];
  P.guide = can('boq', pid) || can('tasks', pid) ? ((await S.sb.from('price_guide').select('*').order('sort')).data || []) : [];
  P.docs = can('docs', pid) || can('log', pid) ? ((await (can('docs', pid) ? S.sb.from('documents').select('*') : S.sb.from('documents').select('*').eq('kind', 'report')).eq('project_id', pid).order('doc_date', { ascending: false }).order('created_at', { ascending: false })).data || []) : [];
  P.proj = S.projects.find(x => x.id === pid);
  const ids = [...new Set([...P.reports.flatMap(r => [r.created_by, r.reviewed_by]), ...P.docs.map(d => d.uploaded_by)].filter(x => x && !(x in S.names)))];
  if (ids.length) { const { data } = await S.sb.from('profiles').select('id,full_name,email').in('id', ids); (data || []).forEach(u => S.names[u.id] = u.full_name || u.email); }
  setBadge('pendN', can('review', pid) ? P.reports.filter(r => r.status === 'submitted').length : 0);
  if (can('quotes', pid)) { const [qq, qi] = await Promise.all([S.sb.from('quotes').select('*').eq('project_id', pid).order('created_at'), S.sb.rpc('quote_items', { p_project: pid })]); P.quotes = qq.data || []; P.qitems = qi.data || [];
    if (!can('docs', pid)) { const qd = P.quotes.map(q => q.doc_id).filter(Boolean); if (qd.length) { const { data } = await S.sb.from('documents').select('*').in('id', qd); P.docs = [...P.docs, ...(data || [])]; } } } else { P.quotes = []; P.qitems = []; }
  setBadge('quoteN', can('quoteRev', pid) && role(pid) === 'consultant' ? P.quotes.filter(q => q.status === 'submitted').length : can('quoteEd', pid) ? P.quotes.filter(q => q.status === 'rejected' && q.adopted).length : 0);
  P.check = can('tasks', pid) ? ((await S.sb.from('phase_checklist').select('*').eq('project_id', pid).order('phase_n').order('sort').order('created_at')).data || []) : [];
  if (can('ledgerEd', pid)) S.sb.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'submitted').then(r => setBadge('custN', r.count || 0)); else if (can('custody', pid)) S.sb.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('custody_user', S.user.id).eq('status', 'rejected').then(r => setBadge('custN', r.count || 0));
  setBadge('taskN', can('tasks', pid) ? P.items.filter(lacks).length + P.check.filter(c => c.status !== 'approved').length : 0);
}
const overall = list => { const W = list.reduce((s, x) => s + (+x.weight || 0), 0); return W ? list.reduce((s, x) => s + (+x.pct || 0) * (+x.weight || 0), 0) / W : 0; };
const groupPct = rows => { const v = rows.filter(r => r.w > 0), avg = v.length ? v.reduce((s, r) => s + r.w, 0) / v.length : 1; let a = 0, b = 0; rows.forEach(r => { const w = r.w > 0 ? r.w : avg; a += w * Math.min(r.pct, 1); b += w; }); return b ? a / b : 0; };

/* ---------------- home ---------------- */
/* ---------------- main hub: Construction / HR / Operations ---------------- */
const myMods = () => [S.projects.length && 'home', finOn() && 'fin', S.opsU && 'ops', S.studyU && 'study', S.admin && 'hr'].filter(Boolean);
const hubOn = () => myMods().length > 1;
const modOf = v => v === 'start' ? 'start' : ['hr', 'staff'].includes(v) ? 'hr' : v === 'ops' ? 'ops' : v === 'study' ? 'study' : /^fin(\/|$)/.test(v) || FINV.includes(v) || v === 'custody' ? 'fin' : ['admin', 'alerts'].includes(v) ? 'start' : 'home';
const MODT = { start: 'RESAN On the go', home: 'Construction – مشروعات المقاولات', hr: 'HR – الموارد البشرية', ops: 'إدارة التشغيل – المولات', study: 'دراسة المشروعات – دراسات الجدوى', fin: 'Finance – الحسابات' };
const MODN = { home: 'Construction', fin: 'الحسابات', hr: 'HR', ops: 'إدارة التشغيل', study: 'دراسة المشروعات' };
const modCrumb = v => { const m = modOf(v); return hubOn() && MODN[m] ? `<a class="crumb" href="#start">الرئيسية</a> <span class="crumb">›</span> <a class="crumb" href="${m === 'home' ? '#home' : '#' + m}">${MODN[m]}</a>` : ''; };
async function renderHub() {
  const [pp, st] = await Promise.all([Promise.all(S.projects.map(p => S.sb.rpc('phase_progress', { p_project: p.id }).then(r => ({ p, ov: overall(r.data || []) })))), S.admin ? S.sb.from('staff').select('id,active') : Promise.resolve({ data: [] })]);
  const staffN = (st.data || []).filter(x => x.active !== false).length;
  const [om, ou, ol, oc, op] = await Promise.all(['malls', 'mall_units', 'leases', 'lease_charges', 'lease_payments'].map(t => S.sb.from(t).select('*')));
  const OU = ou.data || [], ops = { malls: (om.data || []).length, units: OU.length, occ: OU.length ? Math.round(OU.filter(x => x.status === 'leased').length / OU.length * 100) : 0, arr: (ol.data || []).reduce((s, x) => s + Math.max(leaseBal(x, oc.data || [], op.data || []).bal, 0), 0) };
  const tile = (href, cls, ico, en, ar, body, foot) => `<a class="hubt ${cls}" href="${href}"><div class="hico">${ico}</div><div class="hen">${en}</div><div class="har">${ar}</div><div class="hbody">${body}</div><div class="hfoot">${foot} ←</div></a>`;
  const crane = '<svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M14 58V14l6-6 6 6v44M8 58h28M20 14h38M26 14l26 0M46 14v14M42 28h8v6h-8zM20 22l6 6M26 22l-6 6M20 34l6 6M26 34l-6 6"/></svg>';
  const ppl = '<svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="22" r="8"/><circle cx="44" cy="24" r="6"/><path d="M8 52c0-9 7-16 16-16s16 7 16 16M38 38c8-2 18 3 18 14"/></svg>';
  const mall = '<svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M6 26 12 10h40l6 16zM10 26v30h44V26M6 26h52M22 56V40h20v16M16 32h6M42 32h6"/></svg>';
  let studies = []; if (S.studyU) { const r = await S.sb.from('feasibility_studies').select('name,net_profit,updated_at').order('updated_at', { ascending: false }).limit(3); studies = r.data || []; }
  const calc = '<svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><rect x="12" y="6" width="40" height="52" rx="5"/><rect x="18" y="12" width="28" height="10" rx="2"/><path d="M20 32h4M30 32h4M40 32h4M20 41h4M30 41h4M40 41v10M20 50h4M30 50h4"/></svg>';
  const coin = '<svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><rect x="6" y="14" width="52" height="36" rx="5"/><circle cx="32" cy="32" r="8"/><path d="M14 22h6M44 42h6"/></svg>';
  const rvP = S.projects.filter(p => can('ledgerEd', p.id)).map(p => p.id), finRev = rvP.length ? ((await S.sb.from('ledger_entries').select('id', { count: 'exact', head: true }).in('project_id', rvP).eq('status', 'submitted')).count || 0) : 0;
  $('#main').innerHTML = `<div class="hubhi"><b>أهلاً ${esc((S.profile.full_name || '').split(' ')[0] || '')}</b><span class="mut">اختار القسم</span></div><div class="hubg">
    ${!S.projects.length ? '' : tile('#home', 'c1', crane, 'Construction', 'مشروعات المقاولات', `${pp.map(x => `<div class="hrow"><span>${esc(x.p.name)}</span><div class="bar"><u style="width:${Math.round(x.ov * 100)}%"></u></div><em>${Math.round(x.ov * 100)}%</em></div>`).join('')}`, `${S.projects.length} مشروع`)}
    ${!finOn() ? '' : tile(finPids().length ? '#fin' : '#fin/custody', 'c5', coin, 'Finance', 'الحسابات', `<div class="mut">المستخلصات والدفعات والقيود والعهد لكل المشروعات من مكان واحد.</div>${finRev ? `<div class="hbig">${finRev}</div><div class="mut">قيد / تصفية عهدة مستنية المراجعة</div>` : ''}`, finPids().length ? `${finPids().length} مشروع` : 'عهدتي')}
    ${!S.studyU ? '' : tile('#study', 'c4', calc, 'Feasibility', 'دراسة المشروعات', studies.length ? studies.map(x => `<div class="hrow hst"><span>${esc(x.name)}</span><em>${money(+x.net_profit || 0)}</em></div>`).join('') : '<div class="mut">حاسبة دراسات الجدوى: الأرض والأدوار والتكلفة وسعر البيع ← تقرير جاهز.</div>', studies.length ? 'كل الدراسات' : 'ابدأ أول دراسة')}
    ${!S.admin ? '' : tile('#hr', 'c2', ppl, 'HR', 'الموارد البشرية', `<div class="hbig">${staffN}</div><div class="mut">فرد في فريق العمل · الحضور ومواعيد الوصول</div>`, 'فريق العمل والإجازات')}
    ${!S.opsU ? '' : tile('#ops', 'c3', mall, 'Operations', 'إدارة التشغيل', ops.units ? `<div class="hbig">${ops.occ}%</div><div class="mut">إشغال ${ops.units} وحدة في ${ops.malls} مول${ops.arr ? ` · متأخرات ${nf(ops.arr, 0)}` : ''}</div>` : '<div class="mut">المولات والوحدات والعقود والتحصيل.</div>', ops.units ? 'الوحدات والعقود والتحصيل' : 'ابدأ بإضافة المولات')}
  </div>`;
}
/* ---------------- Feasibility studies (lazy module) ---------------- */
async function renderStudy() {
  try { const m = await import('./study.js'); await m.mount($('#main'), { sb: S.sb, toast, esc, canEdit: S.studyEdit }); }
  catch (e) { $('#main').innerHTML = `<div class="note">مقدرتش أفتح قسم الدراسات: ${esc(e.message)}</div>`; }
}
/* ---------------- Operations: malls / units / leases / collection ---------------- */
const USTAT = { leased: ['مؤجرة', '#1d7a4f'], vacant: ['فاضية', '#b3261e'], fitout: ['تحت التجهيز', '#c98a12'], owner: ['استخدام المالك', '#5b6b7a'] };
const CHK = { rent: 'إيجار', service: 'خدمات', deposit: 'تأمين', other: 'أخرى' }, PEV = { 1: 'شهري', 3: 'ربع سنوي', 6: 'نص سنوي', 12: 'سنوي' };
const addM = (d, m) => { const x = new Date(d + 'T12:00:00Z'), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + m); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(day, last)); return x.toISOString().slice(0, 10); };
const monthsBetween = (a, b) => { const x = new Date(a + 'T12:00:00Z'), y = new Date(b + 'T12:00:00Z'); return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth() - (y.getUTCDate() < x.getUTCDate() ? 1 : 0); };
const areaIn = u => (+u.area || 0) + (u.duplex ? +u.area2 || 0 : 0);
const areaTxt = u => { const p = []; if (u.duplex) { if (u.area) p.push(`${u.floor ? esc(u.floor) + ' ' : ''}${nf(u.area)}`); if (u.area2) p.push(`${u.floor2 ? esc(u.floor2) + ' ' : ''}${nf(u.area2)}`); } else if (u.area) p.push(nf(u.area));
  let t = p.length ? p.join(' + ') + ' م2' + (u.duplex && p.length > 1 ? ` (${nf(areaIn(u))})` : '') : ''; if (u.area_out) t += (t ? ' + ' : '') + nf(u.area_out) + ' م2 خارجي'; return (u.duplex ? 'دوبلكس · ' : '') + t; };
const daysTo = d => Math.round((TD(d) - TD(today())) / 864e5);
function genCharges(L) {
  const rows = [], lim = L.ended_on || L.end_date; if (+L.deposit > 0) rows.push({ lease_id: L.id, due_date: L.start_date, kind: 'deposit', amount: +L.deposit, note: 'تأمين' });
  for (let d = L.start_date, k = 0; d <= lim && k < 600; d = addM(L.start_date, (++k) * L.pay_every)) {
    const f = Math.pow(1 + (+L.escalation_pct || 0) / 100, Math.floor(monthsBetween(L.start_date, d) / Math.max(+L.escalation_every || 12, 1))), pe = addM(L.start_date, (k + 1) * L.pay_every); const to = DS(Math.min(TD(pe) - 864e5, TD(lim)));
    rows.push({ lease_id: L.id, due_date: d, kind: 'rent', amount: Math.round(L.rent * f * L.pay_every * 100) / 100, period_from: d, period_to: to });
    if (+L.service_fee > 0) rows.push({ lease_id: L.id, due_date: d, kind: 'service', amount: Math.round(L.service_fee * L.pay_every * 100) / 100, period_from: d, period_to: to });
  }
  return rows;
}
const curRent = (L, C) => { const r = C.filter(c => c.lease_id === L.id && c.kind === 'rent' && c.due_date <= today()).sort((a, b) => b.due_date.localeCompare(a.due_date))[0] || C.find(c => c.lease_id === L.id && c.kind === 'rent'); return r ? r.amount / L.pay_every : +L.rent; };
function leaseBal(L, C, Pm) {
  const ch = C.filter(c => c.lease_id === L.id).sort((a, b) => a.due_date.localeCompare(b.due_date)), paid = Pm.filter(p => p.lease_id === L.id).reduce((s, p) => s + +p.amount, 0);
  const due = ch.filter(c => c.due_date <= today()).reduce((s, c) => s + +c.amount, 0); let cum = 0, oldest = null;
  for (const c of ch) { cum += +c.amount; if (c.due_date > today()) break; if (cum > paid + 0.5) { oldest = c.due_date; break; } }
  return { due, paid, bal: due - paid, oldest, late: oldest ? -daysTo(oldest) : 0, total: ch.reduce((s, c) => s + +c.amount, 0) };
}
async function renderOps() {
  const O = S.ops ||= { tab: 'dash', mall: '' };
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const q = t => S.sb.from(t).select('*'), [m, u, t, l, c, p, ow, os, ld] = await Promise.all([q('malls').order('sort'), q('mall_units').order('sort').order('code'), q('tenants').order('name'), q('leases').order('start_date'), q('lease_charges').order('due_date'), q('lease_payments').order('pay_date'), q('unit_owners').order('name'), q('unit_ownership'), q('leads').order('created_at')]);
  const err = [m, u, t, l, c, p, ow, os, ld].find(x => x.error); if (err) return $('#main').innerHTML = `<div class="note">${esc(err.error.message)}</div>`;
  Object.assign(O, { M: m.data, U: u.data, T: t.data, L: l.data, C: c.data, P: p.data, W: ow.data, WS: os.data, LD: ld.data }); drawOps();
}
function drawOps() {
  document.body.classList.toggle('opsro', !S.opsEdit);
  const O = S.ops, { M, T, C, P } = O, inM = x => !O.mall || x.mall_id === O.mall, U = O.U.filter(inM), uOf = id => O.U.find(x => x.id === id), tOf = id => T.find(x => x.id === id), mOf = id => M.find(x => x.id === id);
  const L = O.L.filter(x => U.some(y => y.id === x.unit_id)), act = L.filter(x => x.status === 'active'), lOfU = id => act.find(x => x.unit_id === id);
  const B = Object.fromEntries(L.map(x => [x.id, leaseBal(x, C, P)]));
  if (!M.length && !S.opsEdit) { $('#main').innerHTML = '<div class="note">لسه مفيش مولات متسجلة.</div>'; return; }
  if (!M.length) { $('#main').innerHTML = `<div class="card" style="max-width:560px"><h3 style="margin-top:0">ابدأ بإضافة أول مول</h3><form id="mF" class="grid"><label class="wide">اسم المول<input name="name" required></label><label class="wide">المكان<input name="place"></label><div class="acts" style="margin:0"><button class="p">إضافة</button></div></form></div>`; return bindOpsMall(); }
  const area = U.reduce((s, x) => s + areaIn(x), 0), leasedU = U.filter(x => x.status === 'leased'), leasedA = leasedU.reduce((s, x) => s + areaIn(x), 0), roll = act.reduce((s, x) => s + curRent(x, C) + (+x.service_fee || 0), 0);
  const arr = act.concat(L.filter(x => x.status === 'ended')).filter(x => B[x.id].bal > 0.5), arrT = arr.reduce((s, x) => s + B[x.id].bal, 0), ending = act.filter(x => daysTo(x.end_date) <= 90).sort((a, b) => a.end_date.localeCompare(b.end_date));
  const tabs = [['dash', '📊 لوحة الأداء'], ['units', `🏬 الوحدات (${U.length})`], ['leases', `📝 العقود (${act.length})`], ['coll', `💰 التحصيل${arr.length ? ` (${arr.length})` : ''}`], ['clients', `👥 العملاء (${O.W.length + T.length + O.LD.filter(x => !['won', 'lost'].includes(x.status)).length})`], ['wait', `⏳ قائمة الانتظار (${O.LD.filter(x => ['waiting', 'contacted', 'offered'].includes(x.status)).length})`]];
  const unitTile = x => { const ls = lOfU(x.id), b = ls && B[ls.id], st = USTAT[x.status]; return `<button type="button" class="utile${O.selMode ? ' selm' : ''}${O.sel?.has('u:' + x.id) ? ' sel' : ''}" data-unit="${x.id}" style="--c:${st[1]}">${O.selMode ? `<i class="ck">${O.sel.has('u:' + x.id) ? '✓' : ''}</i>` : ''}<div class="uh"><b>${esc(x.code)}</b><span>${st[0]}</span></div><div class="mut" style="font-size:12px">${x.duplex ? '' : esc(x.floor || '')}${areaTxt(x) ? (x.duplex ? '' : ' · ') + areaTxt(x) : ''}${x.activity ? ' · ' + esc(x.activity) : ''}</div>${ownersOf(x.id).length ? `<div class="uown">👤 ${ownersOf(x.id).map(o => esc(o.name)).join('، ')}</div>` : ''}${ls ? `<div class="ut">${esc(tOf(ls.tenant_id)?.name || '')}</div><div class="mut" style="font-size:12px">${nf(curRent(ls, C), 0)} ج/شهر · لحد ${fmtD(ls.end_date)}</div>${b.bal > 0.5 ? `<div class="ubad">متأخرات ${nf(b.bal, 0)}</div>` : '<div class="uok">✓ منتظم</div>'}` : ''}${!ls && ['vacant', 'fitout'].includes(x.status) && waitFor(x).length ? `<div class="uwait">⏳ ${waitFor(x).length} في الانتظار</div>` : ''}</button>`; };
  let body = '';
  if (O.tab === 'dash') body = `<div class="kpis"><div class="kpi"><b>${U.length ? Math.round(leasedU.length / U.length * 100) : 0}%</b><span>نسبة الإشغال (${leasedU.length}/${U.length} وحدة)${area ? ` · ${Math.round(leasedA / area * 100)}% من المساحة الداخلية` : ''}</span></div><div class="kpi k-ok"><b>${nf(roll, 0)}</b><span>الإيراد الشهري الحالي (إيجار + خدمات)</span></div><div class="kpi${arrT > 0 ? ' k-bad' : ''}"><b>${nf(arrT, 0)}</b><span>متأخرات على ${arr.length} عقد</span></div><div class="kpi${ending.length ? ' k-warn' : ''}"><b>${ending.length}</b><span>عقود بتخلص خلال 90 يوم</span></div></div>
    <div class="two2"><div class="card"><b>أكبر المتأخرات</b>${arr.length ? `<table class="whyt"><tbody>${arr.sort((a, b) => B[b.id].bal - B[a.id].bal).slice(0, 8).map(x => `<tr class="pick" data-lease="${x.id}"><td><b>${esc(uOf(x.unit_id)?.code)}</b> ${esc(tOf(x.tenant_id)?.name || '')}</td><td class="n">${B[x.id].late} يوم</td><td class="n" style="color:var(--bad)"><b>${nf(B[x.id].bal, 0)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="mut">✓ مفيش متأخرات.</p>'}</div>
    <div class="card"><b>عقود قربت تخلص</b>${ending.length ? `<table class="whyt"><tbody>${ending.slice(0, 8).map(x => `<tr class="pick" data-lease="${x.id}"><td><b>${esc(uOf(x.unit_id)?.code)}</b> ${esc(tOf(x.tenant_id)?.name || '')}</td><td>${fmtD(x.end_date)}</td><td class="n" style="color:${daysTo(x.end_date) < 0 ? 'var(--bad)' : 'var(--warn)'}">${daysTo(x.end_date) < 0 ? 'خلص من ' + -daysTo(x.end_date) + ' يوم' : 'باقي ' + daysTo(x.end_date) + ' يوم'}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">مفيش عقود بتخلص قريب.</p>'}</div></div>
    <div class="card" style="margin-top:12px"><b>حالة الوحدات</b><div class="ustrip">${Object.entries(USTAT).map(([k, [l, c]]) => { const n = U.filter(x => x.status === k).length; return n ? `<div style="flex:${n};background:${c}" title="${l}: ${n}">${l} ${n}</div>` : ''; }).join('')}</div></div>`;
  else if (O.tab === 'units') { const fl = [...new Set(U.map(x => x.floor || '—'))];
    body = `<div class="acts" style="margin-top:0"><button id="uAdd" class="p">+ وحدة</button><label class="btn" style="margin:0">⬆ استيراد وحدات من إكسل<input id="uImp" type="file" accept=".xlsx,.xls,.csv" hidden></label><button type="button" id="selT" class="${O.selMode ? 'p' : ''}">${O.selMode ? 'إنهاء التحديد' : '☑ تحديد متعدد'}</button>${!O.mall && M.length > 1 ? '<span class="mut">اختار المول من فوق عشان تضيف وحدات</span>' : ''}</div>
      ${U.length ? fl.map(f => `<div class="tsub">${esc(f)} <span class="mut">(${U.filter(x => (x.floor || '—') === f).length})</span>${O.selMode ? ` <a href="#" data-selall="${esc(f)}">تحديد الدور</a>` : ''}</div><div class="ugrid">${U.filter(x => (x.floor || '—') === f).map(unitTile).join('')}</div>`).join('') : '<p class="mut">لسه مفيش وحدات. ضيفها واحدة واحدة أو ارفع شيت إكسل فيه أعمدة: الوحدة، الدور، المساحة الداخلية، المساحة الخارجية، النوع، النشاط.</p>'}`; }
  else if (O.tab === 'leases') body = `<div class="acts" style="margin-top:0"><button id="lAdd" class="p">+ عقد جديد</button></div>${L.length ? `<div class="scroll"><table class="stack"><thead><tr><th>الوحدة</th><th>المستأجر</th><th>المدة</th><th class="n">الإيجار الشهري الحالي</th><th>السداد</th><th class="n">المستحق لحد النهارده</th><th class="n">المدفوع</th><th class="n">الرصيد</th></tr></thead><tbody>${[...L].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || a.end_date.localeCompare(b.end_date)).map(x => { const b = B[x.id], dt = daysTo(x.end_date);
      return `<tr class="pick${x.status === 'ended' ? ' mutr' : ''}" data-lease="${x.id}"><td data-l="الوحدة"><b>${esc(uOf(x.unit_id)?.code)}</b>${!O.mall ? ` <span class="tag">${esc(mOf(uOf(x.unit_id)?.mall_id)?.name || '')}</span>` : ''}</td><td data-l="المستأجر">${esc(tOf(x.tenant_id)?.name || '')}</td><td data-l="المدة">${fmtD(x.start_date)} ← ${fmtD(x.end_date)}${x.status === 'ended' ? ' <span class="tag">منتهي</span>' : dt <= 90 ? ` <span class="tag" style="color:var(--warn)">${dt < 0 ? 'خلص' : 'باقي ' + dt + ' يوم'}</span>` : ''}</td><td class="n" data-l="الإيجار">${nf(curRent(x, C), 0)}</td><td data-l="السداد">${PEV[x.pay_every]}${+x.escalation_pct ? ` · زيادة ${x.escalation_pct}%` : ''}</td><td class="n" data-l="المستحق">${nf(b.due, 0)}</td><td class="n" data-l="المدفوع">${nf(b.paid, 0)}</td><td class="n" data-l="الرصيد"><b style="color:${b.bal > 0.5 ? 'var(--bad)' : 'var(--ok)'}">${nf(b.bal, 0)}</b></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mut">لسه مفيش عقود.</p>'}`;
  else if (O.tab === 'clients') body = clientsPane(U, B);
  else if (O.tab === 'wait') body = waitPane();
  else if (O.tab === 'owners') body = ownersPane(U, B);
  else if (O.tab === 'tenants') body = tenantsPane(B);
  else body = arr.length ? `<div class="vlist">${arr.sort((a, b) => B[b.id].late - B[a.id].late).map(x => { const b = B[x.id], tn = tOf(x.tenant_id), un = uOf(x.unit_id);
      const msg = encodeURIComponent(`السلام عليكم ${tn?.name || ''}،\nنفيدكم بوجود مستحقات على وحدة ${un?.code || ''} بـ${mOf(un?.mall_id)?.name || ''} بقيمة ${nf(b.bal, 0)} جنيه، مستحقة من ${fmtD(b.oldest)}.\nبرجاء السداد في أقرب وقت. شكراً.`);
      const wa = tn?.phone ? (d => d.startsWith('0') ? '20' + d.slice(1) : d)(String(tn.phone).replace(/\D/g, '')) : '';
      return `<div class="vrow"><div style="flex:1;min-width:0"><b>${esc(un?.code)} – ${esc(tn?.name || '')}</b>${!O.mall ? ` <span class="tag">${esc(mOf(un?.mall_id)?.name || '')}</span>` : ''}<div class="mut" style="font-size:12px">متأخر من ${fmtD(b.oldest)} (${b.late} يوم) · مستحق ${nf(b.due, 0)} · مدفوع ${nf(b.paid, 0)}</div></div><b style="color:var(--bad);font-size:18px">${nf(b.bal, 0)}</b><div class="vacts"><button type="button" class="p" data-pay="${x.id}">تسجيل دفعة</button>${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${msg}">واتساب تذكير</a>` : ''}<button type="button" data-lease="${x.id}">كشف حساب</button></div></div>`; }).join('')}</div>` : '<div class="note">✓ مفيش متأخرات – كل العقود منتظمة.</div>';
  $('#main').innerHTML = `<div class="sttabs" style="margin-top:0"><div class="seg"><button type="button" data-mall="" class="${!O.mall ? 'on' : ''}">كل المولات</button>${M.map(x => `<button type="button" data-mall="${x.id}" class="${O.mall === x.id ? 'on' : ''}">${esc(x.name)}</button>`).join('')}<button type="button" id="mAdd">+ مول</button></div></div>
  ${O.mall ? `<p class="mut" style="margin:6px 0 0">${esc(mOf(O.mall)?.place || '')} · <a href="#" id="mEd">تعديل بيانات المول</a></p>` : ''}
  <div class="sttabs"><div class="seg">${tabs.map(([k, l]) => `<button type="button" data-otab="${k}" class="${O.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div style="margin-top:12px">${body}</div>`;
  document.querySelectorAll('[data-mall]').forEach(b => b.onclick = () => { O.mall = b.dataset.mall; drawOps(); });
  document.querySelectorAll('[data-otab]').forEach(b => b.onclick = () => { O.tab = b.dataset.otab; O.selMode = false; O.sel = new Set(); drawOps(); });
  O.sel ||= new Set(); selBar();
  $('#mAdd').onclick = () => mallEdit(null); $('#mEd') && ($('#mEd').onclick = e => { e.preventDefault(); mallEdit(mOf(O.mall)); });
  $('#uAdd') && ($('#uAdd').onclick = () => { if (!O.mall && M.length > 1) return toast('اختار المول الأول'); unitEdit({ mall_id: O.mall || M[0].id, status: 'vacant' }); });
  $('#lAdd') && ($('#lAdd').onclick = () => leaseEdit({}));
  $('#uImp') && ($('#uImp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; importUnits(f, O.mall); });
  $('#main').onclick = e => {
    if (e.target.closest('#selT')) { O.selMode = !O.selMode; O.sel = new Set(); return drawOps(); }
    const sa = e.target.closest('[data-selall]'); if (sa) { e.preventDefault(); const L = U.filter(x => (x.floor || '—') === sa.dataset.selall), all = L.every(x => O.sel.has('u:' + x.id)); L.forEach(x => all ? O.sel.delete('u:' + x.id) : O.sel.add('u:' + x.id)); return drawOps(); }
    const sv = e.target.closest('[data-selvis]'); if (sv) { e.preventDefault(); const K = sv.dataset.selvis.split(','), all = K.every(k => O.sel.has(k)); K.forEach(k => all ? O.sel.delete(k) : O.sel.add(k)); return drawOps(); }
    const pk = e.target.closest('[data-pick]'); if (pk) { const k = pk.dataset.pick; O.sel.has(k) ? O.sel.delete(k) : O.sel.add(k); return drawOps(); }
    if (O.selMode && e.target.closest('[data-unit]')) { const k = 'u:' + e.target.closest('[data-unit]').dataset.unit; O.sel.has(k) ? O.sel.delete(k) : O.sel.add(k); return drawOps(); }
    const un = e.target.closest('[data-unit]'), ls = e.target.closest('[data-lease]'), py = e.target.closest('[data-pay]');
    const ow = e.target.closest('[data-owner]'), tn = e.target.closest('[data-tenant]');
    if (e.target.closest('#owAdd')) return ownerEdit({}); if (e.target.closest('#tnAdd')) return tenantEdit({});
    const ca = e.target.closest('[data-cadd]'); if (ca) { const k = ca.dataset.cadd; return k === 'owner' ? ownerEdit({}) : k === 'tenant' ? tenantEdit({}) : leadEdit({ kind: k }); }
    const cf = e.target.closest('[data-cf]'); if (cf) { O.cf = cf.dataset.cf; return drawOps(); } const ld = e.target.closest('[data-lead]'); if (ld) return leadView(ld.dataset.lead);
    if (ow) return ownerView(ow.dataset.owner); if (tn) return tenantView(tn.dataset.tenant);
    if (py) return payEdit(py.dataset.pay); if (ls) return leaseView(ls.dataset.lease); if (un) return unitEdit(O.U.find(x => x.id === un.dataset.unit)); };
  $('#owImp') && ($('#owImp').onchange = e => importOwners(e.target.files[0]));
  $('#owQ') && ($('#owQ').onchange = e => { O.oq = e.target.value.trim(); drawOps(); }); $('#tnQ') && ($('#tnQ').onchange = e => { O.tq = e.target.value.trim(); drawOps(); }); $('#clQ') && ($('#clQ').onchange = e => { O.cq = e.target.value.trim(); drawOps(); });
}
function bindOpsMall() { const f = $('#mF'); if (f) f.onsubmit = async e => { e.preventDefault(); const { error } = await S.sb.from('malls').insert({ name: f.name.value.trim(), place: f.place.value.trim() || null }); if (error) return toast(error.message); renderOps(); }; }
function odlg(html, wide) { const d = document.createElement('dialog'); d.className = 'adlg' + (wide ? ' wide' : ''); d.innerHTML = html; document.body.append(d); d.showModal(); const close = () => { d.close(); d.remove(); }; d.addEventListener('click', e => { if (e.target === d || e.target.closest('.dx')) close(); }); return { d, close }; }
function mallEdit(m) {
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">${m ? 'تعديل المول' : 'مول جديد'}</h3><button type="button" class="dx">✕</button></div><div class="grid"><label class="wide">الاسم<input name="name" required value="${esc(m?.name || '')}"></label><label class="wide">المكان<input name="place" value="${esc(m?.place || '')}"></label><label class="wide">ملاحظات<input name="notes" value="${esc(m?.notes || '')}"></label></div><div class="acts"><button class="p">حفظ</button></div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, row = { name: f.name.value.trim(), place: f.place.value.trim() || null, notes: f.notes.value.trim() || null };
    const { error } = m ? await S.sb.from('malls').update(row).eq('id', m.id) : await S.sb.from('malls').insert({ ...row, sort: S.ops.M.length }); if (error) return toast(error.message); close(); renderOps(); };
}
function unitEdit(u) {
  const O = S.ops, ls = u.id && O.L.filter(x => x.unit_id === u.id).sort((a, b) => b.start_date.localeCompare(a.start_date)), cur = ls && ls.find(x => x.status === 'active');
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">${u.id ? 'وحدة ' + esc(u.code) : 'وحدة جديدة'}</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label>رقم الوحدة<input name="code" required value="${esc(u.code || '')}"></label><label>الدور<input name="floor" list="flL" value="${esc(u.floor || '')}"><datalist id="flL">${[...new Set(O.U.map(x => x.floor).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>المساحة الداخلية م2<span class="dxl" ${u.duplex ? '' : 'hidden'}> (الدور الأساسي)</span><input name="area" type="number" step="any" value="${u.area ?? ''}"></label>
    <label class="wide chk"><input type="checkbox" name="duplex"${u.duplex ? ' checked' : ''}> دوبلكس – الوحدة على دورين</label>
    <label class="dx2" ${u.duplex ? '' : 'hidden'}>الدور التاني<input name="floor2" list="flL" value="${esc(u.floor2 || '')}"></label><label class="dx2" ${u.duplex ? '' : 'hidden'}>مساحة الدور التاني م2<input name="area2" type="number" step="any" value="${u.area2 ?? ''}"></label>
    <label class="wide chk"><input type="checkbox" name="hasout"${u.area_out ? ' checked' : ''}> ليها مساحة خارجية (تراس / سيتنج / واجهة)</label><label class="ox2" ${u.area_out ? '' : 'hidden'}>المساحة الخارجية م2<input name="area_out" type="number" step="any" value="${u.area_out ?? ''}"></label><label>نوع الوحدة<input name="utype" list="utL" value="${esc(u.utype || '')}"><datalist id="utL">${utypes().map(x => `<option value="${esc(x)}">`).join('')}</datalist></label><label>النشاط<input name="activity" value="${esc(u.activity || '')}"></label>
    <label>الحالة<select name="status">${Object.entries(USTAT).map(([k, [l]]) => `<option value="${k}"${u.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="wide">ملاحظات<input name="notes" value="${esc(u.notes || '')}"></label></div>
    <div class="acts"><button class="p">حفظ</button>${u.id ? (cur ? `<button type="button" data-open="${cur.id}">فتح العقد الحالي</button>` : '<button type="button" id="uNewL">+ عقد للوحدة</button>') : ''}${u.id && !(ls || []).length ? '<button type="button" class="danger" id="uDel">حذف</button>' : ''}</div>
    ${u.id ? `<h4>الملاك</h4>${ownersOf(u.id).length ? `<div class="vlist">${ownersOf(u.id).map(o => `<div class="vrow pick" data-vo="${o.id}"><b style="flex:1">${esc(o.name)}</b><span class="mut">${o.link.share_pct != 100 ? nf(o.link.share_pct) + '% · ' : ''}${o.phone ? esc(o.phone) : ''}${o.link.since ? ' · من ' + fmtD(o.link.since) : ''}</span></div>`).join('')}</div>` : '<p class="mut" style="margin:0">الوحدة ملك الشركة (مفيش مالك مسجل).</p>'}<div class="acts" style="margin-top:6px"><button type="button" id="uOwn">+ ربط مالك</button></div>` : ''}
    ${u.id && ['vacant', 'fitout'].includes(u.status) ? `<h4>قائمة الانتظار المناسبة للوحدة (${waitFor(u).length})</h4>${waitFor(u).length ? `<div class="vlist">${waitFor(u).map((x, k) => `<div class="vrow pick" data-vl="${x.id}"><span class="qn">${k + 1}</span><b style="flex:1">${esc(x.name)}</b><span class="mut" style="font-size:12px">${LK[x.kind]} · ${esc(x.utype || 'أي نوع')}${x.budget ? ' · ميزانية ' + nf(x.budget, 0) : ''} · من ${fmtD((x.created_at || today()).slice(0, 10))}</span></div>`).join('')}</div>` : '<p class="mut" style="margin:0">مفيش طلبات مطابقة.</p>'}` : ''}
    ${(ls || []).length ? `<h4>العقود</h4><div class="vlist">${ls.map(x => `<div class="vrow pick" data-open="${x.id}"><b style="flex:1">${esc(O.T.find(t => t.id === x.tenant_id)?.name || '')}</b><span class="mut">${fmtD(x.start_date)} ← ${fmtD(x.end_date)}</span>${x.status === 'ended' ? '<span class="tag">منتهي</span>' : ''}</div>`).join('')}</div>` : ''}</form>`);
  { const f = d.querySelector('form'), sy = () => { d.querySelectorAll('.dx2').forEach(x => x.hidden = !f.duplex.checked); d.querySelector('.dxl').hidden = !f.duplex.checked; d.querySelector('.ox2').hidden = !f.hasout.checked; }; f.duplex.onchange = f.hasout.onchange = sy; }
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, row = { mall_id: u.mall_id, code: f.code.value.trim(), floor: f.floor.value.trim() || null, area: f.area.value === '' ? null : +f.area.value, area_out: f.hasout.checked && f.area_out.value !== '' ? +f.area_out.value : null, duplex: f.duplex.checked, floor2: f.duplex.checked ? f.floor2.value.trim() || null : null, area2: f.duplex.checked && f.area2.value !== '' ? +f.area2.value : null, activity: f.activity.value.trim() || null, utype: f.utype.value.trim() || null, status: f.status.value, notes: f.notes.value.trim() || null };
    const { error } = u.id ? await S.sb.from('mall_units').update(row).eq('id', u.id) : await S.sb.from('mall_units').insert({ ...row, sort: O.U.length }); if (error) return toast(error.message.includes('duplicate') ? 'رقم الوحدة ده موجود في المول' : error.message); close(); renderOps(); };
  d.addEventListener('click', async e => { const o = e.target.closest('[data-open]'); if (o) { close(); return leaseView(o.dataset.open); } if (e.target.id === 'uNewL') { close(); return leaseEdit({ unit_id: u.id }); }
    const vo = e.target.closest('[data-vo]'); if (vo) { close(); return ownerView(vo.dataset.vo); } const vl = e.target.closest('[data-vl]'); if (vl) { close(); return leadView(vl.dataset.vl); } if (e.target.id === 'uOwn') { close(); return linkOwner({ unit_id: u.id }); }
    if (e.target.id === 'uDel') { if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('mall_units').delete().eq('id', u.id); if (error) return toast(error.message); close(); renderOps(); } });
}
function leaseEdit(L) {
  const O = S.ops, mOf = id => O.M.find(x => x.id === id)?.name || '', t = L.tenant_id && O.T.find(x => x.id === L.tenant_id);
  const uo = O.U.filter(x => !O.mall || x.mall_id === O.mall).map(x => `<option value="${x.id}"${x.id === L.unit_id ? ' selected' : ''}>${esc(x.code)}${O.M.length > 1 ? ' – ' + esc(mOf(x.mall_id)) : ''}${x.status === 'leased' && x.id !== L.unit_id ? ' (مؤجرة)' : ''}</option>`).join('');
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">${L.id ? 'تعديل العقد' : 'عقد إيجار جديد'}</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label>الوحدة<select name="unit" required>${uo}</select></label><label>المستأجر<input name="tn" required list="tnL" value="${esc(t?.name || '')}"><datalist id="tnL">${O.T.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></label><label>تليفون المستأجر<input name="tp" dir="ltr" value="${esc(t?.phone || '')}"></label>
    <label>بداية العقد<input name="sd" type="date" required value="${L.start_date || today()}"></label><label>نهاية العقد<input name="ed" type="date" required value="${L.end_date || DS(TD(addM(today(), 12)) - 864e5)}"></label>
    <label>الإيجار الشهري<input name="rent" type="number" step="any" required value="${L.rent ?? ''}"></label><label>السداد<select name="pe">${Object.entries(PEV).map(([k, l]) => `<option value="${k}"${+L.pay_every === +k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>الزيادة السنوية %<input name="esc" type="number" step="any" value="${L.escalation_pct ?? 0}"></label><label>الزيادة كل (شهر)<input name="every" type="number" value="${L.escalation_every ?? 12}"></label>
    <label>مصاريف خدمات شهرية<input name="svc" type="number" step="any" value="${L.service_fee ?? 0}"></label><label>التأمين<input name="dep" type="number" step="any" value="${L.deposit ?? 0}"></label><label class="wide">ملاحظات<input name="notes" value="${esc(L.notes || '')}"></label></div>
    <p class="mut" style="font-size:12px">الأقساط المستحقة بتتولد لوحدها من شروط العقد (الإيجار بالزيادة + الخدمات + التأمين). تعديل الشروط بيعيد توليد الأقساط، والمدفوعات مش بتتأثر.</p><div class="acts"><button class="p">حفظ</button></div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, b = e.submitter || f.querySelector('.p'); b.disabled = true;
    try {
      let tn = O.T.find(x => x.name === f.tn.value.trim());
      if (!tn) { const r = await S.sb.from('tenants').insert({ name: f.tn.value.trim(), phone: f.tp.value.trim() || null }).select().single(); if (r.error) throw r.error; tn = r.data; }
      else if (f.tp.value.trim() && f.tp.value.trim() !== tn.phone) await S.sb.from('tenants').update({ phone: f.tp.value.trim() }).eq('id', tn.id);
      const row = { unit_id: f.unit.value, tenant_id: tn.id, start_date: f.sd.value, end_date: f.ed.value, rent: +f.rent.value, pay_every: +f.pe.value, escalation_pct: +f.esc.value || 0, escalation_every: +f.every.value || 12, service_fee: +f.svc.value || 0, deposit: +f.dep.value || 0, notes: f.notes.value.trim() || null };
      if (row.end_date < row.start_date) throw new Error('نهاية العقد قبل بدايته');
      const r = L.id ? await S.sb.from('leases').update(row).eq('id', L.id).select().single() : await S.sb.from('leases').insert({ ...row, status: 'active' }).select().single(); if (r.error) throw r.error;
      await regenCharges(r.data); if (!L.id) await S.sb.from('mall_units').update({ status: 'leased' }).eq('id', row.unit_id);
      toast('اتحفظ العقد'); close(); await renderOps(); leaseView(r.data.id);
    } catch (er) { b.disabled = false; toast(er.message); } };
}
async function regenCharges(L) { const r1 = await S.sb.from('lease_charges').delete().eq('lease_id', L.id).in('kind', ['rent', 'service', 'deposit']); if (r1.error) throw r1.error; const rows = genCharges(L); for (let k = 0; k < rows.length; k += 300) { const r = await S.sb.from('lease_charges').insert(rows.slice(k, k + 300)); if (r.error) throw r.error; } }
function leaseView(id) {
  const O = S.ops, L = O.L.find(x => x.id === id); if (!L) return; const u = O.U.find(x => x.id === L.unit_id), t = O.T.find(x => x.id === L.tenant_id), m = O.M.find(x => x.id === u?.mall_id), b = leaseBal(L, O.C, O.P);
  const rows = [...O.C.filter(c => c.lease_id === id).map(c => ({ d: c.due_date, t: 'c', c })), ...O.P.filter(p => p.lease_id === id).map(p => ({ d: p.pay_date, t: 'p', p }))].sort((a, b) => a.d.localeCompare(b.d) || (a.t === 'c' ? -1 : 1));
  let run = 0; const st = rows.filter(r => r.t === 'p' || r.d <= addM(today(), 3)).map(r => { if (r.t === 'c') run += +r.c.amount; else run -= +r.p.amount; const fut = r.t === 'c' && r.d > today();
    return `<tr class="${fut ? 'mutr' : ''}"><td>${fmtD(r.d)}</td><td>${r.t === 'c' ? `${CHK[r.c.kind]}${r.c.period_from ? ` <span class="mut" style="font-size:12px">${fmtD(r.c.period_from)} – ${fmtD(r.c.period_to)}</span>` : ''}${r.c.note && r.c.kind === 'other' ? ' – ' + esc(r.c.note) : ''}${fut ? ' <span class="tag">لسه</span>' : ''}` : `<b style="color:var(--ok)">دفعة</b> ${esc([r.p.method, r.p.ref, r.p.notes].filter(Boolean).join(' · '))} <button type="button" class="danger xs" data-pdel="${r.p.id}">✕</button>`}</td><td class="n">${r.t === 'c' ? nf(r.c.amount, 0) : ''}</td><td class="n" style="color:var(--ok)">${r.t === 'p' ? nf(r.p.amount, 0) : ''}</td><td class="n">${fut ? '' : nf(run, 0)}</td></tr>`; }).join('');
  const { d, close } = odlg(`<div class="dh"><div><h3 style="margin:0">${esc(u?.code || '')} – <a href="#" data-gotn="${t?.id}">${esc(t?.name || '')}</a></h3>${ownersOf(L.unit_id).length ? `<div class="mut" style="font-size:12px">المالك: ${ownersOf(L.unit_id).map(o => esc(o.name)).join('، ')}</div>` : ''}<div class="mut" style="font-size:13px">${esc(m?.name || '')} · ${fmtD(L.start_date)} ← ${fmtD(L.end_date)} · ${PEV[L.pay_every]} · الإيجار الحالي ${nf(curRent(L, O.C), 0)} ج/شهر${+L.escalation_pct ? ` · زيادة ${L.escalation_pct}% كل ${L.escalation_every} شهر` : ''}${L.status === 'ended' ? ' · <b>منتهي ' + fmtD(L.ended_on) + '</b>' : ''}</div></div><button type="button" class="dx">✕</button></div>
    <div class="why-f"><div><span>المستحق لحد النهارده</span><b>${nf(b.due, 0)}</b></div><i>−</i><div><span>المدفوع</span><b>${nf(b.paid, 0)}</b></div><i>=</i><div class="${b.bal > 0.5 ? 'bad' : 'ok'}"><span>${b.bal > 0.5 ? 'متأخرات' : b.bal < -0.5 ? 'رصيد مقدم' : 'منتظم'}</span><b>${nf(Math.abs(b.bal), 0)}</b></div>${b.oldest ? `<div><span>متأخر من</span><b style="font-size:15px">${fmtD(b.oldest)}</b></div>` : ''}</div>
    <div class="acts"><button type="button" class="p" data-pay="${id}">+ تسجيل دفعة</button><button type="button" id="lOther">+ مستحق إضافي</button><button type="button" id="lEdit">تعديل العقد</button>${L.status === 'active' ? '<button type="button" id="lEnd">إنهاء العقد</button>' : ''}<button type="button" id="lPrint">🖨 كشف حساب</button></div>
    <h4>كشف الحساب</h4><div class="scroll" style="max-height:50vh;overflow:auto"><table class="whyt"><thead><tr><th>التاريخ</th><th>البيان</th><th class="n">مستحق</th><th class="n">مدفوع</th><th class="n">الرصيد</th></tr></thead><tbody>${st || '<tr><td colspan="5" class="mut">–</td></tr>'}</tbody></table></div><p class="mut" style="font-size:12px">ظاهر المستحقات لحد 3 شهور قدام. إجمالي قيمة العقد ${nf(b.total, 0)}.</p>`, true);
  d.addEventListener('click', async e => {
    if (e.target.closest('[data-pay]')) { close(); return payEdit(id); }
    const gt = e.target.closest('[data-gotn]'); if (gt) { e.preventDefault(); close(); return tenantView(gt.dataset.gotn); }
    if (e.target.id === 'lEdit') { close(); return leaseEdit(L); }
    if (e.target.id === 'lPrint') return printStatement(L, u, t, m, rows, b);
    if (e.target.id === 'lOther') { const a = prompt('قيمة المستحق الإضافي (مثلاً غرامة أو كهرباء)'); if (!a) return; const n = prompt('البيان', 'كهرباء'); const r = await S.sb.from('lease_charges').insert({ lease_id: id, due_date: today(), kind: 'other', amount: +a, note: n || null }); if (r.error) return toast(r.error.message); close(); await renderOps(); return leaseView(id); }
    if (e.target.id === 'lEnd') { const dt = prompt('تاريخ إنهاء العقد (YYYY-MM-DD)', today()); if (!dt) return; const r = await S.sb.from('leases').update({ status: 'ended', ended_on: dt }).eq('id', id).select().single(); if (r.error) return toast(r.error.message); try { await regenCharges(r.data); } catch (er) { return toast(er.message); } await S.sb.from('mall_units').update({ status: 'vacant' }).eq('id', L.unit_id); toast('اتنهى العقد والوحدة بقت فاضية'); close(); return renderOps(); }
    const pd = e.target.closest('[data-pdel]'); if (pd) { if (pd.dataset.sure !== '1') { pd.dataset.sure = '1'; pd.textContent = 'متأكد؟'; return; } const r = await S.sb.from('lease_payments').delete().eq('id', pd.dataset.pdel); if (r.error) return toast(r.error.message); close(); await renderOps(); leaseView(id); }
  });
}
function payEdit(id) {
  const O = S.ops, L = O.L.find(x => x.id === id), b = leaseBal(L, O.C, O.P), u = O.U.find(x => x.id === L.unit_id);
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">دفعة – ${esc(u?.code || '')} ${esc(O.T.find(x => x.id === L.tenant_id)?.name || '')}</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label>المبلغ<input name="a" type="number" step="any" required value="${b.bal > 0 ? Math.round(b.bal) : ''}"></label><label>التاريخ<input name="d" type="date" value="${today()}"></label>
    <label>الطريقة<select name="m"><option>تحويل بنكي</option><option>كاش</option><option>شيك</option><option>انستاباي</option></select></label><label>رقم الإيصال / الشيك<input name="r"></label><label class="wide">ملاحظات<input name="n"></label></div><div class="acts"><button class="p">تسجيل</button></div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target; const r = await S.sb.from('lease_payments').insert({ lease_id: id, amount: +f.a.value, pay_date: f.d.value || today(), method: f.m.value, ref: f.r.value.trim() || null, notes: f.n.value.trim() || null });
    if (r.error) return toast(r.error.message); toast('اتسجلت الدفعة'); close(); await renderOps(); leaseView(id); };
}
function printStatement(L, u, t, m, rows, b) {
  let run = 0; const tr = rows.filter(r => r.t === 'p' || r.d <= today()).map(r => { if (r.t === 'c') run += +r.c.amount; else run -= +r.p.amount; return `<tr><td>${fmtD(r.d)}</td><td>${r.t === 'c' ? CHK[r.c.kind] + (r.c.period_from ? ` (${fmtD(r.c.period_from)} – ${fmtD(r.c.period_to)})` : '') + (r.c.kind === 'other' && r.c.note ? ' – ' + esc(r.c.note) : '') : 'دفعة ' + esc([r.p.method, r.p.ref].filter(Boolean).join(' – '))}</td><td>${r.t === 'c' ? nf(r.c.amount, 0) : ''}</td><td>${r.t === 'p' ? nf(r.p.amount, 0) : ''}</td><td>${nf(run, 0)}</td></tr>`; }).join('');
  const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ${esc(u?.code || '')}</title><base href="${location.href.split('#')[0]}"><style>@page{size:A4;margin:14mm}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;font-size:13px;color:#111}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f26b1d;padding-bottom:8px}.logo .lk{display:none}.logo img{height:48px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1b1c1e;color:#fff;padding:6px}td{border-bottom:1px solid #ddd;padding:5px;text-align:center}td:nth-child(2){text-align:right}.tot{margin-top:12px;font-size:16px;font-weight:700}</style></head><body>
  <div class="top"><div><h2 style="margin:0">كشف حساب مستأجر</h2><div>${esc(m?.name || '')} – وحدة ${esc(u?.code || '')}</div><div>المستأجر: <b>${esc(t?.name || '')}</b> · العقد ${fmtD(L.start_date)} – ${fmtD(L.end_date)}</div><div>حتى ${fmtD(today())}</div></div>${LOGO()}</div>
  <table><thead><tr><th>التاريخ</th><th>البيان</th><th>مستحق</th><th>مدفوع</th><th>الرصيد</th></tr></thead><tbody>${tr}</tbody></table>
  <div class="tot">${b.bal > 0.5 ? `المستحق على المستأجر: <span style="color:#b3261e">${nf(b.bal, 0)} جنيه</span>` : 'لا توجد مستحقات متأخرة'}</div><script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`); w.document.close();
}
/* bulk select: units & clients */
function selBar() {
  const O = S.ops; document.querySelector('.selbar')?.remove(); if (!O.selMode || !O.sel.size) return;
  const K = [...O.sel], units = K.filter(k => k.startsWith('u:')).length, leads = K.filter(k => /^(rent|buy):/.test(k)).length, others = K.length - units;
  const bar = document.createElement('div'); bar.className = 'selbar';
  bar.innerHTML = `<b>${K.length} محدد</b>${units ? '<button type="button" id="bEd" class="p">تعديل جماعي</button>' : ''}${leads ? '<button type="button" id="bSt">تغيير حالة الطلبات</button>' : ''}<button type="button" id="bDel" class="danger">حذف</button><button type="button" id="bClr">إلغاء التحديد</button>`;
  document.body.append(bar);
  bar.querySelector('#bClr').onclick = () => { O.sel = new Set(); drawOps(); };
  bar.querySelector('#bEd') && (bar.querySelector('#bEd').onclick = bulkUnitEdit);
  bar.querySelector('#bSt') && (bar.querySelector('#bSt').onclick = bulkLeadStatus);
  bar.querySelector('#bDel').onclick = bulkDelete;
}
function bulkUnitEdit() {
  const O = S.ops, ids = [...O.sel].filter(k => k.startsWith('u:')).map(k => k.slice(2));
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">تعديل ${ids.length} وحدة مرة واحدة</h3><button type="button" class="dx">✕</button></div><p class="mut" style="font-size:13px;margin-top:0">املا بس الخانات اللي عاوز تغيّرها – الفاضي بيفضل زي ما هو في كل وحدة.</p><div class="grid">
    <label>الدور<input name="floor" list="flLb"><datalist id="flLb">${[...new Set(O.U.map(x => x.floor).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>نوع الوحدة<input name="utype" list="utLb"><datalist id="utLb">${utypes().map(x => `<option value="${esc(x)}">`).join('')}</datalist></label><label>النشاط<input name="activity"></label>
    <label>الحالة<select name="status"><option value="">— زي ما هي —</option>${Object.entries(USTAT).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label>المساحة الداخلية م2<input name="area" type="number" step="any"></label><label>المساحة الخارجية م2<input name="area_out" type="number" step="any"></label>
    ${O.M.length > 1 ? `<label>نقل لمول<select name="mall"><option value="">— زي ما هي —</option>${O.M.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>` : ''}<label class="wide">ملاحظات<input name="notes"></label></div>
    <div class="acts"><button class="p">تطبيق على ${ids.length} وحدة</button></div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, row = {};
    ['floor', 'utype', 'activity', 'notes'].forEach(k => { if (f[k].value.trim()) row[k] = f[k].value.trim(); }); ['area', 'area_out'].forEach(k => { if (f[k].value !== '') row[k] = +f[k].value; });
    if (f.status.value) row.status = f.status.value; if (f.mall && f.mall.value) row.mall_id = f.mall.value;
    if (!Object.keys(row).length) return toast('مفيش حاجة اتغيرت'); const { error } = await S.sb.from('mall_units').update(row).in('id', ids);
    if (error) return toast(error.message.includes('duplicate') ? 'فيه رقم وحدة متكرر في المول اللي بتنقل له' : error.message); toast(`✓ اتعدلت ${ids.length} وحدة`); close(); O.sel = new Set(); renderOps(); };
}
function bulkLeadStatus() {
  const O = S.ops, ids = [...O.sel].filter(k => /^(rent|buy):/.test(k)).map(k => k.split(':')[1]);
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">حالة ${ids.length} طلب</h3><button type="button" class="dx">✕</button></div><div class="grid"><label class="wide">الحالة الجديدة<select name="st">${Object.entries(LST).map(([k, [, t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div><div class="acts"><button class="p">تطبيق</button></div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const { error } = await S.sb.from('leads').update({ status: e.target.st.value, updated_at: new Date().toISOString() }).in('id', ids); if (error) return toast(error.message); toast('✓ اتحدثت الحالة'); close(); O.sel = new Set(); renderOps(); };
}
async function bulkDelete() {
  const O = S.ops, K = [...O.sel], g = p => K.filter(k => k.startsWith(p + ':')).map(k => k.split(':')[1]);
  const U = g('u'), W = g('owner'), Tn = g('tenant'), Ld = [...g('rent'), ...g('buy')];
  const uBlock = U.filter(id => O.L.some(l => l.unit_id === id)), tBlock = Tn.filter(id => O.L.some(l => l.tenant_id === id));
  const U2 = U.filter(id => !uBlock.includes(id)), T2 = Tn.filter(id => !tBlock.includes(id)), total = U2.length + W.length + T2.length + Ld.length;
  const { d, close } = odlg(`<div class="dh"><h3 style="margin:0">حذف ${total} عنصر</h3><button type="button" class="dx">✕</button></div>
    <ul style="margin:6px 0;padding-inline-start:18px">${U2.length ? `<li>${U2.length} وحدة</li>` : ''}${W.length ? `<li>${W.length} مالك (وربطهم بالوحدات)</li>` : ''}${T2.length ? `<li>${T2.length} مستأجر</li>` : ''}${Ld.length ? `<li>${Ld.length} طلب إيجار/شراء</li>` : ''}</ul>
    ${uBlock.length || tBlock.length ? `<div class="note">مش هيتمسح – عليهم عقود (امسح العقود أو أنهيها الأول): ${[...uBlock.map(id => O.U.find(u => u.id === id)?.code), ...tBlock.map(id => O.T.find(t => t.id === id)?.name)].map(esc).join('، ')}</div>` : ''}
    <p style="color:var(--bad)">الحذف نهائي ومش هيترجع.</p><div class="acts">${total ? `<button type="button" class="danger" id="bGo">حذف ${total} نهائياً</button>` : ''}<button type="button" class="dx">إلغاء</button></div>`);
  d.querySelector('#bGo') && (d.querySelector('#bGo').onclick = async () => { const errs = [];
    for (const [t, ids] of [['leads', Ld], ['unit_owners', W], ['tenants', T2], ['mall_units', U2]]) if (ids.length) { const { error } = await S.sb.from(t).delete().in('id', ids); if (error) errs.push(error.message); }
    if (errs.length) toast('حصلت مشكلة: ' + errs[0]); else toast(`✓ اتمسح ${total} عنصر`); close(); O.sel = new Set(); O.selMode = false; renderOps(); });
}
/* clients (CRM): owners, tenants, rent/buy prospects + waiting list by unit type */
const LK = { rent: 'طالب إيجار', buy: 'طالب شراء' }, LST = { waiting: ['pend', 'في الانتظار'], contacted: ['run', 'اتواصلنا'], offered: ['run', 'اتعرض عليه وحدة'], won: ['appr', 'اتعاقد'], lost: ['ret', 'مش مهتم'] };
const CTYPE = { owner: ['مالك', '#7a4fb3'], tenant: ['مستأجر', '#1d7a4f'], rent: ['طالب إيجار', '#c98a12'], buy: ['طالب شراء', '#2e6f9e'] };
const utypes = () => [...new Set(['محل تجاري', 'مكتب إداري', 'عيادة', 'مطعم / كافيه', 'فود كورت', 'كشك', 'مخزن', 'بنك / خدمات', ...(S.ops?.U || []).map(u => u.utype), ...(S.ops?.LD || []).map(l => l.utype)].filter(Boolean))];
function leadFits(l, u) {
  if (l.unit_id) return l.unit_id === u.id;
  if (l.mall_id && l.mall_id !== u.mall_id) return false; if (l.utype && u.utype && l.utype !== u.utype) return false; if (l.floor && u.floor && l.floor !== u.floor && l.floor !== u.floor2) return false;
  if (l.area_min && areaIn(u) && areaIn(u) < +l.area_min) return false; if (l.area_max && areaIn(u) && areaIn(u) > +l.area_max) return false; return true;
}
const unitFree = (u, kind) => kind === 'buy' ? !ownersOf(u.id).length && u.status !== 'owner' : ['vacant', 'fitout'].includes(u.status) && !S.ops.L.some(x => x.unit_id === u.id && x.status === 'active');
const openLead = l => ['waiting', 'contacted', 'offered'].includes(l.status);
const waitFor = u => (S.ops.LD || []).filter(l => openLead(l) && unitFree(u, l.kind) && leadFits(l, u));
const matchUnits = l => S.ops.U.filter(u => unitFree(u, l.kind) && leadFits(l, u));
function clientsPane(U, B) {
  const O = S.ops, f = O.cf || 'all', q = O.cq || '', act = O.L.filter(x => x.status === 'active');
  const rows = [
    ...O.W.map(o => ({ t: 'owner', id: o.id, name: o.name, phone: o.phone, sub: unitsOfOwner(o.id).map(u => u.code).join('، ') || 'مش مربوط بوحدة', att: 'data-owner' })),
    ...O.T.map(t => { const ls = act.filter(l => l.tenant_id === t.id), bal = O.L.filter(l => l.tenant_id === t.id).reduce((s, l) => s + leaseBal(l, O.C, O.P).bal, 0); return { t: 'tenant', id: t.id, name: t.name, phone: t.phone, sub: (ls.map(l => O.U.find(u => u.id === l.unit_id)?.code).join('، ') || 'مفيش عقد ساري') + (bal > 0.5 ? ` · <b style="color:var(--bad)">متأخرات ${nf(bal, 0)}</b>` : ''), att: 'data-tenant' }; }),
    ...O.LD.map(l => ({ t: l.kind, id: l.id, name: l.name, phone: l.phone, sub: `${l.unit_id ? 'وحدة ' + esc(O.U.find(u => u.id === l.unit_id)?.code || '') : esc(l.utype || 'أي نوع')}${l.area_min || l.area_max ? ` · ${l.area_min || 0}–${l.area_max || '∞'} م2` : ''}${l.budget ? ' · ' + nf(l.budget, 0) + (l.kind === 'rent' ? ' ج/شهر' : ' ج') : ''} · <span class="st ${LST[l.status][0]}">${LST[l.status][1]}</span>${openLead(l) && matchUnits(l).length ? ` · <b style="color:var(--ok)">${matchUnits(l).length} وحدة مناسبة متاحة</b>` : ''}`, att: 'data-lead', closed: !openLead(l) }))
  ].filter(r => (f === 'all' ? !r.closed : f === 'closed' ? r.closed : r.t === f && !r.closed) && (!q || (r.name + ' ' + (r.phone || '') + ' ' + r.sub).includes(q)));
  const cnt = k => k === 'all' ? null : k === 'closed' ? O.LD.filter(l => !openLead(l)).length : k === 'owner' ? O.W.length : k === 'tenant' ? O.T.length : O.LD.filter(l => l.kind === k && openLead(l)).length;
  return `<div class="filters" style="margin-top:0"><input id="clQ" type="search" placeholder="بحث بالاسم أو التليفون أو الوحدة" value="${esc(q)}"><div class="addm"><button type="button" class="p">+ عميل</button><div class="addmenu">${Object.entries(CTYPE).map(([k, [l, c]]) => `<button type="button" data-cadd="${k}"><i style="background:${c}"></i>${l}</button>`).join('')}</div></div><label class="btn" style="margin:0">⬆ استيراد ملاك<input id="owImp" type="file" accept=".xlsx,.xls,.csv" hidden></label><button type="button" id="selT" class="${O.selMode ? 'p' : ''}">${O.selMode ? 'إنهاء التحديد' : '☑ تحديد متعدد'}</button></div>
  <div class="cfilt">${[['all', 'الكل'], ...Object.entries(CTYPE).map(([k, [l]]) => [k, l]), ['closed', 'طلبات مقفولة']].map(([k, l]) => `<button type="button" data-cf="${k}" class="${f === k ? 'on' : ''}"${CTYPE[k] ? ` style="--c:${CTYPE[k][1]}"` : ''}>${l}${cnt(k) != null ? ` <small>${cnt(k)}</small>` : ''}</button>`).join('')}</div>
  ${O.selMode && rows.length ? `<p style="margin:0 0 6px"><a href="#" data-selvis="${rows.map(r => r.t + ':' + r.id).join(',')}">تحديد كل الظاهر (${rows.length})</a></p>` : ''}${rows.length ? `<div class="vlist">${rows.map(r => `<button type="button" class="vrow crow${O.sel?.has(r.t + ':' + r.id) ? ' sel' : ''}" ${O.selMode ? `data-pick="${r.t}:${r.id}"` : `${r.att}="${r.id}"`} style="--c:${CTYPE[r.t][1]}">${O.selMode ? `<i class="ck">${O.sel.has(r.t + ':' + r.id) ? '✓' : ''}</i>` : ''}<span class="ctag">${CTYPE[r.t][0]}</span><div style="flex:1;min-width:0;text-align:right"><b>${esc(r.name)}</b> <span class="mut" style="font-size:12px" dir="ltr">${esc(r.phone || '')}</span><div class="mut" style="font-size:12px">${r.sub}</div></div></button>`).join('')}</div>` : '<p class="mut">مفيش عملاء بالفلتر ده.</p>'}`;
}
function waitPane() {
  const O = S.ops, open = O.LD.filter(openLead), groups = {};
  open.forEach(l => { const k = l.kind + '|' + (l.unit_id ? 'وحدة محددة: ' + (O.U.find(u => u.id === l.unit_id)?.code || '') : l.utype || 'أي نوع'); (groups[k] ||= []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  return `<div class="acts" style="margin-top:0"><button type="button" class="p" data-cadd="rent">+ طلب إيجار</button><button type="button" data-cadd="buy">+ طلب شراء</button></div>
  <p class="mut">الطلبات مترتبة بأسبقية التسجيل جوه كل نوع وحدة. أول ما وحدة مطابقة تفضى أو تتسجل، بتظهر جنب الطلب وعلى كارت الوحدة.</p>
  ${keys.length ? keys.map(k => { const [kind, ty] = k.split('|'), L = groups[k], free = O.U.filter(u => unitFree(u, kind) && L.some(l => leadFits(l, u)));
    return `<div class="card wgrp" style="--c:${CTYPE[kind][1]}"><div class="wgh"><span class="ctag">${LK[kind]}</span><b>${esc(ty)}</b><span class="mut">${L.length} في الانتظار</span>${free.length ? `<span class="wfree">✓ ${free.length} وحدة متاحة: ${free.slice(0, 6).map(u => esc(u.code)).join('، ')}</span>` : '<span class="mut" style="font-size:12px">مفيش وحدة متاحة دلوقتي</span>'}</div>
      <div class="vlist">${L.map((l, i) => `<button type="button" class="vrow crow" data-lead="${l.id}" style="--c:${CTYPE[kind][1]}"><span class="qn">${i + 1}</span><div style="flex:1;min-width:0;text-align:right"><b>${esc(l.name)}</b> <span class="mut" style="font-size:12px" dir="ltr">${esc(l.phone || '')}</span><div class="mut" style="font-size:12px">${l.activity ? esc(l.activity) + ' · ' : ''}${l.area_min || l.area_max ? `${l.area_min || 0}–${l.area_max || '∞'} م2 · ` : ''}${l.budget ? nf(l.budget, 0) + ' · ' : ''}من ${fmtD((l.created_at || today()).slice(0, 10))} · <span class="st ${LST[l.status][0]}">${LST[l.status][1]}</span>${matchUnits(l).length ? ` · <b style="color:var(--ok)">${matchUnits(l).length} مناسبة</b>` : ''}</div></div></button>`).join('')}</div></div>`; }).join('') : '<div class="note">مفيش طلبات في الانتظار.</div>'}`;
}
function leadEdit(l) {
  const O = S.ops, kind = l.kind || 'rent';
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">${l.id ? 'تعديل الطلب' : 'طلب ' + (kind === 'rent' ? 'إيجار' : 'شراء') + ' جديد'}</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label>نوع الطلب<select name="kind"><option value="rent"${kind === 'rent' ? ' selected' : ''}>طالب إيجار</option><option value="buy"${kind === 'buy' ? ' selected' : ''}>طالب شراء</option></select></label>
    <label>فرد / شركة<select name="party"><option value="person"${l.party !== 'company' ? ' selected' : ''}>فرد</option><option value="company"${l.party === 'company' ? ' selected' : ''}>شركة</option></select></label>
    <label class="wide">الاسم<input name="name" required value="${esc(l.name || '')}"></label><label>تليفون<input name="phone" dir="ltr" value="${esc(l.phone || '')}"></label><label>تليفون 2<input name="phone2" dir="ltr" value="${esc(l.phone2 || '')}"></label>
    <label>الإيميل<input name="email" dir="ltr" value="${esc(l.email || '')}"></label><label>النشاط المطلوب<input name="activity" value="${esc(l.activity || '')}"></label>
    <div class="wide mut" style="font-size:13px;margin-top:4px"><b>الوحدة المطلوبة</b> – حدد وحدة بعينها أو المواصفات</div>
    <label>المول<select name="mall"><option value="">أي مول</option>${O.M.map(m => `<option value="${m.id}"${l.mall_id === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
    <label>نوع الوحدة<input name="utype" list="utL2" value="${esc(l.utype || '')}"><datalist id="utL2">${utypes().map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>الدور<input name="floor" list="flL2" value="${esc(l.floor || '')}"><datalist id="flL2">${[...new Set(O.U.map(x => x.floor).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>المساحة الداخلية من (م2)<input name="amin" type="number" step="any" value="${l.area_min ?? ''}"></label><label>إلى (م2)<input name="amax" type="number" step="any" value="${l.area_max ?? ''}"></label>
    <label>الميزانية<input name="budget" type="number" step="any" placeholder="إيجار شهري أو سعر شراء" value="${l.budget ?? ''}"></label>
    <label>أو وحدة محددة<select name="unit"><option value="">—</option>${O.U.map(u => `<option value="${u.id}"${l.unit_id === u.id ? ' selected' : ''}>${esc(u.code)}${O.M.length > 1 ? ' – ' + esc(O.M.find(m => m.id === u.mall_id)?.name || '') : ''}</option>`).join('')}</select></label>
    <label>الحالة<select name="status">${Object.entries(LST).map(([k, [, t]]) => `<option value="${k}"${(l.status || 'waiting') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>المصدر<input name="source" list="srcL" value="${esc(l.source || '')}"><datalist id="srcL"><option value="زيارة"><option value="تليفون"><option value="فيسبوك"><option value="سمسار"><option value="ترشيح"></datalist></label>
    <label class="wide">ملاحظات<input name="notes" value="${esc(l.notes || '')}"></label></div><div class="acts"><button class="p">حفظ</button>${l.id ? '<button type="button" class="danger" id="pDel">حذف</button>' : ''}</div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, n = k => f[k].value === '' ? null : +f[k].value, t = k => f[k].value.trim() || null;
    const row = { kind: f.kind.value, party: f.party.value, name: f.name.value.trim(), phone: t('phone'), phone2: t('phone2'), email: t('email'), activity: t('activity'), mall_id: f.mall.value || null, utype: t('utype'), floor: t('floor'), area_min: n('amin'), area_max: n('amax'), budget: n('budget'), unit_id: f.unit.value || null, status: f.status.value, source: t('source'), notes: t('notes'), updated_at: new Date().toISOString() };
    const r = l.id ? await S.sb.from('leads').update(row).eq('id', l.id).select().single() : await S.sb.from('leads').insert(row).select().single(); if (r.error) return toast(r.error.message); toast('اتحفظ'); close(); await renderOps(); leadView(r.data.id); };
  d.addEventListener('click', async e => { if (e.target.id !== 'pDel') return; if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'متأكد؟'; return; } const r = await S.sb.from('leads').delete().eq('id', l.id); if (r.error) return toast(r.error.message); close(); renderOps(); });
}
function leadView(id) {
  const O = S.ops, l = O.LD.find(x => x.id === id); if (!l) return; const mu = openLead(l) ? matchUnits(l) : [], mOf = mid => O.M.find(m => m.id === mid)?.name || '';
  const pos = openLead(l) ? O.LD.filter(x => openLead(x) && x.kind === l.kind && (x.unit_id || x.utype || '') === (l.unit_id || l.utype || '') && (x.created_at || '') <= (l.created_at || '~')).length : 0;
  const msg = u => encodeURIComponent(`السلام عليكم ${l.name}،\nمتاح حالياً وحدة ${u.code} بـ${mOf(u.mall_id)}${u.floor ? ' – ' + u.floor : ''}${areaTxt(u) ? ' بمساحة ' + areaTxt(u) : ''}${u.utype ? ' (' + u.utype + ')' : ''} مناسبة لطلبك ${l.kind === 'rent' ? 'للإيجار' : 'للشراء'}.\nتحب نحدد ميعاد معاينة؟`);
  const { d, close } = odlg(`<div class="dh"><div><h3 style="margin:0">${esc(l.name)} <span class="ctag" style="--c:${CTYPE[l.kind][1]}">${LK[l.kind]}</span></h3><div class="mut" style="font-size:13px"><span class="st ${LST[l.status][0]}">${LST[l.status][1]}</span>${pos ? ` · رقم ${pos} في قائمة الانتظار` : ''} · مسجل ${fmtD((l.created_at || today()).slice(0, 10))}${l.source ? ' · ' + esc(l.source) : ''}</div></div><button type="button" class="dx">✕</button></div>
    ${partyInfo(l, [['phone', 'تليفون'], ['phone2', 'تليفون 2'], ['email', 'الإيميل'], ['activity', 'النشاط']])}
    <div class="pinfo"><div><span>المطلوب</span><b>${l.unit_id ? 'وحدة ' + esc(O.U.find(u => u.id === l.unit_id)?.code || '') : esc(l.utype || 'أي نوع')}${l.mall_id ? ' – ' + esc(mOf(l.mall_id)) : ''}${l.floor ? ' – ' + esc(l.floor) : ''}</b></div>${l.area_min || l.area_max ? `<div><span>المساحة</span><b>${l.area_min || 0} – ${l.area_max || '∞'} م2</b></div>` : ''}${l.budget ? `<div><span>الميزانية</span><b>${nf(l.budget, 0)} ${l.kind === 'rent' ? 'ج/شهر' : 'ج'}</b></div>` : ''}${l.notes ? `<div><span>ملاحظات</span><b>${esc(l.notes)}</b></div>` : ''}</div>
    <div class="acts"><button type="button" id="lEd">تعديل</button>${Object.entries(LST).filter(([k]) => k !== l.status).map(([k, [, t]]) => `<button type="button" class="xs" data-lst="${k}">${t}</button>`).join('')}</div>
    ${openLead(l) ? `<h4>وحدات متاحة مناسبة (${mu.length})</h4>${mu.length ? `<div class="vlist">${mu.map(u => `<div class="vrow"><div style="flex:1"><b>${esc(u.code)}</b> <span class="mut" style="font-size:12px">${esc(mOf(u.mall_id))} · ${esc(u.floor || '')}${areaTxt(u) ? ' · ' + areaTxt(u) : ''}${u.utype ? ' · ' + esc(u.utype) : ''}</span></div><div class="vacts">${l.phone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${waNum(l.phone)}?text=${msg(u)}">عرض واتساب</a>` : ''}<button type="button" class="p" data-conv="${u.id}">${l.kind === 'rent' ? 'عقد إيجار' : 'تسجيل البيع'}</button></div></div>`).join('')}</div>` : '<p class="mut">مفيش وحدات مناسبة متاحة دلوقتي – الطلب هيفضل في قائمة الانتظار.</p>'}` : ''}
    ${l.tenant_id || l.owner_id ? `<p>اتحوّل لـ <a href="#" data-gocl="${l.tenant_id ? 't' : 'o'}">${l.tenant_id ? 'مستأجر' : 'مالك'}</a></p>` : ''}`, true);
  d.addEventListener('click', async e => {
    if (e.target.id === 'lEd') { close(); return leadEdit(l); }
    const st = e.target.closest('[data-lst]'); if (st) { const r = await S.sb.from('leads').update({ status: st.dataset.lst, updated_at: new Date().toISOString() }).eq('id', id); if (r.error) return toast(r.error.message); close(); await renderOps(); return leadView(id); }
    const g = e.target.closest('[data-gocl]'); if (g) { e.preventDefault(); close(); return g.dataset.gocl === 't' ? tenantView(l.tenant_id) : ownerView(l.owner_id); }
    const cv = e.target.closest('[data-conv]'); if (cv) { const info = { name: l.name, kind: l.party, phone: l.phone, phone2: l.phone2, email: l.email, notes: l.notes };
      if (l.kind === 'rent') { let t = l.tenant_id && O.T.find(x => x.id === l.tenant_id); if (!t) { const r = await S.sb.from('tenants').insert({ ...info, activity: l.activity }).select().single(); if (r.error) return toast(r.error.message); t = r.data; }
        await S.sb.from('leads').update({ tenant_id: t.id, status: 'won', unit_id: cv.dataset.conv, updated_at: new Date().toISOString() }).eq('id', id); close(); await renderOps(); return leaseEdit({ unit_id: cv.dataset.conv, tenant_id: t.id, rent: l.budget || '' }); }
      let o = l.owner_id && O.W.find(x => x.id === l.owner_id); if (!o) { const r = await S.sb.from('unit_owners').insert(info).select().single(); if (r.error) return toast(r.error.message); o = r.data; }
      await S.sb.from('leads').update({ owner_id: o.id, status: 'won', unit_id: cv.dataset.conv, updated_at: new Date().toISOString() }).eq('id', id); close(); await renderOps(); return linkOwner({ owner_id: o.id, unit_id: cv.dataset.conv, price: l.budget, since: today() }); }
  });
}
/* owners & tenants registers */
const ownersOf = uid => { const O = S.ops; return (O.WS || []).filter(x => x.unit_id === uid && x.active !== false).map(l => ({ ...(O.W.find(w => w.id === l.owner_id) || {}), link: l })).filter(x => x.id); };
const unitsOfOwner = oid => { const O = S.ops; return (O.WS || []).filter(x => x.owner_id === oid && x.active !== false).map(l => ({ ...(O.U.find(u => u.id === l.unit_id) || {}), link: l })).filter(x => x.id); };
const waNum = ph => { let d = String(ph || '').replace(/\D/g, ''); if (d.startsWith('0020')) d = d.slice(2); else if (d.startsWith('0')) d = '20' + d.slice(1); return d; };
function ownersPane(U, B) {
  const O = S.ops, inMall = o => !O.mall || unitsOfOwner(o.id).some(u => u.mall_id === O.mall) || !unitsOfOwner(o.id).length;
  const L = O.W.filter(inMall).filter(o => !O.oq || (o.name + ' ' + (o.phone || '') + ' ' + unitsOfOwner(o.id).map(u => u.code).join(' ')).includes(O.oq));
  const act = O.L.filter(x => x.status === 'active');
  return `<div class="filters" style="margin-top:0"><input id="owQ" type="search" placeholder="بحث بالاسم أو التليفون أو رقم الوحدة" value="${esc(O.oq || '')}"><button type="button" class="p" id="owAdd">+ مالك</button><label class="btn" style="margin:0">⬆ استيراد ملاك من إكسل<input id="owImp" type="file" accept=".xlsx,.xls,.csv" hidden></label></div>
  ${L.length ? `<div class="vgrid">${L.map(o => { const us = unitsOfOwner(o.id), ls = us.map(u => act.find(x => x.unit_id === u.id)).filter(Boolean), rent = ls.reduce((s, x) => s + curRent(x, O.C) * (us.find(u => u.id === x.unit_id).link.share_pct / 100), 0), ar = ls.reduce((s, x) => s + Math.max(B[x.id]?.bal || 0, 0), 0);
    return `<button type="button" class="vcard ocard2" data-owner="${o.id}"><div style="display:flex;gap:6px"><b style="flex:1">${esc(o.name)}</b><span class="tag">${o.kind === 'company' ? 'شركة' : 'فرد'}</span></div><div class="mut" style="font-size:12px" dir="auto">${esc(o.phone || 'بدون تليفون')}</div>
      <div style="font-size:13px">${us.length ? `${us.length} وحدة: ${us.slice(0, 6).map(u => `<span class="chip3">${esc(u.code)}</span>`).join('')}${us.length > 6 ? ' …' : ''}` : '<span class="mut">مش مربوط بوحدات</span>'}</div>
      ${us.length ? `<div class="mut" style="font-size:12px">مؤجر ${ls.length}/${us.length} · إيجار ${nf(rent, 0)} ج/شهر${ar > 0.5 ? ` · <b style="color:var(--bad)">متأخرات ${nf(ar, 0)}</b>` : ''}</div>` : ''}</button>`; }).join('')}</div>` : '<p class="mut">لسه مفيش ملاك مسجلين. ضيفهم واحد واحد أو ارفع شيت فيه: اسم المالك، التليفون، رقم الوحدة (والمول والنسبة لو موجودين).</p>'}`;
}
function tenantsPane(B) {
  const O = S.ops, L = O.T.filter(t => !O.tq || (t.name + ' ' + (t.phone || '') + ' ' + (t.activity || '')).includes(O.tq)).filter(t => !O.mall || O.L.some(l => l.tenant_id === t.id && O.U.find(u => u.id === l.unit_id)?.mall_id === O.mall) || !O.L.some(l => l.tenant_id === t.id));
  return `<div class="filters" style="margin-top:0"><input id="tnQ" type="search" placeholder="بحث بالاسم أو التليفون أو النشاط" value="${esc(O.tq || '')}"><button type="button" class="p" id="tnAdd">+ مستأجر</button></div>
  ${L.length ? `<div class="vgrid">${L.map(t => { const ls = O.L.filter(l => l.tenant_id === t.id), ac = ls.filter(l => l.status === 'active'), bal = ls.reduce((s, l) => s + (B[l.id]?.bal ?? leaseBal(l, O.C, O.P).bal), 0);
    return `<button type="button" class="vcard ocard2" data-tenant="${t.id}"><div style="display:flex;gap:6px"><b style="flex:1">${esc(t.name)}</b><span class="tag">${t.kind === 'person' ? 'فرد' : 'شركة'}</span></div><div class="mut" style="font-size:12px" dir="auto">${esc([t.phone, t.activity].filter(Boolean).join(' · ') || '—')}</div>
      <div style="font-size:13px">${ac.length ? ac.map(l => `<span class="chip3">${esc(O.U.find(u => u.id === l.unit_id)?.code || '')}</span>`).join('') : `<span class="mut">${ls.length ? 'عقوده منتهية' : 'مفيش عقود'}</span>`}</div>
      <div style="font-size:12px;color:${bal > 0.5 ? 'var(--bad)' : 'var(--ok)'}">${bal > 0.5 ? 'متأخرات ' + nf(bal, 0) : bal < -0.5 ? 'رصيد مقدم ' + nf(-bal, 0) : '✓ منتظم'}</div></button>`; }).join('')}</div>` : '<p class="mut">مفيش مستأجرين. المستأجر بيتسجل لوحده لما تعمل عقد، أو ضيفه من هنا.</p>'}`;
}
const PFIELDS = [['name', 'الاسم', 1], ['kind', 'النوع'], ['phone', 'تليفون'], ['phone2', 'تليفون 2'], ['email', 'الإيميل'], ['national_id', 'الرقم القومي'], ['address', 'العنوان', 1], ['notes', 'ملاحظات', 1]];
const TFIELDS = [['name', 'الاسم / الشركة', 1], ['kind', 'النوع'], ['contact', 'المسؤول'], ['phone', 'تليفون'], ['phone2', 'تليفون 2'], ['email', 'الإيميل'], ['activity', 'النشاط'], ['commercial_reg', 'السجل التجاري'], ['tax_no', 'البطاقة الضريبية'], ['national_id', 'الرقم القومي'], ['address', 'العنوان', 1], ['notes', 'ملاحظات', 1]];
function partyForm(F, x, title) {
  return `<form><div class="dh"><h3 style="margin:0">${title}</h3><button type="button" class="dx">✕</button></div><div class="grid">${F.map(([k, l, w]) => k === 'kind' ? `<label>${l}<select name="kind"><option value="person"${x.kind === 'person' ? ' selected' : ''}>فرد</option><option value="company"${x.kind === 'company' ? ' selected' : ''}>شركة</option></select></label>` : `<label${w ? ' class="wide"' : ''}>${l}<input name="${k}"${k === 'name' ? ' required' : ''}${/phone|email|national|tax|commercial/.test(k) ? ' dir="ltr"' : ''} value="${esc(x[k] || '')}"></label>`).join('')}</div><div class="acts"><button class="p">حفظ</button>${x.id ? '<button type="button" class="danger" id="pDel">حذف</button>' : ''}</div></form>`;
}
function partySave(d, F, table, x, close, after) {
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, row = {}; F.forEach(([k]) => row[k] = f[k].value.trim() || null); if (!row.kind) row.kind = table === 'tenants' ? 'company' : 'person';
    const r = x.id ? await S.sb.from(table).update(row).eq('id', x.id).select().single() : await S.sb.from(table).insert(row).select().single(); if (r.error) return toast(r.error.message); toast('اتحفظ'); close(); await renderOps(); after && after(r.data); };
  d.addEventListener('click', async e => { if (e.target.id !== 'pDel') return; if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'متأكد؟ هيتمسح نهائي'; return; }
    const r = await S.sb.from(table).delete().eq('id', x.id); if (r.error) return toast(r.error.message.includes('foreign') ? 'مينفعش يتمسح – مربوط بعقود' : r.error.message); close(); renderOps(); });
}
function ownerEdit(o) { const { d, close } = odlg(partyForm(PFIELDS, { kind: 'person', ...o }, o.id ? 'تعديل بيانات المالك' : 'مالك جديد')); partySave(d, PFIELDS, 'unit_owners', o, close, r => ownerView(r.id)); }
function tenantEdit(t) { const { d, close } = odlg(partyForm(TFIELDS, { kind: 'company', ...t }, t.id ? 'تعديل بيانات المستأجر' : 'مستأجر جديد')); partySave(d, TFIELDS, 'tenants', t, close, r => tenantView(r.id)); }
const partyInfo = (x, F) => `<div class="pinfo">${F.filter(([k]) => !['name', 'kind'].includes(k) && x[k]).map(([k, l]) => `<div><span>${l}</span><b dir="auto">${/^phone/.test(k) ? `<a href="tel:${esc(x[k])}">${esc(x[k])}</a> <a target="_blank" rel="noopener" href="https://wa.me/${waNum(x[k])}" title="واتساب">💬</a>` : k === 'email' ? `<a href="mailto:${esc(x[k])}">${esc(x[k])}</a>` : esc(x[k])}</b></div>`).join('') || '<span class="mut">مفيش بيانات إضافية</span>'}</div>`;
function ownerView(id) {
  const O = S.ops, o = O.W.find(x => x.id === id); if (!o) return; const us = unitsOfOwner(id), mOf = mid => O.M.find(m => m.id === mid)?.name || '';
  const rows = us.map(u => { const l = O.L.find(x => x.unit_id === u.id && x.status === 'active'), t = l && O.T.find(x => x.id === l.tenant_id), b = l && leaseBal(l, O.C, O.P);
    return `<tr><td><a href="#" data-gu="${u.id}"><b>${esc(u.code)}</b></a> <span class="mut" style="font-size:12px">${esc(mOf(u.mall_id))} · ${esc(u.floor || '')}${areaTxt(u) ? ' · ' + areaTxt(u) : ''}</span></td><td class="n">${nf(u.link.share_pct)}%</td><td>${l ? `<a href="#" data-gl="${l.id}">${esc(t?.name || '')}</a><div class="mut" style="font-size:12px">لحد ${fmtD(l.end_date)}</div>` : `<span style="color:${USTAT[u.status][1]}">${USTAT[u.status][0]}</span>`}</td><td class="n">${l ? nf(curRent(l, O.C), 0) : '–'}</td><td class="n" style="color:${b && b.bal > 0.5 ? 'var(--bad)' : 'inherit'}">${b ? nf(b.bal, 0) : '–'}</td><td class="mut" style="font-size:12px">${[u.link.contract_no && 'عقد ' + esc(u.link.contract_no), u.link.since && fmtD(u.link.since), u.link.price && nf(u.link.price, 0) + ' ج'].filter(Boolean).join(' · ')}</td><td><button type="button" class="xs" data-ul="${u.link.id}">تعديل</button></td></tr>`; }).join('');
  const { d, close } = odlg(`<div class="dh"><div><h3 style="margin:0">${esc(o.name)} <span class="tag">${o.kind === 'company' ? 'شركة' : 'فرد'} · مالك</span></h3></div><button type="button" class="dx">✕</button></div>${partyInfo(o, PFIELDS)}
    <div class="acts"><button type="button" id="oEd">تعديل البيانات</button><button type="button" class="p" id="oLink">+ ربط وحدة</button></div>
    <h4>الوحدات (${us.length})</h4>${us.length ? `<div class="scroll"><table class="whyt"><thead><tr><th>الوحدة</th><th class="n">النسبة</th><th>المستأجر الحالي</th><th class="n">الإيجار/شهر</th><th class="n">متأخرات</th><th>الشراء</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="mut">مش مربوط بوحدات لسه.</p>'}`, true);
  d.addEventListener('click', e => { const gu = e.target.closest('[data-gu]'), gl = e.target.closest('[data-gl]'), ul = e.target.closest('[data-ul]');
    if (e.target.id === 'oEd') { close(); return ownerEdit(o); } if (e.target.id === 'oLink') { close(); return linkOwner({ owner_id: id }); }
    if (gu) { e.preventDefault(); close(); return unitEdit(O.U.find(x => x.id === gu.dataset.gu)); } if (gl) { e.preventDefault(); close(); return leaseView(gl.dataset.gl); }
    if (ul) { close(); return linkOwner(O.WS.find(x => x.id === ul.dataset.ul)); } });
}
function tenantView(id) {
  const O = S.ops, t = O.T.find(x => x.id === id); if (!t) return; const ls = O.L.filter(l => l.tenant_id === id).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const tot = ls.reduce((s, l) => s + leaseBal(l, O.C, O.P).bal, 0);
  const { d, close } = odlg(`<div class="dh"><div><h3 style="margin:0">${esc(t.name)} <span class="tag">${t.kind === 'person' ? 'فرد' : 'شركة'} · مستأجر</span></h3></div><button type="button" class="dx">✕</button></div>${partyInfo(t, TFIELDS)}
    <div class="acts"><button type="button" id="tEd">تعديل البيانات</button><button type="button" class="p" id="tNew">+ عقد جديد</button></div>
    <h4>العقود (${ls.length}) · ${tot > 0.5 ? `<span style="color:var(--bad)">إجمالي المتأخرات ${nf(tot, 0)}</span>` : '<span style="color:var(--ok)">منتظم</span>'}</h4>${ls.length ? `<div class="vlist">${ls.map(l => { const u = O.U.find(x => x.id === l.unit_id), b = leaseBal(l, O.C, O.P), ow = ownersOf(l.unit_id);
      return `<div class="vrow pick" data-gl="${l.id}"><div style="flex:1"><b>${esc(u?.code || '')}</b> <span class="mut" style="font-size:12px">${esc(O.M.find(m => m.id === u?.mall_id)?.name || '')}${ow.length ? ' · المالك ' + ow.map(x => esc(x.name)).join('، ') : ''}</span><div class="mut" style="font-size:12px">${fmtD(l.start_date)} ← ${fmtD(l.end_date)} · ${nf(curRent(l, O.C), 0)} ج/شهر${l.status === 'ended' ? ' · منتهي' : ''}</div></div><b style="color:${b.bal > 0.5 ? 'var(--bad)' : 'var(--ok)'}">${nf(b.bal, 0)}</b></div>`; }).join('')}</div>` : '<p class="mut">مفيش عقود.</p>'}`, true);
  d.addEventListener('click', e => { const gl = e.target.closest('[data-gl]'); if (e.target.id === 'tEd') { close(); return tenantEdit(t); } if (e.target.id === 'tNew') { close(); return leaseEdit({ tenant_id: id }); } if (gl) { close(); return leaseView(gl.dataset.gl); } });
}
function linkOwner(k) {
  const O = S.ops, mOf = mid => O.M.find(m => m.id === mid)?.name || '';
  const { d, close } = odlg(`<form><div class="dh"><h3 style="margin:0">${k.id ? 'تعديل ملكية' : 'ربط مالك بوحدة'}</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label>المالك<select name="o" required>${O.W.map(o => `<option value="${o.id}"${o.id === k.owner_id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
    <label>الوحدة<select name="u" required>${O.U.map(u => `<option value="${u.id}"${u.id === k.unit_id ? ' selected' : ''}>${esc(u.code)}${O.M.length > 1 ? ' – ' + esc(mOf(u.mall_id)) : ''}</option>`).join('')}</select></label>
    <label>نسبة الملكية %<input name="sh" type="number" step="any" value="${k.share_pct ?? 100}"></label><label>تاريخ الشراء / التملك<input name="since" type="date" value="${k.since || ''}"></label>
    <label>رقم العقد<input name="cn" value="${esc(k.contract_no || '')}"></label><label>سعر الشراء<input name="pr" type="number" step="any" value="${k.price ?? ''}"></label><label class="wide">ملاحظات<input name="nt" value="${esc(k.notes || '')}"></label></div>
    ${O.W.length ? '' : '<p class="mut">لازم تضيف المالك الأول من تبويب الملاك.</p>'}<div class="acts"><button class="p">حفظ</button>${k.id ? '<button type="button" class="danger" id="kDel">فك الربط</button>' : ''}</div></form>`);
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, row = { owner_id: f.o.value, unit_id: f.u.value, share_pct: +f.sh.value || 100, since: f.since.value || null, contract_no: f.cn.value.trim() || null, price: f.pr.value === '' ? null : +f.pr.value, notes: f.nt.value.trim() || null, active: true };
    const r = k.id ? await S.sb.from('unit_ownership').update(row).eq('id', k.id) : await S.sb.from('unit_ownership').insert(row); if (r.error) return toast(r.error.message.includes('duplicate') ? 'المالك ده مربوط بالوحدة دي قبل كده' : r.error.message); toast('اتحفظ'); close(); await renderOps(); ownerView(row.owner_id); };
  d.addEventListener('click', async e => { if (e.target.id !== 'kDel') return; if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'متأكد؟'; return; } const r = await S.sb.from('unit_ownership').delete().eq('id', k.id); if (r.error) return toast(r.error.message); close(); await renderOps(); ownerView(k.owner_id); });
}
async function importOwners(file) {
  if (!file) return; if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش'); const O = S.ops;
  const wb = XLSX.read(await file.arrayBuffer()), A = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }), T = v => String(v ?? '').trim();
  const hi = A.findIndex(r => r.some(x => /مالك|اسم|owner|name/i.test(T(x)))); if (hi < 0) return toast('مش لاقي عمود اسم المالك');
  const H = A[hi].map(T), c = re => H.findIndex(x => re.test(x)), cn = c(/مالك|اسم|owner|name/i), cp = c(/تليفون|موبايل|هاتف|phone|mobile/i), cu = c(/وحد|unit/i), cm = c(/مول|mall/i), cs = c(/نسب|share/i), ci = c(/قومي|national/i), ce = c(/ميل|email/i);
  let nO = 0, nL = 0, miss = [];
  for (const r of A.slice(hi + 1)) { const name = T(r[cn]); if (!name) continue;
    let o = O.W.find(x => x.name === name); if (!o) { const res = await S.sb.from('unit_owners').insert({ name, phone: cp >= 0 ? T(r[cp]) || null : null, national_id: ci >= 0 ? T(r[ci]) || null : null, email: ce >= 0 ? T(r[ce]) || null : null }).select().single(); if (res.error) return toast(res.error.message); o = res.data; O.W.push(o); nO++; }
    if (cu < 0) continue; for (const code of T(r[cu]).split(/[،,+&/]/).map(x => x.trim()).filter(Boolean)) {
      const mall = cm >= 0 ? O.M.find(m => m.name === T(r[cm]) || T(r[cm]).includes(m.name)) : null, u = O.U.find(x => x.code === code && (!mall || x.mall_id === mall.id) && (mall || !O.mall || x.mall_id === O.mall));
      if (!u) { miss.push(code); continue; } const res = await S.sb.from('unit_ownership').upsert({ unit_id: u.id, owner_id: o.id, share_pct: cs >= 0 && T(r[cs]) ? +T(r[cs]).replace('%', '') || 100 : 100, active: true }, { onConflict: 'unit_id,owner_id' }); if (!res.error) nL++; } }
  toast(`اتضاف ${nO} مالك و${nL} ربط بوحدات${miss.length ? ` · وحدات مش موجودة: ${[...new Set(miss)].slice(0, 8).join('، ')}` : ''}`); renderOps();
}
async function importUnits(file, mall) {
  if (!file) return; if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش – حدّث الصفحة وجرب تاني');
  let wb; try { wb = XLSX.read(await file.arrayBuffer()); } catch (er) { return toast('مش قادر أقرا الملف: ' + er.message); }
  const O = S.ops, T = v => String(v ?? '').trim(), CODE = v => T(v).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\s+/g, ' ').toUpperCase(), N = v => { if (typeof v === 'number') return v > 0 ? v : null; const m = String(v ?? '').replace(/,/g, '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/\d+(\.\d+)?/); return m && +m[0] > 0 ? +m[0] : null; };
  const F = [['code', 'رقم الوحدة', /رقم الوحد|كود|الوحدة|وحده|^وحدة|unit|code|shop/i, 1], ['floor', 'الدور', /^الدور$|^دور|floor|level/i], ['area', 'المساحة الداخلية', /داخل|^المساحة$|^مساحة$|^المساحه$|area|m2|م2/i], ['area_out', 'المساحة الخارجية', /خارج|تراس|outdoor|terrace/i],
    ['utype', 'نوع الوحدة', /نوع|type|category/i], ['activity', 'النشاط', /نشاط|activity|use/i], ['status', 'الحالة', /حال|status/i], ['duplex', 'دوبلكس', /دوبلكس|duplex/i], ['floor2', 'الدور التاني', /^(ال)?دور (ال)?(ثاني|تاني)|floor ?2/i], ['area2', 'مساحة الدور التاني', /مساحة الدور|area ?2/i], ['notes', 'ملاحظات', /ملاحظ|notes|remark/i]];
  const d = document.createElement('dialog'); d.className = 'adlg wide'; document.body.append(d); d.showModal(); const close = () => { d.close(); d.remove(); };
  let sn = wb.SheetNames.find(n => { const A = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); return A.some(r => r.some(x => F[0][2].test(T(x)))); }) || wb.SheetNames[0], hi = -1, map = {};
  const draw = () => {
    const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
    if (hi < 0) { hi = A.slice(0, 30).findIndex(r => r.filter(x => T(x)).length >= 2 && r.some(x => F[0][2].test(T(x)))); if (hi < 0) hi = A.findIndex(r => r.filter(x => T(x)).length >= 2); map = {}; const H = (A[hi] || []).map(T); F.forEach(([k, , re]) => { const i = H.findIndex((h, j) => h && re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; }); }
    const H = (A[hi] || []).map(T), rows = A.slice(hi + 1).filter(r => map.code != null && T(r[map.code]));
    const seen = new Set(), dup = new Set(); rows.forEach(r => { const c = CODE(r[map.code]); if (seen.has(c)) dup.add(c); seen.add(c); });
    const colSel = k => `<select data-map="${k}"><option value="">—</option>${H.map((h, i) => `<option value="${i}"${map[k] === i ? ' selected' : ''}>${esc(h || 'عمود ' + (i + 1))}</option>`).join('')}</select>`;
    d.innerHTML = `<div class="dh"><div><h3 style="margin:0">استيراد وحدات</h3><div class="mut" style="font-size:12px">${esc(file.name)}</div></div><button type="button" class="dx">✕</button></div>
    <div class="grid"><label>المول<select id="imM">${O.M.length > 1 ? '<option value="">— اختار المول —</option>' : ''}${O.M.map(m => `<option value="${m.id}"${(mall || (O.M.length === 1 && O.M[0].id)) === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      ${wb.SheetNames.length > 1 ? `<label>الشيت<select id="imS">${wb.SheetNames.map(n => `<option${n === sn ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}<label>صف العناوين<input id="imH" type="number" min="1" value="${hi + 1}"></label></div>
    <h4>ربط الأعمدة</h4><div class="grid">${F.map(([k, l, , req]) => `<label>${l}${req ? ' *' : ''}${colSel(k)}</label>`).join('')}</div>
    ${map.code == null ? '<div class="note">حدد عمود رقم الوحدة.</div>' : `<p style="margin:8px 0"><b>${seen.size}</b> وحدة في الملف${dup.size ? ` · <span style="color:var(--bad)">أرقام مكررة: ${[...dup].slice(0, 10).map(esc).join('، ')} (هيتاخد آخر سطر)</span>` : ''}</p>
    <div class="scroll" style="max-height:34vh;overflow:auto"><table class="whyt"><thead><tr>${F.filter(([k]) => map[k] != null).map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 12).map(r => `<tr>${F.filter(([k]) => map[k] != null).map(([k]) => `<td>${esc(T(r[map[k]]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > 12 ? `<p class="mut" style="font-size:12px">ظاهر أول 12 من ${rows.length}</p>` : ''}`}
    <p class="mut" style="font-size:12px">الوحدات الموجودة بنفس الرقم في نفس المول بتتحدث بياناتها، والجديدة بتتضاف. الحالة لو مش موجودة بتبقى "فاضية".</p>
    <div class="acts"><button type="button" class="p" id="imGo"${map.code == null || !rows.length ? ' disabled' : ''}>استيراد ${seen.size} وحدة</button></div>`;
    d.querySelectorAll('[data-map]').forEach(x => x.onchange = () => { map[x.dataset.map] = x.value === '' ? undefined : +x.value; if (x.value === '') delete map[x.dataset.map]; mall = d.querySelector('#imM').value; draw(); });
    d.querySelector('#imS') && (d.querySelector('#imS').onchange = e => { sn = e.target.value; hi = -1; mall = d.querySelector('#imM').value; draw(); });
    d.querySelector('#imH').onchange = e => { hi = Math.max(0, +e.target.value - 1); const H2 = (A[hi] || []).map(T); map = {}; F.forEach(([k, , re]) => { const i = H2.findIndex((h, j) => h && re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; }); mall = d.querySelector('#imM').value; draw(); };
    d.querySelector('#imM').onchange = e => { mall = e.target.value; };
    d.querySelector('#imGo').onclick = async () => { const mid = d.querySelector('#imM').value; if (!mid) return toast('اختار المول'); const b = d.querySelector('#imGo'); b.disabled = true;
      const g = (r, k) => map[k] != null ? r[map[k]] : '', stOf = v => /مؤجر|leased|rented/i.test(v) ? 'leased' : /تجهيز|fit/i.test(v) ? 'fitout' : /مالك|owner/i.test(v) ? 'owner' : 'vacant';
      const by = new Map(); rows.forEach((r, k) => { const dx = map.duplex != null && /نعم|اه|yes|true|^1$|✓|دوبلكس/i.test(T(g(r, 'duplex')));
        by.set(CODE(g(r, 'code')), { mall_id: mid, code: CODE(g(r, 'code')), floor: T(g(r, 'floor')) || null, area: N(g(r, 'area')), area_out: N(g(r, 'area_out')), utype: T(g(r, 'utype')) || null, activity: T(g(r, 'activity')) || null, status: map.status != null ? stOf(T(g(r, 'status'))) : 'vacant', duplex: dx, floor2: dx ? T(g(r, 'floor2')) || null : null, area2: dx ? N(g(r, 'area2')) : null, notes: T(g(r, 'notes')) || null, sort: k }); });
      const { data: cur } = await S.sb.from('mall_units').select('id,code,status').eq('mall_id', mid), exist = new Map((cur || []).map(u => [CODE(u.code), u]));
      const L = [...by.values()], ins = L.filter(x => !exist.has(x.code)), upd = L.filter(x => exist.has(x.code));
      let nI = 0, nU = 0, errs = [];
      for (let k = 0; k < ins.length; k += 200) { const { error } = await S.sb.from('mall_units').insert(ins.slice(k, k + 200)); if (error) { errs.push(error.message); break; } nI += Math.min(200, ins.length - k); }
      for (const x of upd) { const e = exist.get(x.code), row = { ...x }; delete row.mall_id; delete row.sort; row.code = e.code; if (map.status == null) delete row.status; const { error } = await S.sb.from('mall_units').update(row).eq('id', e.id); if (error) { errs.push(x.code + ': ' + error.message); if (errs.length > 3) break; } else nU++; }
      if (errs.length) { b.disabled = false; d.querySelector('.acts').insertAdjacentHTML('beforebegin', `<div class="note" style="color:var(--bad)">اتضاف ${nI} واتحدث ${nU}، وحصلت مشكلة: ${esc(errs.join(' | '))}</div>`); return; }
      toast(`✓ اتضاف ${nI} وحدة جديدة واتحدث ${nU}`); close(); S.ops.mall = mid; renderOps(); };
    d.querySelector('.dx').onclick = close;
  };
  draw();
}

async function renderHome() {
  const cards = await Promise.all(S.projects.map(async p => { const [a, w, u] = await Promise.all([S.sb.rpc('phase_progress', { p_project: p.id }), S.sb.rpc('active_work', { p_project: p.id, p_limit: 8 }), S.sb.rpc('site_updates', { p_project: p.id, p_n: 2 })]); return { p, list: a.data || [], work: w.data || [], upd: u.data || [] }; }));
  $('#main').innerHTML = `<h2>المشاريع</h2><div class="pgrid">${cards.map(({ p, list, work, upd }) => `<article class="pc"><div class="row2"><div><h2>${esc(p.name)}</h2><div class="mut">${esc(p.place)}${p.land ? ' · أرض ' + esc(p.land) : ''} · <span class="roleTag">${ROLE[role(p.id)] || ''}</span></div></div><div class="pbig">${list.length ? Math.round(overall(list) * 100) + '%' : '–'}</div></div>
  <dl class="who"><dt>المالك</dt><dd>${esc(p.owner_name)}</dd><dt>المقاول العام</dt><dd>${esc(p.contractor_name)}</dd><dt>الاستشاري</dt><dd>${esc(p.consultant_name)}</dd></dl>
  <div class="mbars">${list.map(x => `<div><span>${x.n}. ${esc(x.name)}</span><div class="bar${x.pct >= 1 ? ' full' : ''}"><u style="width:${Math.min(x.pct, 1) * 100}%"></u></div><em>${Math.round(x.pct * 100)}%</em></div>`).join('')}</div>
  ${liveWork(p, work, upd)}
  <div class="acts" style="margin-top:0"><a class="btn p" href="#p/${p.id}/status">فتح المشروع</a>${can('report', p.id) ? `<a class="btn" href="#p/${p.id}/report">تقرير يومي</a>` : ''}${can('review', p.id) ? `<a class="btn" href="#p/${p.id}/review">المراجعة</a>` : ''}${can('fullRep', p.id) ? `<button type="button" data-rep="${p.id}">📄 تقرير شامل</button>` : ''}</div></article>`).join('')}</div>`;
  $('#main').onclick = e => { const rp = e.target.closest('[data-rep]'); if (rp && can('fullRep', rp.dataset.rep)) return projectReport(rp.dataset.rep, rp); const t = e.target.closest('[data-lt]'); if (!t) return; const box = t.closest('.live'); box.querySelectorAll('[data-lt]').forEach(b => b.classList.toggle('on', b === t)); box.querySelectorAll('[data-lp]').forEach(x => x.hidden = x.dataset.lp !== t.dataset.lt); };
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
    ${ed ? `<div class="phset" data-ph="${x.n}"><label>وزن المرحلة %<input type="number" step="any" data-pf="weight" value="${Math.round(x.weight * 10000) / 100}"></label><label>نسبة يدوية %<input type="number" step="any" data-pf="manual" value="${x.manual ? Math.round(x.pct * 1000) / 10 : ''}" placeholder="${x.auto_pct != null ? 'محسوبة: ' + Math.round(x.auto_pct * 100) : '—'}"></label><label>المخطط حتى اليوم %<input type="number" step="any" data-pf="planned" value="${x.planned_pct ?? ''}"></label><label title="${esc(S.P.phases.find(p => p.n === x.n)?.budget_rev_src || '')}">الميزانية التقديرية ج<input type="number" step="any" data-pf="brev" value="${S.P.phases.find(p => p.n === x.n)?.budget_rev ?? ''}"></label><button data-savewph="${x.n}">حفظ</button></div>` : ''}
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
    const { error } = await S.sb.from('phases').update({ weight: (+g('weight') || 0) / 100, manual_pct: g('manual') === '' ? null : +g('manual'), planned_pct: g('planned') === '' ? null : +g('planned'), ...(() => { const o = P.phases.find(p => p.n === +b.dataset.savewph), v = g('brev') === '' ? null : +g('brev'); return (+o?.budget_rev || null) === v ? {} : { budget_rev: v, budget_rev_src: 'تعديل يدوي', budget_rev_date: today() }; })() }).eq('project_id', P.id).eq('n', +b.dataset.savewph);
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
/* ---- vendors (approved companies per item) ---- */
const VK = { supply: 'توريد', exec: 'تنفيذ', both: 'توريد وتنفيذ' }, VS = { approved: ['appr', 'معتمدة'], suggested: ['pend', 'مقترحة'], blocked: ['ret', 'مستبعدة'] };
const prio = n => n > 4 ? 0 : 1, byPrio = (a, b) => prio(a) - prio(b) || a - b;
function vendorsFor(i) {
  const t = (i.group_name || '') + ' ' + i.name, tn = normAr(t);
  return (S.P.vendors || []).filter(v => v.status !== 'blocked' && (!v.phases || !v.phases.length || v.phases.includes(i.phase_n)) && (() => { try { const re = new RegExp(v.pattern, 'i'); return re.test(t) || re.test(tn); } catch { return false; } })())
    .sort((x, y) => (x.status === 'approved' ? 0 : 1) - (y.status === 'approved' ? 0 : 1) || (y.rating || 0) - (x.rating || 0));
}
const vendLink = i => { if (!(S.P.vendors || []).length) return ''; const n = vendorsFor(i).length, nq = (S.P.quotes || []).filter(q => q.item_id === i.id).length; return ` <a href="#" class="vlink" data-vend="${esc(i.id)}" title="الشركات اللي ممكن تسعّر البند">🏢${n || '+'}</a>${nq ? ` <a href="#" class="vlink" data-vend="${esc(i.id)}" title="عروض الأسعار المسجلة للبند">📑${nq}</a>` : ''}`; };
const gq = q => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const gmaps = q => 'https://www.google.com/maps/search/' + encodeURIComponent(q);
/* ---- phones & whatsapp ---- */
const PHS = v => String(v.phone || '').split(/\s*[\/،,;|]\s*/).map(s => s.trim()).filter(Boolean);
const isMob = p => /^(\+?20|0020)?0?1[0125]\d{8}$/.test(String(p).replace(/[\s-]/g, ''));
const vWA = v => v.whatsapp || PHS(v).find(isMob) || '';
const phLinks = v => PHS(v).map(p => `<a class="vph" href="tel:${esc(p.replace(/[\s-]/g, ''))}" dir="ltr">📞 ${esc(p)}</a>`).join('');
/* ---- price guide (guide only: never counted in totals) ---- */
const UNORM = u => String(u || '').replace(/²/g, '2').replace(/³/g, '3').replace(/\s/g, '');
const rxc = {}, rx = p => rxc[p] ||= (() => { try { return new RegExp(p, 'i'); } catch { return /$^/; } })();
function guideFor(i) { if (i.rate > 0 && !i.reprice) return null; const tn = normAr((i.group_name || '') + ' ' + i.name), u = UNORM(i.unit);
  return (S.P.guide || []).find(g => UNORM(g.unit) === u && (!g.phases || !g.phases.length || g.phases.includes(i.phase_n)) && rx(g.pattern).test(tn) && !(g.not_pattern && rx(g.not_pattern).test(tn))) || null; }
const gChip = i => { const g = guideFor(i); return g ? ` <a href="#" class="gchip" data-guide="${esc(i.id)}" title="سعر استرشادي من متوسطات السوق – مش داخل في أي حسابات">≈ ${nf(g.rate)} <small>استرشادي</small></a>` : ''; };
const vQuick = i => { const V = vendorsFor(i).filter(v => PHS(v).length || v.whatsapp).slice(0, 2); return V.length ? `<div class="vquick">${V.map(v => `<span class="vq"><b>${esc(v.name.length > 26 ? v.name.slice(0, 26) + '…' : v.name)}</b>${PHS(v)[0] ? `<a href="tel:${esc(PHS(v)[0].replace(/[\s-]/g, ''))}" title="اتصال ${esc(PHS(v)[0])}">📞</a>` : ''}${vWA(v) ? `<a href="https://wa.me/${waNum(vWA(v))}" target="_blank" rel="noopener" title="واتساب">💬</a>` : ''}</span>`).join('')}</div>` : ''; };
function guideDialog(id) {
  const P = S.P, i = P.items.find(x => x.id === id), g = i && guideFor(i); if (!g) return;
  const dlg = document.createElement('dialog'); dlg.className = 'adlg';
  dlg.innerHTML = `<div class="dh"><div><div class="mut" style="font-size:12px">${esc(i.code)} · سعر استرشادي</div><h3 style="margin:2px 0 0;font-size:16px;line-height:1.5">${esc(g.label)}</h3></div><button type="button" class="dx">✕</button></div>
  <div class="gbig"><b>${nf(g.rate)}</b> ج.م / ${esc(i.unit || g.unit)}<span class="mut">المدى المعقول ${nf(g.rmin)} – ${nf(g.rmax)}</span></div>
  ${+i.qty > 0 ? `<p>بالكمية الحالية (${nf(i.qty)} ${esc(i.unit || '')}) القيمة التقديرية ≈ <b>${nf(i.qty * g.rate, 0)} ج.م</b> (من ${nf(i.qty * g.rmin, 0)} لـ ${nf(i.qty * g.rmax, 0)}).</p>` : ''}
  <h4>اتحسب إزاي</h4><p style="line-height:1.8">${esc(g.basis || '')}</p><h4>المصادر</h4><p class="mut" style="line-height:1.8">${esc(g.sources || '')} · آخر تحديث ${fmtD(g.as_of)}</p>
  <div class="note">السعر ده للاسترشاد ومقارنة عروض الأسعار بس. البند هيفضل <b>غير مسعّر</b> ومش داخل في إجمالي المقايسة ولا التكلفة لحد ما يتسجل سعر فعلي من عرض سعر أو تحديث يدوي. لو عرض السعر بعيد عن المدى ده راجع المواصفات قبل الاعتماد.</div>
  <div class="acts"><button type="button" class="p" data-gv>🏢 الشركات وطلب عرض سعر</button></div>`;
  document.body.append(dlg); dlg.showModal();
  dlg.onclick = e => { const gv = e.target.closest('[data-gv]'); if (e.target === dlg || e.target.closest('.dx') || gv) { dlg.close(); dlg.remove(); } if (gv) vendorPanel(id); };
}
document.addEventListener('click', e => { const g = e.target.closest('[data-guide]'); if (g) { e.preventDefault(); e.stopPropagation(); guideDialog(g.dataset.guide); } }, true);
function vendorPanel(id) {
  const P = S.P, i = P.items.find(x => x.id === id); if (!i) return;
  const V = vendorsFor(i), Q = (P.quotes || []).filter(q => q.item_id === id).sort((a, b) => qVat(a) - qVat(b)), ed = can('editBoq', P.id);
  const msg = v => encodeURIComponent(`السلام عليكم، شركة ريسان للمقاولات – مشروع ${P.proj.name}.\nمطلوب عرض سعر ${VK[v.kind] === 'توريد' ? 'توريد' : 'توريد وتنفيذ'} للبند:\n${i.name}\nالكمية: ${+i.qty ? nf(i.qty) + ' ' + (i.unit || '') : 'حسب المقايسة'}\nبرجاء إرسال السعر ومدة التوريد. شكراً.`);
  const dlg = document.createElement('dialog'); dlg.className = 'adlg';
  dlg.innerHTML = `<div class="dh"><div><div class="mut" style="font-size:12px">${esc(i.code)} · ${i.phase_n}. ${esc(P.phaseProg.find(x => x.n === i.phase_n)?.name || '')}</div><h3 style="margin:2px 0 0;font-size:16px;line-height:1.5">${esc(i.name.length > 120 ? i.name.slice(0, 120) + '…' : i.name)}</h3><div class="mut" style="font-size:13px">${+i.qty ? nf(i.qty) + ' ' + esc(i.unit || '') : 'مقطوعية'}${i.rate > 0 ? ' · السعر الحالي ' + nf(i.rate) + ' ج.م' : ' · <b style="color:var(--bad)">مش متسعّر</b>'}</div></div><button type="button" class="dx">✕</button></div>
  ${(() => { const g = guideFor(i); return g ? `<a href="#" class="gbox" data-guide="${esc(i.id)}"><span>سعر استرشادي من متوسطات السوق</span><b>≈ ${nf(g.rate)} ج.م / ${esc(i.unit || '')}</b><small>المدى ${nf(g.rmin)} – ${nf(g.rmax)} · اضغط لتفاصيل الحساب</small></a>` : ''; })()}
  <h4>الشركات المناسبة للبند (${V.length})</h4>${V.length < 2 ? `<div class="note" style="margin-top:0">الشركات المسجلة للبند ده أقل من اتنين. <a target="_blank" rel="noopener" href="${gmaps((i.group_name || i.name).slice(0, 40) + ' الغردقة')}">🗺 دوّر على شركات في الغردقة</a> (خرايط جوجل بتعرض الرقم مباشرة)${ed ? ` أو <a href="#" data-vnew="${esc(i.id)}">+ ضيف شركة للنوع ده</a>` : ''}.</div>` : ''}${V.length ? `<div class="vlist">${V.map(v => `<div class="vrow"><div style="flex:1;min-width:0"><b>${esc(v.name)}</b> <span class="st ${VS[v.status][0]}">${VS[v.status][1]}</span> <span class="tag">${VK[v.kind]}</span>${v.rating ? ' <span style="color:var(--warn)">' + '★'.repeat(v.rating) + '</span>' : ''}<div class="mut" style="font-size:12px">${esc(v.trade)}${v.contact ? ' · ' + esc(v.contact) : ''}${v.notes ? ' · ' + esc(v.notes) : ''}</div>${PHS(v).length || v.whatsapp ? `<div class="vphs">${phLinks(v)}${v.whatsapp && !PHS(v).includes(v.whatsapp) ? `<a class="vph" href="tel:${esc(v.whatsapp)}" dir="ltr">📱 ${esc(v.whatsapp)}</a>` : ''}</div>` : '<div class="mut" style="font-size:12px">مفيش رقم متسجل لسه</div>'}</div><div class="vacts">${PHS(v)[0] ? `<a class="btn" href="tel:${esc(PHS(v)[0].replace(/[\s-]/g, ''))}">📞 اتصال</a>` : ''}${vWA(v) ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${waNum(vWA(v))}?text=${msg(v)}">واتساب – طلب سعر</a>` : PHS(v).length ? '<span class="mut" style="font-size:12px;align-self:center">خط أرضي/ساخن – اتصال بس</span>' : ''}${v.website ? `<a class="btn" target="_blank" rel="noopener" href="${esc(/^https?:/.test(v.website) ? v.website : 'https://' + v.website)}">الموقع</a>` : `<a class="btn" target="_blank" rel="noopener" href="${gq(v.name + ' مصر')}">بحث</a>`}</div></div>`).join('')}</div>` : '<p class="mut">مفيش شركات متسجلة لنوع البند ده لسه.</p>'}
  <h4>عروض الأسعار للبند (${Q.length})</h4>${Q.length ? `<div class="vlist">${Q.map(q => `<div class="vrow"><div style="flex:1"><b>${esc(q.supplier || '')}</b>${q.option_label ? ' – ' + esc(q.option_label) : ''} <span class="st ${QST[q.status][0]}">${QST[q.status][1]}</span>${q.adopted ? ' <span class="st appr">✔ السعر المثبت</span>' : ''}<div class="mut" style="font-size:12px">${nf(qVat(q), 0)} ج.م / ${esc(i.unit || 'مقطوع')} شامل الضريبة${q.valid_until ? ' · صالح لحد ' + fmtD(q.valid_until) : ''}</div></div></div>`).join('')}</div>` : '<p class="mut" style="margin:0">لسه مفيش عروض متسجلة للبند.</p>'}
  <div class="acts" style="margin-top:14px"><a class="btn" target="_blank" rel="noopener" href="${gq('سعر ' + i.name.slice(0, 80) + ' ' + (i.unit || '') + ' مصر ' + new Date().getFullYear())}">🔎 ابحث عن سعر السوق</a>${can('quotes', P.id) ? `<a class="btn${ed ? ' p' : ''}" href="#p/${P.id}/quotes" data-qgo>${ed ? '+ سجّل عرض سعر' : '📑 عروض الأسعار'}</a>` : ''}${ed ? `<a class="btn" href="#p/${P.id}/tasks" data-gov>🏢 إدارة الشركات</a>` : ''}</div>`;
  document.body.append(dlg); dlg.showModal();
  dlg.onclick = e => { if (e.target === dlg || e.target.closest('.dx')) { dlg.close(); dlg.remove(); } const vn = e.target.closest('[data-vnew]'); if (vn) { e.preventDefault(); dlg.close(); dlg.remove(); const kw = normAr(i.group_name || '').replace(/^(ال)?اعمال\s*/, '').split(/\s+/).filter(w => w.length > 2).slice(0, 2).join('|'); return vendorEdit(null, async () => { P.vendors = (await S.sb.from('vendors').select('*').order('trade').order('name')).data || []; vendorPanel(id); }, { trade: i.group_name || '', pattern: kw, phases: [i.phase_n], status: 'approved', kind: 'both' }); } if (e.target.closest('[data-gov]')) { (S.tk ||= { tab: 'price', ph: '' }).tab = 'vendors'; dlg.close(); dlg.remove(); if (location.hash === `#p/${P.id}/tasks`) { e.preventDefault(); renderTasks(); } } if (e.target.closest('[data-open]')) { dlg.close(); dlg.remove(); docClick(e); } if (e.target.closest('[data-qgo]')) { const F = (S.qF ||= { st: '', q: '', item: '', form: null }); F.item = id; F.form = ed ? { item: id } : null; dlg.close(); dlg.remove(); if (location.hash === `#p/${P.id}/quotes`) { e.preventDefault(); renderQuotes(); } } };
}
document.addEventListener('click', e => { const v = e.target.closest('[data-vend]'); if (v) { e.preventDefault(); e.stopPropagation(); vendorPanel(v.dataset.vend); } }, true);

function renderTasks() {
  const P = S.P, ed = can('editBoq', P.id), T = (S.tk ||= { tab: 'price', ph: '' }), C = P.check;
  const miss = P.items.filter(lacks), phases = [...P.phaseProg].sort((a, b) => byPrio(a.n, b.n));
  const phOpt = sel => phases.map(x => `<option value="${x.n}"${String(x.n) === String(sel) ? ' selected' : ''}>${x.n}. ${esc(x.name)}${x.n > 4 ? ' ★' : ''}</option>`).join('');
  const openN = cat => C.filter(c => c.category === cat && c.status !== 'approved').length, overdue = c => c.due_date && c.due_date < today() && c.status !== 'approved';
  const pname = n => esc(P.phaseProg.find(x => x.n === n)?.name || '');
  const missPost = miss.filter(i => i.phase_n > 4).length, late = C.filter(overdue).length;
  // phase readiness cards
  const bar = (lbl, ok, n, go) => { const p = n ? ok / n : 0, st = !n ? 'none' : ok === n ? 'done' : ok ? 'part' : 'miss';
    return `<button type="button" class="rbar ${st}" data-go="${go}"><span class="rl">${lbl}</span><span class="rt"><u style="width:${Math.round(p * 100)}%"></u></span><span class="rn">${n ? `${ok}/${n}` : '—'}</span></button>`; };
  const pcard = x => { const it = P.items.filter(i => i.phase_n === x.n), pr = it.filter(i => !lacks(i)).length, d = readiness(x.n, 'design'), m = readiness(x.n, 'material');
    const tot = it.length + d.n + m.n, ok = pr + d.ok + m.ok, pct = tot ? ok / tot : 0;
    return `<div class="phc${x.n > 4 ? ' pri' : ''}"><div class="phh"><span class="pnum">${x.n}</span><b>${esc(x.name)}</b>${x.n > 4 ? '<span class="pbadge">أولوية</span>' : ''}<span class="php">${tot ? Math.round(pct * 100) + '%' : ''}</span></div>
      ${bar('التسعير', pr, it.length, 'price|' + x.n)}${bar('التصاميم', d.ok, d.n, 'design|' + x.n)}${bar('الخامات', m.ok, m.n, 'material|' + x.n)}</div>`; };
  const post = phases.filter(x => x.n > 4), pre = phases.filter(x => x.n <= 4);
  let body = '';
  if (T.tab === 'price') {
    const L = miss.filter(i => !T.ph || String(i.phase_n) === T.ph), grp = [...new Set(L.map(i => i.phase_n))].sort(byPrio);
    const GL = L.map(i => [i, guideFor(i)]).filter(([i, g]) => g && +i.qty > 0), gEst = GL.reduce((s, [i, g]) => s + i.qty * g.rate, 0);
    body = `<p class="mut">البنود دي ناقصها سعر أو كمية، ومترتبة بحيث مراحل ما بعد الهيكل الخرساني تيجي الأول. 🏢 بيفتح الشركات اللي ممكن تسعّر البند، و<span class="gchip" style="pointer-events:none">≈ استرشادي</span> سعر محسوب من متوسطات السوق للمقارنة بس – البند بيفضل غير مسعّر لحد ما يجيله سعر فعلي.</p>${GL.length ? `<div class="note">${GL.length} بند ناقص ليهم سعر استرشادي، قيمتهم التقديرية ≈ <b>${nf(gEst, 0)} ج.م</b> – للتخطيط بس ومش داخلة في أي إجمالي.</div>` : ''}${L.length ? grp.map((n, k) => { const G = L.filter(i => i.phase_n === n), gg = [...new Set(G.map(i => i.group_name))];
      return `<details class="tgrp${n > 4 ? ' pri' : ''}"${T.ph || k === 0 ? ' open' : ''}><summary><span class="pnum">${n}</span><b>${pname(n)}</b>${n > 4 ? '<span class="pbadge">أولوية</span>' : ''}<span class="tcount">${G.length} بند ناقص</span></summary>${gg.map(g => `<div class="tsub">${esc(g)}</div><div class="tlist">${G.filter(i => i.group_name === g).slice(0, 80).map(i => `<div class="trow" data-id="${esc(i.id)}"><div class="tt"><span class="tcode">${esc(i.code)}</span> ${esc(i.name.length > 110 ? i.name.slice(0, 110) + '…' : i.name)}<div class="mut">${i.building ? esc(i.building) + ' · ' : ''}${esc(i.unit || '')} · <span style="color:var(--bad)">${i.reprice && +i.qty > 0 && i.rate > 0 ? `السعر الحالي ${nf(i.rate)} مصنعية بس – محتاج سعر توريد ومصنعيات` : 'ناقص ' + (!(+i.qty > 0) && !(i.rate > 0) ? 'الكمية والسعر' : !(+i.qty > 0) ? 'الكمية' : 'السعر')}</span>${gChip(i)}</div>${vQuick(i)}</div><button type="button" class="vbtn" data-vend="${esc(i.id)}">🏢 ${vendorsFor(i).length || ''} شركات</button>${ed ? `<label>الكمية<input type="number" step="any" data-f="qty" value="${+i.qty || ''}"></label><label>السعر<input type="number" step="any" data-f="rate" value="${i.rate || ''}"></label><button type="button" class="p" data-savep>حفظ</button>` : ''}</div>`).join('')}</div>`).join('')}</details>`; }).join('') : '<div class="note">✓ كل البنود متسعّرة.</div>'}`;
  } else if (T.tab === 'vendors') {
    const V = P.vendors || [], F = T.vf ||= { q: '', st: '' }, L = V.filter(v => (!F.st || v.status === F.st) && (!F.q || (v.name + ' ' + v.trade).includes(F.q))), tr = [...new Set(L.map(v => v.trade))];
    body = `<p class="mut">دليل الشركات اللي ممكن تتسعّر منها البنود توريد أو تنفيذ. الشركات بتظهر جوه كل بند حسب الكلمات المفتاحية. اللي عليها "مقترحة" دي قايمة مبدئية بأسماء معروفة في السوق، راجعها وخلّي المناسب "معتمدة" وضيف أرقام المندوبين.</p>
    <div class="filters"><input id="vQ" type="search" placeholder="بحث بالاسم أو النشاط" value="${esc(F.q)}"><select id="vS" style="max-width:180px"><option value="">كل الحالات</option>${Object.entries(VS).map(([k, [, l]]) => `<option value="${k}"${F.st === k ? ' selected' : ''}>${l}</option>`).join('')}</select>${ed ? '<button type="button" class="p" data-vedit="">+ شركة</button>' : ''}</div>
    ${tr.map(t => `<div class="tsub">${esc(t)} <span class="mut">(${L.filter(v => v.trade === t).length})</span></div><div class="vgrid">${L.filter(v => v.trade === t).map(v => `<div class="vcard s-${v.status}"><div style="display:flex;gap:6px;align-items:start"><b style="flex:1">${esc(v.name)}</b><span class="st ${VS[v.status][0]}">${VS[v.status][1]}</span></div><div class="mut" style="font-size:12px">${VK[v.kind]}${v.phases?.length ? ' · مراحل ' + v.phases.join('، ') : ''}${v.rating ? ' · <span style="color:var(--warn)">' + '★'.repeat(v.rating) + '</span>' : ''}</div>${v.phone || v.contact || v.whatsapp ? `<div style="font-size:13px">${esc(v.contact || '')}<div class="vphs">${phLinks(v)}${vWA(v) ? `<a class="vph wa" target="_blank" rel="noopener" href="https://wa.me/${waNum(vWA(v))}">💬 واتساب</a>` : ''}</div></div>` : ''}${v.notes ? `<div class="mut" style="font-size:12px">${esc(v.notes)}</div>` : ''}${ed ? `<div class="mact"><button type="button" data-vedit="${v.id}">تعديل</button>${v.status !== 'approved' ? `<button type="button" data-vst="approved|${v.id}">✓ اعتماد</button>` : ''}</div>` : ''}</div>`).join('')}</div>`).join('') || '<p class="mut">مفيش شركات بالبحث ده.</p>'}`;
  } else {
    const cat = T.tab, L = C.filter(c => c.category === cat && (!T.ph || String(c.phase_n) === T.ph)), ph = [...new Set(L.map(c => c.phase_n))].sort(byPrio);
    const docs = P.docs || [];
    body = `${ed ? `<details class="card"><summary><b>+ إضافة ${cat === 'design' ? 'لوحة / تصميم' : 'خامة للاعتماد'}</b></summary><form id="cF" class="grid" style="margin-top:10px"><label>المرحلة<select name="ph">${phOpt(T.ph || post[0]?.n)}</select></label><label class="wide">البيان<input name="title" required placeholder="${cat === 'design' ? 'مثلاً: لوحات أسقف الدور الأول' : 'مثلاً: عينة البورسلين للحمامات'}"></label>${(P.proj.buildings || []).length > 1 ? `<label>المبنى<select name="bld"><option value="">الكل</option>${P.proj.buildings.map(b => `<option>${esc(b)}</option>`).join('')}</select></label>` : ''}<label>الحالة<select name="st">${Object.entries(CST).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>مطلوب قبل<input type="date" name="due"></label><label>المسؤول<input name="owner"></label><div class="acts" style="margin:0;align-self:end"><button class="p">إضافة</button></div></form></details>
      ${!C.some(c => c.category === cat) ? `<div class="note">لسه مفيش قائمة ${CCAT[cat]}. <button type="button" id="cTpl" class="p" style="margin-inline-start:8px">إضافة القائمة الافتراضية لكل المراحل</button> <span class="mut">وبعدها امسح اللي مش لازم وضيف الناقص.</span></div>` : ''}` : ''}
      ${L.length ? ph.map(n => { const r = readiness(n, cat); return `<details class="tgrp${n > 4 ? ' pri' : ''}"${n > 4 || T.ph || r.state !== 'done' ? ' open' : ''}><summary><span class="pnum">${n}</span><b>${pname(n)}</b>${n > 4 ? '<span class="pbadge">أولوية</span>' : ''}<span class="rchip ${r.state}">${r.state === 'done' ? '✓ مكتملة' : r.state === 'part' ? 'ناقصها جزء' : 'ناقصة'} ${r.ok}/${r.n}</span></summary><div class="tlist">${L.filter(c => c.phase_n === n).map(c => `<div class="trow${c.status === 'approved' ? ' done' : ''}${overdue(c) ? ' late' : ''}" data-cid="${c.id}"><span class="tchk">${c.status === 'approved' ? '☑' : '☐'}</span><div class="tt"><b>${esc(c.title)}</b>${c.building ? ` <span class="chip2">${esc(c.building)}</span>` : ''}<div class="mut">${c.owner ? 'المسؤول: ' + esc(c.owner) + ' · ' : ''}${c.due_date ? `مطلوب قبل ${fmtD(c.due_date)}${overdue(c) ? ' <b style="color:var(--bad)">متأخر</b>' : ''} · ` : ''}${c.notes ? esc(c.notes) : ''}${c.doc_id && docs.find(d => d.id === c.doc_id) ? ' ' + docChip(docs.find(d => d.id === c.doc_id)) : ''}</div></div>
        ${ed ? `<select data-cst class="cst ${CST[c.status][0]}">${Object.entries(CST).map(([k, [, l]]) => `<option value="${k}"${k === c.status ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-cdoc title="ربط بمستند"><option value="">📎 —</option>${docs.map(d => `<option value="${d.id}"${d.id === c.doc_id ? ' selected' : ''}>📎 ${esc(d.title.slice(0, 30))}</option>`).join('')}</select><button type="button" data-cdel class="danger" title="حذف">✕</button>` : `<span class="st ${CST[c.status][0]}">${CST[c.status][1]}</span>`}</div>`).join('')}</div></details>`; }).join('') : C.some(c => c.category === cat) ? '<p class="mut">مفيش بنود في المرحلة دي.</p>' : ''}`;
  }
  const tabs = [['price', '💰 التسعير', miss.length], ['design', '📐 التصاميم', openN('design')], ['material', '🧱 اعتماد الخامات', openN('material')], ['vendors', '🏢 الشركات', (P.vendors || []).length]];
  $('#main').innerHTML = `<h2 style="margin-bottom:2px">مهام المكتب الفني</h2><p class="mut" style="margin-top:0">الأولوية لمراحل ما بعد الهيكل الخرساني ★ – التشطيبات والواجهات والكهروميكانيك واللاندسكيب.</p>
  <div class="kpis"><div class="kpi k-bad" data-go="price|"><b>${missPost}</b><span>بنود ناقصة تسعير بعد الهيكل<br><small>من ${miss.length} إجمالي</small></span></div><div class="kpi k-warn" data-go="design|"><b>${openN('design')}</b><span>تصاميم مفتوحة</span></div><div class="kpi k-warn" data-go="material|"><b>${openN('material')}</b><span>خامات محتاجة اعتماد</span></div><div class="kpi${late ? ' k-bad' : ''}"><b>${late}</b><span>متأخر عن الميعاد</span></div></div>
  <h3 class="sech">★ مراحل ما بعد الهيكل – أولوية</h3><div class="phgrid">${post.map(pcard).join('')}</div>
  <details class="pregrp"><summary>المراحل الأولى (لحد الهيكل الخرساني)</summary><div class="phgrid" style="margin-top:10px">${pre.map(pcard).join('')}</div></details>
  <div class="sttabs" id="tTabs"><div class="seg">${tabs.map(([k, l, n]) => `<button type="button" data-tab="${k}" class="${T.tab === k ? 'on' : ''}">${l} <small>(${n})</small></button>`).join('')}</div></div>
  ${T.tab !== 'vendors' ? `<div class="filters" style="margin-top:8px"><select id="tPh" style="max-width:300px"><option value="">كل المراحل</option>${phOpt(T.ph)}</select></div>` : ''}<div style="margin-top:8px">${body}</div>`;
  const re = async () => { await loadProject(P.id); renderTasks(); };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; renderTasks(); });
  $('#tPh') && ($('#tPh').onchange = e => { T.ph = e.target.value; renderTasks(); });
  $('#vQ') && ($('#vQ').onchange = e => { T.vf.q = e.target.value.trim(); renderTasks(); });
  $('#vS') && ($('#vS').onchange = e => { T.vf.st = e.target.value; renderTasks(); });
  $('#main').onclick = async e => {
    const g = e.target.closest('[data-go]'); if (g) { const [t, n] = g.dataset.go.split('|'); T.tab = t; T.ph = n; renderTasks(); return $('#tTabs')?.scrollIntoView({ behavior: 'smooth' }); }
    const ve = e.target.closest('[data-vedit]'); if (ve) return vendorEdit(ve.dataset.vedit, re);
    const vs = e.target.closest('[data-vst]'); if (vs) { const [st, id] = vs.dataset.vst.split('|'); const { error } = await S.sb.from('vendors').update({ status: st, updated_at: new Date().toISOString() }).eq('id', id); if (error) return toast(error.message); toast('اتعتمدت'); return re(); }
    const sp = e.target.closest('[data-savep]'); if (sp) { const row = sp.closest('.trow'), id = row.dataset.id, v = f => { const x = row.querySelector(`[data-f=${f}]`).value; return x === '' ? null : +x; }; sp.disabled = true;
      const q = v('qty'), r = v('rate'), i = P.items.find(x => x.id === id); let err = null;
      if (r != null && (r !== i.rate || i.reprice)) ({ error: err } = await S.sb.from('boq_rates').upsert({ item_id: id, rate: r, rate_source: 'manual', rate_doc_id: null, rate_updated_at: new Date().toISOString() }));
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
function vendorEdit(id, done, pre) {
  const P = S.P, v = (P.vendors || []).find(x => x.id === id) || { kind: 'supply', status: 'approved', trade: '', pattern: '', ...(pre || {}) };
  const dlg = document.createElement('dialog'); dlg.className = 'adlg';
  dlg.innerHTML = `<form id="vF"><div class="dh"><h3 style="margin:0">${id ? esc(v.name) : 'شركة جديدة'}</h3><button type="button" class="dx">✕</button></div><div class="grid">
  <label class="wide">اسم الشركة<input name="name" required value="${esc(v.name || '')}"></label>
  <label>النوع<select name="kind">${Object.entries(VK).map(([k, l]) => `<option value="${k}"${v.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>الحالة<select name="status">${Object.entries(VS).map(([k, [, l]]) => `<option value="${k}"${v.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>النشاط<input name="trade" required list="trL" value="${esc(v.trade)}"><datalist id="trL">${[...new Set((P.vendors || []).map(x => x.trade))].map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
  <label class="wide">كلمات البنود اللي تظهر فيها (افصل بـ |)<input name="pattern" required value="${esc(v.pattern)}" placeholder="مثلاً: بورسلين|سيراميك|بلاط"></label>
  <label>المراحل (اختياري)<input name="phases" value="${esc((v.phases || []).join(','))}" placeholder="5,6"></label>
  <label>المندوب<input name="contact" value="${esc(v.contact || '')}"></label><label>التليفون <small class="mut">(أكتر من رقم افصل بـ /)</small><input name="phone" dir="ltr" value="${esc(v.phone || '')}" placeholder="19119 / 0223456789"></label><label>واتساب <small class="mut">(موبايل)</small><input name="whatsapp" dir="ltr" value="${esc(v.whatsapp || '')}" placeholder="01xxxxxxxxx"></label><label>الموقع الإلكتروني<input name="website" dir="ltr" value="${esc(v.website || '')}"></label>
  <label>التقييم<select name="rating"><option value="">—</option>${[5, 4, 3, 2, 1].map(r => `<option value="${r}"${v.rating === r ? ' selected' : ''}>${'★'.repeat(r)}</option>`).join('')}</select></label>
  <label class="wide">ملاحظات<input name="notes" value="${esc(v.notes || '')}"></label></div>
  <div class="acts"><button class="p">حفظ</button>${id ? '<button type="button" class="danger" id="vDel">حذف</button>' : ''}</div></form>`;
  document.body.append(dlg); dlg.showModal(); const close = () => { dlg.close(); dlg.remove(); };
  dlg.onclick = async e => { if (e.target === dlg || e.target.closest('.dx')) return close(); if (e.target.id === 'vDel') { if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('vendors').delete().eq('id', id); if (error) return toast(error.message); close(); done(); } };
  dlg.querySelector('#vF').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), g = k => String(f.get(k) || '').trim();
    try { new RegExp(g('pattern')); } catch { return toast('الكلمات فيها رمز غلط'); }
    const row = { name: g('name'), kind: g('kind'), status: g('status'), trade: g('trade'), pattern: g('pattern'), phases: g('phases') ? g('phases').split(/[,،\s]+/).map(Number).filter(Boolean) : null, contact: g('contact') || null, phone: g('phone') || null, whatsapp: g('whatsapp') || null, website: g('website') || null, rating: g('rating') ? +g('rating') : null, notes: g('notes') || null, updated_at: new Date().toISOString() };
    const { error } = id ? await S.sb.from('vendors').update(row).eq('id', id) : await S.sb.from('vendors').insert(row); if (error) return toast(error.message); toast('اتحفظ'); close(); done(); };
}

/* ---------------- store / warehouse ---------------- */
const MVK = { receipt: ['وارد', 'appr', '⬇'], issue: ['صرف', 'pend', '⬆'], return: ['مرتجع', 'imp', '↩'], adjust: ['تسوية / رصيد افتتاحي', 'run', '⚖'] };
const MCOL = ['#3b6ea8', '#7d8189', '#b08a3e', '#d2a24c', '#8a6f5a', '#b5523b', '#7a5230', '#2e8b85', '#6a5acd', '#c2185b'];
const MICO = [['حديد', '🔩'], ['خرسان', '🏗️'], ['اسمنت', '🧱'], ['أسمنت', '🧱'], ['رمل', '⛱️'], ['زلط', '🪨'], ['سن', '🪨'], ['طوب', '🧱'], ['خشب', '🪵'], ['عزل', '🛡️']];
const micon = n => (MICO.find(([k]) => n.includes(k)) || [, '📦'])[1];
/* items preparation (start of carpentry etc.) + estimated qty for items whose BOQ qty is still 0 */
const matchNorm = (i, N) => N.filter(n => (!n.project_id || n.project_id === S.P.id) && (!n.phase_n || n.phase_n === i.phase_n) && (() => { try { return new RegExp(n.pattern, 'i').test((i.group_name || '') + ' ' + i.name); } catch { return false; } })() && (!n.item_unit || String(i.unit || '').replace('³', '3').includes(n.item_unit)));
function suggestQty(i, N) {
  const I = S.P.items, same = I.filter(x => x.id !== i.id && x.building === i.building && x.group_name === i.group_name && +x.qty > 0 && x.sort < i.sort).sort((a, b) => b.sort - a.sort);
  if (same.length) return { q: +same[0].qty, from: `${same[0].name} – نفس المبنى` };
  const oth = I.filter(x => x.id !== i.id && x.group_name === i.group_name && x.name === i.name && +x.qty > 0);
  if (oth.length) return { q: Math.round(oth.reduce((s, x) => s + +x.qty, 0) / oth.length * 100) / 100, from: `متوسط ${oth.length} مبنى` };
  if (N) { const key = x => matchNorm(x, N).map(n => n.id).sort().join(','), k = key(i); if (k) { const sim = I.filter(x => x.id !== i.id && x.building === i.building && x.unit === i.unit && +x.qty > 0 && x.sort < i.sort && key(x) === k).sort((a, b) => b.sort - a.sort);
    if (sim.length) return { q: +sim[0].qty, from: `${sim[0].code} – أقرب بند مشابه في نفس المبنى` }; } }
  return null;
}
function prepPane(N, M) {
  const P = S.P, F = S.stT.pf ||= { b: '', q: '' };
  const L = P.items.filter(i => { const qe = +i.qty > 0 ? +i.qty : +i.est_qty || 0; return !(qe > 0 && i.ex >= qe * 0.999) && matchNorm(i, N).length; })
    .filter(i => (!F.b || i.building === F.b) && (!F.q || (i.code + ' ' + i.group_name + ' ' + i.name).includes(F.q))).sort((a, b) => (a.phase_n - b.phase_n) || (a.sort - b.sort));
  const B = [...new Set(P.items.map(i => i.building).filter(Boolean))];
  const mNames = i => [...new Set(matchNorm(i, N).map(n => M.find(m => m.id === n.material_id)?.name).filter(Boolean))].join('، ');
  return `<div class="card"><p class="mut" style="margin-top:0">علّم البند لما يبدأ تجهيزه في الموقع (نجارة/تخشيب/حدادة) حتى لو نسبته لسه صفر، عشان النظام يحسب الخامات المطلوبة له من بدري: الحديد والخشب مطلوبين من أول التجهيز، والخرسانة بعدها بحوالي أسبوع. ولو كمية البند في المقايسة لسه صفر حط كمية تقديرية (فيه اقتراح من نفس المبنى أو المباني المشابهة).</p>
  <div class="filters">${B.length > 1 ? `<select id="pfB" style="max-width:220px"><option value="">كل المباني</option>${B.map(b => `<option${F.b === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}<input id="pfQ" type="search" placeholder="بحث" value="${esc(F.q)}"></div>
  <div class="scroll"><table class="stack prept"><thead><tr><th>البند</th><th>الخامات</th><th class="n">الكمية</th><th>كمية تقديرية</th><th>بدأ التجهيز</th><th></th></tr></thead><tbody>${L.slice(0, 150).map(i => { const sg = !(+i.qty > 0) ? suggestQty(i, N) : null;
    return `<tr data-pid="${esc(i.id)}"${i.prep_start ? ' class="on"' : ''}><td data-l="البند"><b>${esc(i.code)}</b> ${esc(i.group_name)} – ${esc(i.name.slice(0, 60))}${i.building ? ` <span class="tag">${esc(i.building)}</span>` : ''}${i.ex > 0 ? ` <span class="mut" style="font-size:12px">منفذ ${nf(i.ex)}</span>` : ''}</td><td data-l="الخامات" class="mut" style="font-size:12px">${esc(mNames(i))}</td>
      <td class="n" data-l="الكمية">${+i.qty > 0 ? nf(i.qty) + ' ' + esc(i.unit || '') : '<span style="color:var(--warn)">لسه صفر</span>'}</td>
      <td data-l="كمية تقديرية">${+i.qty > 0 ? '–' : `<input data-f="est" type="number" step="any" value="${i.est_qty ?? ''}" style="width:90px">${sg ? ` <button type="button" class="xs" data-sg="${sg.q}" title="${esc(sg.from)}">اقتراح ${nf(sg.q)}</button>` : ''}`}</td>
      <td data-l="بدأ التجهيز"><input data-f="prep" type="date" value="${i.prep_start || ''}" style="width:auto"> ${i.prep_start ? '' : `<button type="button" class="xs" data-today>النهارده</button>`}</td>
      <td><button type="button" class="p xs" data-psave>حفظ</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="mut">مفيش بنود.</td></tr>'}</tbody></table></div>${L.length > 150 ? `<p class="mut">ظاهر أول 150 بند من ${L.length} – استخدم الفلتر.</p>` : ''}</div>`;
}
function bindPrep(re) {
  const T = S.stT; if (T.tab !== 'prep') return;
  $('#pfB') && ($('#pfB').onchange = e => { T.pf.b = e.target.value; re(); });
  $('#pfQ') && ($('#pfQ').onchange = e => { T.pf.q = e.target.value.trim(); re(); });
  document.querySelectorAll('.prept [data-sg]').forEach(b => b.onclick = () => { b.closest('tr').querySelector('[data-f=est]').value = b.dataset.sg; });
  document.querySelectorAll('.prept [data-today]').forEach(b => b.onclick = () => { b.closest('tr').querySelector('[data-f=prep]').value = today(); });
  document.querySelectorAll('.prept [data-psave]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'), est = tr.querySelector('[data-f=est]'), d = tr.querySelector('[data-f=prep]').value || null; b.disabled = true;
    const { error } = await S.sb.rpc('set_item_prep', { p_item: tr.dataset.pid, p_date: d, p_est: est && est.value !== '' ? +est.value : null, p_set_est: !!est });
    if (error) { b.disabled = false; return toast(error.message); } toast('اتحفظ'); await loadProject(S.P.id); re(); });
}
async function stockWhy(mid, r, start) {
  const P = S.P, { data: X, error } = await S.sb.rpc('stock_explain', { p_project: P.id, p_material: mid });
  if (error || !X) return toast(error?.message || 'مفيش بيانات');
  const u = esc(r.unit), f1 = v => nf(v, v < 10 ? 2 : 1), I = X.items || [], act = I.filter(i => +i.need > 0), cons = I.filter(i => +i.cons > 0), rest = I.filter(i => !(+i.need > 0));
  const mv = X.moves || {}, mq = k => +(mv[k]?.q || 0), usedIssues = mq('issue') - mq('return') > 0;
  const avail = +r.rec_reports + +r.rec_moves + +r.adjusted - (usedIssues ? +r.issued : +r.consumed_est), mat = X.material || {};
  const ST = { running: ['جاري', 'run'], prep: ['بدأ التجهيز', 'run'], soon: ['هيبدأ', 'pend'], done: ['خلص', 'appr'], idle: ['لسه مبدأش', ''], noqty: ['مالوش كمية', 'ret'] };
  const why = i => i.state === 'running' ? `منفذ ${f1(i.ex)} من ${f1(i.qe)} ${esc(i.unit)}` : i.state === 'prep' ? `التجهيز بدأ ${fmtD(i.prep)}` : i.state === 'soon' ? `مربوط بنشاط "${esc(i.act)}" بيبدأ ${fmtD(i.act_s)}` : '';
  const noq = I.filter(i => i.state === 'noqty' && (i.prep || i.ex > 0));
  const warn = [];
  if (!+r.rec_reports && !+r.rec_moves && !+r.adjusted) warn.push('مفيش أي وارد ولا رصيد افتتاحي مسجل من تاريخ بداية المتابعة، فالرصيد محسوب صفر. لو فيه كمية في المخزن فعلاً سجّلها كـ"تسوية / رصيد افتتاحي" وهيتصلح الحساب.');
  if (!usedIssues && +r.consumed_est > 0) warn.push('مفيش أذون صرف، فالمنصرف محسوب من الكميات المنفذة × المعدل. لو المعدل مش مظبوط لنوع البند ده عدّله من إعدادات المعدلات.');
  if (act.some(i => i.state === 'running' && +i.ex / +i.qty > 0.97)) warn.push('فيه بنود منفذ منها أكتر من 97% ولسه ظاهرة جارية – غالباً الكمية الإجمالية للبند أكبر من الحقيقي بشوية. راجع الكمية في المقايسة.');
  if (noq.length) warn.push(`${noq.length} بند بدأ تجهيزه بس كميته في المقايسة صفر ومفيش كمية تقديرية (${noq.map(i => esc(i.code)).join('، ')}) – مش داخل في المطلوب. حط له كمية تقديرية من تبويب "تجهيز البنود".`);
  if ((X.before || []).length) warn.push(`فيه ${X.before.length} توريد لنفس الخامة في التقارير قبل تاريخ بداية المتابعة (${fmtD(X.start)}) ومش محسوبين في الرصيد – شوفهم تحت. لو لسه في المخزن سجّل الموجود كرصيد افتتاحي.`);
  if (mat.stocked === false) warn.push('الخامة دي متعلّمة "مش بتتخزن" فمش بتطلّع تنبيه نقص.');
  const dlg = document.createElement('dialog'); dlg.className = 'adlg wide';
  dlg.innerHTML = `<div class="dh"><div><h3 style="margin:0">${micon(r.name)} ${esc(r.name)} – الحسبة مبنية على إيه؟</h3><div class="mut" style="font-size:13px">المتابعة من ${fmtD(X.start)} · كل الأرقام بـ${u}</div></div><button type="button" class="dx">✕</button></div>
  <div class="why-f"><div><span>المطلوب للبنود الجارية</span><b>${f1(r.needed)}</b></div><i>+</i><div><span>الحد الأدنى</span><b>${f1(r.min_stock)}</b></div><i>−</i><div><span>المتاح</span><b>${f1(avail)}</b></div><i>=</i><div class="${+r.shortage > 0 ? 'bad' : 'ok'}"><span>${+r.shortage > 0 ? 'النقص' : 'مفيش نقص'}</span><b>${f1(Math.max(+r.shortage, 0))}</b></div></div>
  <p class="mut" style="margin:4px 0 0;font-size:12px">المتاح = وارد التقارير ${f1(r.rec_reports)} + وارد الأذون ${f1(r.rec_moves)} + التسويات ${f1(r.adjusted)} − ${usedIssues ? `المنصرف بالأذون ${f1(r.issued)}` : `الاستهلاك المحسوب ${f1(r.consumed_est)}`}</p>
  ${warn.length ? `<div class="note" style="margin-top:10px">${warn.map(w => '⚠ ' + w).join('<br>')}</div>` : ''}
  <h4>1. المطلوب (${f1(r.needed)}) – من البنود دي</h4>${act.length ? `<div class="scroll"><table class="whyt stack"><thead><tr><th>البند</th><th>ليه محسوب؟</th><th>مطلوب في الموقع</th><th class="n">الباقي</th><th class="n">× المعدل</th><th class="n">= المطلوب</th></tr></thead><tbody>${act.map(i => `<tr><td data-l="البند"><b>${esc(i.code)}</b> ${esc(i.name)}${i.building ? ` <span class="tag">${esc(i.building)}</span>` : ''}</td><td data-l="ليه؟"><span class="st ${ST[i.state][1]}">${ST[i.state][0]}</span> <span class="mut" style="font-size:12px">${why(i)}</span></td><td data-l="مطلوب في الموقع">${fmtD(i.need_by)}<div class="mut" style="font-size:11px">${i.order_by < today() ? '<b style="color:var(--bad)">اطلب النهارده</b>' : 'اطلب قبل ' + fmtD(i.order_by)}</div></td><td class="n" data-l="الباقي">${f1(Math.max(+i.qe - +i.ex, 0))} ${esc(i.unit)}${!(+i.qty > 0) ? '<div class="mut" style="font-size:11px">من كمية تقديرية</div>' : ''}</td><td class="n" data-l="المعدل" title="${esc(i.pattern)}">${nf(i.rate, 3)}<div class="mut" style="font-size:11px">${esc(i.nnote || '')}</div></td><td class="n" data-l="المطلوب"><b>${f1(i.need)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">مفيش بنود جارية أو بادئة خلال أسبوعين محتاجة الخامة دي.</p>'}
  <p class="mut" style="font-size:12px;margin:4px 0">البند بيتحسب لو: اتنفذ منه جزء ولسه مخلصش، أو اتعلّم إن تجهيزه بدأ، أو مربوط بنشاط في الجدول الزمني بيبدأ خلال 14 يوم + مدة التوريد (${esc(mat.lead_days ?? '')} يوم). ${mat.stage === 'prep' ? 'الخامة دي مطلوبة من أول التجهيز.' : 'الخامة دي مطلوبة وقت التنفيذ – حوالي أسبوع بعد بداية التجهيز.'} المعدل جاي من قواعد معدلات الاستهلاك للخامة (${(X.norms || []).length} قاعدة).</p>
  ${rest.length ? `<details><summary class="mut" style="font-size:13px">بنود تانية بتستخدم الخامة بس مش داخلة في المطلوب (${rest.length})</summary><div class="scroll"><table class="whyt"><tbody>${rest.slice(0, 60).map(i => `<tr><td><b>${esc(i.code)}</b> ${esc(i.name)}</td><td><span class="st ${ST[i.state][1]}">${ST[i.state][0]}</span></td><td class="n">${f1(i.ex)} / ${+i.qe > 0 ? f1(i.qe) : '؟'} ${esc(i.unit)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
  <h4>2. الوارد (${f1(+r.rec_reports + +r.rec_moves + +r.adjusted)})</h4>
  ${(X.receipts || []).length ? `<div class="scroll"><table class="whyt"><thead><tr><th>التاريخ</th><th>المكتوب في توريدات التقرير</th><th>اتعرف عليه بكلمة</th><th class="n">الكمية</th></tr></thead><tbody>${X.receipts.map(x => `<tr><td>${fmtD(x.d)}</td><td>${esc(x.txt)} <span class="mut">${esc(x.u || '')}</span></td><td><span class="tag">${esc(x.alias)}</span></td><td class="n">${f1(x.q)}</td></tr>`).join('')}</tbody></table></div><p class="mut" style="font-size:12px;margin:4px 0">⚠ راجع الوحدة: لو التقرير مكتوب فيه الكمية بوحدة غير ${u} (كجم بدل طن مثلاً) الرقم هيتحسب غلط.</p>` : '<p class="mut">مفيش توريدات في التقارير المعتمدة اتعرف عليها كـ' + esc(r.name) + ` من ${fmtD(X.start)}. الكلمات اللي بيدوّر بيها: ${(mat.aliases || []).map(a => `<span class="tag">${esc(a)}</span>`).join(' ')}</p>`}
  ${(X.before || []).length ? `<details><summary style="font-size:13px;color:var(--warn)">توريدات قبل بداية المتابعة – مش محسوبة (${X.before.length})</summary><table class="whyt"><tbody>${X.before.map(x => `<tr><td>${fmtD(x.d)}</td><td>${esc(x.txt)} <span class="mut">${esc(x.u || '')}</span></td><td class="n">${f1(x.q)}</td></tr>`).join('')}</tbody></table></details>` : ''}
  ${Object.keys(mv).length ? `<p style="margin:6px 0">أذون المخزن: ${Object.entries(mv).map(([k, v]) => `${MVK[k][0].split(' /')[0]} ${f1(v.q)} (${v.n} إذن)`).join(' · ')}</p>` : '<p class="mut" style="margin:6px 0">مفيش أذون مخزن مسجلة.</p>'}
  <h4>3. ${usedIssues ? 'المنصرف بالأذون' : 'الاستهلاك المحسوب'} (${f1(usedIssues ? r.issued : r.consumed_est)})</h4>
  ${usedIssues ? `<p>المنصرف مأخوذ من أذون الصرف (${f1(r.issued)}). الاستهلاك المحسوب للمقارنة: ${f1(r.consumed_est)}.</p>` : cons.length ? `<div class="scroll"><table class="whyt"><thead><tr><th>البند</th><th class="n">اتنفذ من ${fmtD(X.start)}</th><th class="n">× المعدل</th><th class="n">= استهلاك</th></tr></thead><tbody>${cons.map(i => `<tr><td><b>${esc(i.code)}</b> ${esc(i.name)}</td><td class="n">${f1(i.ex_new)} ${esc(i.unit)}</td><td class="n">${nf(i.rate, 3)}</td><td class="n"><b>${f1(i.cons)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">مفيش كميات اتنفذت من تاريخ بداية المتابعة.</p>'}
  <div class="acts" style="margin-top:12px"><a class="btn" href="#p/${P.id}/log">سجل التقارير</a></div>`;
  document.body.append(dlg); dlg.showModal(); dlg.onclick = e => { if (e.target === dlg || e.target.closest('.dx') || e.target.closest('a')) { dlg.close(); dlg.remove(); } };
}
async function renderStore() {
  const P = S.P, ed = can('editBoq', P.id), mv = can('storeMove', P.id), T = S.stT ||= { tab: 'moves' };
  $('#main').innerHTML = '<p class="mut">جاري تحميل المخزن…</p>';
  const [st, mats, norms, moves, set] = await Promise.all([S.sb.rpc('stock_status2', { p_project: P.id }), S.sb.from('materials').select('*').order('sort'), S.sb.from('material_norms').select('*'), S.sb.from('stock_moves').select('*').eq('project_id', P.id).order('move_date', { ascending: false }).order('id', { ascending: false }).limit(60), S.sb.from('stock_settings').select('*').eq('project_id', P.id).maybeSingle()]);
  if (st.error) return $('#main').innerHTML = `<div class="note">${esc(st.error.message)}</div>`;
  const R = st.data || [], M = mats.data || [], N = norms.data || [], MV = moves.data || [], start = set.data?.start_date || today();
  const mat = id => M.find(m => m.id === id), mName = id => mat(id)?.name || '', mUnit = id => mat(id)?.unit || '';
  const col = id => MCOL[Math.max(0, M.findIndex(m => m.id === id)) % MCOL.length];
  const bal = r => +r.issued > 0 ? +r.balance : +r.balance_est;
  const sinceRep = P.reports.filter(r => r.status === 'approved' && r.report_date >= start).flatMap(r => (r.body.supply || []).map(x => ({ ...x, d: r.report_date })));
  const unmatched = [...new Set(sinceRep.filter(x => x.item && !M.some(m => (m.aliases || []).some(a => normAr(x.item).includes(normAr(a))))).map(x => x.item))];
  // status per material
  const info = R.map(r => { const m = mat(r.material_id) || {}, b = bal(r), need = +r.needed + (+r.min_stock || 0), stocked = m.stocked !== false;
    const cov = need > 0 ? Math.max(0, b) / need : (b > 0 ? 1 : 0);
    const stt = !stocked ? ['follow', 'متابعة فقط'] : +r.shortage > 0 ? ['bad', 'ناقص'] : need > 0 && cov < 1.5 ? ['warn', 'قرب يخلص'] : b > 0 ? ['ok', 'كافي'] : ['idle', 'مفيش حركة'];
    return { r, m, b, need, cov, stt, c: col(r.material_id), stocked }; });
  const nShort = info.filter(x => x.stt[0] === 'bad').length, nWarn = info.filter(x => x.stt[0] === 'warn').length, nOk = info.filter(x => x.stt[0] === 'ok').length;
  const ring = (pct, c) => `<div class="ring" style="--p:${Math.min(pct, 1) * 100};--c:${c}"><span>${pct >= 10 ? '+999' : Math.round(pct * 100)}<small>%</small></span></div>`;
  const card = x => { const r = x.r; const used = +r.issued > 0 ? +r.issued : +r.consumed_est, rec = +r.rec_reports + +r.rec_moves + +r.adjusted;
    return `<div class="mcard s-${x.stt[0]}" style="--c:${x.c}"><div class="mhead"><span class="mic">${micon(r.name)}</span><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="mut" style="font-size:12px">${esc(r.unit)}</div></div><span class="mst">${x.stt[1]}</span></div>
      <div class="mbody">${x.stocked && x.need > 0 ? ring(x.cov, x.stt[0] === 'bad' ? 'var(--bad)' : x.stt[0] === 'warn' ? 'var(--warn)' : x.c) : `<div class="ring off" style="--p:0"><span>–</span></div>`}
        <div class="mnum"><div class="mut" style="font-size:12px">الرصيد${+r.issued > 0 ? '' : ' (محسوب)'}</div><div class="mbal" style="${x.b < 0 ? 'color:var(--bad)' : ''}">${nf(x.b, 1)}</div><div class="mut" style="font-size:12px">${x.stocked && x.need > 0 ? `يغطي ${Math.round(Math.min(x.cov, 9.99) * 100)}% من المطلوب` : x.stocked ? 'مفيش بنود جارية محتاجاها' : 'بتتصب مباشرة – مش بتتخزن'}</div></div></div>
      <div class="mflow"><div><span>وارد</span><b>${nf(rec, 1)}</b></div><div><span>${+r.issued > 0 ? 'منصرف' : 'استهلاك محسوب'}</span><b>${nf(used, 1)}</b></div><div><span>مطلوب للجاري</span><b>${nf(r.needed, 1)}</b></div></div>
      ${rec > 0 ? `<div class="mbar" title="المستهلك من الوارد"><u style="width:${Math.min(100, used / rec * 100)}%"></u></div><div class="mut" style="font-size:11px;margin-top:3px">اتستهلك ${Math.round(Math.min(used / rec, 9.99) * 100)}% من الوارد</div>` : ''}
      ${+r.shortage > 0 ? `<div class="mshort">ناقص <b>${nf(r.shortage, 1)} ${esc(r.unit)}</b>${r.order_by ? `<div style="font-size:12px;margin-top:3px">${r.order_by < today() ? `⏰ كان لازم يتطلب من ${fmtD(r.order_by)} – <b>اطلب النهارده</b>` : `🗓 اطلب قبل <b>${fmtD(r.order_by)}</b>`} (مطلوب في الموقع ${fmtD(r.need_by)} · مدة التوريد ${r.lead_days} يوم)</div>` : ''}${(r.items || []).length ? `<div style="font-size:12px;margin-top:3px">للبنود: ${(r.items || []).slice(0, 4).map(i => `${esc(i.code)} (${nf(i.need, 1)})`).join(' · ')}</div>` : ''}</div>` : ''}
      ${+r.issued > 0 && +r.consumed_est > 0 && +r.issued - +r.consumed_est > 0.05 * +r.consumed_est ? `<div class="mut" style="font-size:12px;margin-top:6px;color:var(--warn)">⚠ المنصرف أكتر من الاستهلاك المحسوب بـ ${nf(+r.issued - +r.consumed_est, 1)} – هالك أو صرف زيادة؟</div>` : ''}
      <div class="mact"><button type="button" data-why="${r.material_id}">🔍 مبني على إيه؟</button>${mv ? `<button type="button" data-q="receipt" data-m="${r.material_id}">+ وارد</button><button type="button" data-q="issue" data-m="${r.material_id}">− صرف</button>` : ''}</div></div>`; };
  const order = { bad: 0, warn: 1, ok: 2, idle: 3, follow: 4 };
  const itemOpt = '<option value="">— بدون بند —</option>' + P.items.filter(i => +i.qty > 0).map(i => `<option value="${esc(i.id)}">${esc(i.code + ' ' + i.name.slice(0, 55) + (i.building ? ' – ' + i.building : ''))}</option>`).join('');
  const form = `<form id="mvF" class="card mvform"><div class="seg mk">${Object.entries(MVK).map(([k, [l, , ic]]) => `<button type="button" data-kind="${k}" class="${k === 'receipt' ? 'on' : ''}">${ic} ${l.split(' /')[0]}</button>`).join('')}</div><input type="hidden" name="kind" value="receipt">
    <div class="grid" style="margin-top:10px"><label>الخامة<select name="mat" required>${M.map(m => `<option value="${m.id}">${micon(m.name)} ${esc(m.name)} (${esc(m.unit)})</option>`).join('')}</select></label>
    <label>الكمية<input name="qty" type="number" step="any" inputmode="decimal" required></label><label>التاريخ<input name="d" type="date" value="${today()}"></label>
    <label data-k="receipt">المورد<input name="sup"></label><label data-k="issue return" class="wide">للبند<select name="item">${itemOpt}</select></label><label class="wide">ملاحظات<input name="note"></label></div>
    <div class="acts"><button class="p">تسجيل الحركة</button></div><p class="mut" style="margin:0;font-size:12px">الرصيد الموجود فعلاً سجّله كـ"تسوية". التسوية ممكن تكون بالسالب لو الجرد طلع أقل.</p></form>`;
  const movesHtml = MV.length ? `<div class="mvlist">${MV.map(x => `<div class="mvrow" style="--c:${col(x.material_id)}"><span class="mvic k-${x.kind}">${MVK[x.kind][2]}</span><div style="flex:1;min-width:0"><b>${MVK[x.kind][0].split(' /')[0]} ${esc(mName(x.material_id))}</b><div class="mut" style="font-size:12px">${fmtD(x.move_date)}${x.item_id ? ' · ' + esc(P.items.find(i => i.id === x.item_id)?.code || '') : ''}${x.supplier ? ' · ' + esc(x.supplier) : ''}${x.note ? ' · ' + esc(x.note) : ''}</div></div><b class="mvq">${x.kind === 'issue' || (x.kind === 'adjust' && +x.qty < 0) ? '−' : '+'}${nf(Math.abs(x.qty), 2)} <small>${esc(mUnit(x.material_id))}</small></b>${x.created_by === S.user.id || role(P.id) === 'management' ? `<button type="button" data-mvdel="${x.id}" class="danger xs">✕</button>` : ''}</div>`).join('')}</div>` : '<div class="note">لسه مفيش حركات مسجلة. ابدأ بتسجيل الرصيد الافتتاحي لكل خامة كـ"تسوية".</div>';
  const settings = ed ? `<div class="card"><h4 style="margin-top:0">الخامات</h4><div class="scroll"><table class="stack medt"><thead><tr><th>الخامة</th><th>الوحدة</th><th>أسماء في التقارير</th><th>حد أدنى</th><th>مطلوبة إمتى</th><th>مدة التوريد (يوم)</th><th>بتتخزن</th></tr></thead><tbody>${M.map(m => `<tr data-mid="${m.id}"><td data-l="الخامة"><span class="dot" style="background:${col(m.id)}"></span><input data-k="name" value="${esc(m.name)}" style="width:calc(100% - 18px)"></td><td data-l="الوحدة"><input data-k="unit" value="${esc(m.unit)}" style="width:90px"></td><td data-l="أسماء في التقارير"><input data-k="aliases" value="${esc((m.aliases || []).join('، '))}"></td><td data-l="حد أدنى"><input data-k="min_stock" type="number" step="any" value="${+m.min_stock || 0}" style="width:90px"></td><td data-l="مطلوبة إمتى"><select data-k="stage" style="min-height:36px;font-size:13px"><option value="prep"${m.stage === 'prep' ? ' selected' : ''}>أول التجهيز (نجارة/حدادة)</option><option value="exec"${m.stage !== 'prep' ? ' selected' : ''}>وقت التنفيذ/الصب</option></select></td><td data-l="مدة التوريد"><input data-k="lead_days" type="number" value="${m.lead_days ?? 3}" style="width:70px"></td><td data-l="بتتخزن"><input data-k="stocked" type="checkbox"${m.stocked ? ' checked' : ''} style="width:auto;min-height:0"></td></tr>`).join('')}</tbody></table></div>
    <div class="acts"><button id="matSave" class="p">حفظ الخامات</button><button id="matAdd">+ خامة</button></div></div>
    <div class="card" style="margin-top:12px"><h4 style="margin-top:0">معدلات الاستهلاك</h4><p class="mut" style="margin-top:-4px;font-size:13px">لكل خامة: البنود اللي اسمها أو مجموعتها فيها الكلمات دي (افصل بـ |)، والكمية من الخامة لكل وحدة من البند. مثال: حديد · سقف|كمر · م3 · 0.11 = 110 كجم حديد لكل م3 أسقف.</p>
    <div class="scroll"><table class="stack"><thead><tr><th>الخامة</th><th>كلمات البند</th><th>وحدة البند</th><th>المرحلة</th><th class="n">المعدل</th><th></th></tr></thead><tbody>${N.filter(n => !n.project_id || n.project_id === P.id).map(n => `<tr><td data-l="الخامة"><span class="dot" style="background:${col(n.material_id)}"></span>${esc(mName(n.material_id))}</td><td data-l="كلمات البند" dir="auto">${esc(n.pattern)}</td><td data-l="وحدة البند">${esc(n.item_unit || 'أي وحدة')}</td><td data-l="المرحلة">${n.phase_n || 'الكل'}</td><td class="n" data-l="المعدل">${nf(n.rate, 4)} ${esc(mUnit(n.material_id))}${n.note ? `<div class="mut" style="font-size:11px">${esc(n.note)}</div>` : ''}</td><td><button type="button" data-ndel="${n.id}" class="danger xs">✕</button></td></tr>`).join('')}</tbody></table></div>
    <form id="nF" class="grid" style="margin-top:8px"><label>الخامة<select name="mat">${M.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label><label>كلمات البند<input name="pat" required placeholder="مثلاً: مباني|طوب"></label><label>وحدة البند<input name="unit" placeholder="م2"></label><label>المرحلة<select name="ph"><option value="">الكل</option>${P.phaseProg.map(x => `<option value="${x.n}">${x.n}. ${esc(x.name)}</option>`).join('')}</select></label><label>المعدل<input name="rate" type="number" step="any" required></label><label>ملاحظة<input name="note"></label><div class="acts" style="margin:0;align-self:end"><button class="p">إضافة معدل</button></div></form></div>` : '';
  const canPrep = ['site', 'tech', 'management', 'store'].includes(role(P.id)) || S.admin;
  const tabs = [['moves', `الحركات (${MV.length})`], mv && ['new', '+ تسجيل حركة'], canPrep && ['prep', '🗓 تجهيز البنود'], unmatched.length && ['unm', `توريدات مش متعرّفة (${unmatched.length})`], ed && ['set', '⚙️ الخامات والمعدلات']].filter(Boolean);
  if (!tabs.some(t => t[0] === T.tab)) T.tab = 'moves';
  const pane = T.tab === 'new' ? form : T.tab === 'prep' ? prepPane(N, M) : T.tab === 'set' ? settings : T.tab === 'unm' ? `<div class="card"><p class="mut" style="margin-top:0">الأسماء دي جت في توريدات التقارير ومش متربطة بخامة. ضيفها في "أسماء في التقارير" للخامة المناسبة من تبويب الإعدادات عشان تتحسب في الوارد.</p>${unmatched.slice(0, 40).map(t => `<span class="chip3">${esc(t)}</span>`).join(' ')}</div>` : movesHtml;
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">المخزن</h2><p class="mut" style="margin:2px 0 0;font-size:13px">المتابعة من ${fmtD(start)}${ed ? ' · <a href="#" id="stStart">تغيير</a>' : ''} · <a href="#" id="stHow">إزاي بيتحسب؟</a></p></div></div>
  <div class="note" id="stHowT" hidden>الوارد = توريدات التقارير المعتمدة + أذون الوارد. الرصيد = الوارد − أذون الصرف، ولو مفيش أذون صرف بيتحسب الاستهلاك من الكميات المنفذة × معدلات الاستهلاك. المطلوب = الكمية الباقية في البنود الجارية والبادئة خلال أسبوعين × المعدل + الحد الأدنى.</div>
  <div class="kpis"><div class="kpi k-bad"><b>${nShort}</b><span>خامات ناقصة</span></div><div class="kpi k-warn"><b>${nWarn}</b><span>قربت تخلص</span></div><div class="kpi k-ok"><b>${nOk}</b><span>كافية</span></div><div class="kpi"><b>${MV.length}</b><span>حركة مسجلة</span></div></div>
  <div class="mgrid">${info.sort((x, y) => order[x.stt[0]] - order[y.stt[0]]).map(card).join('')}</div>
  <div class="sttabs"><div class="seg">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${T.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div style="margin-top:10px">${pane}</div>`;
  const re = () => renderStore();
  bindPrep(re);
  $('#stHow').onclick = e => { e.preventDefault(); $('#stHowT').hidden = !$('#stHowT').hidden; };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; re(); });
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { T.tab = 'new'; T.pre = { kind: b.dataset.q, mat: b.dataset.m }; re(); });
  const f = $('#mvF'); if (f) { const setK = k => { f.kind.value = k; f.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x.dataset.kind === k)); f.querySelectorAll('[data-k]').forEach(x => x.hidden = !x.dataset.k.split(' ').includes(k)); };
    f.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => setK(b.dataset.kind)); setK(T.pre?.kind || 'receipt'); if (T.pre?.mat) f.mat.value = T.pre.mat; T.pre = null; f.scrollIntoView({ block: 'nearest' });
    f.onsubmit = async e => { e.preventDefault(); const g = n => f[n].value; const row = { project_id: P.id, material_id: g('mat'), kind: g('kind'), qty: +g('qty'), move_date: g('d') || today(), item_id: ['issue', 'return'].includes(g('kind')) ? g('item') || null : null, supplier: g('kind') === 'receipt' ? g('sup').trim() || null : null, note: g('note').trim() || null };
      if (row.kind !== 'adjust' && !(row.qty > 0)) return toast('الكمية لازم تكون أكبر من صفر'); const { error } = await S.sb.from('stock_moves').insert(row); if (error) return toast(error.message); toast('اتسجلت الحركة'); T.tab = 'moves'; re(); }; }
  $('#stStart') && ($('#stStart').onclick = async e => { e.preventDefault(); const d = prompt('تاريخ بداية متابعة المخزن (YYYY-MM-DD)', start); if (!d) return; const { error } = await S.sb.from('stock_settings').upsert({ project_id: P.id, start_date: d }); if (error) return toast(error.message); re(); });
  $('#matAdd') && ($('#matAdd').onclick = async () => { const { error } = await S.sb.from('materials').insert({ name: 'خامة جديدة ' + (M.length + 1), unit: 'وحدة', sort: M.length + 1 }); if (error) return toast(error.message); re(); });
  $('#matSave') && ($('#matSave').onclick = async () => { const rows = [...document.querySelectorAll('.medt tr[data-mid]')].map(tr => { const g = k => tr.querySelector(`[data-k=${k}]`); return { id: tr.dataset.mid, name: g('name').value.trim(), unit: g('unit').value.trim(), aliases: g('aliases').value.split(/[،,]/).map(x => x.trim()).filter(Boolean), min_stock: +g('min_stock').value || 0, stocked: g('stocked').checked, stage: g('stage').value, lead_days: +g('lead_days').value || 0 }; });
    const { error } = await S.sb.from('materials').upsert(rows); if (error) return toast(error.message); toast('اتحفظت الخامات'); re(); });
  const nf2 = $('#nF'); if (nf2) nf2.onsubmit = async e => { e.preventDefault(); const g = n => nf2[n].value; const { error } = await S.sb.from('material_norms').insert({ project_id: P.id, material_id: g('mat'), pattern: g('pat').trim(), item_unit: g('unit').trim() || null, phase_n: g('ph') ? +g('ph') : null, rate: +g('rate'), note: g('note').trim() || null }); if (error) return toast(error.message); toast('اتضاف المعدل'); re(); };
  $('#main').onclick = async e => { const wy = e.target.closest('[data-why]'); if (wy) return stockWhy(wy.dataset.why, R.find(x => x.material_id === wy.dataset.why), set.data?.start_date || today()); const d1 = e.target.closest('[data-mvdel]'), d2 = e.target.closest('[data-ndel]'); const b = d1 || d2; if (!b) return; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; }
    const { error } = d1 ? await S.sb.from('stock_moves').delete().eq('id', d1.dataset.mvdel) : await S.sb.from('material_norms').delete().eq('id', d2.dataset.ndel); if (error) return toast(error.message); re(); };
}

/* ---------------- full project report (from home) ---------------- */
async function projectReport(pid, btn) {
  const w = window.open('', '_blank'); if (!w) return toast('المتصفح منع فتح نافذة التقرير، اسمح بالنوافذ المنبثقة');
  w.document.write('<p style="font-family:sans-serif;direction:rtl;padding:30px">جاري تجهيز التقرير…</p>');
  if (btn) btn.disabled = true;
  const saved = S.P; S.P = { id: pid };
  try {
    await loadProject(pid); const P = S.P, p = P.proj, r = role(pid), tdy = today();
    const showCost = can('ledger', pid) || ['tech'].includes(r) || S.admin, isOwner = r === 'owner' && !S.admin;
    const [sa, sp, cl, lg, iv, st, su] = await Promise.all([
      S.sb.from('schedule_activities').select('*').eq('project_id', pid).order('sort'), S.sb.rpc('schedule_progress', { p_project: pid }),
      S.sb.from('contract_lines').select('*').eq('project_id', pid).order('sort'),
      showCost ? S.sb.rpc('ledger_summary', { p_project: pid }) : Promise.resolve({ data: [] }),
      can('inv', pid) ? S.sb.from('owner_invoices').select('*').eq('project_id', pid).order('no') : Promise.resolve({ data: [] }),
      can('store', pid) ? S.sb.rpc('stock_status2', { p_project: pid }) : Promise.resolve({ data: [] }),
      S.sb.rpc('site_updates', { p_project: pid, p_n: 14 })]);
    const PP = P.phaseProg || [], ov = overall(PP), contract = (cl.data || []).reduce((s, x) => s + (+x.amount || +x.value || 0), 0) || P.items.reduce((s, i) => s + (+i.camt || 0), 0);
    // schedule
    const prog = Object.fromEntries((sp.data || []).map(x => [x.activity_id, x])), A = (sa.data || []), par = new Set(A.map(a => a.parent_id).filter(Boolean));
    const leaf = A.filter(a => !par.has(a.id) && a.start && a.finish).map(a => { const pr = prog[a.id]?.pct; const s0 = new Date(a.start), f0 = new Date(a.finish), t = new Date(tdy); const plan = t <= s0 ? 0 : t >= f0 ? 1 : (t - s0) / Math.max(f0 - s0, 864e5); return { ...a, pct: pr == null ? null : +pr, plan }; });
    const late = leaf.filter(a => a.pct != null && a.pct < 0.999 && (a.finish < tdy || a.plan - a.pct > 0.15)).sort((x, y) => (y.plan - (y.pct || 0)) - (x.plan - (x.pct || 0)));
    const soon = leaf.filter(a => a.start > tdy && a.start <= addDaysISO(tdy, 21));
    const planAll = leaf.length ? leaf.reduce((s, a) => s + a.plan, 0) / leaf.length : null, actAll = leaf.filter(a => a.pct != null).length ? leaf.filter(a => a.pct != null).reduce((s, a) => s + a.pct, 0) / leaf.filter(a => a.pct != null).length : null;
    // site
    const U = su.data || [], lab = U.length ? Math.round(U.reduce((s, u) => s + (+u.labor || 0), 0) / U.length) : 0;
    const acts = U.flatMap(u => (u.acts || []).map(a => ({ d: u.report_date, t: a.desc || a.text || a.title || a.activity || (typeof a === 'string' ? a : ''), b: a.building || '' }))).filter(a => a.t).slice(0, 25);
    const inProg = P.items.filter(i => +i.qty > 0 && i.ex > 0 && i.ex < +i.qty * 0.999).sort((a, b) => (b.camt || 0) - (a.camt || 0)).slice(0, 15);
    // cost
    const LG = lg.data || [], act = n => LG.filter(x => x.phase_n === n).reduce((s, x) => s + +x.expense, 0);
    const costRows = PP.map(x => { const it = P.items.filter(i => i.phase_n === x.n), c = it.reduce((s, i) => s + (+i.camt || 0), 0), u = it.reduce((s, i) => s + updVal(i), 0), a = act(x.n); return { ...x, c, u: Math.max(u, a), a }; });
    const ct = k => costRows.reduce((s, x) => s + x[k], 0);
    // invoices
    const I = (iv.data || []).filter(i => !isOwner || i.status !== 'draft'), Itot = I.reduce((s, i) => s + invSum(i), 0), Inet = I.reduce((s, i) => s + invPay(i).net, 0), lastI = I[I.length - 1];
    // tech office & store
    const miss = P.items.filter(lacks), checks = P.check || [], openC = c => checks.filter(x => x.category === c && x.status !== 'approved').length;
    const short = (st.data || []).filter(x => +x.shortage > 0);
    const pend = P.reports.filter(x => x.status === 'submitted').length, lastRep = P.reports.find(x => x.status === 'approved')?.report_date;
    // key points
    const K = [`نسبة الإنجاز الكلية <b>${Math.round(ov * 100)}%</b>${planAll != null ? ` مقابل مخطط ${Math.round(planAll * 100)}% حسب الجدول الزمني` : ''}.`,
      late.length ? `<b class="bad">${late.length}</b> نشاط متأخر في الجدول الزمني.` : leaf.length ? 'مفيش أنشطة متأخرة في الجدول الزمني.' : '',
      U.length ? `متوسط العمالة في آخر ${U.length} تقرير: <b>${lab}</b> عامل/يوم. آخر تقرير معتمد ${lastRep ? fmtD(lastRep) : '–'}.` : '',
      !isOwner && miss.length ? `<b>${miss.length}</b> بند في المقايسة ناقص تسعير أو كمية (${miss.filter(i => i.phase_n > 4).length} منهم بعد الهيكل).` : '',
      short.length ? `<b class="bad">نقص خامات</b>: ${short.map(x => `${esc(x.name)} ${nf(x.shortage, 1)} ${esc(x.unit)}`).join('، ')}.` : '',
      lastI ? `آخر مستخلص: ${esc(lastI.title || '')} – المستحق صرفه ${nf(invPay(lastI).net, 0)} ج.م (${IST[lastI.status][1]}).` : '',
      showCost && !isOwner && LG.length ? `التكلفة الفعلية المصروفة ${nf(ct('a'), 0)} ج.م من قيمة عقد ${nf(contract, 0)} ج.م.` : ''].filter(Boolean);
    const bar = (v, c = '#f26b1d') => `<div class="br"><u style="width:${Math.min(Math.max(v, 0), 1) * 100}%;background:${c}"></u></div>`;
    const sec = (t, body) => body ? `<section><h2>${t}</h2>${body}</section>` : '';
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير شامل – ${esc(p.name)} – ${tdy}</title><base href="${location.href.split('#')[0]}"><style>
    @page{size:A4;margin:14mm}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#1b1c1e;margin:0;font-size:12.5px;line-height:1.55}
    .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f26b1d;padding-bottom:10px}.logo .lk{display:none}.logo img{height:52px}
    h1{margin:0;font-size:24px}h2{font-size:16px;margin:0 0 8px;padding:4px 10px;background:#1b1c1e;color:#fff;border-radius:6px}section{margin-top:16px;break-inside:avoid-page}
    .mut{color:#6b6c6f}.bad{color:#b3261e}.ok{color:#1d7a4f}.kp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.kp div{border:1px solid #d7d5ce;border-radius:10px;padding:8px 10px}.kp b{display:block;font-size:22px;color:#f26b1d}.kp span{font-size:11px;color:#6b6c6f}
    table{width:100%;border-collapse:collapse}th{background:#f1efe9;text-align:right;padding:5px 6px;font-size:11.5px;border-bottom:1px solid #d7d5ce}td{padding:4px 6px;border-bottom:1px solid #eceae4;vertical-align:top}td.n,th.n{text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}tr.t td{font-weight:700;border-top:2px solid #1b1c1e}
    .br{height:9px;background:#eceae4;border-radius:9px;overflow:hidden;min-width:120px}.br u{display:block;height:100%;float:right}
    ul.k{margin:6px 0;padding-right:18px}ul.k li{margin:3px 0}.foot{margin-top:20px;font-size:10.5px;color:#6b6c6f;border-top:1px solid #d7d5ce;padding-top:6px;display:flex;justify-content:space-between}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.chip{display:inline-block;padding:0 7px;border-radius:99px;background:#f1efe9;font-size:11px}
    @media print{.np{display:none}}.np{position:fixed;bottom:14px;left:14px}.np button{font:inherit;padding:8px 16px;border-radius:8px;border:0;background:#f26b1d;color:#fff;cursor:pointer}
    </style></head><body><div class="np"><button onclick="print()">🖨 طباعة / PDF</button></div>
    <div class="top"><div><h1>${esc(p.name)}</h1><div class="mut">${esc(p.place || '')}${p.land ? ' · أرض ' + esc(p.land) : ''} · المالك: ${esc(p.owner_name || '')} · الاستشاري: ${esc(p.consultant_name || '')}</div><div style="margin-top:4px"><b>تقرير شامل عن المشروع</b> · ${new Date(tdy + 'T12:00:00Z').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${LOGO()}</div>
    <div class="kp"><div><b>${Math.round(ov * 100)}%</b><span>الإنجاز الكلي</span></div><div><b>${planAll != null ? Math.round(planAll * 100) + '%' : '–'}</b><span>المخطط حسب الجدول</span></div><div><b>${nf(contract / 1e6, 2)} م</b><span>قيمة العقد</span></div><div><b>${I.length ? nf(Itot / 1e6, 2) + ' م' : '–'}</b><span>إجمالي المستخلصات</span></div></div>
    ${sec('أهم النقاط', `<ul class="k">${K.map(x => `<li>${x}</li>`).join('')}</ul>`)}
    ${sec('الإنجاز حسب المراحل', `<table><thead><tr><th>المرحلة</th><th class="n">الوزن</th><th style="width:45%">الإنجاز</th><th class="n">%</th></tr></thead><tbody>${PP.map(x => `<tr><td>${x.n}. ${esc(x.name)}</td><td class="n">${Math.round((+x.weight || 0) * 1000) / 10}%</td><td>${bar(+x.pct)}</td><td class="n"><b>${Math.round(+x.pct * 100)}%</b></td></tr>`).join('')}<tr class="t"><td>المشروع</td><td></td><td>${bar(ov)}</td><td class="n">${Math.round(ov * 100)}%</td></tr></tbody></table>`)}
    ${sec('الجدول الزمني', leaf.length ? `<p class="mut" style="margin:0 0 6px">${leaf.length} نشاط · المخطط لحد النهارده ${Math.round(planAll * 100)}% · الفعلي ${actAll != null ? Math.round(actAll * 100) + '%' : '–'}</p>
      ${late.length ? `<b class="bad">أنشطة متأخرة (${late.length})</b><table><thead><tr><th>النشاط</th><th>النهاية المخططة</th><th class="n">المخطط</th><th class="n">الفعلي</th></tr></thead><tbody>${late.slice(0, 15).map(a => `<tr><td>${esc(a.name)}</td><td>${fmtD(a.finish)}</td><td class="n">${Math.round(a.plan * 100)}%</td><td class="n bad">${Math.round(a.pct * 100)}%</td></tr>`).join('')}</tbody></table>` : '<p class="ok">✓ مفيش أنشطة متأخرة.</p>'}
      ${soon.length ? `<b style="display:block;margin-top:8px">أنشطة هتبدأ خلال 3 أسابيع</b><table><tbody>${soon.slice(0, 10).map(a => `<tr><td>${esc(a.name)}</td><td class="n">${fmtD(a.start)} ← ${fmtD(a.finish)}</td></tr>`).join('')}</tbody></table>` : ''}` : '<p class="mut">لسه مفيش جدول زمني متسجل.</p>')}
    ${sec('الموقع – آخر أسبوعين', (U.length || inProg.length) ? `<div class="two"><div><b>البنود الجاري تنفيذها</b><table><tbody>${inProg.map(i => `<tr><td>${esc(i.code)} ${esc(i.name.slice(0, 60))}${i.building ? ` <span class="chip">${esc(i.building)}</span>` : ''}</td><td style="width:90px">${bar(i.pct)}</td><td class="n">${Math.round(i.pct * 100)}%</td></tr>`).join('') || '<tr><td class="mut">–</td></tr>'}</tbody></table></div>
      <div><b>من التقارير اليومية</b> <span class="mut">(متوسط ${lab} عامل/يوم)</span><table><tbody>${acts.map(a => `<tr><td class="n mut">${fmtD(a.d)}</td><td>${esc(String(a.t).slice(0, 110))}${a.b ? ` <span class="chip">${esc(a.b)}</span>` : ''}</td></tr>`).join('') || '<tr><td class="mut">مفيش تقارير معتمدة حديثة.</td></tr>'}</tbody></table></div></div>` : '')}
    ${showCost && !isOwner ? sec('التكلفة حسب المراحل', `<table><thead><tr><th>المرحلة</th><th class="n">التعاقدي</th><th class="n">المحدّث</th><th class="n">الفعلي المصروف</th><th class="n">الفعلي ÷ التعاقدي</th></tr></thead><tbody>${costRows.map(x => `<tr><td>${x.n}. ${esc(x.name)}</td><td class="n">${nf(x.c, 0)}</td><td class="n">${nf(x.u, 0)}</td><td class="n">${x.a ? nf(x.a, 0) : '–'}</td><td class="n ${x.c && x.a > x.c ? 'bad' : ''}">${x.c && x.a ? Math.round(x.a / x.c * 100) + '%' : '–'}</td></tr>`).join('')}<tr class="t"><td>الإجمالي</td><td class="n">${nf(ct('c'), 0)}</td><td class="n">${nf(ct('u'), 0)}</td><td class="n">${nf(ct('a'), 0)}</td><td class="n">${ct('c') ? Math.round(ct('a') / ct('c') * 100) + '%' : '–'}</td></tr></tbody></table><p class="mut" style="margin:4px 0 0;font-size:11px">التعاقدي من قيمة العقد · المحدّث من أسعار البنود (توريد ومصنعيات) أو الفعلي لو أكبر · الفعلي من شيت الحسابات.</p>`) : ''}
    ${I.length ? sec('المستخلصات', `<table><thead><tr><th>المستخلص</th><th>التاريخ</th><th>الحالة</th><th class="n">إجمالي الأعمال</th><th class="n">المستحق صرفه</th></tr></thead><tbody>${I.map(i => `<tr><td>${esc(i.title || 'مستخلص ' + i.no)}</td><td>${i.inv_date ? fmtD(i.inv_date) : '–'}</td><td>${IST[i.status][1]}</td><td class="n">${nf(invSum(i), 0)}</td><td class="n">${nf(invPay(i).net, 0)}</td></tr>`).join('')}<tr class="t"><td colspan="3">الإجمالي</td><td class="n">${nf(Itot, 0)}</td><td class="n">${nf(Inet, 0)}</td></tr></tbody></table>`) : ''}
    ${!isOwner && can('tasks', pid) ? sec('جاهزية المكتب الفني', `<table><thead><tr><th>المرحلة</th><th class="n">بنود ناقصة تسعير</th><th class="n">تصاميم مفتوحة</th><th class="n">خامات محتاجة اعتماد</th></tr></thead><tbody>${PP.filter(x => x.n > 4).concat(PP.filter(x => x.n <= 4)).map(x => { const m = P.items.filter(i => i.phase_n === x.n && lacks(i)).length, d = checks.filter(c => c.phase_n === x.n && c.category === 'design' && c.status !== 'approved').length, mt = checks.filter(c => c.phase_n === x.n && c.category === 'material' && c.status !== 'approved').length; return `<tr><td>${x.n}. ${esc(x.name)}${x.n > 4 ? ' ★' : ''}</td><td class="n ${m ? 'bad' : 'ok'}">${m || '✓'}</td><td class="n">${d || '–'}</td><td class="n">${mt || '–'}</td></tr>`; }).join('')}<tr class="t"><td>الإجمالي</td><td class="n">${miss.length}</td><td class="n">${openC('design')}</td><td class="n">${openC('material')}</td></tr></tbody></table>`) : ''}
    ${(st.data || []).length ? sec('المخزن', `<table><thead><tr><th>الخامة</th><th class="n">الرصيد</th><th class="n">مطلوب للبنود الجارية</th><th class="n">النقص</th></tr></thead><tbody>${(st.data || []).filter(x => +x.balance_est || +x.needed || +x.rec_reports || +x.rec_moves).map(x => `<tr><td>${esc(x.name)} <span class="mut">(${esc(x.unit)})</span></td><td class="n">${nf(+x.issued > 0 ? x.balance : x.balance_est, 1)}</td><td class="n">${+x.needed ? nf(x.needed, 1) : '–'}</td><td class="n ${+x.shortage > 0 ? 'bad' : ''}">${+x.shortage > 0 ? nf(x.shortage, 1) : '✓'}</td></tr>`).join('') || '<tr><td class="mut">مفيش حركة مخزن.</td></tr>'}</tbody></table>`) : ''}
    ${!isOwner ? sec('التقارير اليومية', `<p style="margin:0">آخر تقرير معتمد: <b>${lastRep ? fmtD(lastRep) : '–'}</b> · تقارير مستنية مراجعة: <b class="${pend ? 'bad' : ''}">${pend}</b> · إجمالي التقارير المعتمدة: ${P.reports.filter(x => x.status === 'approved').length}</p>`) : ''}
    <div class="foot"><span>RESAN On the go · ${esc(ROLE[r] || (S.admin ? 'الإدارة' : ''))}</span><span>اتطلع ${new Date().toLocaleString('ar-EG')}</span></div>
    <script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  } catch (e) { w.close(); toast('مقدرتش أجهّز التقرير: ' + e.message); }
  finally { S.P = saved; if (btn) btn.disabled = false; }
}
const addDaysISO = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/* ---------------- owner invoices (المستخلصات) ---------------- */
const ICAT = { design: 'التصميمات', contract: 'الأعمال التعاقدية', supply: 'التوريدات والمشتريات', extra: 'المصروفات الإضافية' };
const ICUM = c => c === 'design' || c === 'contract';
const IST = { draft: ['pend', 'مسودة'], submitted: ['run', 'اتقدّم للمالك'], approved: ['appr', 'معتمد'], paid: ['appr', 'اتصرف'] };
const lnVal = l => l.kind !== 'line' ? 0 : ICUM(l.cat) ? (+l.prev_qty + +l.cur_qty) * +l.rate * +l.pct : +l.cur_qty * +l.rate * +l.pct;
const lnCur = l => l.kind !== 'line' ? 0 : ICUM(l.cat) ? lnVal(l) - +l.prev_value : lnVal(l);
const invTot = L => { const t = { design: 0, contract: 0, supply: 0, extra: 0, cumDesign: 0, cumContract: 0, prevContract: 0, prevDesign: 0 }; L.forEach(l => { t[l.cat] += lnCur(l); if (l.cat === 'contract') { t.cumContract += lnVal(l); t.prevContract += +l.prev_value; } if (l.cat === 'design') { t.cumDesign += lnVal(l); t.prevDesign += +l.prev_value; } }); return t; };
const invSum = i => +i.amt_design + +i.amt_contract + +i.amt_supply + +i.amt_extra;
const invPay = i => { const w = invSum(i); return { works: w, worksPay: w * +i.pay_pct, fee: w * +i.fee_pct, net: w * +i.pay_pct + w * +i.fee_pct }; };
/* ---------------- accounts: invoices, payments received per invoice, advance payments, actual cost ---------------- */
const PAYK = { advance: 'دفعة مقدمة', invoice: 'دفعة مستخلص', other: 'دفعة أخرى' }, PAYM = ['تحويل بنكي', 'شيك', 'نقدي', 'إيداع'];
async function payForm(kind, x = {}, inv = null, done, pre = {}) {
  const P = S.P, [iv, py] = await Promise.all([S.sb.from('owner_invoices').select('*').eq('project_id', P.id).order('no'), S.sb.from('owner_payments').select('*').eq('project_id', P.id)]);
  const R = (iv.data || []).map(i => { const p = invPay(i), paid = (py.data || []).filter(y => y.kind === 'invoice' && y.invoice_id === i.id && y.status === 'received' && y.id !== x.id).reduce((s, y) => s + +y.amount, 0); return { i, rem: Math.max(p.net - paid, 0) }; });
  await loadAccs(); const d = document.createElement('dialog'); d.className = 'adlg'; const r0 = inv && R.find(r => r.i.id === inv);
    d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${x.id ? 'تعديل دفعة' : pre.title || '+ وارد – ' + PAYK[kind]}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px">
      <label>النوع<select name="kind">${Object.entries(PAYK).map(([k, l]) => `<option value="${k}"${k === (x.kind || kind) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label data-k="invoice">المستخلص<select name="inv">${R.filter(r => r.i.status !== 'draft').map(r => `<option value="${r.i.id}"${r.i.id === (x.invoice_id || inv) ? ' selected' : ''}>مستخلص ${r.i.no} – متبقي ${nf(r.rem, 0)}</option>`).join('')}</select></label>
      <label>المبلغ (ج.م)<input name="amount" type="number" step="any" inputmode="decimal" required value="${x.amount ?? pre.amount ?? (r0 ? Math.round(r0.rem) || '' : '')}"></label>
      <label>التاريخ<input type="date" name="date" value="${x.pay_date || today()}"></label>
      <label>الحالة<select name="status"><option value="received">مستلمة</option><option value="requested"${(x.status || pre.status) === 'requested' ? ' selected' : ''}>مطلوبة – لسه ماوصلتش</option></select></label>
      ${S.finAny ? `<label>اتحط في حساب${accSel('acc', x.id ? x.account_id : (pre.acc || (S.accs || []).find(a => a.kind === 'bank' && a.active)?.id), '— مش محدد —')}</label>` : ''}<label>طريقة الدفع<select name="method"><option value="">—</option>${PAYM.map(m => `<option${m === x.method ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <label>رقم التحويل / الشيك<input name="ref" value="${esc(x.ref || '')}"></label>
      <fieldset data-k="advance" class="wide phs"><legend>الدفعة المقدمة على مرحلة</legend>${P.phaseProg.map(ph => `<label class="chk"><input type="checkbox" name="ph" value="${ph.n}"${(x.phase_ns || pre.phases || []).includes(ph.n) ? ' checked' : ''}> ${ph.n}. ${esc(ph.name)}</label>`).join('')}</fieldset>
      <label class="wide">ملاحظات<input name="notes" value="${esc(x.notes || pre.notes || '')}"></label>
      <div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
    document.body.append(d); d.showModal(); const f = d.querySelector('form'), sync = () => d.querySelectorAll('[data-k]').forEach(e => e.hidden = e.dataset.k !== f.kind.value); f.kind.onchange = sync; sync();
    f.inv.onchange = () => { const r = R.find(r => r.i.id === f.inv.value); if (r && !x.id) f.amount.value = Math.round(r.rem) || ''; };
    d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
    f.onsubmit = async e => { e.preventDefault(); const k = f.kind.value, rec = { project_id: P.id, kind: k, invoice_id: k === 'invoice' ? f.inv.value || null : null, phase_ns: k === 'advance' ? [...f.querySelectorAll('[name=ph]:checked')].map(c => +c.value) : null, amount: +f.amount.value, pay_date: f.date.value || null, status: f.status.value, method: f.method.value || null, ref: f.ref.value.trim() || null, notes: f.notes.value.trim() || null }; if (f.acc) rec.account_id = f.acc.value || null;
      if (!(rec.amount > 0)) return toast('اكتب المبلغ'); if (k === 'invoice' && !rec.invoice_id) return toast('اختار المستخلص');
      const { error } = x.id ? await S.sb.from('owner_payments').update(rec).eq('id', x.id) : await S.sb.from('owner_payments').insert(rec); if (error) return toast(error.message);
      d.close(); d.remove(); toast('اتسجلت الدفعة'); (done || renderAcct)(); };
}

/* ---------------- phase cash statement: advances vs inflow vs outflow ---------------- */
async function renderPhFin() {
  const P = S.P, ed = can('acctEdit', P.id), proj = S.projects.find(p => p.id === P.id);
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const [pj, ph, iv, py, lg] = await Promise.all([S.sb.from('projects').select('adv_pct,fee_rate').eq('id', P.id).single(), S.sb.from('phases').select('*').eq('project_id', P.id).order('n'), S.sb.from('owner_invoices').select('*').eq('project_id', P.id).order('no'), S.sb.from('owner_payments').select('*').eq('project_id', P.id), S.sb.rpc('ledger_summary', { p_project: P.id })]);
  const AP = +(pj.data?.adv_pct ?? 0.5), PH = ph.data || [], I = (iv.data || []).filter(i => i.status !== 'draft'), PY = py.data || [], LG = lg.data || [];
  const { data: LN } = I.length ? await S.sb.from('owner_invoice_lines').select('invoice_id,cat,kind,rate,prev_qty,cur_qty,pct,prev_value,phase_n').in('invoice_id', I.map(i => i.id)) : { data: [] };
  const sum = (A, f) => A.reduce((s, x) => s + (+f(x) || 0), 0), got = x => x.status === 'received', Z = () => Object.fromEntries(PH.map(p => [p.n, 0]));
  const exp = Z(); let expNone = 0; LG.forEach(x => { if (x.phase_n && x.phase_n in exp) exp[x.phase_n] += +x.expense; else expNone += +x.expense; });
  const expTot = sum(PH, p => exp[p.n]) || 1, ledRev = sum(LG, x => x.revenue);
  // works per phase for each invoice: lines → manual split → estimate by actual cost
  const W = {}; I.forEach(i => { const w = invSum(i), L = (LN || []).filter(l => l.invoice_id === i.id && l.kind === 'line'), m = Z(); let src;
    if (i.phase_split && Object.keys(i.phase_split).length) { Object.entries(i.phase_split).forEach(([n, v]) => { if (n in m) m[n] += +v; }); src = 'manual'; }
    else if (L.length) { L.forEach(l => { if (l.phase_n in m) m[l.phase_n] += lnCur(l); }); src = 'lines'; }
    else { PH.forEach(p => m[p.n] = w * exp[p.n] / expTot); src = 'est'; }
    const t = sum(PH, p => m[p.n]); if (src !== 'manual' && t > 0 && Math.abs(t - w) > 1) PH.forEach(p => m[p.n] *= w / t);
    const q = invPay(i), L2 = PY.filter(y => y.kind === 'invoice' && y.invoice_id === i.id), paid = sum(L2.filter(got), y => y.amount), ratio = !L2.length && i.status === 'paid' ? 1 : q.net ? Math.min(paid / q.net, 1) : 0;
    W[i.id] = { m, src, ratio, w }; });
  const advSplit = y => { const ns = (y.phase_ns || []).filter(n => n in exp); if (!ns.length) return {}; const b = sum(ns, n => +PH.find(p => p.n === n).budget_rev || 1); return Object.fromEntries(ns.map(n => [n, +y.amount * (+PH.find(p => p.n === n).budget_rev || 1) / b])); };
  const advGot = Z(), advAsk = Z(); let advNone = 0; PY.filter(y => y.kind === 'advance').forEach(y => { const sp = advSplit(y); if (!Object.keys(sp).length) { if (got(y)) advNone += +y.amount; return; } Object.entries(sp).forEach(([n, v]) => (got(y) ? advGot : advAsk)[n] += v); });
  const rows = PH.map(p => { const price = +p.budget_rev || 0, works = sum(I, i => W[i.id].m[p.n]), ded = sum(I, i => W[i.id].m[p.n] * (1 - +i.pay_pct)), wDue = sum(I, i => W[i.id].m[p.n] * +i.pay_pct), wGot = sum(I, i => W[i.id].m[p.n] * +i.pay_pct * W[i.id].ratio);
    const inflow = advGot[p.n] + wGot, out = exp[p.n], bal = inflow - out, req = AP * price, advRem = Math.max(req - advGot[p.n] - advAsk[p.n], 0), def = Math.max(-bal, 0), over = out > price && price > 0 ? out - price : 0;
    return { p, price, works, ded, wDue, wGot, inflow, out, bal, req, advRem, def, over, claim: Math.max(advRem, def - advAsk[p.n], 0), got: advGot[p.n], ask: advAsk[p.n], advBal: advGot[p.n] - ded, est: I.some(i => W[i.id].src === 'est' && W[i.id].m[p.n] > 0) }; });
  const T = k => sum(rows, r => r[k]), payRecv = sum(PY.filter(got), y => y.amount), unclass = ledRev - payRecv, feeGot = sum(I, i => invPay(i).fee * W[i.id].ratio), anyEst = I.some(i => W[i.id].src === 'est');
  const live = rows.filter(r => r.price || r.out || r.inflow || r.works);
  const c = (v, cls = '') => `<td class="n ${cls}">${Math.abs(v) < 1 ? '–' : nf(v, 0)}</td>`;
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">حساب المراحل – الوارد والمنصرف</h2><p class="mut" style="margin:2px 0 0;font-size:13px">الاتفاق: دفعة مقدمة <b>${Math.round(AP * 100)}%</b> من السعر التقديري لكل مرحلة، وكل مستخلص بيتصرف منه ${Math.round(+(I[0]?.pay_pct ?? 0.5) * 100)}% من قيمة الأعمال (والباقي بيتخصم من المقدم) + 100% من أتعاب الشركة. الأتعاب مش داخلة في تمويل المراحل.</p></div>${ed ? `<div class="acts" style="margin:0"><button class="p" data-padd="advance">+ وارد دفعة مقدمة</button><button data-padd="invoice">+ وارد دفعة مستخلص</button><button id="pfAp">نسبة المقدم ${Math.round(AP * 100)}%</button></div>` : ''}</div>
  ${unclass > 1 ? `<div class="note">في شيت الحسابات <b>وارد ${money(ledRev)}</b>، والمتسجل هنا كدفعات من المالك ${money(payRecv)} بس. الفرق <b>${money(unclass)}</b> لازم يتسجل كدفعات (مقدمة على مرحلة / دفعة مستخلص) عشان حساب كل مرحلة يطلع صح – لحد ما ده يحصل، المراحل هتبان فيها عجز أكبر من الحقيقي.</div>` : ''}
  <div class="kpis">
    <div class="kpi k-ok"><b>${money(T('inflow'))}</b><span>الوارد للمراحل<br><small>مقدم ${money(T('got'))} + من المستخلصات ${money(T('wGot'))}${advNone ? `<br><b class="bad">+ مقدم مش متوزع ${money(advNone)}</b>` : ''}</small></span></div>
    <div class="kpi"><b>${money(T('out'))}</b><span>المنصرف على المراحل<br><small>${expNone ? 'غير موزع على مرحلة ' + money(expNone) : 'من القيود المعتمدة'}</small></span></div>
    <div class="kpi${T('bal') < 0 ? ' k-bad' : ''}"><b>${money(T('bal'))}</b><span>${T('bal') < 0 ? 'عجز' : 'فائض'} (الوارد − المنصرف)</span></div>
    <div class="kpi k-warn"><b>${money(Math.max(T('claim') - advNone, 0))}</b><span>ممكن نطالب بيه كدفعات مقدمة<br><small>${advNone ? 'بعد خصم المقدم اللي مش متوزع ' + money(advNone) + ' – وزّعه عشان الرقم يبقى دقيق لكل مرحلة' : 'متبقي مقدم ' + money(T('advRem'))}</small></span></div>
    <div class="kpi"><b>${money(feeGot)}</b><span>أتعاب الشركة المحصّلة<br><small>بره تمويل المراحل</small></span></div></div>
  <div class="card" style="padding:0"><div class="scroll"><table class="actb pft"><thead><tr><th>المرحلة</th><th class="n">السعر التقديري</th><th class="n">المقدم المستحق ${Math.round(AP * 100)}%</th><th class="n">المقدم المستلم</th><th class="n">أعمال مستخلصة</th><th class="n">اتخصم من المقدم</th><th class="n">رصيد المقدم</th><th class="n">وارد المستخلصات</th><th class="n">إجمالي الوارد</th><th class="n">المنصرف</th><th class="n">الفرق</th><th class="n">المطالبة</th><th></th></tr></thead><tbody>
  ${live.map(r => `<tr><td><b>${r.p.n}. ${esc(r.p.name)}</b>${r.over ? `<div class="bad" style="font-size:11px">المنصرف عدّى السعر التقديري بـ ${nf(r.over, 0)} – حدّث السعر</div>` : ''}${r.est ? '<div class="mut" style="font-size:11px">* فيه مستخلصات متوزعة تقديري</div>' : ''}</td>${c(r.price)}${c(r.req)}<td class="n">${r.got ? nf(r.got, 0) : '–'}${r.ask ? `<div class="mut" style="font-size:11px">مطلوب ${nf(r.ask, 0)}</div>` : ''}</td>${c(r.works)}${c(r.ded)}${c(r.advBal, r.advBal < 0 ? 'bad' : '')}${c(r.wGot)}${c(r.inflow)}${c(r.out)}${c(r.bal, r.bal < 0 ? 'bad' : 'ok')}<td class="n">${r.claim > 1 ? `<b>${nf(r.claim, 0)}</b><div class="mut" style="font-size:11px">${r.def > r.advRem ? 'تغطية العجز' : 'باقي المقدم'}</div>` : '✔'}</td>
    <td class="qa">${r.claim > 1 ? `<button class="xs" data-claim="${r.p.n}">مطالبة</button>` : ''}${ed ? `<button class="xs" data-padd="advance" data-ph="${r.p.n}">+ مقدم</button>` : ''}</td></tr>`).join('')}
  <tr class="tot"><td>الإجمالي</td>${['price', 'req', 'got', 'works', 'ded', 'advBal', 'wGot', 'inflow', 'out', 'bal', 'claim'].map(k => c(T(k), k === 'bal' && T(k) < 0 ? 'bad' : '')).join('')}<td></td></tr></tbody></table></div></div>
  <p class="mut" style="font-size:12px">المطالبة = الأكبر بين: باقي المقدم المستحق (${Math.round(AP * 100)}% × السعر التقديري − المستلم − المطلوب) أو العجز الفعلي في المرحلة. لو المرحلة فيها بنود مستجدة، حدّث سعرها التقديري من إعدادات المرحلة والمقدم المستحق هيزيد معاه.</p>
  ${advNone ? `<div class="secT">دفعات مقدمة مش متوزعة على مراحل – ${money(advNone)}</div><div class="note" style="margin-top:0">الدفعات دي مستلمة بس مش معروف هي مقدم لأنهي مرحلة، فمش داخلة في حساب أي مرحلة. دوس "توزيع" واختار المرحلة (أو أكتر من مرحلة وهتتقسم بنسبة السعر التقديري).</div>
  <div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th class="n">المبلغ</th><th>ملاحظات</th><th></th></tr></thead><tbody>${PY.filter(y => y.kind === 'advance' && got(y) && !Object.keys(advSplit(y)).length).sort((a, b) => (a.pay_date || '9') < (b.pay_date || '9') ? -1 : 1).map(y => `<tr><td data-l="التاريخ">${y.pay_date ? fmtD(y.pay_date) : 'بدون تاريخ'}</td><td class="n" data-l="المبلغ"><b>${nf(y.amount, 0)}</b></td><td data-l="ملاحظات" style="font-size:12px">${esc(y.notes || '')}</td><td class="qa">${ed ? `<button class="xs" data-ped="${y.id}">توزيع</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
  <div class="secT">توزيع المستخلصات على المراحل</div>
  <div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>المستخلص</th><th class="n">الأعمال</th><th>التوزيع</th><th>الأساس</th><th></th></tr></thead><tbody>${I.map(i => `<tr><td data-l="المستخلص"><b>${i.no}</b> ${esc(i.title || '')}</td><td class="n" data-l="الأعمال">${nf(W[i.id].w, 0)}</td><td data-l="التوزيع" style="font-size:12px">${PH.filter(p => W[i.id].m[p.n] > 1).map(p => `${p.n}: ${nf(W[i.id].m[p.n], 0)}`).join(' · ') || '–'}</td><td data-l="الأساس">${{ lines: 'من بنود المستخلص', manual: 'توزيع يدوي', est: '<span class="tag">تقديري حسب المصروف</span>' }[W[i.id].src]}</td><td class="qa">${ed && W[i.id].src !== 'lines' ? `<button class="xs" data-split="${i.id}">توزيع</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>
  ${anyEst ? '<p class="mut" style="font-size:12px">المستخلصات القديمة مالهاش بنود بمراحل، فاتوزعت بنسبة المصروف الفعلي لكل مرحلة (لأن الشغل بالتكلفة + 15%). لو عندك التوزيع الحقيقي دوس "توزيع" ودخّله.</p>' : ''}`;
  const claimDoc = r => { const w = open('', '_blank'); if (!w) return toast('افتح النوافذ المنبثقة'); w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>مطالبة دفعة – ${esc(r.p.name)}</title><style>body{font-family:"Segoe UI",Tahoma,sans-serif;margin:30px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:14px}td{border:1px solid #999;padding:7px 10px}td:first-child{background:#f3f1ec;font-weight:700;width:55%}.big td{font-size:18px;font-weight:700;color:#b3261e}.sig{display:flex;justify-content:space-around;margin-top:60px;font-weight:700}@page{size:A4;margin:16mm}</style></head><body>
    <h1>مطالبة بدفعة مقدمة – ${esc(proj.name)}</h1><p>السادة / ${esc(proj.owner_name)}<br>التاريخ: ${fmtD(today())}</p><p>بالإشارة للاتفاق على صرف دفعة مقدمة بنسبة ${Math.round(AP * 100)}% من السعر التقديري لكل مرحلة، نرجو صرف الدفعة الموضحة لمرحلة <b>${r.p.n}. ${esc(r.p.name)}</b>:</p>
    <table><tr><td>السعر التقديري للمرحلة</td><td>${nf(r.price, 0)} ج.م</td></tr><tr><td>الدفعة المقدمة المستحقة (${Math.round(AP * 100)}%)</td><td>${nf(r.req, 0)} ج.م</td></tr><tr><td>المستلم من الدفعات المقدمة للمرحلة</td><td>${nf(r.got, 0)} ج.م</td></tr>${r.ask ? `<tr><td>مطالبات سابقة لم تصرف</td><td>${nf(r.ask, 0)} ج.م</td></tr>` : ''}<tr><td>المخصوم من المقدم في المستخلصات</td><td>${nf(r.ded, 0)} ج.م</td></tr><tr><td>المنصرف الفعلي على المرحلة</td><td>${nf(r.out, 0)} ج.م</td></tr><tr><td>إجمالي الوارد للمرحلة (مقدم + مستخلصات)</td><td>${nf(r.inflow, 0)} ج.م</td></tr>${r.def ? `<tr><td>العجز في تمويل المرحلة</td><td>${nf(r.def, 0)} ج.م</td></tr>` : ''}<tr class="big"><td>المطلوب صرفه</td><td>${nf(r.claim, 0)} ج.م</td></tr></table>
    <div class="sig"><span>الحسابات</span><span>المدير التنفيذي</span></div><script>onload=()=>print()<\/script></body></html>`); w.document.close(); };
  const splitForm = i => { const d = document.createElement('dialog'); d.className = 'adlg'; const m = W[i.id].m;
    d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">توزيع مستخلص ${i.no} على المراحل</h3><button type="button" class="dx">✕</button></div><p class="mut" style="font-size:13px">قيمة الأعمال ${nf(W[i.id].w, 0)} – المجموع لازم يساويها.</p><form class="grid">${PH.map(p => `<label>${p.n}. ${esc(p.name)}<input type="number" step="any" data-n="${p.n}" value="${m[p.n] > 1 ? Math.round(m[p.n]) : ''}"></label>`).join('')}<p class="wide" id="spT"></p><div class="acts wide" style="margin:0"><button class="p">حفظ</button>${i.phase_split ? '<button type="button" id="spClr">رجّع للتقديري</button>' : ''}</div></form>`;
    document.body.append(d); d.showModal(); const f = d.querySelector('form'), tot = () => [...f.querySelectorAll('[data-n]')].reduce((s, e) => s + (+e.value || 0), 0), upd = () => { const t = tot(), df = W[i.id].w - t; d.querySelector('#spT').innerHTML = `المجموع ${nf(t, 0)}${Math.abs(df) > 1 ? ` · <span class="bad">${df > 0 ? 'ناقص' : 'زيادة'} ${nf(Math.abs(df), 0)}</span>` : ' ✔'}`; }; f.oninput = upd; upd();
    const save = async v => { const { error } = await S.sb.from('owner_invoices').update({ phase_split: v }).eq('id', i.id); if (error) return toast(error.message); d.close(); d.remove(); toast('اتحفظ التوزيع'); renderPhFin(); };
    d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } if (e.target.id === 'spClr') save(null); };
    f.onsubmit = e => { e.preventDefault(); if (Math.abs(W[i.id].w - tot()) > 1) return toast('المجموع لازم يساوي قيمة الأعمال'); save(Object.fromEntries([...f.querySelectorAll('[data-n]')].filter(e => +e.value).map(e => [e.dataset.n, +e.value]))); }; };
  $('#pfAp') && ($('#pfAp').onclick = async () => { const v = prompt('نسبة الدفعة المقدمة من السعر التقديري للمرحلة %', Math.round(AP * 100)); if (v == null || !(+v >= 0 && +v <= 100)) return; const { error } = await S.sb.from('projects').update({ adv_pct: +v / 100 }).eq('id', P.id); if (error) return toast(error.message); renderPhFin(); });
  $('#main').onclick = e => { const a = e.target.closest('[data-padd]'); if (a) { const n = a.dataset.ph && +a.dataset.ph, r = n && rows.find(x => x.p.n === n); return payForm(a.dataset.padd, {}, null, renderPhFin, n ? { phases: [n], amount: r.advRem ? Math.round(r.advRem) : '' } : {}); }
    const cl = e.target.closest('[data-claim]'); if (cl) { const r = rows.find(x => x.p.n === +cl.dataset.claim); if (ed && confirm('تسجّل المطالبة كدفعة مقدمة "مطلوبة" عشان تتابعها؟')) payForm('advance', {}, null, renderPhFin, { title: 'مطالبة دفعة مقدمة', phases: [r.p.n], amount: Math.round(r.claim), status: 'requested', notes: 'مطالبة ' + fmtD(today()) }); return claimDoc(r); }
    const pe = e.target.closest('[data-ped]'); if (pe) return payForm(null, PY.find(y => y.id === pe.dataset.ped), null, renderPhFin);
    const sp = e.target.closest('[data-split]'); if (sp) splitForm(I.find(i => i.id === sp.dataset.split)); };
}
async function renderFinAll() {
  const PS = finPids(), sum = (A, f) => A.reduce((s, x) => s + (+f(x) || 0), 0), got = x => x.status === 'received';
  const rows = await Promise.all(PS.map(async pid => { const p = S.projects.find(x => x.id === pid), A = can('acct', pid), cost = can('ledger', pid), rv = can('ledgerEd', pid);
    const [iv, py, lg, pend] = await Promise.all([A ? S.sb.from('owner_invoices').select('*').eq('project_id', pid) : { data: [] }, A ? S.sb.from('owner_payments').select('*').eq('project_id', pid) : { data: [] }, cost ? S.sb.rpc('ledger_summary', { p_project: pid }) : { data: [] }, rv ? S.sb.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'submitted') : { count: 0 }]);
    const I = (iv.data || []).filter(i => i.status !== 'draft'), PY = py.data || [];
    const R = I.map(i => { const q = invPay(i), L = PY.filter(x => x.kind === 'invoice' && x.invoice_id === i.id), paid = sum(L.filter(got), x => x.amount), assumed = !L.length && i.status === 'paid'; return { ...q, adv: q.works * (1 - +i.pay_pct), paid: assumed ? q.net : paid, rem: assumed ? 0 : Math.max(q.net - paid, 0) }; });
    const advGot = sum(PY.filter(x => x.kind === 'advance' && got(x)), x => x.amount), recv = advGot + sum(R, r => r.paid) + sum(PY.filter(x => x.kind === 'other' && got(x)), x => x.amount);
    return { p, A, cost, rv, n: I.length, billed: sum(R, r => r.works + r.fee), recv, rem: sum(R, r => r.rem), advBal: advGot - sum(R, r => r.adv), exp: sum(lg.data || [], x => x.expense), pend: pend.count || 0, first: finViews(pid)[0] }; }));
  const anyA = rows.some(r => r.A), anyC = rows.some(r => r.cost), anyR = rows.some(r => r.rv), T = k => sum(rows, r => r[k]);
  const td = (r, k, l, cls = '') => `<td class="n ${cls}" data-l="${l}">${r.A || k === 'exp' && r.cost ? nf(r[k], 0) : '–'}</td>`;
  $('#main').innerHTML = `${anyA ? `<div class="kpis">
    <div class="kpi"><b>${money(T('billed'))}</b><span>قيمة المستخلصات المقدمة<br><small>كل المشروعات</small></span></div>
    <div class="kpi k-ok"><b>${money(T('recv'))}</b><span>إجمالي المحصّل من الملاك</span></div>
    <div class="kpi${T('rem') > 0 ? ' k-bad' : ''}"><b>${money(T('rem'))}</b><span>متأخرات على الملاك</span></div>
    ${anyC ? `<div class="kpi"><b>${money(T('exp'))}</b><span>المصروف الفعلي</span></div>` : ''}
    ${anyR ? `<div class="kpi${T('pend') ? ' k-warn' : ''}"><b>${T('pend')}</b><span>قيود وتصفيات عهدة مستنية المراجعة</span></div>` : ''}</div>` : ''}
  <div class="card" style="padding:0"><div class="scroll"><table class="actb stack"><thead><tr><th>المشروع</th>${anyA ? '<th class="n">المستخلصات</th><th class="n">قيمتها</th><th class="n">المحصّل</th><th class="n">المتأخرات</th><th class="n">رصيد المقدم</th>' : ''}${anyC ? '<th class="n">المصروف الفعلي</th>' : ''}${anyR ? '<th class="n">مستني مراجعة</th>' : ''}<th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td data-l="المشروع"><a href="#p/${r.p.id}/${r.first}"><b>${esc(r.p.name)}</b></a><div class="mut" style="font-size:11px">${esc(r.p.place || '')}</div></td>${anyA ? `<td class="n" data-l="المستخلصات">${r.A ? r.n : '–'}</td>${td(r, 'billed', 'قيمتها')}${td(r, 'recv', 'المحصّل')}${td(r, 'rem', 'المتأخرات', r.rem > 0 ? 'bad' : '')}${td(r, 'advBal', 'رصيد المقدم', r.advBal < 0 ? 'bad' : '')}` : ''}${anyC ? td(r, 'exp', 'المصروف الفعلي') : ''}${anyR ? `<td class="n" data-l="مستني مراجعة">${r.rv ? (r.pend ? `<a href="#p/${r.p.id}/custody"><b>${r.pend}</b></a>` : '✔') : '–'}</td>` : ''}<td class="qa">${finViews(r.p.id).map(v => `<a class="btn xs" href="#p/${r.p.id}/${v}">${VIEWS.find(x => x[0] === v)[1]}</a>`).join(' ')}</td></tr>`).join('')}
  ${anyA && rows.length > 1 ? `<tr class="tot"><td>الإجمالي</td><td class="n">${T('n')}</td><td class="n">${nf(T('billed'), 0)}</td><td class="n">${nf(T('recv'), 0)}</td><td class="n">${nf(T('rem'), 0)}</td><td class="n">${nf(T('advBal'), 0)}</td>${anyC ? `<td class="n">${nf(T('exp'), 0)}</td>` : ''}${anyR ? `<td class="n">${T('pend')}</td>` : ''}<td></td></tr>` : ''}</tbody></table></div></div>
  <p class="mut" style="font-size:12px">اختار المشروع من فوق عشان تدخل على المستخلصات والدفعات والقيود والعهدة بتاعته.</p>`;
}
async function renderAcct() {
  const P = S.P, ed = can('acctEdit', P.id), cost = can('ledger', P.id), V = (S.ac ||= { list: 'all' });
  if (V.pid !== P.id) { V.pid = P.id; V.list = 'all'; }
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const [iv, py, lg] = await Promise.all([S.sb.from('owner_invoices').select('*').eq('project_id', P.id).order('no'), S.sb.from('owner_payments').select('*').eq('project_id', P.id).order('pay_date', { ascending: true, nullsFirst: true }).order('created_at'), cost ? S.sb.rpc('ledger_summary', { p_project: P.id }) : Promise.resolve({ data: [] })]);
  if (iv.error || py.error) return $('#main').innerHTML = `<div class="note">${esc((iv.error || py.error).message)}</div>`;
  const I = iv.data || [], PY = py.data || [], LG = lg.data || [], got = x => x.status === 'received';
  const R = I.map(i => { const p = invPay(i), adv = p.works * (1 - +i.pay_pct), L = PY.filter(x => x.kind === 'invoice' && x.invoice_id === i.id), paid = L.filter(got).reduce((s, x) => s + +x.amount, 0), assumed = !L.length && i.status === 'paid';
    return { i, ...p, adv, paid, assumed, rem: i.status === 'draft' ? 0 : assumed ? 0 : Math.max(p.net - paid, 0), over: paid - p.net, last: L.filter(got).map(x => x.pay_date).filter(Boolean).sort().pop() }; });
  const live = R.filter(r => r.i.status !== 'draft'), sum = (A, f) => A.reduce((s, x) => s + (+f(x) || 0), 0);
  const AD = PY.filter(x => x.kind === 'advance'), advGot = sum(AD.filter(got), x => x.amount), advReq = sum(AD.filter(x => !got(x)), x => x.amount), advUsed = sum(live, r => r.adv), advBal = advGot - advUsed;
  const due = sum(live, r => r.net), invPaid = sum(live, r => r.assumed ? r.net : r.paid), other = sum(PY.filter(x => x.kind === 'other' && got(x)), x => x.amount), recv = advGot + invPaid + other, rem = sum(live, r => r.rem);
  const billed = sum(live, r => r.works + r.fee), exp = sum(LG, x => x.expense), lrev = sum(LG, x => x.revenue);
  const phName = n => P.phaseProg.find(x => x.n === n)?.name || '';
  const pr = x => `${PAYK[x.kind]}${x.kind === 'invoice' ? ' – مستخلص ' + (I.find(i => i.id === x.invoice_id)?.no ?? '؟') : ''}${x.phase_ns?.length ? ' – ' + x.phase_ns.map(n => n + '. ' + phName(n)).join('، ') : ''}`;
  const acts = x => ed ? `<button data-ped="${x.id}">تعديل</button><button class="danger" data-pdel="${x.id}">حذف</button>` : '';
  const LIST = PY.filter(x => V.list === 'all' || x.kind === V.list).slice().reverse();
  const costRows = (() => { const m = {}; LG.forEach(x => { const k = x.phase_n || 0; (m[k] ||= { n: k, e: 0, r: 0 }); m[k].e += +x.expense; m[k].r += +x.revenue; }); return Object.values(m).sort((a, b) => (a.n || 99) - (b.n || 99)); })();
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">الحسابات</h2><p class="mut" style="margin:2px 0 0;font-size:13px">المستخلصات والدفعات المستلمة من المالك على كل مستخلص، والدفعات المقدمة واللي اتخصم منها${cost ? '، والمصروف الفعلي من شيت الحسابات' : ''}.</p></div>${ed ? '<div class="acts" style="margin:0"><button class="p" data-padd="invoice">+ وارد دفعة مستخلص</button><button data-padd="advance">+ وارد دفعة مقدمة</button><button data-padd="other">+ وارد آخر</button></div>' : ''}</div>
  <div class="kpis">
    <div class="kpi"><b>${money(billed)}</b><span>قيمة المستخلصات المقدمة<br><small>أعمال ${money(sum(live, r => r.works))} + أتعاب ${money(sum(live, r => r.fee))}</small></span></div>
    <div class="kpi k-ok"><b>${money(recv)}</b><span>إجمالي المحصّل من المالك<br><small>مقدم ${money(advGot)} + مستخلصات ${money(invPaid)}${other ? ' + أخرى ' + money(other) : ''}</small></span></div>
    <div class="kpi${rem > 0 ? ' k-bad' : ''}"><b>${money(rem)}</b><span>متأخرات على المالك<br><small>من صافي المستحق ${money(due)}</small></span></div>
    <div class="kpi${advBal < 0 ? ' k-bad' : ''}"><b>${money(advBal)}</b><span>رصيد الدفعات المقدمة<br><small>مستلم ${money(advGot)} − اتخصم ${money(advUsed)}${advReq ? ' · مطلوب ' + money(advReq) : ''}</small></span></div>
    ${cost ? `<div class="kpi${recv - exp < 0 ? ' k-warn' : ''}"><b>${money(exp)}</b><span>المصروف الفعلي (شيت الحسابات)<br><small>${recv - exp >= 0 ? 'المحصّل أكبر بـ ' + money(recv - exp) : 'المصروف أكبر من المحصّل بـ ' + money(exp - recv)}</small></span></div>` : ''}
  </div>
  ${advBal < 0 ? `<div class="note">المخصوم من الدفعات المقدمة (${money(advUsed)}) أكبر من المقدم المستلم (${money(advGot)}). يا إما فيه دفعات مقدمة لسه ماتسجلتش، يا إما المستخلصات الجاية محتاجة تتصرف بنسبة أعلى.</div>` : ''}
  <div class="secT">المستخلصات والدفعات</div>
  ${I.length ? `<div class="card" style="padding:0"><div class="scroll"><table class="actb stack"><thead><tr><th>المستخلص</th><th>الحالة</th><th class="n">الأعمال</th><th class="n">الأتعاب</th><th class="n">يتخصم من المقدم</th><th class="n">صافي المستحق</th><th class="n">المنصرف</th><th class="n">المتبقي</th><th></th></tr></thead><tbody>
    ${R.map(r => `<tr class="${r.i.status === 'draft' ? 'dim' : ''}"><td data-l="المستخلص"><a href="#p/${P.id}/inv" data-iv="${r.i.id}"><b>${r.i.no}</b> ${esc(r.i.title || '')}</a><div class="mut" style="font-size:11px">${r.i.inv_date ? fmtD(r.i.inv_date) : 'بدون تاريخ'}${r.last ? ' · آخر دفعة ' + fmtD(r.last) : ''}</div></td><td data-l="الحالة"><span class="st ${IST[r.i.status][0]}">${IST[r.i.status][1]}</span></td>
      <td class="n" data-l="الأعمال">${nf(r.works, 0)}</td><td class="n" data-l="الأتعاب">${nf(r.fee, 0)}</td><td class="n" data-l="يتخصم من المقدم">${nf(r.adv, 0)}<div class="mut" style="font-size:11px">${Math.round((1 - r.i.pay_pct) * 100)}%</div></td><td class="n" data-l="صافي المستحق"><b>${nf(r.net, 0)}</b></td>
      <td class="n" data-l="المنصرف">${r.assumed ? '<span class="mut" title="المستخلص حالته اتصرف ومفيش تفاصيل دفعات متسجلة">اتصرف كله*</span>' : r.paid ? nf(r.paid, 0) : '–'}</td><td class="n ${r.rem > 0 ? 'bad' : ''}" data-l="المتبقي">${r.i.status === 'draft' ? 'مسودة' : r.over > 1 ? '<span class="mut">زيادة ' + nf(r.over, 0) + '</span>' : r.rem > 0 ? nf(r.rem, 0) : '✔'}</td>
      <td class="qa">${ed && r.i.status !== 'draft' ? `<button data-padd="invoice" data-inv="${r.i.id}">+ دفعة</button>` : ''}</td></tr>`).join('')}
    <tr class="tot"><td>الإجمالي</td><td></td><td class="n" data-l="الأعمال">${nf(sum(live, r => r.works), 0)}</td><td class="n" data-l="الأتعاب">${nf(sum(live, r => r.fee), 0)}</td><td class="n" data-l="يتخصم من المقدم">${nf(advUsed, 0)}</td><td class="n" data-l="صافي المستحق">${nf(due, 0)}</td><td class="n" data-l="المنصرف">${nf(invPaid, 0)}</td><td class="n" data-l="المتبقي">${nf(rem, 0)}</td><td></td></tr></tbody></table></div></div>
    ${R.some(r => r.assumed) ? '<p class="mut" style="font-size:12px">* مستخلصات حالتها "اتصرف" من غير دفعات متسجلة – محسوبة مصروفة بالكامل. سجّل الدفعات الفعلية بتواريخها عشان الحساب يبقى دقيق.</p>' : ''}` : `<div class="note">لسه مفيش مستخلصات. اعملها من <a href="#p/${P.id}/inv">صفحة المستخلصات</a>.</div>`}
  <div class="secT">الدفعات المقدمة</div>
  <div class="card">${AD.length ? `<div class="advbar"><div style="width:${advGot ? Math.min(advUsed / advGot * 100, 100) : 0}%"></div></div><p class="mut" style="margin:6px 0 10px;font-size:13px">اتخصم ${money(advUsed)} من ${money(advGot)} مستلمة${advGot ? ` (${Math.round(advUsed / advGot * 100)}%)` : ''} · الخصم بيتحسب من كل مستخلص = الأعمال × (100% − نسبة الصرف)</p>
    <div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>على مرحلة</th><th class="n">المبلغ</th><th>الحالة</th><th>المرجع</th><th></th></tr></thead><tbody>${AD.map(x => `<tr><td data-l="التاريخ">${fmtD(x.pay_date)}</td><td data-l="على مرحلة">${x.phase_ns?.length ? x.phase_ns.map(n => n + '. ' + esc(phName(n))).join('، ') : '–'}${x.notes ? `<div class="mut" style="font-size:12px">${esc(x.notes)}</div>` : ''}</td><td class="n" data-l="المبلغ"><b>${nf(x.amount, 0)}</b></td><td data-l="الحالة"><span class="st ${got(x) ? 'appr' : 'pend'}">${got(x) ? 'مستلمة' : 'مطلوبة'}</span></td><td data-l="المرجع">${esc([x.method, x.ref].filter(Boolean).join(' · ')) || '–'}</td><td class="qa">${acts(x)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mut" style="margin:0">لسه مفيش دفعات مقدمة متسجلة.${advUsed ? ` المستخلصات بتخصم ${money(advUsed)} من المقدم، فسجّل الدفعات المقدمة اللي اتصرفت.` : ''}</p>`}</div>
  <div class="secT">سجل الدفعات</div>
  <div class="sttabs" style="margin:0 0 10px"><div class="seg">${[['all', 'الكل'], ['invoice', 'دفعات المستخلصات'], ['advance', 'الدفعات المقدمة'], ['other', 'أخرى']].map(([k, l]) => `<button type="button" data-pl="${k}" class="${V.list === k ? 'on' : ''}">${l} (${k === 'all' ? PY.length : PY.filter(x => x.kind === k).length})</button>`).join('')}</div></div>
  <div class="card" style="padding:0">${LIST.length ? `<div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>الدفعة</th><th class="n">المبلغ</th><th>الحالة</th><th>طريقة الدفع والمرجع</th><th></th></tr></thead><tbody>${LIST.map(x => `<tr><td data-l="التاريخ">${fmtD(x.pay_date)}</td><td data-l="الدفعة">${esc(pr(x))}${x.notes ? `<div class="mut" style="font-size:12px">${esc(x.notes)}</div>` : ''}</td><td class="n" data-l="المبلغ"><b>${nf(x.amount, 0)}</b></td><td data-l="الحالة"><span class="st ${got(x) ? 'appr' : 'pend'}">${got(x) ? 'مستلمة' : 'مطلوبة'}</span></td><td data-l="المرجع">${esc([x.method, x.ref].filter(Boolean).join(' · ')) || '–'}</td><td class="qa">${acts(x)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut" style="padding:14px;margin:0">مفيش دفعات.</p>'}</div>
  ${cost ? `<div class="secT">المصروف الفعلي من شيت الحسابات</div><div class="card">${costRows.length ? `<div class="scroll"><table class="stack"><thead><tr><th>المرحلة</th><th class="n">المصروفات</th><th class="n">الإيرادات المسجلة في الشيت</th></tr></thead><tbody>${costRows.map(x => `<tr><td data-l="المرحلة">${x.n ? x.n + '. ' + esc(phName(x.n)) : 'بدون مرحلة'}</td><td class="n" data-l="المصروفات">${nf(x.e, 0)}</td><td class="n" data-l="الإيرادات">${x.r ? nf(x.r, 0) : '–'}</td></tr>`).join('')}<tr class="tot"><td>الإجمالي</td><td class="n" data-l="المصروفات">${nf(exp, 0)}</td><td class="n" data-l="الإيرادات">${nf(lrev, 0)}</td></tr></tbody></table></div>
    ${Math.abs(lrev - recv) > 1 ? `<p class="mut" style="font-size:12px;margin:6px 0 0">الإيرادات في شيت الحسابات ${money(lrev)}، والمحصّل المتسجل هنا ${money(recv)}. الفرق ${money(Math.abs(lrev - recv))} – غالباً دفعات لسه ماتسجلتش هنا.</p>` : ''}` : '<p class="mut" style="margin:0">لسه مفيش شيت حسابات مرفوع.</p>'}
    <div class="acts"><label class="btn" title="شيت الحسابات بنفس شكل شيت الغردقة. بيستبدل بيانات الإكسل القديمة.">رفع شيت الحسابات<input type="file" id="lgF" accept=".xlsx,.xls" hidden></label></div><div id="lgBox"></div></div>` : ''}`;
  $('#lgF') && ($('#lgF').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLedger(f); });
  document.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { V.list = b.dataset.pl; renderAcct(); });
  $('#main').onclick = async e => { const iv2 = e.target.closest('[data-iv]'); if (iv2) { e.preventDefault(); (S.iv ||= {}).pid = P.id; S.iv.id = iv2.dataset.iv; S.iv.tab = 'summary'; S.iv.edit = false; location.hash = `#p/${P.id}/inv`; return; }
    const a = e.target.closest('[data-padd]'); if (a) return payForm(a.dataset.padd, {}, a.dataset.inv || null, renderAcct);
    const ed2 = e.target.closest('[data-ped]'); if (ed2) return payForm(null, PY.find(x => x.id === ed2.dataset.ped), null, renderAcct);
    const dl = e.target.closest('[data-pdel]'); if (dl) { if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('owner_payments').delete().eq('id', dl.dataset.pdel); if (error) return toast(error.message); toast('اتحذفت'); renderAcct(); } };
}

/* ---------------- subcontractor contracts (technical office): fixed prices, change log, subcontractor invoices & deductions ---------------- */
const SCST = { draft: ['pend', 'مسودة – الأسعار لسه مش مثبتة'], active: ['appr', 'ساري – الأسعار مثبتة'], closed: ['', 'منتهي'] };
const SIST = { draft: ['pend', 'مسودة'], submitted: ['run', 'اتقدّم للمراجعة'], approved: ['appr', 'معتمد'], paid: ['appr', 'اتصرف'] };
const SCCH = { price: 'تعديل فئة', qty: 'تعديل كمية', addition: 'بند إضافي', cancel: 'إلغاء بند', other: 'تعديل آخر' };
const SDED = ['جزاءات / غرامات تأخير', 'خامات مسلّمة للمقاول', 'سلفة', 'مياه وكهرباء', 'معدات من الشركة', 'أخرى'];
const sLnCum = l => (+l.prev_qty + +l.cur_qty) * +l.rate * +l.pct, sLnCur = l => sLnCum(l) - +l.prev_value;
async function loadSubs(pid) {
  const C = (await S.sb.from('sub_contracts').select('*').eq('project_id', pid).order('created_at')).data || [], ids = C.map(c => c.id);
  if (!ids.length) return { C, I: [], CH: [], IV: [], LN: [], DD: [] };
  const [it, ch, iv] = await Promise.all([S.sb.from('sub_contract_items').select('*').in('contract_id', ids).order('sort'), S.sb.from('sub_contract_changes').select('*').in('contract_id', ids).order('change_date').order('created_at'), S.sb.from('sub_invoices').select('*').in('contract_id', ids).order('no')]);
  const IV = iv.data || [], vid = IV.map(i => i.id); let LN = [], DD = [];
  if (vid.length) { const [ln, dd] = await Promise.all([S.sb.from('sub_invoice_lines').select('*').in('invoice_id', vid).order('sort'), S.sb.from('sub_deductions').select('*').in('invoice_id', vid).order('created_at')]); LN = ln.data || []; DD = dd.data || []; }
  return { C, I: it.data || [], CH: ch.data || [], IV, LN, DD };
}
const subInvTot = (iv, D) => { const L = D.LN.filter(l => l.invoice_id === iv.id), gross = L.reduce((s, l) => s + sLnCur(l), 0), cum = L.reduce((s, l) => s + sLnCum(l), 0), ret = gross * +iv.retention_pct, adv = +iv.advance_recovery || 0, ded = D.DD.filter(d => d.invoice_id === iv.id).reduce((s, d) => s + +d.amount, 0); return { L, gross, cum, ret, adv, ded, net: gross - ret - adv - ded }; };
async function renderSubs() {
  const P = S.P, ed = can('editBoq', P.id), V = (S.sc ||= {}); if (V.pid !== P.id) { S.sc = { pid: P.id }; return renderSubs(); }
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>'; const D = V.D = await loadSubs(P.id);
  if (V.iid && D.IV.some(i => i.id === V.iid)) return subInvoice(D); V.iid = null;
  if (V.cid && D.C.some(c => c.id === V.cid)) return subContract(D); V.cid = null;
  const phName = n => P.phaseProg.find(x => x.n === n)?.name || '';
  const row = c => { const I = D.I.filter(i => i.contract_id === c.id && !i.cancelled), val = I.reduce((s, i) => s + +i.qty * +i.rate, 0), orig = D.I.filter(i => i.contract_id === c.id && i.origin === 'contract').reduce((s, i) => s + +(i.orig_qty ?? i.qty) * +(i.orig_rate ?? i.rate), 0), IV = D.IV.filter(i => i.contract_id === c.id && i.status !== 'draft').map(i => subInvTot(i, D));
    const done = IV.reduce((s, t) => s + t.gross, 0), ret = IV.reduce((s, t) => s + t.ret, 0), phs = [...new Set(I.map(i => i.phase_n).filter(Boolean))].sort((a, b) => a - b);
    return `<a href="#" class="ivcard" data-sc="${c.id}"><div style="flex:1;min-width:0"><b>${esc(c.contractor)}</b> <span class="st ${SCST[c.status][0]}">${SCST[c.status][1]}</span><div>${esc(c.title)}</div><div class="mut" style="font-size:12px">${phs.map(n => n + '. ' + esc(phName(n))).join(' · ') || 'بدون مرحلة'} · ${I.length} بند${D.CH.filter(x => x.contract_id === c.id).length ? ' · ' + D.CH.filter(x => x.contract_id === c.id).length + ' تعديل' : ''} · ${D.IV.filter(i => i.contract_id === c.id).length} مستخلص</div></div>
      <div style="text-align:left;min-width:150px"><div class="mut" style="font-size:11px">قيمة العقد${Math.abs(val - orig) > 1 && c.status !== 'draft' ? ` (الأصلية ${money(orig)})` : ''}</div><b>${money(val)}</b><div class="mut" style="font-size:11px">منفذ ${money(done)}${val ? ' (' + Math.round(done / val * 100) + '%)' : ''}${ret ? ' · تأمين محجوز ' + money(ret) : ''}</div></div></a>`; };
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">عقود المقاولين</h2><p class="mut" style="margin:2px 0 0;font-size:13px">عقد لكل مقاول بفئاته المثبتة، وكل تعديل أو إضافة بيتسجل برقم أمر التغيير وتاريخه، ومستخلص المقاول بيتعمل من بنود عقده بخصوماته. خصومات المقاول مالهاش علاقة بمستخلص المالك.</p></div>${ed ? '<button class="p" id="scNew">+ عقد مقاول جديد</button>' : ''}</div>
  ${D.C.length ? `<div class="ivlist">${D.C.map(row).join('')}</div>` : '<div class="note">لسه مفيش عقود مقاولين للمشروع ده.</div>'}`;
  $('#scNew') && ($('#scNew').onclick = () => subContractForm(null, D));
  $('#main').onclick = e => { const a = e.target.closest('[data-sc]'); if (!a) return; e.preventDefault(); V.cid = a.dataset.sc; V.tab = 'items'; renderSubs(); };
}
function subContractForm(c, D) {
  const P = S.P, d = document.createElement('dialog'); d.className = 'adlg'; c ||= {};
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${c.id ? 'بيانات العقد' : 'عقد مقاول جديد'}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px">
    <label>المقاول من القائمة<select name="vendor"><option value="">— مش في القائمة —</option>${(P.vendors || []).map(v => `<option value="${v.id}"${v.id === c.vendor_id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label>اسم المقاول<input name="contractor" value="${esc(c.vendor_id ? '' : c.contractor || '')}" placeholder="لو مش في القائمة"></label>
    <label class="wide">موضوع العقد<input name="title" required value="${esc(c.title || '')}" placeholder="مثلاً: مصنعيات الخرسانة المسلحة للهيكل"></label>
    <label>تاريخ العقد<input type="date" name="date" value="${c.contract_date || today()}"></label><label>البداية<input type="date" name="start" value="${c.start_date || ''}"></label><label>النهاية<input type="date" name="end" value="${c.end_date || ''}"></label>
    <label>تأمين أعمال (محجوز من كل مستخلص) %<input type="number" step="any" name="ret" value="${c.id ? Math.round(c.retention_pct * 1000) / 10 : 5}"></label>
    <label>دفعة مقدمة للمقاول<input type="number" step="any" name="adv" value="${c.advance_amount || 0}"></label><label>استرداد المقدم من كل مستخلص %<input type="number" step="any" name="advp" value="${c.id ? Math.round(c.advance_recovery_pct * 1000) / 10 : 0}"></label>
    <label class="wide">ملاحظات / شروط<input name="notes" value="${esc(c.notes || '')}"></label>
    <label class="wide">ملف العقد (اختياري)<input type="file" name="file" accept="${DOC_ACCEPT}"></label>
    <div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form');
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  f.onsubmit = async e => { e.preventDefault(); const v = (P.vendors || []).find(x => x.id === f.vendor.value), name = v ? v.name : f.contractor.value.trim(); if (!name) return toast('اختار المقاول أو اكتب اسمه');
    const rec = { project_id: P.id, vendor_id: v?.id || null, contractor: name, title: f.title.value.trim(), contract_date: f.date.value || null, start_date: f.start.value || null, end_date: f.end.value || null, retention_pct: (+f.ret.value || 0) / 100, advance_amount: +f.adv.value || 0, advance_recovery_pct: (+f.advp.value || 0) / 100, notes: f.notes.value.trim() || null };
    if (f.file.files[0]) { const m = { kind: 'other', title: 'عقد ' + name + ' – ' + rec.title, doc_date: rec.contract_date }; await uploadDocs([f.file.files[0]], m); if (m.ids?.[0]) rec.doc_id = m.ids[0]; }
    const { data, error } = c.id ? await S.sb.from('sub_contracts').update(rec).eq('id', c.id).select().single() : await S.sb.from('sub_contracts').insert({ ...rec, status: 'draft' }).select().single();
    if (error) return toast(error.message); d.close(); d.remove(); S.sc.cid = data.id; S.sc.tab = 'items'; renderSubs(); };
}
function subContract(D) {
  const P = S.P, V = S.sc, ed = can('editBoq', P.id), c = D.C.find(x => x.id === V.cid), I = D.I.filter(i => i.contract_id === c.id), CH = D.CH.filter(x => x.contract_id === c.id), IV = D.IV.filter(i => i.contract_id === c.id);
  const live = I.filter(i => !i.cancelled), val = live.reduce((s, i) => s + +i.qty * +i.rate, 0), orig = I.filter(i => i.origin === 'contract').reduce((s, i) => s + +(i.orig_qty ?? i.qty) * +(i.orig_rate ?? i.rate), 0);
  const T = IV.filter(i => i.status !== 'draft').map(i => subInvTot(i, D)), done = T.reduce((s, t) => s + t.gross, 0), ret = T.reduce((s, t) => s + t.ret, 0), advR = T.reduce((s, t) => s + t.adv, 0), ded = T.reduce((s, t) => s + t.ded, 0), net = T.reduce((s, t) => s + t.net, 0);
  const phName = n => P.phaseProg.find(x => x.n === n)?.name || '', draft = c.status === 'draft', code = i => i.item_id ? P.items.find(x => x.id === i.item_id)?.code || '' : '';
  const lastQ = {}; IV.forEach(iv => D.LN.filter(l => l.invoice_id === iv.id).forEach(l => { lastQ[l.contract_item_id] = +l.prev_qty + +l.cur_qty; }));
  const items = `<div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>البند</th><th>المرحلة</th><th>الوحدة</th><th class="n">الكمية</th><th class="n">الفئة</th><th class="n">القيمة</th><th class="n">المنفذ في المستخلصات</th><th></th></tr></thead><tbody>
    ${I.length ? I.map(i => `<tr class="${i.cancelled ? 'dim' : ''}"><td data-l="البند">${code(i) ? `<span class="tag">${esc(code(i))}</span> ` : ''}${esc(i.name)}${i.origin === 'addition' ? ' <span class="st run">إضافة</span>' : ''}${i.cancelled ? ' <span class="st ret">ملغي</span>' : ''}</td><td data-l="المرحلة">${i.phase_n ? i.phase_n + '. ' + esc(phName(i.phase_n)) : '–'}</td><td data-l="الوحدة">${esc(i.unit || '')}</td>
      <td class="n" data-l="الكمية">${nf(i.qty)}${i.orig_qty != null && +i.orig_qty !== +i.qty ? `<div class="mut" style="font-size:11px"><s>${nf(i.orig_qty)}</s></div>` : ''}</td><td class="n" data-l="الفئة"><b>${nf(i.rate)}</b>${i.orig_rate != null && +i.orig_rate !== +i.rate ? `<div class="mut" style="font-size:11px"><s>${nf(i.orig_rate)}</s></div>` : ''}</td><td class="n" data-l="القيمة">${nf(+i.qty * +i.rate, 0)}</td><td class="n" data-l="المنفذ">${lastQ[i.id] ? nf(lastQ[i.id]) + (+i.qty ? ` <small class="mut">(${Math.round(lastQ[i.id] / i.qty * 100)}%)</small>` : '') : '–'}</td>
      <td class="qa">${ed && !i.cancelled ? (draft ? `<button data-ied="${i.id}">تعديل</button><button class="danger" data-idel="${i.id}">حذف</button>` : `<button data-ch="price|${i.id}">تعديل فئة</button><button data-ch="qty|${i.id}">تعديل كمية</button><button class="danger" data-ch="cancel|${i.id}">إلغاء</button>`) : ''}</td></tr>`).join('') : '<tr><td colspan="8" class="mut">لسه مفيش بنود في العقد.</td></tr>'}
    <tr class="tot"><td>الإجمالي</td><td></td><td></td><td></td><td></td><td class="n" data-l="القيمة">${nf(val, 0)}</td><td class="n" data-l="المنفذ">${nf(done, 0)}</td><td></td></tr></tbody></table></div></div>
    ${ed ? `<div class="acts"><button class="p" data-spick>+ بنود من المقايسة</button><button data-sman>+ بند يدوي</button>${draft && I.length ? '<button data-sact class="p">✔ اعتماد العقد وتثبيت الأسعار</button>' : ''}</div>${draft ? '<p class="mut" style="font-size:12px">العقد لسه مسودة: تقدر تعدّل البنود بحرية. بعد "اعتماد العقد" الفئات والكميات بتتثبت، وأي تغيير بعدها بيتسجل كتعديل برقم وتاريخ، والبنود الجديدة بتتسجل كإضافة.</p>' : ''}` : ''}`;
  const changes = `<div class="card" style="padding:0">${CH.length ? `<div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>النوع</th><th>البند</th><th class="n">من</th><th class="n">إلى</th><th>أمر التغيير</th><th>ملاحظات</th></tr></thead><tbody>${CH.slice().reverse().map(x => { const i = I.find(y => y.id === x.contract_item_id); return `<tr><td data-l="التاريخ">${fmtD(x.change_date)}</td><td data-l="النوع"><span class="st ${x.change_type === 'cancel' ? 'ret' : 'run'}">${SCCH[x.change_type]}</span></td><td data-l="البند">${esc(i?.name || '–')}</td><td class="n" data-l="من">${x.old_value != null ? nf(x.old_value) : '–'}</td><td class="n" data-l="إلى">${x.new_value != null ? nf(x.new_value) : '–'}</td><td data-l="أمر التغيير">${esc(x.ref || '–')}</td><td data-l="ملاحظات">${esc(x.note || '')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mut" style="padding:14px;margin:0">مفيش تعديلات على العقد.</p>'}</div>`;
  const invs = `${ed && !draft ? '<div class="acts" style="margin-top:0"><button class="p" data-snew>+ مستخلص مقاول جديد</button></div>' : draft ? '<div class="note">اعتمد العقد الأول عشان تعمل مستخلصات.</div>' : ''}<div class="ivlist">${IV.slice().reverse().map(iv => { const t = subInvTot(iv, D); return `<a href="#" class="ivcard" data-si="${iv.id}"><div class="ivno">${iv.no}</div><div style="flex:1"><b>مستخلص ${iv.no}</b> <span class="st ${SIST[iv.status][0]}">${SIST[iv.status][1]}</span>${iv.owner_invoice_id ? ' <span class="tag">اتحسب في مستخلص المالك</span>' : ''}<div class="mut" style="font-size:12px">${fmtD(iv.inv_date)} · أعمال ${nf(t.gross, 0)} · خصومات ${nf(t.ret + t.adv + t.ded, 0)}</div></div><div style="text-align:left"><b>${nf(t.net, 0)}</b><div class="mut" style="font-size:11px">صافي المستحق</div></div></a>`; }).join('') || '<p class="mut">مفيش مستخلصات.</p>'}</div>`;
  $('#main').innerHTML = `<a href="#" id="scBack" class="mut" style="font-size:13px">← كل العقود</a>
  <div class="sthead"><div><h2 style="margin:2px 0">${esc(c.contractor)} <span class="st ${SCST[c.status][0]}">${SCST[c.status][1]}</span></h2><div>${esc(c.title)}</div><div class="mut" style="font-size:13px">${c.contract_date ? 'بتاريخ ' + fmtD(c.contract_date) : ''}${c.start_date ? ' · من ' + fmtD(c.start_date) : ''}${c.end_date ? ' لـ ' + fmtD(c.end_date) : ''} · تأمين ${Math.round(c.retention_pct * 1000) / 10}%${+c.advance_amount ? ' · مقدم ' + nf(c.advance_amount, 0) + ' يسترد ' + Math.round(c.advance_recovery_pct * 100) + '%' : ''}${c.notes ? ' · ' + esc(c.notes) : ''}</div>${c.doc_id && P.docs.find(x => x.id === c.doc_id) ? docChip(P.docs.find(x => x.id === c.doc_id)) : ''}</div>
    <div class="acts" style="margin:0">${ed ? `<button data-sced>بيانات العقد</button><select id="scSt" style="width:auto">${Object.entries(SCST).filter(([k]) => k !== 'draft' || draft).map(([k, [, l]]) => `<option value="${k}"${k === c.status ? ' selected' : ''}>${l.split(' –')[0]}</option>`).join('')}</select>` : ''}</div></div>
  <div class="kpis"><div class="kpi"><b>${money(orig)}</b><span>قيمة العقد الأصلية</span></div><div class="kpi${Math.abs(val - orig) > 1 ? ' k-warn' : ''}"><b>${money(val)}</b><span>القيمة بعد التعديلات<br><small>${val - orig >= 0 ? '+' : ''}${money(val - orig)} · ${CH.length} تعديل</small></span></div><div class="kpi"><b>${money(done)}</b><span>المنفذ في المستخلصات${val ? ` (${Math.round(done / val * 100)}%)` : ''}</span></div><div class="kpi k-ok"><b>${money(net)}</b><span>صافي المستحق للمقاول<br><small>تأمين محجوز ${money(ret)}${advR ? ' · مقدم مسترد ' + money(advR) : ''}${ded ? ' · خصومات ' + money(ded) : ''}</small></span></div></div>
  <div class="sttabs"><div class="seg">${[['items', `بنود العقد (${I.length})`], ['changes', `التعديلات (${CH.length})`], ['inv', `المستخلصات (${IV.length})`]].map(([k, l]) => `<button type="button" data-stab="${k}" class="${(V.tab || 'items') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <div style="margin-top:12px">${V.tab === 'changes' ? changes : V.tab === 'inv' ? invs : items}</div>`;
  const re = () => renderSubs();
  $('#scSt') && ($('#scSt').onchange = async e => { const { error } = await S.sb.from('sub_contracts').update({ status: e.target.value }).eq('id', c.id); if (error) return toast(error.message); re(); });
  $('#main').onclick = async e => { const t = e.target.closest('button,a'); if (!t) return;
    if (t.id === 'scBack') { e.preventDefault(); V.cid = null; return re(); }
    if (t.dataset.stab) { V.tab = t.dataset.stab; return subContract(D); }
    if (t.dataset.si) { e.preventDefault(); V.iid = t.dataset.si; return re(); }
    if ('sced' in t.dataset) return subContractForm(c, D);
    if ('spick' in t.dataset) return subPick(c, I, draft, re);
    if ('sman' in t.dataset) return subItemForm(c, null, draft, re);
    if (t.dataset.ied) return subItemForm(c, I.find(i => i.id === t.dataset.ied), draft, re);
    if (t.dataset.idel) { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('sub_contract_items').delete().eq('id', t.dataset.idel); return error ? toast(error.message) : re(); }
    if ('sact' in t.dataset) { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'متأكد؟ الفئات هتتثبت'; return; } for (const i of I) await S.sb.from('sub_contract_items').update({ orig_qty: i.qty, orig_rate: i.rate, origin: 'contract' }).eq('id', i.id); const { error } = await S.sb.from('sub_contracts').update({ status: 'active' }).eq('id', c.id); if (error) return toast(error.message); toast('اتعتمد العقد واتثبتت الفئات'); return re(); }
    if (t.dataset.ch) { const [k, id] = t.dataset.ch.split('|'); return subChange(c, I.find(i => i.id === id), k, re); }
    if ('snew' in t.dataset) { t.disabled = true; const last = IV[IV.length - 1], no = (last?.no || 0) + 1, LL = last ? D.LN.filter(l => l.invoice_id === last.id) : [];
      const { data: nv, error } = await S.sb.from('sub_invoices').insert({ contract_id: c.id, no, inv_date: today(), period_from: last?.period_to || c.start_date || null, period_to: today(), retention_pct: c.retention_pct, status: 'draft' }).select().single(); if (error) { t.disabled = false; return toast(error.message); }
      const rows = I.filter(i => !i.cancelled || LL.some(l => l.contract_item_id === i.id)).map((i, k) => { const pl = LL.find(l => l.contract_item_id === i.id); return { invoice_id: nv.id, contract_item_id: i.id, name: i.name, unit: i.unit, phase_n: i.phase_n, item_id: i.item_id, rate: i.rate, prev_qty: pl ? +pl.prev_qty + +pl.cur_qty : 0, cur_qty: 0, pct: pl ? pl.pct : 1, prev_value: pl ? sLnCum(pl) : 0, sort: k }; });
      if (rows.length) { const { error: e2 } = await S.sb.from('sub_invoice_lines').insert(rows); if (e2) toast(e2.message); }
      V.iid = nv.id; V.edit = true; return re(); }
    docClick(e); };
}
function subItemForm(c, it, draft, done) {
  const P = S.P, d = document.createElement('dialog'); d.className = 'adlg'; it ||= {};
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${it.id ? 'تعديل بند' : draft ? 'بند جديد في العقد' : 'بند إضافي على العقد'}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px">
    <label class="wide">بند المقايسة (اختياري)<select name="item"><option value="">— بند يدوي —</option>${P.phaseProg.map(ph => `<optgroup label="${ph.n}. ${esc(ph.name)}">${P.items.filter(i => i.phase_n === ph.n).map(i => `<option value="${esc(i.id)}"${i.id === it.item_id ? ' selected' : ''}>${esc(i.code + ' ' + i.name.slice(0, 70))}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label class="wide">وصف البند في العقد<input name="name" required value="${esc(it.name || '')}"></label>
    <label>المرحلة<select name="ph" required><option value="">—</option>${P.phaseProg.map(x => `<option value="${x.n}"${x.n === it.phase_n ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select></label>
    <label>الوحدة<input name="unit" value="${esc(it.unit || '')}"></label><label>الكمية<input name="qty" type="number" step="any" value="${it.qty ?? ''}"></label><label>الفئة<input name="rate" type="number" step="any" required value="${it.rate ?? ''}"></label>
    ${!draft ? '<label>رقم أمر التغيير<input name="ref"></label><label>التاريخ<input type="date" name="date" value="' + today() + '"></label><label class="wide">سبب الإضافة<input name="note"></label>' : ''}
    <div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form');
  f.item.onchange = () => { const i = P.items.find(x => x.id === f.item.value); if (!i) return; if (!f.name.value) f.name.value = i.name; f.ph.value = i.phase_n; if (!f.unit.value) f.unit.value = i.unit || ''; if (!f.qty.value) f.qty.value = +i.qty || ''; };
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  f.onsubmit = async e => { e.preventDefault(); const rec = { contract_id: c.id, item_id: f.item.value || null, name: f.name.value.trim(), phase_n: +f.ph.value || null, unit: f.unit.value.trim() || null, qty: f.qty.value === '' ? null : +f.qty.value, rate: +f.rate.value || 0 };
    if (it.id) { const { error } = await S.sb.from('sub_contract_items').update(rec).eq('id', it.id); if (error) return toast(error.message); }
    else { const { data, error } = await S.sb.from('sub_contract_items').insert({ ...rec, origin: draft ? 'contract' : 'addition', sort: Date.now() / 1e6 }).select().single(); if (error) return toast(error.message);
      if (!draft) await S.sb.from('sub_contract_changes').insert({ contract_id: c.id, contract_item_id: data.id, change_type: 'addition', new_value: (rec.qty || 0) * rec.rate, ref: f.ref.value.trim() || null, change_date: f.date.value || today(), note: f.note.value.trim() || null }); }
    d.close(); d.remove(); done(); };
}
function subChange(c, it, kind, done) {
  const d = document.createElement('dialog'); d.className = 'adlg'; const old = kind === 'price' ? it.rate : kind === 'qty' ? it.qty : null;
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${SCCH[kind]} – ${esc(it.name.slice(0, 60))}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px">
    ${kind !== 'cancel' ? `<label>${kind === 'price' ? 'الفئة' : 'الكمية'} الحالية<input value="${nf(old)}" disabled></label><label>الجديدة<input name="v" type="number" step="any" required></label>` : '<p class="wide" style="margin:0">البند هيتلغي من العقد ومش هيدخل في المستخلصات الجاية. اللي اتنفذ منه قبل كده بيفضل محسوب.</p>'}
    <label>رقم أمر التغيير / الملحق<input name="ref"></label><label>التاريخ<input type="date" name="date" value="${today()}"></label><label class="wide">السبب<input name="note" ${kind === 'cancel' ? 'required' : ''}></label>
    <div class="acts wide" style="margin:0"><button class="p">تسجيل التعديل</button></div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form');
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  f.onsubmit = async e => { e.preventDefault(); const nv = kind === 'cancel' ? null : +f.v.value;
    const upd = kind === 'price' ? { rate: nv } : kind === 'qty' ? { qty: nv } : { cancelled: true };
    let { error } = await S.sb.from('sub_contract_items').update(upd).eq('id', it.id);
    if (!error) ({ error } = await S.sb.from('sub_contract_changes').insert({ contract_id: c.id, contract_item_id: it.id, change_type: kind, old_value: old, new_value: nv, ref: f.ref.value.trim() || null, change_date: f.date.value || today(), note: f.note.value.trim() || null }));
    if (error) return toast(error.message); d.close(); d.remove(); toast('اتسجل التعديل'); done(); };
}
function subPick(c, I, draft, done) {
  const P = S.P, used = new Set(I.map(i => i.item_id).filter(Boolean)), F = (S.ivPick ||= { ph: '', q: '' }), d = document.createElement('dialog'); d.className = 'adlg wide';
  const list = () => { const ph = +F.ph || null, q = normAr(F.q); const R = P.items.filter(i => (!ph || i.phase_n === ph) && (!q || normAr(i.code + ' ' + i.name).includes(q)));
    return `<div class="pklist">${R.map(i => `<label class="pkrow${used.has(i.id) ? ' used' : ''}"><input type="checkbox" value="${esc(i.id)}"${used.has(i.id) ? ' disabled' : ''}><span class="pkc">${esc(i.code)}</span><span class="pkn">${esc(i.name.length > 110 ? i.name.slice(0, 110) + '…' : i.name)}</span><span class="pkq">${+i.qty ? nf(i.qty) + ' ' + esc(i.unit || '') : esc(i.unit || '')}</span><span class="pkr"><input type="number" step="any" placeholder="الفئة" data-r="${esc(i.id)}" style="width:86px;min-height:32px"></span></label>`).join('') || '<p class="mut">مفيش بنود.</p>'}</div>`; };
  d.innerHTML = `<div class="dh"><div><h3 style="margin:0;font-size:17px">بنود من المقايسة لعقد ${esc(c.contractor)}</h3><div class="mut" style="font-size:13px">علّم على البنود واكتب فئة المقاول (المصنعية أو اللي متفق عليه). الكمية بتيجي من المقايسة وتقدر تعدّلها بعدين.${draft ? '' : ' العقد ساري، فالبنود هتتسجل كإضافات.'}</div></div><button type="button" class="dx">✕</button></div>
    <div class="filters" style="margin:12px 0 8px"><select id="pkPh"><option value="">كل المراحل</option>${P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === F.ph ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select><input id="pkQ" type="search" placeholder="بحث" value="${esc(F.q)}"></div>
    <div id="pkBox">${list()}</div>${draft ? '' : '<div class="grid" style="margin-top:8px"><label>رقم أمر التغيير<input id="pkRef"></label><label>التاريخ<input type="date" id="pkDate" value="' + today() + '"></label></div>'}<div class="acts"><button class="p" id="pkGo">إضافة</button></div>`;
  document.body.append(d); d.showModal();
  d.querySelector('#pkPh').onchange = e => { F.ph = e.target.value; d.querySelector('#pkBox').innerHTML = list(); }; d.querySelector('#pkQ').oninput = e => { F.q = e.target.value; d.querySelector('#pkBox').innerHTML = list(); };
  d.querySelector('#pkBox').addEventListener('input', e => { if (e.target.dataset.r) { const cb = e.target.closest('.pkrow').querySelector('input[type=checkbox]'); if (!cb.disabled) cb.checked = e.target.value !== ''; } });
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  d.querySelector('#pkGo').onclick = async () => { const rows = [...d.querySelectorAll('#pkBox input[type=checkbox]:checked')].map(cb => { const i = P.items.find(x => x.id === cb.value); return { contract_id: c.id, item_id: i.id, name: i.name, phase_n: i.phase_n, unit: i.unit, qty: +i.qty || null, rate: +d.querySelector(`[data-r="${CSS.escape(i.id)}"]`).value || 0, origin: draft ? 'contract' : 'addition', sort: Date.now() / 1e6 }; });
    if (!rows.length) return toast('علّم على بند واحد على الأقل'); const { data, error } = await S.sb.from('sub_contract_items').insert(rows).select(); if (error) return toast(error.message);
    if (!draft) await S.sb.from('sub_contract_changes').insert(data.map(x => ({ contract_id: c.id, contract_item_id: x.id, change_type: 'addition', new_value: (+x.qty || 0) * +x.rate, ref: d.querySelector('#pkRef').value.trim() || null, change_date: d.querySelector('#pkDate').value || today() })));
    d.close(); d.remove(); toast(`اتضاف ${rows.length} بند${rows.some(r => !r.rate) ? ' – فيه بنود من غير فئة، كمّلها' : ''}`); done(); };
}
async function subInvoice(D) {
  const P = S.P, V = S.sc, iv = D.IV.find(i => i.id === V.iid), c = D.C.find(x => x.id === iv.contract_id), ed = can('editBoq', P.id), fin = can('ledger', P.id);
  const E = V.edit && ed && iv.status === 'draft', t = subInvTot(iv, D), L = t.L, DDi = D.DD.filter(x => x.invoice_id === iv.id);
  const advLeft = +c.advance_amount - D.IV.filter(x => x.contract_id === c.id && x.id !== iv.id && x.status !== 'draft').reduce((s, x) => s + +x.advance_recovery, 0), advSug = Math.max(0, Math.min(advLeft, t.gross * +c.advance_recovery_pct));
  const phName = n => P.phaseProg.find(x => x.n === n)?.name || '';
  $('#main').innerHTML = `<a href="#" id="siBack" class="mut" style="font-size:13px">← عقد ${esc(c.contractor)}</a>
  <div class="sthead"><div><h2 style="margin:2px 0">مستخلص ${iv.no} – ${esc(c.contractor)} <span class="st ${SIST[iv.status][0]}">${SIST[iv.status][1]}</span></h2><div class="mut" style="font-size:13px">${esc(c.title)} · ${fmtD(iv.inv_date)}${iv.period_from ? ' · الفترة ' + fmtD(iv.period_from) + ' – ' + fmtD(iv.period_to) : ''}</div></div>
    <div class="acts" style="margin:0">${ed && iv.status === 'draft' && !E ? '<button class="p" id="siEd">تعديل الكميات</button>' : ''}${E ? '<button class="p" id="siSave">حفظ</button><button id="siPull">⬇ الكميات من التقارير المعتمدة</button><button id="siX">إلغاء</button>' : ''}${!E ? '<button id="siPrint">🖨 طباعة</button>' : ''}${(ed || fin) && !E ? `<select id="siSt" style="width:auto">${Object.entries(SIST).map(([k, [, l]]) => `<option value="${k}"${k === iv.status ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}${ed && iv.status === 'draft' && !E ? '<button class="danger" id="siDel">حذف المستخلص</button>' : ''}</div></div>
  <div class="card" style="padding:0"><div class="scroll"><table class="ivt" id="siT"><thead><tr><th>البند</th><th>الوحدة</th><th class="n">الفئة</th><th class="n">السابق</th><th class="n">الحالي</th><th class="n">الإجمالي</th><th class="n">نسبة الصرف</th><th class="n">القيمة التراكمية</th><th class="n">قيمة الحالي</th><th>ملاحظات</th></tr></thead><tbody>
    ${L.map(l => `<tr><td>${esc(l.name)}${l.phase_n ? ` <span class="tag ph">م${l.phase_n}</span>` : ''}</td><td>${esc(l.unit || '')}</td><td class="n">${nf(l.rate)}</td><td class="n">${nf(l.prev_qty)}</td><td class="n cur">${E ? `<input data-sl="${l.id}" data-f="cur_qty" type="number" step="any" value="${+l.cur_qty || ''}" style="width:80px">` : +l.cur_qty ? nf(l.cur_qty) : '–'}</td><td class="n">${nf(+l.prev_qty + +l.cur_qty)}</td><td class="n">${E ? `<input data-sl="${l.id}" data-f="pct" type="number" step="any" value="${Math.round(l.pct * 1000) / 10}" style="width:60px">%` : Math.round(l.pct * 100) + '%'}</td><td class="n">${nf(sLnCum(l), 0)}</td><td class="n"><b>${nf(sLnCur(l), 0)}</b></td><td>${E ? `<input data-sl="${l.id}" data-f="notes" value="${esc(l.notes || '')}" style="width:120px">` : esc(l.notes || '')}</td></tr>`).join('')}
    <tr class="tot"><td colspan="7">الإجمالي</td><td class="n">${nf(t.cum, 0)}</td><td class="n">${nf(t.gross, 0)}</td><td></td></tr></tbody></table></div></div>
  <div class="ivpay card" style="margin-top:12px"><table><tbody><tr><td>إجمالي الأعمال الحالية</td><td class="n"><b>${nf(t.gross, 0)}</b></td></tr>
    <tr><td>تأمين أعمال ${ed && iv.status === 'draft' ? `<input id="siRet" type="number" step="any" value="${Math.round(iv.retention_pct * 1000) / 10}" style="width:64px">%` : Math.round(iv.retention_pct * 1000) / 10 + '%'}</td><td class="n">− ${nf(t.ret, 0)}</td></tr>
    ${+c.advance_amount ? `<tr><td>استرداد من الدفعة المقدمة ${ed && iv.status === 'draft' ? `<input id="siAdv" type="number" step="any" value="${+iv.advance_recovery || ''}" placeholder="${Math.round(advSug)}" style="width:110px">` : ''} <small class="mut">(المتبقي من المقدم ${nf(advLeft, 0)})</small></td><td class="n">− ${nf(t.adv, 0)}</td></tr>` : ''}
    ${DDi.map(x => `<tr><td>${esc(x.kind)}${x.note ? ' – ' + esc(x.note) : ''} ${(ed || fin) && iv.status === 'draft' ? `<button class="danger xs" data-ddel="${x.id}">✕</button>` : ''}</td><td class="n">− ${nf(x.amount, 0)}</td></tr>`).join('')}
    <tr class="net"><td>صافي المستحق للمقاول</td><td class="n">${nf(t.net, 0)}</td></tr></tbody></table>
    ${(ed || fin) && iv.status === 'draft' ? `<form id="ddF" class="grid" style="margin-top:10px"><label>خصم<select name="k">${SDED.map(k => `<option>${k}</option>`).join('')}</select></label><label>المبلغ<input name="a" type="number" step="any" required></label><label>ملاحظة<input name="n"></label><div class="acts" style="margin:0;align-self:end"><button>+ إضافة خصم</button></div></form>` : ''}
    <p class="mut" style="font-size:12px;margin:8px 0 0">الخصومات دي على المقاول بس، ومش بتأثر على مستخلص المالك.</p></div>`;
  const re = () => renderSubs();
  $('#siBack').onclick = e => { e.preventDefault(); V.iid = null; V.edit = false; V.tab = 'inv'; re(); };
  $('#siEd') && ($('#siEd').onclick = () => { V.edit = true; subInvoice(D); }); $('#siX') && ($('#siX').onclick = () => { V.edit = false; re(); });
  const collect = () => { document.querySelectorAll('[data-sl]').forEach(x => { const l = L.find(y => y.id === x.dataset.sl), f = x.dataset.f; l[f] = f === 'notes' ? x.value || null : f === 'pct' ? (x.value === '' ? 1 : +x.value / 100) : +x.value || 0; }); };
  $('#siPull') && ($('#siPull').onclick = async () => { collect(); const ids = L.map(l => l.item_id).filter(Boolean); if (!ids.length) return toast('بنود العقد مش مربوطة ببنود المقايسة');
    const { data } = await S.sb.from('progress_entries').select('item_id,qty').in('item_id', ids); const ex = {}; (data || []).forEach(x => ex[x.item_id] = (ex[x.item_id] || 0) + +x.qty); let n = 0;
    L.forEach(l => { if (l.item_id && ex[l.item_id] != null) { const v = Math.max(0, Math.round((ex[l.item_id] - +l.prev_qty) * 1000) / 1000); if (v !== +l.cur_qty) { l.cur_qty = v; n++; } } }); toast(n ? `اتحدث ${n} بند من التقارير` : 'مفيش كميات جديدة'); subInvoice(D); });
  $('#siSave') && ($('#siSave').onclick = async () => { collect(); let err = null; for (const l of L) { const { error } = await S.sb.from('sub_invoice_lines').update({ cur_qty: l.cur_qty, pct: l.pct, notes: l.notes }).eq('id', l.id); err = err || error; }
    const upd = { retention_pct: $('#siRet') ? (+$('#siRet').value || 0) / 100 : iv.retention_pct }; if ($('#siAdv')) upd.advance_recovery = $('#siAdv').value === '' ? Math.round(advSug) : +$('#siAdv').value;
    const { error } = await S.sb.from('sub_invoices').update(upd).eq('id', iv.id); err = err || error; if (err) return toast(err.message); V.edit = false; toast('اتحفظ'); re(); });
  $('#siRet') && !E && ($('#siRet').onchange = async e => { await S.sb.from('sub_invoices').update({ retention_pct: (+e.target.value || 0) / 100 }).eq('id', iv.id); re(); });
  $('#siAdv') && !E && ($('#siAdv').onchange = async e => { await S.sb.from('sub_invoices').update({ advance_recovery: +e.target.value || 0 }).eq('id', iv.id); re(); });
  $('#siSt') && ($('#siSt').onchange = async e => { const { error } = await S.sb.from('sub_invoices').update({ status: e.target.value }).eq('id', iv.id); if (error) return toast(error.message); re(); });
  $('#siDel') && ($('#siDel').onclick = async e => { const b = e.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('sub_invoices').delete().eq('id', iv.id); if (error) return toast(error.message); V.iid = null; V.tab = 'inv'; re(); });
  $('#ddF') && ($('#ddF').onsubmit = async e => { e.preventDefault(); const f = e.target; const { error } = await S.sb.from('sub_deductions').insert({ invoice_id: iv.id, kind: f.k.value, amount: +f.a.value, note: f.n.value.trim() || null }); if (error) return toast(error.message); re(); });
  $('#main').querySelectorAll('[data-ddel]').forEach(b => b.onclick = async () => { await S.sb.from('sub_deductions').delete().eq('id', b.dataset.ddel); re(); });
  $('#siPrint') && ($('#siPrint').onclick = () => { const w = window.open('', '_blank'); if (!w) return; const tb = $('#siT').outerHTML, pay = $('.ivpay table').outerHTML;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>مستخلص ${iv.no} – ${esc(c.contractor)}</title><style>body{font-family:system-ui,Tahoma,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th,td{border:1px solid #999;padding:4px 6px}th{background:#eee}.n{text-align:left;direction:ltr}.tot td,.net td{font-weight:700;background:#f4f4f4}.tag{font-size:10px;color:#666}input,button{display:none}.sig{display:flex;justify-content:space-around;margin-top:40px}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>${esc(P.proj.name)} – مستخلص مقاول رقم ${iv.no}</h1><div>المقاول: <b>${esc(c.contractor)}</b> · ${esc(c.title)} · التاريخ ${fmtD(iv.inv_date)}</div>${tb}<div style="max-width:420px;margin-right:auto">${pay}</div><div class="sig"><span>المقاول</span><span>المهندس المسئول</span><span>المكتب الفني</span><span>الحسابات</span></div><script>onload=()=>print()<\/script></body></html>`); w.document.close(); });
}
/* owner invoice: pull approved subcontractor invoices (gross, no deductions) */
async function invFromSubs(inv, L, done) {
  const P = S.P, D = await loadSubs(P.id), A = D.IV.filter(i => ['approved', 'paid'].includes(i.status) && (!i.owner_invoice_id || i.owner_invoice_id === inv.id));
  const d = document.createElement('dialog'); d.className = 'adlg';
  d.innerHTML = `<div class="dh"><div><h3 style="margin:0;font-size:17px">من مستخلصات المقاولين</h3><div class="mut" style="font-size:13px">بيتنقل إجمالي الأعمال (الكميات × الفئات) لكل بند بمرحلته، من غير تأمين المقاول ولا خصوماته.</div></div><button type="button" class="dx">✕</button></div>
    ${A.length ? `<div class="pklist" style="margin-top:10px">${A.map(i => { const c = D.C.find(x => x.id === i.contract_id), t = subInvTot(i, D); return `<label class="pkrow" style="grid-template-columns:24px minmax(0,1fr) 120px"><input type="checkbox" value="${i.id}"${i.owner_invoice_id ? ' checked disabled' : ''}><span><b>${esc(c.contractor)}</b> – مستخلص ${i.no}<br><small class="mut">${esc(c.title)} · ${fmtD(i.inv_date)}${i.owner_invoice_id ? ' · اتنقل قبل كده' : ''}</small></span><span class="pkr">${nf(t.gross, 0)}</span></label>`; }).join('')}</div><div class="acts"><button class="p" id="fsGo">نقل للمستخلص</button></div>` : '<p class="mut">مفيش مستخلصات مقاولين معتمدة لسه ماتنقلتش.</p>'}`;
  document.body.append(d); d.showModal(); d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  const go = d.querySelector('#fsGo'); if (!go) return;
  go.onclick = async () => { const ids = [...d.querySelectorAll('input:checked:not(:disabled)')].map(x => x.value); if (!ids.length) return toast('اختار مستخلص');
    let mx = Math.max(0, ...L.filter(l => l.cat === 'contract').map(l => +l.sort || 0)), n = 0;
    ids.forEach(id => D.LN.filter(l => l.invoice_id === id && +l.cur_qty).forEach(s => { const o = L.find(l => l.cat === 'contract' && l.kind === 'line' && l.line_key === s.contract_item_id);
      if (o) { o.cur_qty = +o.cur_qty + +s.cur_qty; o.rate = +s.rate; } else L.push({ cat: 'contract', kind: 'line', name: s.name, unit: s.unit, rate: +s.rate, prev_qty: +s.prev_qty, cur_qty: +s.cur_qty, pct: +s.pct, prev_value: +s.prev_value, item_id: s.item_id, phase_n: s.phase_n, line_key: s.contract_item_id, notes: null, sort: mx += 10, _new: true }); n++; }));
    V_subPulled = ids; d.close(); d.remove(); toast(`اتنقل ${n} بند – احفظ المستخلص`); done(); };
}
let V_subPulled = [];

/* ---------------- accounting entries (ledger) + site custody settlement ---------------- */
const LCAT = ['توريدات', 'مصنعيات', 'توريدوتركيب', 'تصميمات', 'استشارات', 'تراخيص', 'اكراميات_وعمالة', 'نثريات', 'موقع', 'دعايا'];
const lcat = c => (c || '').replace(/_/g, ' ').replace('توريدوتركيب', 'توريد وتركيب');
const LPAY = ['نقدي', 'تحويل بنكي', 'شيك', 'عهدة'], LEST = { draft: ['', 'مسودة'], submitted: ['pend', 'بانتظار الحسابات'], approved: ['appr', 'معتمد'], rejected: ['ret', 'مرجّع'] };
const LSRC = { excel: 'شيت الحسابات', odoo: 'أودو', manual: 'قيد يدوي', custody: 'عهدة', archived: 'أرشيف' };
async function ledDocs(rows) { const P = S.P, ids = [...new Set(rows.map(r => r.doc_id).filter(Boolean))].filter(id => !P.docs.some(d => d.id === id)); if (ids.length) { const { data } = await S.sb.from('documents').select('*').in('id', ids); P.docs = [...P.docs, ...(data || [])]; } }
const GACAT = ['مرتبات', 'إيجارات', 'مكافآت', 'نثريات', 'انتقالات', 'سكن', 'مرافق_واتصالات', 'مصاريف_بنكية', 'ضيافة', 'مستلزمات_مكتبية', 'أخرى'];
async function loadAccs(force) { if (!S.finAny) return []; if (!S.accs || force) S.accs = (await S.sb.from('cash_accounts').select('*').order('sort').order('created_at')).data || []; return S.accs; }
const accName = id => (S.accs || []).find(a => a.id === id)?.name || '';
const accSel = (name, sel, blank = '—') => `<select name="${name}"><option value="">${blank}</option>${(S.accs || []).filter(a => a.active || a.id === sel).map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${a.kind === 'cash' ? '💵' : '🏦'} ${esc(a.name)}</option>`).join('')}</select>`;
async function liteP(pid) { if (S.P?.id === pid && S.P.items && S.P.phaseProg) return S.P; if ((S.LP ||= {})[pid]) return S.LP[pid];
  const [ph, it, vd] = await Promise.all([S.sb.from('phases').select('n,name').eq('project_id', pid).order('n'), S.sb.from('boq_items').select('id,code,name,phase_n,group_name,unit').eq('project_id', pid).order('sort'), S.sb.from('vendors').select('id,name')]);
  return S.LP[pid] = { id: pid, phaseProg: ph.data || [], items: it.data || [], vendors: vd.data || [], docs: [] }; }
async function ledgerForm(x, mode, sugg, done, o = {}) {
  x ||= {}; const cust = mode === 'custody', d = document.createElement('dialog'); d.className = 'adlg'; await loadAccs();
  const T = cust ? S.projects : S.projects.filter(p => can('ledgerEd', p.id)), gaOk = cust || S.finAny, pick = cust || o.pick;
  let tgt = x.id ? (x.project_id || 'ga') : o.ga ? 'ga' : (o.P?.id || S.P?.id || T[0]?.id || 'ga'); if (tgt !== 'ga' && !T.some(p => p.id === tgt)) tgt = T[0]?.id || 'ga';
  let P = tgt === 'ga' ? null : (o.P?.id === tgt ? o.P : await liteP(tgt));
  const fixedGa = o.ga && !pick, showTgt = pick && (T.length > 1 || gaOk);
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${x.id ? 'تعديل مصروف' : cust ? '+ مصروف من العهدة' : o.ga ? '+ مصروف إداري وعمومي' : '+ قيد مصروف'}</h3><button type="button" class="dx">✕</button></div>
    ${x.review_note && x.status === 'rejected' ? `<div class="note" style="margin-top:10px">الحسابات رجّعته: ${esc(x.review_note)}</div>` : ''}<form class="grid" style="margin-top:12px">
    <label class="wide"${showTgt ? '' : ' hidden'}>المصروف على<select name="tgt">${T.map(p => `<option value="${p.id}"${p.id === tgt ? ' selected' : ''}>مشروع ${esc(p.name)}</option>`).join('')}${gaOk ? `<option value="ga"${tgt === 'ga' ? ' selected' : ''}>مصروفات إدارية وعمومية للشركة</option>` : ''}</select></label>
    <label>التاريخ<input type="date" name="date" required value="${x.entry_date || today()}"></label>
    <label>القيمة (ج.م)<input name="amount" type="number" step="any" inputmode="decimal" required value="${x.expense ?? ''}"></label>
    <label data-pj>المرحلة<select name="ph"><option value="">— اختار —</option></select></label>
    <label data-pj>المرحلة الفرعية<input name="sub" list="lgSub" value="${esc(x.sub_phase || '')}" placeholder="مثلاً: خوازيق، كرفانات"><datalist id="lgSub"></datalist></label>
    <label data-pj>النوع<select name="cat"><option value="">— اختار —</option>${LCAT.map(c => `<option value="${c}"${c === x.category ? ' selected' : ''}>${lcat(c)}</option>`).join('')}</select></label>
    <label data-ga>نوع المصروف الإداري<select name="gcat"><option value="">— اختار —</option>${GACAT.map(c => `<option value="${c}"${c === x.category ? ' selected' : ''}>${lcat(c)}</option>`).join('')}</select></label>
    <label>الفرعي<input name="subcat" list="lgSc" value="${esc(x.sub_category || '')}" placeholder="مثلاً: حديد، أسمنت / مرتب شهر 11"><datalist id="lgSc">${(sugg?.sc || []).map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
    <label class="wide">البيان<input name="desc" required value="${esc(x.description || '')}" placeholder="اكتب المصروف بوضوح"></label>
    <label>المورد / المستفيد<input name="sup" list="lgV" value="${esc(x.supplier || '')}"><datalist id="lgV"></datalist></label>
    <label data-pj>بند المقايسة (اختياري)<select name="item"><option value="">—</option></select></label>
    <label data-pj>الكمية<input name="qty" type="number" step="any" value="${x.qty ?? ''}"></label><label data-pj>الوحدة<input name="unit" value="${esc(x.unit || '')}"></label>
    ${cust ? '' : `${S.finAny ? `<label>اتدفع من${accSel('acc', x.id ? x.account_id : (x.account_id || o.acc || ''), '— مش من حساب متسجل —')}</label>` : ''}<label>طريقة الدفع<select name="pay"><option value="">—</option>${LPAY.map(m => `<option${m === x.pay_method ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
    <label data-pj>رقم المستخلص<select name="inv"><option value="">— لسه —</option></select></label>
    <label>رقم الإيصال / التحويل<input name="ref" value="${esc(x.ref || '')}"></label>`}
    <label class="wide">${cust ? '📷 صورة الفاتورة / الإيصال' : 'مرفق (اختياري)'}${x.doc_id ? ' – <span class="mut">فيه مرفق، ارفع جديد لو عاوز تغيّره</span>' : ''}<input type="file" name="file" accept="image/*,.pdf"${cust ? ' capture="environment"' : ''}></label>
    <div class="acts wide" style="margin:0"><button class="p">${cust ? 'حفظ' : 'حفظ القيد'}</button>${cust && !x.id ? '<button type="button" id="lgMore">حفظ وإضافة غيره</button>' : ''}</div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form'); let SG = sugg || { sub: {}, sc: [], sup: [], inv: [] };
  const subs = n => [...new Set([...(SG.sub?.[n] || []), ...(P?.items || []).filter(i => i.phase_n === +n).map(i => i.group_name)])].filter(Boolean);
  const fillPh = () => { const n = f.ph.value; d.querySelector('#lgSub').innerHTML = subs(n).map(s => `<option value="${esc(s)}">`).join(''); f.item.innerHTML = '<option value="">—</option>' + (P?.items || []).filter(i => i.phase_n === +n).map(i => `<option value="${esc(i.id)}"${i.id === x.item_id ? ' selected' : ''}>${esc(i.code + ' ' + (i.name || '').slice(0, 60))}</option>`).join(''); };
  const fillP = () => { f.ph.innerHTML = '<option value="">— اختار —</option>' + (P?.phaseProg || []).map(p => `<option value="${p.n}"${p.n === x.phase_n ? ' selected' : ''}>${p.n}. ${esc(p.name)}</option>`).join(''); fillPh();
    d.querySelector('#lgV').innerHTML = [...new Set([...(P?.vendors || []).map(v => v.name), ...(SG.sup || [])])].map(s => `<option value="${esc(s)}">`).join('');
    f.inv && (f.inv.innerHTML = '<option value="">— لسه —</option>' + (SG.inv || []).map(n => `<option value="${n}"${n === x.owner_invoice_no ? ' selected' : ''}>مستخلص ${n}</option>`).join('')); };
  const sync = () => { const ga = f.tgt.value === 'ga'; d.querySelectorAll('[data-pj]').forEach(e => e.hidden = ga); d.querySelectorAll('[data-ga]').forEach(e => e.hidden = !ga); f.ph.required = f.cat.required = !ga; f.gcat.required = ga; };
  f.tgt.onchange = async () => { const v = f.tgt.value; if (v !== 'ga') { P = await liteP(v); SG = await ledgerSugg(v); } else P = null; sync(); fillP(); };
  sync(); fillP(); if (fixedGa) f.tgt.value = 'ga', sync();
  f.ph.onchange = fillPh; f.item.onchange = () => { const i = (P?.items || []).find(y => y.id === f.item.value); if (i && !f.unit.value) f.unit.value = i.unit || ''; if (i && !f.sub.value) f.sub.value = i.group_name || ''; };
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  let more = false; d.querySelector('#lgMore') && (d.querySelector('#lgMore').onclick = () => { more = true; f.requestSubmit(); });
  f.onsubmit = async e => { e.preventDefault(); const ga = f.tgt.value === 'ga', ph = !ga && (P?.phaseProg || []).find(p => p.n === +f.ph.value);
    const rec = { project_id: ga ? null : P.id, entry_date: f.date.value, expense: +f.amount.value, revenue: 0, phase_n: ph?.n || null, main_phase: ga ? 'مصروفات إدارية وعمومية' : ph?.name || null, sub_phase: ga ? null : f.sub.value.trim() || null, category: ga ? f.gcat.value : f.cat.value, sub_category: f.subcat.value.trim() || null, description: f.desc.value.trim(), supplier: f.sup.value.trim() || null, item_id: ga ? null : f.item.value || null, qty: ga || f.qty.value === '' ? null : +f.qty.value, unit: ga ? null : f.unit.value.trim() || null };
    const v = (P?.vendors || []).find(y => y.name === rec.supplier); rec.vendor_id = v?.id || null;
    if (!(rec.expense > 0)) return toast('اكتب القيمة'); if (!rec.category) return toast('اختار النوع');
    if (cust) { if (!x.id) Object.assign(rec, { source: 'custody', custody_user: x.custody_user || S.user.id, pay_method: 'عهدة', status: 'draft' }); else if (x.status === 'rejected' && x.custody_user === S.user.id) rec.status = 'draft'; }
    else { Object.assign(rec, { pay_method: f.pay.value || null, owner_invoice_no: !ga && f.inv.value ? +f.inv.value : null, ref: f.ref.value.trim() || null }); if (f.acc) rec.account_id = f.acc.value || null; if (!x.id) Object.assign(rec, { source: 'manual', status: 'approved' }); }
    const file = f.file.files[0]; if (file) { const up = P || (S.P?.id ? S.P : { id: S.projects[0]?.id }); const m = { P: up, kind: 'receipt', title: 'إيصال – ' + rec.description.slice(0, 60), doc_date: rec.entry_date, supplier: rec.supplier, amount: rec.expense }; await uploadDocs([file], m); if (m.ids?.[0]) rec.doc_id = m.ids[0]; }
    const { error } = x.id ? await S.sb.from('ledger_entries').update(rec).eq('id', x.id) : await S.sb.from('ledger_entries').insert(rec); if (error) return toast(error.message);
    toast(x.id ? 'اتحفظ' : 'اتسجل'); d.close(); d.remove(); done(); if (more) ledgerForm({ entry_date: rec.entry_date, phase_n: rec.phase_n, sub_phase: rec.sub_phase, category: rec.category, project_id: rec.project_id }, mode, SG, done, { ...o, P, ga: ga }); };
}
async function ledgerSugg(pid) {
  const [{ data: le }, { data: iv }] = await Promise.all([S.sb.from('ledger_entries').select('phase_n,sub_phase,sub_category,supplier').eq('project_id', pid).limit(2000), can('inv', pid) ? S.sb.from('owner_invoices').select('no').eq('project_id', pid).order('no') : Promise.resolve({ data: [] })]);
  const sub = {}; (le || []).forEach(r => { if (r.sub_phase) (sub[r.phase_n] ||= new Set()).add(r.sub_phase.trim()); });
  const nxt = (iv || []).length ? Math.max(...iv.map(i => i.no)) + 1 : 1;
  return { sub: Object.fromEntries(Object.entries(sub).map(([k, v]) => [k, [...v]])), sc: [...new Set((le || []).map(r => r.sub_category).filter(Boolean))], sup: [...new Set((le || []).map(r => r.supplier).filter(Boolean))].slice(0, 300), inv: [...(iv || []).map(i => i.no), nxt] };
}
async function renderLedger() {
  const P = S.P, F = (S.lg ||= { ph: '', cat: '', inv: '', src: '', st: '', q: '', lim: 200 }); if (F.pid !== P.id) Object.assign(F, { pid: P.id, ph: '', cat: '', inv: '', src: '', st: '', q: '', lim: 200 });
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  let q = S.sb.from('ledger_entries').select('*').eq('project_id', P.id).gt('expense', 0);
  if (F.ph) q = F.ph === '0' ? q.is('phase_n', null) : q.eq('phase_n', +F.ph); if (F.cat) q = q.eq('category', F.cat); if (F.inv) q = F.inv === '0' ? q.is('owner_invoice_no', null) : q.eq('owner_invoice_no', +F.inv); if (F.src) q = q.eq('source', F.src); if (F.st) q = q.eq('status', F.st); else q = q.neq('status', 'draft');
  const [{ data: R, error }, sugg, { data: ppl }] = await Promise.all([q.order('entry_date', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(5000), ledgerSugg(P.id), S.sb.rpc('project_people', { p_project: P.id })]);
  if (error) return $('#main').innerHTML = `<div class="note">${esc(error.message)}</div>`;
  const nm = Object.fromEntries((ppl || []).map(p => [p.user_id, p.name])), qq = normAr(F.q);
  const rows = (R || []).filter(r => !qq || normAr([r.description, r.supplier, r.sub_phase, r.sub_category, r.ref].join(' ')).includes(qq)), shown = rows.slice(0, F.lim); await ledDocs(shown);
  const ok = rows.filter(r => r.status === 'approved'), tot = ok.reduce((s, r) => s + +r.expense, 0), pend = (R || []).filter(r => r.status === 'submitted');
  const byCat = {}; ok.forEach(r => byCat[r.category || '—'] = (byCat[r.category || '—'] || 0) + +r.expense);
  const phN = n => n ? n + '. ' + (P.phaseProg.find(p => p.n === n)?.name || '') : '—', code = id => P.items.find(i => i.id === id)?.code || '';
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">القيود والمصروفات</h2><p class="mut" style="margin:2px 0 0;font-size:13px">كل مصروف بمرحلته ونوعه وبند المقايسة ورقم المستخلص. القيود المعتمدة بس هي اللي بتدخل في تكاليف المراحل ومستخلص المالك.</p></div><div class="acts" style="margin:0"><button class="p" id="lgNew">+ قيد مصروف</button>${can('acctEdit', P.id) ? '<button id="lgIn">+ وارد من المالك</button>' : ''}<a class="btn" href="#p/${P.id}/phfin">حساب المراحل</a>${pend.length ? `<a class="btn" href="#p/${P.id}/custody">مراجعة العُهد (${pend.length})</a>` : ''}</div></div>
  <div class="kpis"><div class="kpi"><b>${money(tot)}</b><span>إجمالي المعتمد بالفلتر الحالي<br><small>${ok.length} قيد</small></span></div>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `<div class="kpi"><b>${money(v)}</b><span>${esc(lcat(c))}</span></div>`).join('')}</div>
  <div class="filters" style="margin-top:12px"><select id="fPh"><option value="">كل المراحل</option>${P.phaseProg.map(p => `<option value="${p.n}"${String(p.n) === F.ph ? ' selected' : ''}>${p.n}. ${esc(p.name)}</option>`).join('')}<option value="0"${F.ph === '0' ? ' selected' : ''}>بدون مرحلة</option></select>
    <select id="fCat"><option value="">كل الأنواع</option>${LCAT.map(c => `<option value="${c}"${c === F.cat ? ' selected' : ''}>${lcat(c)}</option>`).join('')}</select>
    <select id="fInv"><option value="">كل المستخلصات</option>${sugg.inv.map(n => `<option value="${n}"${String(n) === F.inv ? ' selected' : ''}>مستخلص ${n}</option>`).join('')}<option value="0"${F.inv === '0' ? ' selected' : ''}>من غير مستخلص</option></select>
    <select id="fSrc"><option value="">كل المصادر</option>${Object.entries(LSRC).map(([k, l]) => `<option value="${k}"${k === F.src ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <select id="fSt"><option value="">معتمد + تحت المراجعة</option>${Object.entries(LEST).map(([k, [, l]]) => `<option value="${k}"${k === F.st ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <input id="fQ" type="search" placeholder="بحث في البيان أو المورد" value="${esc(F.q)}"></div>
  <div class="card" style="padding:0;margin-top:10px"><div class="scroll"><table class="stack lgt"><thead><tr><th>التاريخ</th><th>المرحلة</th><th>النوع</th><th>البيان</th><th>المورد</th><th class="n">القيمة</th><th>مستخلص</th><th>المصدر</th><th></th></tr></thead><tbody>
    ${shown.map(r => { const dd = r.doc_id && P.docs.find(x => x.id === r.doc_id), edt = r.source !== 'excel' && r.source !== 'archived'; return `<tr class="${r.status !== 'approved' ? 'dim' : ''}"><td data-l="التاريخ">${r.entry_date ? fmtD(r.entry_date) : '–'}</td><td data-l="المرحلة">${esc(phN(r.phase_n))}${r.sub_phase ? `<div class="mut" style="font-size:12px">${esc(r.sub_phase)}</div>` : ''}</td><td data-l="النوع">${esc(lcat(r.category) || '–')}${r.sub_category ? `<div class="mut" style="font-size:12px">${esc(r.sub_category)}</div>` : ''}</td>
      <td data-l="البيان">${esc(r.description || '')}${r.item_id ? ` <span class="tag">${esc(code(r.item_id))}</span>` : ''}${r.qty ? ` <small class="mut">${nf(r.qty)} ${esc(r.unit || '')}</small>` : ''}${dd ? ' ' + docChip(dd) : ''}</td><td data-l="المورد">${esc(r.supplier || '–')}</td><td class="n" data-l="القيمة"><b>${nf(r.expense, 0)}</b></td><td data-l="مستخلص">${r.owner_invoice_no ?? '–'}</td>
      <td data-l="المصدر"><span class="mut" style="font-size:12px">${LSRC[r.source] || r.source}${r.custody_user ? ' – ' + esc(nm[r.custody_user] || '') : ''}${r.pay_method && r.source !== 'custody' ? ' · ' + esc(r.pay_method) : ''}</span>${r.status !== 'approved' ? ` <span class="st ${LEST[r.status][0]}">${LEST[r.status][1]}</span>` : ''}</td><td class="qa">${edt ? `<button data-led="${r.id}">تعديل</button><button class="danger" data-ldl="${r.id}">حذف</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="9" class="mut">مفيش قيود بالفلتر ده.</td></tr>'}</tbody></table></div></div>
  ${rows.length > F.lim ? `<div class="acts"><button id="lgMoreRows">عرض المزيد (${rows.length - F.lim})</button></div>` : ''}`;
  const set = (k, v) => { F[k] = v; F.lim = 200; renderLedger(); };
  [['fPh', 'ph'], ['fCat', 'cat'], ['fInv', 'inv'], ['fSrc', 'src'], ['fSt', 'st']].forEach(([id, k]) => $('#' + id).onchange = e => set(k, e.target.value)); $('#fQ').onchange = e => set('q', e.target.value.trim());
  $('#lgNew').onclick = () => ledgerForm(null, 'acct', sugg, renderLedger); $('#lgIn') && ($('#lgIn').onclick = () => payForm('invoice', {}, null, () => toast('اتسجل الوارد – هتلاقيه في ملخص الحسابات وحساب المراحل'))); $('#lgMoreRows') && ($('#lgMoreRows').onclick = () => { F.lim += 500; renderLedger(); });
  $('#main').onclick = async e => { const a = e.target.closest('[data-led]'); if (a) return ledgerForm(R.find(r => String(r.id) === a.dataset.led), 'acct', sugg, renderLedger);
    const b = e.target.closest('[data-ldl]'); if (b) { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('ledger_entries').delete().eq('id', b.dataset.ldl); if (error) return toast(error.message); toast('اتحذف'); return renderLedger(); }
    docClick(e); };
}
async function peopleAll(pids) { const R = await Promise.all(pids.map(id => S.sb.rpc('project_people', { p_project: id }))), m = {}; R.forEach((r, k) => (r.data || []).forEach(p => { (m[p.user_id] ||= { user_id: p.user_id, name: p.name, roles: new Set(), pids: [] }).roles.add(p.role); m[p.user_id].pids.push(pids[k]); })); return Object.values(m); }
function custTxForm(kind, h, people, done) { const d = document.createElement('dialog'); d.className = 'adlg'; const H = people.filter(p => ['site', 'tech', 'store', 'finance', 'management'].some(r => p.roles.has(r)));
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${kind === 'issue' ? 'صرف عهدة' : 'رد نقدية من عهدة'}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px"><label class="wide">صاحب العهدة<select name="h" required><option value="">— اختار —</option>${H.map(p => `<option value="${p.user_id}"${p.user_id === h ? ' selected' : ''}>${esc(p.name)} (${[...p.roles].map(r => ROLE[r] || r).join('، ')})</option>`).join('')}</select></label>
    <label>المبلغ<input name="a" type="number" step="any" required></label><label>التاريخ<input type="date" name="d" value="${today()}"></label>
    ${S.finAny ? `<label>${kind === 'issue' ? 'اتصرفت من' : 'رجعت في'}${accSel('acc', (S.accs || []).find(a => a.kind === 'cash' && a.active)?.id || '', '— مش من حساب متسجل —')}</label>` : ''}
    <label>طريقة<select name="m"><option>نقدي</option><option>تحويل بنكي</option><option>شيك</option></select></label>
    <label>لمشروع (اختياري)<select name="pj"><option value="">— عامة –</option>${S.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>ملاحظة<input name="n"></label><div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
  document.body.append(d); d.showModal(); d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target; const { error } = await S.sb.from('custody_txns').insert({ project_id: f.pj.value || null, holder: f.h.value, kind, amount: +f.a.value, txn_date: f.d.value, method: f.m.value, note: f.n.value.trim() || null, account_id: f.acc?.value || null }); if (error) return toast(error.message); d.close(); d.remove(); toast('اتسجل'); done(); }; }
async function renderCustody() {
  const fin = S.finAny || S.projects.some(p => can('ledgerEd', p.id)); await loadAccs();
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const pids = S.projects.map(p => p.id);
  const [le, tx, ph, people] = await Promise.all([S.sb.from('ledger_entries').select('*').eq('source', 'custody').order('entry_date', { ascending: false }).order('id', { ascending: false }), S.sb.from('custody_txns').select('*').order('txn_date', { ascending: false }), S.sb.from('phases').select('project_id,n,name'), peopleAll(pids)]);
  if (le.error || tx.error) return $('#main').innerHTML = `<div class="note">${esc((le.error || tx.error).message)}</div>`;
  const E = le.data || [], T = tx.data || [], PH = ph.data || [], nm = id => people.find(p => p.user_id === id)?.name || (id === S.user.id ? 'أنا' : '—');
  const docs = [...new Set(E.map(x => x.doc_id).filter(Boolean))], DOCS = docs.length ? ((await S.sb.from('documents').select('*').in('id', docs)).data || []) : []; (S.P ||= { id: null }).docs = [...(S.P.docs || []), ...DOCS.filter(d => !(S.P.docs || []).some(y => y.id === d.id))];
  const sugg = await ledgerSugg(S.P?.id || pids[0]);
  const bal = h => { const iss = T.filter(t => t.holder === h && t.kind === 'issue').reduce((s, t) => s + +t.amount, 0), ret = T.filter(t => t.holder === h && t.kind === 'return').reduce((s, t) => s + +t.amount, 0), M = E.filter(x => x.custody_user === h), ap = M.filter(x => x.status === 'approved').reduce((s, x) => s + +x.expense, 0), pe = M.filter(x => x.status === 'submitted').reduce((s, x) => s + +x.expense, 0), dr = M.filter(x => ['draft', 'rejected'].includes(x.status)).reduce((s, x) => s + +x.expense, 0); return { iss, ret, ap, pe, dr, left: iss - ret - ap, after: iss - ret - ap - pe - dr }; };
  const where = x => x.project_id ? `<b>${esc(S.projects.find(p => p.id === x.project_id)?.name || '')}</b><div class="mut" style="font-size:12px">${x.phase_n ? x.phase_n + '. ' + esc(PH.find(p => p.project_id === x.project_id && p.n === x.phase_n)?.name || '') : 'من غير مرحلة'}${x.sub_phase ? ' · ' + esc(x.sub_phase) : ''}</div>` : '<span class="tag">إداري</span>';
  const rowE = (x, acts) => { const dd = x.doc_id && DOCS.find(y => y.id === x.doc_id); return `<tr><td data-l="التاريخ">${fmtD(x.entry_date)}</td><td data-l="على">${where(x)}</td><td data-l="النوع">${esc(lcat(x.category))}${x.sub_category ? `<div class="mut" style="font-size:12px">${esc(x.sub_category)}</div>` : ''}</td><td data-l="البيان">${esc(x.description || '')}${x.supplier ? `<div class="mut" style="font-size:12px">${esc(x.supplier)}</div>` : ''}${dd ? docChip(dd) : '<span class="mut" style="font-size:11px"> · من غير إيصال</span>'}${x.review_note ? `<div style="color:var(--bad);font-size:12px">${esc(x.review_note)}</div>` : ''}</td><td class="n" data-l="القيمة"><b>${nf(x.expense, 0)}</b></td><td data-l="الحالة"><span class="st ${LEST[x.status][0]}">${LEST[x.status][1]}</span></td><td class="qa">${acts(x)}</td></tr>`; };
  const tbl = (L, acts) => `<div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>على</th><th>النوع</th><th>البيان</th><th class="n">القيمة</th><th>الحالة</th><th></th></tr></thead><tbody>${L.map(x => rowE(x, acts)).join('') || '<tr><td colspan="7" class="mut">مفيش.</td></tr>'}</tbody></table></div></div>`;
  const balCard = b => `<div class="kpis"><div class="kpi"><b>${money(b.iss - b.ret)}</b><span>العهدة المستلمة<br><small>صرف ${money(b.iss)}${b.ret ? ' − رد ' + money(b.ret) : ''}</small></span></div><div class="kpi k-ok"><b>${money(b.ap)}</b><span>مصروفات معتمدة</span></div><div class="kpi${b.pe ? ' k-warn' : ''}"><b>${money(b.pe)}</b><span>تحت مراجعة الحسابات</span></div><div class="kpi${b.after < 0 ? ' k-bad' : ''}"><b>${money(b.after)}</b><span>${b.after < 0 ? 'مصروف أكتر من العهدة' : 'الباقي في العهدة'}<br><small>بعد كل المصروفات المسجلة</small></span></div></div>`;
  const mine = () => { const me = S.user.id, b = bal(me), M = E.filter(x => x.custody_user === me), dr = M.filter(x => ['draft', 'rejected'].includes(x.status)), ndr = M.filter(x => x.status === 'draft').length;
    return `<div class="sthead"><div><h2 style="margin:0">عهدتي</h2><p class="mut" style="margin:2px 0 0;font-size:13px">عهدة واحدة لكل المشروعات. سجّل كل مصروف على المشروع بمرحلته ونوعه، أو كمصروف إداري (سكن، انتقالات، نثريات الشركة…)، وصوّر الإيصال، وبعدين ابعت التصفية للحسابات.</p></div><div class="acts" style="margin:0"><button class="p" id="cuAdd">+ مصروف</button>${ndr ? `<button class="p" id="cuSend">إرسال التصفية للحسابات (${ndr})</button>` : ''}</div></div>${balCard(b)}
    ${dr.length ? `<div class="secT">مسودات ومرجّعات – لسه ماتبعتتش</div>${tbl(dr, x => `<button data-ced="${x.id}">تعديل</button><button class="danger" data-cdl="${x.id}">حذف</button>`)}` : ''}
    <div class="secT">بانتظار الحسابات</div>${tbl(M.filter(x => x.status === 'submitted'), x => `<button data-cback="${x.id}">سحب للتعديل</button>`)}
    <div class="secT">المعتمد</div>${tbl(M.filter(x => x.status === 'approved').slice(0, 100), () => '')}
    <div class="secT">حركة العهدة</div><div class="card" style="padding:0">${T.filter(t => t.holder === me).map(t => `<div class="vrow" style="padding:10px 14px"><div style="flex:1">${t.kind === 'issue' ? '⬇ استلام عهدة' : '⬆ رد نقدية'} – ${fmtD(t.txn_date)}${t.note ? ' · ' + esc(t.note) : ''}</div><b>${nf(t.amount, 0)}</b></div>`).join('') || '<p class="mut" style="padding:14px;margin:0">مفيش.</p>'}</div>`; };
  const admin = () => { const H = [...new Set([...T.map(t => t.holder), ...E.map(x => x.custody_user), ...people.filter(p => ['site', 'tech', 'store'].some(r => p.roles.has(r))).map(p => p.user_id)])], Q = E.filter(x => x.status === 'submitted'), tot = H.reduce((s, h) => s + bal(h).left, 0);
    return `<div class="sthead"><div><h2 style="margin:0">العُهد والتصفيات</h2><p class="mut" style="margin:2px 0 0;font-size:13px">رصيد عهدة كل مهندس على مستوى الشركة، ومصروفات التصفية – على المشروعات بمراحلها أو مصروفات إدارية. تقدر تعدّل التصنيف قبل الاعتماد.</p></div><div class="acts" style="margin:0"><button class="p" data-tx="issue">+ صرف عهدة</button><button data-tx="return">رد نقدية</button></div></div>
    <div class="kpis"><div class="kpi"><b>${money(tot)}</b><span>إجمالي أرصدة العهد</span></div><div class="kpi${Q.length ? ' k-warn' : ''}"><b>${Q.length}</b><span>مصروف مستني مراجعة<br><small>${money(Q.reduce((s, x) => s + +x.expense, 0))}</small></span></div></div>
    <div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>صاحب العهدة</th><th class="n">مستلم</th><th class="n">معتمد</th><th class="n">تحت المراجعة</th><th class="n">الرصيد</th><th></th></tr></thead><tbody>${H.map(h => { const b = bal(h); return `<tr><td data-l="صاحب العهدة"><b>${esc(nm(h))}</b></td><td class="n" data-l="مستلم">${nf(b.iss - b.ret, 0)}</td><td class="n" data-l="معتمد">${nf(b.ap, 0)}</td><td class="n" data-l="تحت المراجعة">${b.pe ? `<b style="color:var(--warn)">${nf(b.pe, 0)}</b>` : '–'}</td><td class="n${b.left < 0 ? ' bad' : ''}" data-l="الرصيد">${nf(b.left, 0)}</td><td class="qa"><button data-tx="issue" data-h="${h}">+ صرف</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="mut">مفيش عُهد لسه.</td></tr>'}</tbody></table></div></div>
    <div class="secT">بانتظار المراجعة (${Q.length})</div>
    ${[...new Set(Q.map(x => x.custody_user))].map(h => { const L = Q.filter(x => x.custody_user === h); return `<div class="card" style="padding:0;margin-bottom:12px"><div class="vrow" style="padding:10px 14px;border-bottom:1px solid var(--line)"><div style="flex:1"><b>${esc(nm(h))}</b> <span class="mut">${L.length} مصروف · ${nf(L.reduce((s, x) => s + +x.expense, 0), 0)} ج.م</span></div><button class="p" data-apall="${h}">✔ اعتماد الكل</button></div><div class="scroll"><table class="stack"><tbody>${L.map(x => rowE(x, y => `<button class="p" data-cok="${y.id}">✔</button><button data-ced="${y.id}">تعديل</button><button class="danger" data-cno="${y.id}">رجّع</button>`)).join('')}</tbody></table></div></div>`; }).join('') || '<p class="mut">مفيش تصفيات مستنية مراجعة.</p>'}
    <div class="secT">آخر حركات العُهد</div><div class="card" style="padding:0">${T.slice(0, 40).map(t => `<div class="vrow" style="padding:10px 14px"><div style="flex:1">${t.kind === 'issue' ? '⬇ صرف عهدة لـ' : '⬆ رد نقدية من'} <b>${esc(nm(t.holder))}</b> – ${fmtD(t.txn_date)}${t.account_id ? ' · ' + esc(accName(t.account_id)) : ''}${t.project_id ? ' · ' + esc(S.projects.find(p => p.id === t.project_id)?.name || '') : ''}${t.note ? ' · ' + esc(t.note) : ''}</div><b>${nf(t.amount, 0)}</b><button class="danger xs" data-txdl="${t.id}">✕</button></div>`).join('') || '<p class="mut" style="padding:14px;margin:0">مفيش.</p>'}</div>`; };
  $('#main').innerHTML = fin ? admin() : mine(); if (fin) setBadge('custN', E.filter(x => x.status === 'submitted').length);
  const re = () => renderCustody(), okX = x => x.category && (!x.project_id || x.phase_n);
  $('#cuAdd') && ($('#cuAdd').onclick = () => ledgerForm(null, 'custody', sugg, re));
  $('#cuSend') && ($('#cuSend').onclick = async () => { const ids = E.filter(x => x.custody_user === S.user.id && x.status === 'draft').map(x => x.id); const { error } = await S.sb.from('ledger_entries').update({ status: 'submitted' }).in('id', ids); if (error) return toast(error.message); toast(`اتبعت ${ids.length} مصروف للحسابات`); re(); });
  $('#main').onclick = async e => { const b = e.target.closest('button'); if (!b) return docClick(e); const k = Object.keys(b.dataset).find(x => x !== 'sure' && x !== 'h'), id = b.dataset[k], x = E.find(y => String(y.id) === id);
    if (k === 'tx') return custTxForm(b.dataset.tx, b.dataset.h, people, re);
    if (k === 'ced') return ledgerForm(x, 'custody', sugg, re);
    if (k === 'cdl') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('ledger_entries').delete().eq('id', id); return error ? toast(error.message) : re(); }
    if (k === 'cback') { const { error } = await S.sb.from('ledger_entries').update({ status: 'draft' }).eq('id', id); return error ? toast(error.message) : re(); }
    if (k === 'cok') { if (!okX(x)) return toast('حدد المرحلة والنوع الأول من "تعديل"'); const { error } = await S.sb.from('ledger_entries').update({ status: 'approved', review_note: null }).eq('id', id); return error ? toast(error.message) : re(); }
    if (k === 'cno') { const n = await askNote('سبب الرجوع للمهندس', 'مثلاً: الإيصال مش واضح / المرحلة غلط'); if (!n) return; const { error } = await S.sb.from('ledger_entries').update({ status: 'rejected', review_note: n }).eq('id', id); return error ? toast(error.message) : re(); }
    if (k === 'apall') { const L = E.filter(y => y.custody_user === id && y.status === 'submitted'), bad = L.filter(y => !okX(y)).length; if (bad) return toast(`فيه ${bad} مصروف من غير مرحلة أو نوع – كمّلهم الأول`); if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = `متأكد؟ ${L.length} مصروف`; return; } const { error } = await S.sb.from('ledger_entries').update({ status: 'approved', review_note: null }).in('id', L.map(y => y.id)); return error ? toast(error.message) : (toast('اتعتمدت التصفية'), re()); }
    if (k === 'txdl') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('custody_txns').delete().eq('id', id); return error ? toast(error.message) : re(); } };
}
/* ---------------- Treasury: bank & cash accounts ---------------- */
async function cashMoves() {
  await loadAccs(true);
  const [op, ci, tr, le, ct, cu, pp] = await Promise.all([S.sb.from('owner_payments').select('*').eq('status', 'received'), S.sb.from('cash_income').select('*'), S.sb.from('cash_transfers').select('*'), S.sb.from('ledger_entries').select('id,project_id,entry_date,description,category,sub_category,supplier,expense,account_id,phase_n,status,source'), S.sb.from('custody_txns').select('*'), Promise.resolve(null), peopleAll(S.projects.map(p => p.id))]);
  const nm = id => pp.find(p => p.user_id === id)?.name || '—', pn = id => S.projects.find(p => p.id === id)?.name || '', M = [];
  (op.data || []).filter(x => x.account_id).forEach(x => M.push({ acc: x.account_id, date: x.pay_date, inn: +x.amount, out: 0, t: 'وارد مالك', desc: `${pn(x.project_id)} – ${PAYK[x.kind]}${x.notes ? ' · ' + x.notes : ''}`, ref: x.ref, src: { k: 'op', x } }));
  (ci.data || []).forEach(x => M.push({ acc: x.account_id, date: x.txn_date, inn: +x.amount, out: 0, t: 'وارد آخر', desc: [x.source, x.note].filter(Boolean).join(' · '), ref: x.ref, src: { k: 'ci', x } }));
  (tr.data || []).forEach(x => { M.push({ acc: x.from_account, date: x.txn_date, inn: 0, out: +x.amount, t: 'تحويل', desc: 'تحويل إلى ' + accName(x.to_account) + (x.note ? ' · ' + x.note : ''), ref: x.ref, src: { k: 'tr', x } }); M.push({ acc: x.to_account, date: x.txn_date, inn: +x.amount, out: 0, t: 'تحويل', desc: 'تحويل من ' + accName(x.from_account) + (x.note ? ' · ' + x.note : ''), ref: x.ref, src: { k: 'tr', x } }); });
  (le.data || []).filter(x => x.account_id && x.status === 'approved' && +x.expense > 0).forEach(x => M.push({ acc: x.account_id, date: x.entry_date, inn: 0, out: +x.expense, t: x.project_id ? 'مصروف مشروع' : 'مصروف إداري', desc: `${x.project_id ? pn(x.project_id) + (x.phase_n ? ' · م' + x.phase_n : '') : lcat(x.category)} – ${x.description || ''}${x.supplier ? ' · ' + x.supplier : ''}`, src: { k: 'le', x } }));
  (ct.data || []).filter(x => x.account_id).forEach(x => M.push({ acc: x.account_id, date: x.txn_date, inn: x.kind === 'return' ? +x.amount : 0, out: x.kind === 'issue' ? +x.amount : 0, t: 'عهدة', desc: (x.kind === 'issue' ? 'صرف عهدة لـ ' : 'رد عهدة من ') + nm(x.holder) + (x.note ? ' · ' + x.note : ''), src: { k: 'ct', x } }));
  const CT = ct.data || [], LE = le.data || [], H = [...new Set([...CT.map(t => t.holder), ...LE.filter(x => x.source === 'custody').map(x => x.custody_user)])];
  const custBal = CT.reduce((s, t) => s + (t.kind === 'issue' ? 1 : -1) * +t.amount, 0) - LE.filter(x => x.source === 'custody' && x.status === 'approved').reduce((s, x) => s + +x.expense, 0);
  const A = S.accs.map(a => { const L = M.filter(m => m.acc === a.id && (!m.date || m.date >= a.opening_date)).sort((x, y) => (x.date || '0') < (y.date || '0') ? -1 : (x.date || '0') > (y.date || '0') ? 1 : 0); let b = +a.opening_balance; L.forEach(m => { b += m.inn - m.out; m.bal = b; }); return { a, L, bal: b, inn: L.reduce((s, m) => s + m.inn, 0), out: L.reduce((s, m) => s + m.out, 0), before: M.filter(m => m.acc === a.id && m.date && m.date < a.opening_date).length }; });
  return { A, custBal, people: pp, unacc: { op: (op.data || []).filter(x => !x.account_id && x.pay_date >= (S.accs[0]?.opening_date || '9')).length } };
}
async function pickProj(list, title) { return new Promise(res => { const d = document.createElement('dialog'); d.className = 'adlg'; d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${title}</h3><button type="button" class="dx">✕</button></div><div class="acts">${list.map(p => `<button class="p" data-pp="${p.id}">${esc(p.name)}</button>`).join('')}</div>`; document.body.append(d); d.showModal(); d.onclick = e => { const b = e.target.closest('[data-pp]'); if (b || e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); res(b ? b.dataset.pp : null); } }; }); }
function accForm(x, done) { x ||= {}; const d = document.createElement('dialog'); d.className = 'adlg';
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${x.id ? 'تعديل حساب' : '+ حساب بنك / خزينة'}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px"><label class="wide">اسم الحساب<input name="name" required value="${esc(x.name || '')}" placeholder="مثلاً: بنك مصر – جاري"></label>
    <label>النوع<select name="kind"><option value="bank">بنك</option><option value="cash"${x.kind === 'cash' ? ' selected' : ''}>خزينة نقدية</option></select></label><label>البنك<input name="bank" value="${esc(x.bank_name || '')}"></label><label>رقم الحساب<input name="no" value="${esc(x.acc_no || '')}"></label>
    <label>رصيد الافتتاح<input name="ob" type="number" step="any" value="${x.opening_balance ?? 0}"></label><label>بتاريخ<input type="date" name="od" value="${x.opening_date || today()}"></label><label class="chk"><input type="checkbox" name="act"${x.active !== false ? ' checked' : ''}> شغال</label>
    <p class="mut wide" style="font-size:12px;margin:0">الرصيد بيتحسب من رصيد الافتتاح + كل الحركات من التاريخ ده وبعده. الحركات اللي قبله مش بتأثر.</p><div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
  document.body.append(d); d.showModal(); d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, rec = { name: f.name.value.trim(), kind: f.kind.value, bank_name: f.bank.value.trim() || null, acc_no: f.no.value.trim() || null, opening_balance: +f.ob.value || 0, opening_date: f.od.value || today(), active: f.act.checked };
    const { error } = x.id ? await S.sb.from('cash_accounts').update(rec).eq('id', x.id) : await S.sb.from('cash_accounts').insert(rec); if (error) return toast(error.message); d.close(); d.remove(); toast('اتحفظ'); done(); }; }
function cashForm(kind, x, done) { x ||= {}; const d = document.createElement('dialog'), tr = kind === 'tr'; d.className = 'adlg';
  d.innerHTML = `<div class="dh"><h3 style="margin:0;font-size:17px">${tr ? 'تحويل بين الحسابات' : 'وارد آخر للشركة'}</h3><button type="button" class="dx">✕</button></div><form class="grid" style="margin-top:12px">
    ${tr ? `<label>من${accSel('from', x.from_account || '', '— اختار —')}</label><label>إلى${accSel('to', x.to_account || '', '— اختار —')}</label>` : `<label>في حساب${accSel('acc', x.account_id || S.accs.find(a => a.active)?.id, '— اختار —')}</label><label>المصدر<input name="src" value="${esc(x.source || '')}" placeholder="مثلاً: تمويل من الشركاء، إيجار، فوائد"></label>`}
    <label>المبلغ<input name="a" type="number" step="any" required value="${x.amount ?? ''}"></label><label>التاريخ<input type="date" name="d" value="${x.txn_date || today()}"></label><label>المرجع<input name="ref" value="${esc(x.ref || '')}"></label><label class="wide">ملاحظة<input name="n" value="${esc(x.note || '')}"></label><div class="acts wide" style="margin:0"><button class="p">حفظ</button></div></form>`;
  document.body.append(d); d.showModal(); d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target, base = { amount: +f.a.value, txn_date: f.d.value, ref: f.ref.value.trim() || null, note: f.n.value.trim() || null };
    if (tr && (!f.from.value || !f.to.value || f.from.value === f.to.value)) return toast('اختار حسابين مختلفين'); if (!tr && !f.acc.value) return toast('اختار الحساب');
    const t = tr ? 'cash_transfers' : 'cash_income', rec = tr ? { ...base, from_account: f.from.value, to_account: f.to.value } : { ...base, account_id: f.acc.value, source: f.src.value.trim() || null };
    const { error } = x.id ? await S.sb.from(t).update(rec).eq('id', x.id) : await S.sb.from(t).insert(rec); if (error) return toast(error.message); d.close(); d.remove(); toast('اتسجل'); done(); }; }
async function renderBank() {
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>'; const V = (S.bk ||= { acc: null, lim: 200 });
  const C = await cashMoves(), A = C.A, tot = A.filter(x => x.a.active).reduce((s, x) => s + x.bal, 0), cur = A.find(x => x.a.id === V.acc) || A[0]; if (cur) V.acc = cur.a.id;
  const re = () => renderBank(), LP = S.projects.filter(p => can('ledgerEd', p.id));
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">البنك والخزينة</h2><p class="mut" style="margin:2px 0 0;font-size:13px">كل التمويل بيدخل هنا، ومنه بيتصرف على المشروعات (بمراحلها وبنودها) أو مصروفات إدارية، أو بيتحول عهد للمهندسين.</p></div><div class="acts" style="margin:0"><button class="p" data-bk="op">+ وارد من مالك</button><button data-bk="ci">+ وارد آخر</button><button class="p" data-bk="pj">+ مصروف على مشروع</button><button data-bk="ga">+ مصروف إداري</button><button data-bk="tr">⇄ تحويل</button><button data-bk="ct">+ صرف عهدة</button><button data-bk="acc">⚙ حساب جديد</button></div></div>
  <div class="kpis"><div class="kpi${tot < 0 ? ' k-bad' : ' k-ok'}"><b>${money(tot)}</b><span>رصيد البنوك والخزينة</span></div><div class="kpi"><b>${money(C.custBal)}</b><span>أرصدة العهد مع المهندسين</span></div><div class="kpi"><b>${money(tot + C.custBal)}</b><span>إجمالي النقدية<br><small>حسابات + عهد</small></span></div></div>
  <div class="acgrid">${A.map(x => `<button type="button" class="accard${x === cur ? ' on' : ''}${x.a.active ? '' : ' dim'}" data-acc="${x.a.id}"><i>${x.a.kind === 'cash' ? '💵' : '🏦'}</i><b>${esc(x.a.name)}</b><span class="${x.bal < 0 ? 'bad' : ''}">${nf(x.bal, 0)} ج.م</span><small>افتتاح ${nf(x.a.opening_balance, 0)} في ${fmtD(x.a.opening_date)}</small></button>`).join('')}</div>
  ${cur ? `<div class="secT">كشف حساب: ${esc(cur.a.name)} <button class="xs" data-acced="${cur.a.id}">تعديل الحساب</button></div>
  ${+cur.a.opening_balance === 0 && !cur.L.length ? '<div class="note">ابدأ بتعديل الحساب: اكتب رصيده الفعلي النهارده كرصيد افتتاح، وكل حركة بعد كده هتتحسب عليه.</div>' : ''}
  <div class="kpis"><div class="kpi k-ok"><b>${money(cur.inn)}</b><span>وارد</span></div><div class="kpi"><b>${money(cur.out)}</b><span>منصرف</span></div><div class="kpi"><b>${money(cur.bal)}</b><span>الرصيد</span></div></div>
  <div class="card" style="padding:0"><div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th class="n">وارد</th><th class="n">منصرف</th><th class="n">الرصيد</th><th></th></tr></thead><tbody>
  ${cur.L.slice().reverse().slice(0, V.lim).map((m, k) => `<tr><td data-l="التاريخ">${m.date ? fmtD(m.date) : '–'}</td><td data-l="النوع"><span class="tag">${m.t}</span></td><td data-l="البيان">${esc(m.desc)}${m.ref ? `<div class="mut" style="font-size:11px">${esc(m.ref)}</div>` : ''}</td><td class="n ok" data-l="وارد">${m.inn ? nf(m.inn, 0) : ''}</td><td class="n" data-l="منصرف">${m.out ? nf(m.out, 0) : ''}</td><td class="n${m.bal < 0 ? ' bad' : ''}" data-l="الرصيد"><b>${nf(m.bal, 0)}</b></td><td class="qa">${['ci', 'tr'].includes(m.src.k) ? `<button class="xs" data-mved="${cur.L.length - 1 - k}">تعديل</button><button class="xs danger" data-mvdl="${cur.L.length - 1 - k}">حذف</button>` : ''}</td></tr>`).join('')}
  <tr class="tot"><td>${fmtD(cur.a.opening_date)}</td><td></td><td>رصيد افتتاح</td><td></td><td></td><td class="n">${nf(cur.a.opening_balance, 0)}</td><td></td></tr></tbody></table></div></div>
  ${cur.L.length > V.lim ? `<div class="acts"><button id="bkMore">عرض المزيد</button></div>` : ''}
  <p class="mut" style="font-size:12px">الوارد من المالك بيتسجل على الحساب من خانة "اتحط في حساب" في فورم الدفعة، والمصروف من خانة "اتدفع من" في القيد. القيود القديمة اللي مش متحدد ليها حساب مش داخلة في الكشف.</p>` : '<div class="note">ضيف أول حساب بنك أو خزينة.</div>'}`;
  const withP = async (pid, fn) => { const old = S.P; S.P = await liteP(pid); try { await fn(); } finally { S.P = old; } };
  $('#bkMore') && ($('#bkMore').onclick = () => { V.lim += 300; re(); });
  $('#main').onclick = async e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.acc) { V.acc = b.dataset.acc; V.lim = 200; return re(); }
    if (b.dataset.acced) return accForm(S.accs.find(a => a.id === b.dataset.acced), re);
    const mv = b.dataset.mved ?? b.dataset.mvdl; if (mv != null) { const m = cur.L[+mv], t = m.src.k === 'tr' ? 'cash_transfers' : 'cash_income'; if (b.dataset.mved != null) return cashForm(m.src.k, m.src.x, re); if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from(t).delete().eq('id', m.src.x.id); return error ? toast(error.message) : re(); }
    const k = b.dataset.bk; if (!k) return;
    if (k === 'acc') return accForm(null, re); if (k === 'tr' || k === 'ci') return cashForm(k, null, re);
    if (k === 'ct') return custTxForm('issue', null, C.people, re);
    if (k === 'ga') return ledgerForm(null, 'acct', { sub: {}, sc: [], sup: [], inv: [] }, re, { ga: true, acc: cur?.a.id });
    const pid = LP.length === 1 ? LP[0].id : await pickProj(LP, k === 'op' ? 'وارد من مالك أنهي مشروع؟' : 'مصروف على أنهي مشروع؟'); if (!pid) return;
    if (k === 'op') return withP(pid, () => payForm('invoice', {}, null, re, { acc: cur?.a.id }));
    if (k === 'pj') { const P = await liteP(pid); return ledgerForm(null, 'acct', await ledgerSugg(pid), re, { P, acc: cur?.a.id, pick: true }); } };
}
/* ---------------- G&A (company overheads) ---------------- */
async function renderGA() {
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>'; await loadAccs(); const F = (S.ga ||= { cat: '', mon: '', q: '' });
  const { data, error } = await S.sb.from('ledger_entries').select('*').is('project_id', null).gt('expense', 0).neq('status', 'draft').order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(3000);
  if (error) return $('#main').innerHTML = `<div class="note">${esc(error.message)}</div>`;
  const pp = await peopleAll(S.projects.map(p => p.id)), nm = id => pp.find(p => p.user_id === id)?.name || '';
  const ALL = data || [], qq = normAr(F.q), R = ALL.filter(r => (!F.cat || r.category === F.cat) && (!F.mon || (r.entry_date || '').startsWith(F.mon)) && (!qq || normAr([r.description, r.supplier, r.sub_category].join(' ')).includes(qq)));
  const ok = R.filter(r => r.status === 'approved'), tot = ok.reduce((s, r) => s + +r.expense, 0), byCat = {}; ok.forEach(r => byCat[r.category || '—'] = (byCat[r.category || '—'] || 0) + +r.expense);
  const mons = [...new Set(ALL.map(r => (r.entry_date || '').slice(0, 7)).filter(Boolean))].sort().reverse(), re = () => renderGA();
  const sugg = { sub: {}, sc: [...new Set(ALL.map(r => r.sub_category).filter(Boolean))], sup: [...new Set(ALL.map(r => r.supplier).filter(Boolean))], inv: [] };
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">المصروفات الإدارية والعمومية</h2><p class="mut" style="margin:2px 0 0;font-size:13px">مصروفات الشركة اللي مش على مشروع: مرتبات، إيجارات، مكافآت، نثريات، انتقالات، سكن… سواء اتدفعت من البنك أو الخزينة أو من عهدة مهندس.</p></div><div class="acts" style="margin:0"><button class="p" id="gaNew">+ مصروف إداري</button></div></div>
  <div class="kpis"><div class="kpi"><b>${money(tot)}</b><span>إجمالي المعتمد بالفلتر<br><small>${ok.length} قيد</small></span></div>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `<div class="kpi"><b>${money(v)}</b><span>${esc(lcat(c))}</span></div>`).join('')}</div>
  <div class="filters" style="margin-top:12px"><select id="gCat"><option value="">كل الأنواع</option>${GACAT.map(c => `<option value="${c}"${c === F.cat ? ' selected' : ''}>${lcat(c)}</option>`).join('')}</select><select id="gMon"><option value="">كل الشهور</option>${mons.map(m => `<option${m === F.mon ? ' selected' : ''}>${m}</option>`).join('')}</select><input id="gQ" type="search" placeholder="بحث" value="${esc(F.q)}"></div>
  <div class="card" style="padding:0;margin-top:10px"><div class="scroll"><table class="stack"><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>المستفيد</th><th class="n">القيمة</th><th>اتدفع من</th><th></th></tr></thead><tbody>
  ${R.slice(0, 500).map(r => `<tr class="${r.status !== 'approved' ? 'dim' : ''}"><td data-l="التاريخ">${fmtD(r.entry_date)}</td><td data-l="النوع">${esc(lcat(r.category))}${r.sub_category ? `<div class="mut" style="font-size:12px">${esc(r.sub_category)}</div>` : ''}</td><td data-l="البيان">${esc(r.description || '')}</td><td data-l="المستفيد">${esc(r.supplier || '–')}</td><td class="n" data-l="القيمة"><b>${nf(r.expense, 0)}</b></td><td data-l="اتدفع من"><span class="mut" style="font-size:12px">${r.source === 'custody' ? 'عهدة – ' + esc(nm(r.custody_user)) : esc(accName(r.account_id) || r.pay_method || '–')}</span>${r.status !== 'approved' ? ` <span class="st ${LEST[r.status][0]}">${LEST[r.status][1]}</span>` : ''}</td><td class="qa">${r.source === 'manual' ? `<button data-ged="${r.id}">تعديل</button><button class="danger" data-gdl="${r.id}">حذف</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">مفيش مصروفات إدارية متسجلة.</td></tr>'}</tbody></table></div></div>`;
  [['gCat', 'cat'], ['gMon', 'mon']].forEach(([id, k]) => $('#' + id).onchange = e => { F[k] = e.target.value; re(); }); $('#gQ').onchange = e => { F.q = e.target.value.trim(); re(); };
  $('#gaNew').onclick = () => ledgerForm(null, 'acct', sugg, re, { ga: true });
  $('#main').onclick = async e => { const a = e.target.closest('[data-ged]'); if (a) return ledgerForm(R.find(r => String(r.id) === a.dataset.ged), 'acct', sugg, re, { ga: true });
    const b = e.target.closest('[data-gdl]'); if (b) { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('ledger_entries').delete().eq('id', b.dataset.gdl); return error ? toast(error.message) : re(); } };
}

async function renderInv() {
  const P = S.P, ed = can('invEdit', P.id), V = S.iv ||= { id: null };
  if (V.pid !== P.id) { V.pid = P.id; V.id = null; }
  if (V.id) return renderInvOne();
  $('#main').innerHTML = '<p class="mut">جاري التحميل…</p>';
  const { data, error } = await S.sb.from('owner_invoices').select('*').eq('project_id', P.id).order('no');
  if (error) return $('#main').innerHTML = `<div class="note">${esc(error.message)}</div>`;
  const I = data || [], last = I[I.length - 1], tot = I.reduce((a, i) => { Object.keys(ICAT).forEach(k => a[k] += +i['amt_' + k]); return a; }, { design: 0, contract: 0, supply: 0, extra: 0 }), all = Object.values(tot).reduce((a, b) => a + b, 0);
  const paidNet = I.filter(i => i.status !== 'draft').reduce((s, i) => s + invPay(i).net, 0);
  $('#main').innerHTML = `<div class="sthead"><div><h2 style="margin:0">مستخلصات المالك</h2><p class="mut" style="margin:2px 0 0;font-size:13px">بنظام التكلفة + أتعاب الشركة. كل مستخلص بيكمّل كميات اللي قبله تلقائياً.</p></div>${ed ? '<button id="ivNew" class="p">+ مستخلص جديد</button>' : ''}</div>
  <div class="kpis"><div class="kpi"><b>${I.length}</b><span>مستخلص</span></div><div class="kpi"><b>${nf(all / 1e6, 2)}<small> م</small></b><span>إجمالي الأعمال</span></div><div class="kpi k-ok"><b>${nf(paidNet / 1e6, 2)}<small> م</small></b><span>إجمالي المستحق صرفه</span></div><div class="kpi"><b>${last ? nf(invPay(last).net, 0) : '–'}</b><span>صافي آخر مستخلص${last ? ' (' + last.no + ')' : ''}</span></div></div>
  ${I.length ? `<div class="card" style="padding:0"><div class="scroll"><table class="ivsum"><thead><tr><th>البند</th>${I.map(i => `<th class="n"><a href="#" data-iv="${i.id}">مستخلص ${i.no}</a></th>`).join('')}<th class="n">الإجمالي</th></tr></thead><tbody>
    ${Object.entries(ICAT).map(([k, l]) => `<tr><td>${l}</td>${I.map(i => `<td class="n">${nf(i['amt_' + k], 0)}</td>`).join('')}<td class="n"><b>${nf(tot[k], 0)}</b></td></tr>`).join('')}
    <tr class="tot"><td>إجمالي الأعمال</td>${I.map(i => `<td class="n">${nf(invSum(i), 0)}</td>`).join('')}<td class="n">${nf(all, 0)}</td></tr>
    <tr><td class="mut">المستحق صرفه</td>${I.map(i => `<td class="n mut">${nf(invPay(i).net, 0)}</td>`).join('')}<td class="n mut">${nf(paidNet, 0)}</td></tr></tbody></table></div></div>` : '<div class="note">لسه مفيش مستخلصات للمشروع ده.</div>'}
  <div class="ivlist">${[...I].reverse().map(i => { const p = invPay(i); return `<a href="#" class="ivcard" data-iv="${i.id}"><div class="ivno">${i.no}</div><div style="flex:1;min-width:0"><b>${esc(i.title || 'مستخلص جاري ' + i.no)}</b> <span class="st ${IST[i.status][0]}">${IST[i.status][1]}</span><div class="mut" style="font-size:12px">${i.inv_date ? fmtD(i.inv_date) : 'بدون تاريخ'}${i.legacy ? ' · مستخلص سابق (إجماليات بس)' : ''}</div></div><div style="text-align:left"><div class="mut" style="font-size:11px">الأعمال ${nf(p.works, 0)}</div><b>${nf(p.net, 0)}</b><div class="mut" style="font-size:11px">مستحق صرفه</div></div></a>`; }).join('')}</div>`;
  $('#main').onclick = e => { const a = e.target.closest('[data-iv]'); if (!a) return; e.preventDefault(); V.id = a.dataset.iv; V.tab = 'summary'; V.edit = false; renderInv(); };
  $('#ivNew') && ($('#ivNew').onclick = async () => {
    const no = (last?.no || 0) + 1; $('#ivNew').disabled = true;
    const { data: nw, error } = await S.sb.from('owner_invoices').insert({ project_id: P.id, no, title: 'مستخلص جاري ' + no, inv_date: today(), period_from: last?.period_to || last?.inv_date || null, period_to: today(), pay_pct: last?.pay_pct ?? 0.5, fee_pct: last?.fee_pct ?? 0.15, status: 'draft' }).select().single();
    if (error) { $('#ivNew').disabled = false; return toast(error.message); }
    if (last) { const { data: LL } = await S.sb.from('owner_invoice_lines').select('*').eq('invoice_id', last.id).order('sort');
      const rows = (LL || []).filter(l => ICUM(l.cat)).map(l => ({ invoice_id: nw.id, cat: l.cat, kind: l.kind, name: l.name, description: l.description, unit: l.unit, rate: l.rate, prev_qty: +l.prev_qty + +l.cur_qty, cur_qty: 0, pct: l.pct, prev_value: lnVal(l), notes: null, item_id: l.item_id, phase_n: l.phase_n, line_key: l.line_key, sort: l.sort }));
      for (let k = 0; k < rows.length; k += 300) { const { error: e2 } = await S.sb.from('owner_invoice_lines').insert(rows.slice(k, k + 300)); if (e2) toast(e2.message); }
      toast(rows.length ? `اتعمل مستخلص ${no} واتنقلت ${rows.filter(r => r.kind === 'line').length} بند من مستخلص ${last.no}` : `اتعمل مستخلص ${no}`); }
    V.id = nw.id; V.tab = 'contract'; V.edit = true; renderInv(); });
}

/* invoice: pick lines from BOQ items by phase */
function invPick(cat, L, done) {
  const P = S.P, used = new Set(L.filter(l => l.cat === cat && l.item_id).map(l => l.item_id)), cum = ICUM(cat), F = (S.ivPick ||= { ph: '', q: '' });
  const d = document.createElement('dialog'); d.className = 'adlg wide';
  const list = () => { const ph = +F.ph || null, q = normAr(F.q); const R = P.items.filter(i => (!ph || i.phase_n === ph) && (!q || normAr(i.code + ' ' + i.name + ' ' + (i.building || '')).includes(q)));
    return R.length ? `<div class="pklist">${R.map(i => `<label class="pkrow${used.has(i.id) ? ' used' : ''}"><input type="checkbox" value="${esc(i.id)}"${used.has(i.id) ? ' disabled' : ''}><span class="pkc">${esc(i.code)}</span><span class="pkn">${esc(i.name.length > 110 ? i.name.slice(0, 110) + '…' : i.name)}${i.building ? ` <small class="mut">– ${esc(i.building)}</small>` : ''}${used.has(i.id) ? ' <small class="mut">(موجود في المستخلص)</small>' : ''}</span><span class="pkq">${+i.qty ? nf(i.qty) + ' ' + esc(i.unit || '') : esc(i.unit || 'مقطوعية')}${i.ex > 0 ? `<br><small>منفذ ${nf(i.ex)}</small>` : ''}</span><span class="pkr">${i.rate > 0 ? nf(i.rate, 0) : '<small class="mut">مش متسعّر</small>'}</span></label>`).join('')}</div>` : '<p class="mut">مفيش بنود.</p>'; };
  d.innerHTML = `<div class="dh"><div><h3 style="margin:0;font-size:17px">إضافة بنود من المقايسة – ${ICAT[cat]}</h3><div class="mut" style="font-size:13px">اختار المرحلة وعلّم على البنود. الاسم والوحدة والسعر هيتنقلوا من المقايسة${cum ? '، والكمية الحالية = المنفذ من التقارير المعتمدة' : ''}، وتقدر تعدّلهم بعد الإضافة.</div></div><button type="button" class="dx">✕</button></div>
    <div class="filters" style="margin:12px 0 8px"><select id="pkPh"><option value="">كل المراحل</option>${P.phaseProg.map(x => `<option value="${x.n}"${String(x.n) === F.ph ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select><input id="pkQ" type="search" placeholder="بحث بالكود أو الاسم" value="${esc(F.q)}"><label class="chk"><input type="checkbox" id="pkAll"> تحديد الكل</label></div>
    <div id="pkBox">${list()}</div><div class="acts"><button class="p" id="pkGo">إضافة البنود المختارة</button><span class="mut" id="pkN"></span></div>`;
  document.body.append(d); d.showModal();
  const cnt = () => { const n = d.querySelectorAll('#pkBox input:checked').length; d.querySelector('#pkN').textContent = n ? `${n} بند مختار` : ''; };
  const redraw = () => { d.querySelector('#pkBox').innerHTML = list(); d.querySelector('#pkAll').checked = false; cnt(); };
  d.querySelector('#pkPh').onchange = e => { F.ph = e.target.value; redraw(); }; d.querySelector('#pkQ').oninput = e => { F.q = e.target.value; redraw(); };
  d.querySelector('#pkAll').onchange = e => { d.querySelectorAll('#pkBox input:not(:disabled)').forEach(c => c.checked = e.target.checked); cnt(); }; d.querySelector('#pkBox').onchange = cnt;
  d.onclick = e => { if (e.target === d || e.target.closest('.dx')) { d.close(); d.remove(); } };
  d.querySelector('#pkGo').onclick = () => { const ids = [...d.querySelectorAll('#pkBox input:checked')].map(c => c.value); if (!ids.length) return toast('علّم على بند واحد على الأقل');
    let mx = Math.max(0, ...L.filter(l => l.cat === cat).map(l => +l.sort || 0)); const byPh = {}; ids.map(id => P.items.find(i => i.id === id)).forEach(i => (byPh[i.phase_n] ||= []).push(i));
    Object.keys(byPh).sort((a, b) => a - b).forEach(n => { n = +n; const has = L.some(l => l.cat === cat && +l.phase_n === n);
      if (!has) L.push({ cat, kind: 'head1', name: `${n}. ${P.phaseProg.find(x => x.n === n)?.name || 'المرحلة ' + n}`, unit: '', rate: 0, prev_qty: 0, cur_qty: 0, pct: 1, prev_value: 0, phase_n: n, sort: mx += 10, _new: true });
      byPh[n].forEach(i => L.push({ cat, kind: 'line', name: i.name, unit: i.unit || 'مقطوعية', rate: i.rate > 0 ? Math.round(i.rate * 100) / 100 : 0, prev_qty: 0, cur_qty: cum ? Math.max(+i.ex || 0, 0) : (+i.qty || 1), pct: 1, prev_value: 0, item_id: i.id, phase_n: n, notes: null, sort: mx += 10, _new: true })); });
    d.close(); d.remove(); toast(`اتضاف ${ids.length} بند – راجع الفئة والكميات واحفظ`); done(); };
}
/* invoice: split by phase (this invoice + cumulative to date) */
async function invPhases(inv, L, useLines, amt) {
  const P = S.P, box = $('#ivBody'); const cats = Object.keys(ICAT);
  const { data: prevInv } = await S.sb.from('owner_invoices').select('*').eq('project_id', P.id).lt('no', inv.no).order('no');
  const ids = (prevInv || []).map(i => i.id); let PL = [];
  if (ids.length) { const { data } = await S.sb.from('owner_invoice_lines').select('invoice_id,cat,kind,rate,prev_qty,cur_qty,pct,prev_value,phase_n').in('invoice_id', ids); PL = data || []; }
  const M = {}, add = (n, k, cur, cum) => { const r = (M[n ?? 0] ||= { n: n ?? 0, cur: {}, cum: {} }); r.cur[k] = (r.cur[k] || 0) + cur; r.cum[k] = (r.cum[k] || 0) + cum; };
  if (useLines) L.filter(l => l.kind === 'line').forEach(l => add(l.phase_n, l.cat, lnCur(l), ICUM(l.cat) ? lnVal(l) : lnCur(l)));
  else cats.forEach(k => add(null, k, amt(k), 0));
  PL.filter(l => l.kind === 'line' && !ICUM(l.cat)).forEach(l => add(l.phase_n, l.cat, 0, lnCur(l)));
  (prevInv || []).filter(i => !PL.some(l => l.invoice_id === i.id)).forEach(i => cats.forEach(k => { if (!ICUM(k) || !useLines) add(null, k, 0, +i['amt_' + k]); }));
  const rows = Object.values(M).sort((a, b) => (a.n || 99) - (b.n || 99)), t = (r, w) => cats.reduce((s, k) => s + (r[w][k] || 0), 0), T = (w, k) => rows.reduce((s, r) => s + (k ? r[w][k] || 0 : t(r, w)), 0);
  const nm = n => n ? `${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')}` : '<span class="mut">غير موزّع على مرحلة</span>';
  box.innerHTML = `<div class="card" style="padding:0"><div class="scroll"><table class="stack ivph"><thead><tr><th rowspan="2">المرحلة</th><th colspan="${cats.length + 1}" class="c">المستخلص الحالي</th><th class="c" rowspan="2">التراكمي حتى المستخلص ده</th></tr><tr>${cats.map(k => `<th class="n">${ICAT[k]}</th>`).join('')}<th class="n">الإجمالي</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td data-l="المرحلة">${nm(r.n)}</td>${cats.map(k => `<td class="n" data-l="${ICAT[k]}">${r.cur[k] ? nf(r.cur[k], 0) : '–'}</td>`).join('')}<td class="n" data-l="الإجمالي"><b>${nf(t(r, 'cur'), 0)}</b></td><td class="n" data-l="التراكمي">${nf(t(r, 'cum'), 0)}</td></tr>`).join('')}
    <tr class="tot"><td>الإجمالي</td>${cats.map(k => `<td class="n" data-l="${ICAT[k]}">${nf(T('cur', k), 0)}</td>`).join('')}<td class="n" data-l="الإجمالي">${nf(T('cur'), 0)}</td><td class="n" data-l="التراكمي">${nf(T('cum'), 0)}</td></tr></tbody></table></div></div>
    ${rows.some(r => !r.n) ? '<p class="mut" style="font-size:12px">"غير موزّع" = بنود من غير مرحلة، أو مستخلصات سابقة متسجلة بالإجماليات بس. حدد المرحلة لكل بند من "تعديل" عشان التقسيم يكمل.</p>' : ''}`;
}
async function renderInvOne() {
  const P = S.P, V = S.iv, ed = can('invEdit', P.id);
  const [{ data: inv, error }, { data: LL }] = await Promise.all([S.sb.from('owner_invoices').select('*').eq('id', V.id).single(), S.sb.from('owner_invoice_lines').select('*').eq('invoice_id', V.id).order('sort').order('id')]);
  if (error) { V.id = null; return toast(error.message); }
  const lock = inv.status !== 'draft', canEd = ed && !lock;
  if (!V.L || V.loaded !== V.id) { V.L = (LL || []).map(l => ({ ...l })); V.loaded = V.id; V.del = []; }
  const L = V.L, T = invTot(L), useLines = L.length > 0 || !inv.legacy;
  const amt = k => useLines ? T[k] : +inv['amt_' + k], works = Object.keys(ICAT).reduce((s, k) => s + amt(k), 0), pay = works * +inv.pay_pct, fee = works * +inv.fee_pct;
  const E = V.edit && canEd, inp = (l, f, w = 90, ty = 'number') => E ? `<input data-l="${l._i}" data-f="${f}" type="${ty}" step="any" value="${esc(l[f] ?? '')}" style="width:${w}px">` : '';
  L.forEach((l, k) => l._i = k);
  const catTable = c => { const R = L.filter(l => l.cat === c), cum = ICUM(c);
    const row = l => l.kind !== 'line' ? `<tr class="${l.kind}"><td colspan="${cum ? 10 : 8}">${E ? `<input data-l="${l._i}" data-f="name" value="${esc(l.name)}" style="width:70%;font-weight:700"> <button type="button" class="danger xs" data-ldel="${l._i}">✕</button>` : esc(l.name)}</td></tr>`
      : `<tr><td>${E ? `<textarea data-l="${l._i}" data-f="name" rows="1" style="width:100%;min-width:220px">${esc(l.name)}</textarea>` : esc(l.name)}${!E && l.item_id ? ` <span class="tag">${esc(P.items.find(i => i.id === l.item_id)?.code || '')}</span>` : ''}${!E && l.phase_n ? ` <span class="tag ph">م${l.phase_n}</span>` : ''}${E ? `<div class="lnmeta"><select data-l="${l._i}" data-f="phase_n" class="psel${l.phase_n ? '' : ' miss'}" title="المرحلة"><option value="">— المرحلة —</option>${P.phaseProg.map(x => `<option value="${x.n}"${x.n === +l.phase_n ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('')}</select><select data-l="${l._i}" data-f="item_id" class="isel"><option value="">— ربط ببند مقايسة —</option>${P.items.filter(i => !l.phase_n || i.phase_n === +l.phase_n || i.id === l.item_id).map(i => `<option value="${esc(i.id)}"${i.id === l.item_id ? ' selected' : ''}>${esc(i.code + ' ' + i.name.slice(0, 50))}</option>`).join('')}</select></div>` : ''}</td>
        <td>${E ? inp(l, 'unit', 60, 'text') : esc(l.unit || '')}</td><td class="n">${E ? inp(l, 'rate', 95) : nf(l.rate)}</td>
        ${cum ? `<td class="n">${E ? inp(l, 'prev_qty', 80) : nf(l.prev_qty)}</td>` : ''}<td class="n cur">${E ? inp(l, 'cur_qty', 80) : (+l.cur_qty ? nf(l.cur_qty) : '–')}</td>${cum ? `<td class="n">${nf(+l.prev_qty + +l.cur_qty)}</td>` : ''}
        <td class="n">${E ? `<input data-l="${l._i}" data-f="pct" type="number" step="any" value="${Math.round(l.pct * 1000) / 10}" style="width:62px">%` : Math.round(l.pct * 100) + '%'}</td><td class="n" id="lv${l._i}"><b>${nf(lnVal(l), 0)}</b>${cum && Math.abs(lnCur(l)) > 0.5 ? `<div class="cur" style="font-size:11px">الحالي ${nf(lnCur(l), 0)}</div>` : ''}</td>
        <td>${E ? inp(l, 'notes', 130, 'text') : esc(l.notes || '')}</td>${E ? `<td><button type="button" class="danger xs" data-ldel="${l._i}">✕</button></td>` : ''}</tr>`;
    return `<div class="scroll"><table class="ivt"><thead><tr><th>البند</th><th>الوحدة</th><th class="n">الفئة</th>${cum ? '<th class="n">السابق</th>' : ''}<th class="n">الحالي</th>${cum ? '<th class="n">إجمالي الكميات</th>' : ''}<th class="n">${cum ? 'نسبة الإنجاز' : 'نسبة الصرف'}</th><th class="n">قيمة الصرف</th><th>ملاحظات</th>${E ? '<th></th>' : ''}</tr></thead><tbody>${R.map(row).join('') || `<tr><td colspan="10" class="mut">مفيش بنود.</td></tr>`}</tbody></table></div>
      <div class="ivfoot">${cum ? `<span>الإجمالي التراكمي <b>${nf(c === 'contract' ? T.cumContract : T.cumDesign, 0)}</b></span><span>السابق <b>${nf(c === 'contract' ? T.prevContract : T.prevDesign, 0)}</b></span>` : ''}<span class="cur">الحالي <b id="ivCurT">${nf(T[c], 0)}</b></span></div>
      ${E ? `<div class="acts"><button type="button" class="p" data-pick="${c}">+ بنود من المقايسة</button><button type="button" data-add="line|${c}">+ بند يدوي</button><button type="button" data-add="head1|${c}">+ عنوان رئيسي</button><button type="button" data-add="head2|${c}">+ عنوان فرعي</button>${c === 'contract' ? '<button type="button" id="ivPull">⬇ الكميات الحالية من التقارير المعتمدة</button><button type="button" id="ivSubs">⬇ من مستخلصات المقاولين</button>' : ''}${c === 'supply' || c === 'extra' ? '<button type="button" id="ivLedger">⬇ من قيود الحسابات</button>' : ''}</div>` : ''}`; };
  const summary = `<div class="ivpay card"><table><tbody>${Object.entries(ICAT).map(([k, l]) => `<tr><td>${l}</td><td class="n">${nf(amt(k), 0)}</td></tr>`).join('')}<tr class="tot"><td>إجمالي الأعمال عن ${esc(inv.title || '')}</td><td class="n">${nf(works, 0)}</td></tr>
    <tr><td>نسبة الصرف من الأعمال ${E ? `<input id="ivPay" type="number" step="any" value="${Math.round(inv.pay_pct * 100)}" style="width:70px">%` : `<b>${Math.round(inv.pay_pct * 100)}%</b>`} <span class="mut" style="font-size:12px">(الباقي مخصوم من الدفعة المقدمة)</span></td><td class="n">${nf(pay, 0)}</td></tr>
    <tr><td>نسبة الشركة ${E ? `<input id="ivFee" type="number" step="any" value="${Math.round(inv.fee_pct * 1000) / 10}" style="width:70px">%` : `<b>${Math.round(inv.fee_pct * 1000) / 10}%</b>`} من الأعمال – تُصرف 100%</td><td class="n">${nf(fee, 0)}</td></tr>
    <tr class="net"><td>المستحق صرفه</td><td class="n">${nf(pay + fee, 0)}</td></tr></tbody></table>
    ${inv.legacy && !L.length ? `<p class="mut" style="margin:8px 0 0;font-size:13px">ده مستخلص سابق متسجل بالإجماليات بس. عشان المستخلص الجاي يكمّل الكميات تلقائياً لازم بنوده التفصيلية تتسجل، ممكن ترفع إكسل المستخلص.</p>` : ''}</div>`;
  const tabs = [['summary', 'الملخص'], ['phases', 'حسب المراحل'], ...Object.entries(ICAT).map(([k, l]) => [k, `${l} <small>(${nf(amt(k) / 1000, 0)} ألف)</small>`])];
  $('#main').innerHTML = `<div class="sthead"><div><a href="#" id="ivBack" class="mut" style="font-size:13px">← كل المستخلصات</a><h2 style="margin:2px 0">${E ? `<input id="ivTitle" value="${esc(inv.title || '')}" style="font-size:20px;font-weight:700;max-width:320px">` : esc(inv.title || 'مستخلص ' + inv.no)} <span class="st ${IST[inv.status][0]}">${IST[inv.status][1]}</span></h2>
    <div class="mut" style="font-size:13px">${E ? `التاريخ <input id="ivDate" type="date" value="${inv.inv_date || ''}" style="width:auto"> · الفترة من <input id="ivFrom" type="date" value="${inv.period_from || ''}" style="width:auto"> لـ <input id="ivTo" type="date" value="${inv.period_to || ''}" style="width:auto">` : `${inv.inv_date ? fmtD(inv.inv_date) : ''}${inv.period_from ? ' · الفترة ' + fmtD(inv.period_from) + ' – ' + fmtD(inv.period_to) : ''}`}</div></div>
    <div class="acts" style="margin:0">${canEd && !V.edit ? '<button id="ivEd" class="p">تعديل</button>' : ''}${E ? '<button id="ivSave" class="p">حفظ</button><button id="ivCancel">إلغاء</button>' : ''}${!E ? '<button id="ivPrint">🖨 طباعة / PDF</button><button id="ivXls">⬇ Excel</button>' : ''}${ed && !E ? `<select id="ivSt" style="width:auto">${Object.entries(IST).map(([k, [, l]]) => `<option value="${k}"${k === inv.status ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}${E ? '<label class="btn" style="margin:0">⬆ استيراد إكسل<input id="ivImp" type="file" accept=".xlsx,.xls" hidden></label>' : ''}</div></div>
  ${lock && ed ? '<div class="note" style="margin-top:8px">المستخلص اتقدّم – عشان تعدّل فيه رجّع حالته لـ"مسودة".</div>' : ''}
  <div class="sttabs"><div class="seg">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${V.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <div style="margin-top:12px" id="ivBody">${V.tab === 'summary' ? summary : V.tab === 'phases' ? '<p class="mut">جاري الحساب…</p>' : catTable(V.tab)}</div>`;
  if (V.tab === 'phases') invPhases(inv, L, useLines, amt);
  const keep = () => { document.querySelectorAll('[data-l][data-f]').forEach(x => { const l = L[+x.dataset.l]; if (!l) return; const f = x.dataset.f; l[f] = ['rate', 'prev_qty', 'cur_qty'].includes(f) ? (x.value === '' ? 0 : +x.value) : f === 'pct' ? (x.value === '' ? 1 : +x.value / 100) : f === 'item_id' ? x.value || null : f === 'phase_n' ? (x.value === '' ? null : +x.value) : x.value; }); };
  const meta = () => { const g = id => $('#' + id)?.value; const m = {}; if ($('#ivTitle')) m.title = g('ivTitle'); if ($('#ivDate')) { m.inv_date = g('ivDate') || null; m.period_from = g('ivFrom') || null; m.period_to = g('ivTo') || null; } if ($('#ivPay')) m.pay_pct = (+g('ivPay') || 0) / 100; if ($('#ivFee')) m.fee_pct = (+g('ivFee') || 0) / 100; return m; };
  if (E) { V.meta = { ...(V.meta || {}), ...{} }; }
  const re = () => { keep(); Object.assign(inv, meta()); V.metaPend = { ...(V.metaPend || {}), ...meta() }; renderInvOne(); };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { if (E) keep(); V.metaPend = { ...(V.metaPend || {}), ...meta() }; V.tab = b.dataset.tab; renderInvOne(); });
  $('#ivBack').onclick = e => { e.preventDefault(); if (E && !confirm('في تعديلات مش محفوظة. تخرج من غير حفظ؟')) return; V.id = null; V.L = null; V.edit = false; V.metaPend = null; renderInv(); };
  $('#ivEd') && ($('#ivEd').onclick = () => { V.edit = true; renderInvOne(); });
  $('#ivCancel') && ($('#ivCancel').onclick = () => { V_subPulled = []; V.edit = false; V.L = null; V.metaPend = null; renderInvOne(); });
  if (E && V.metaPend) { const m = V.metaPend; if ('title' in m && $('#ivTitle')) $('#ivTitle').value = m.title; if (m.inv_date !== undefined && $('#ivDate')) { $('#ivDate').value = m.inv_date || ''; $('#ivFrom').value = m.period_from || ''; $('#ivTo').value = m.period_to || ''; } if ('pay_pct' in m && $('#ivPay')) $('#ivPay').value = Math.round(m.pay_pct * 100); if ('fee_pct' in m && $('#ivFee')) $('#ivFee').value = Math.round(m.fee_pct * 1000) / 10; }
  $('#main').onclick = async e => {
    const ad = e.target.closest('[data-add]'); if (ad) { keep(); const [kind, cat] = ad.dataset.add.split('|'); const mx = Math.max(0, ...L.filter(l => l.cat === cat).map(l => l.sort)); L.push({ cat, kind, name: kind === 'line' ? '' : (kind === 'head1' ? 'عنوان رئيسي' : 'عنوان فرعي'), unit: ICUM(cat) ? 'م3' : 'مقطوعية', rate: 0, prev_qty: 0, cur_qty: ICUM(cat) ? 0 : 1, pct: 1, prev_value: 0, sort: mx + 10, _new: true }); return renderInvOne(); }
    const pk = e.target.closest('[data-pick]'); if (pk) { keep(); return invPick(pk.dataset.pick, L, re); }
    if (e.target.closest('#ivSubs')) { keep(); return invFromSubs(inv, L, re); }
    const dl = e.target.closest('[data-ldel]'); if (dl) { keep(); const l = L[+dl.dataset.ldel]; if (l.id) V.del.push(l.id); L.splice(+dl.dataset.ldel, 1); return renderInvOne(); }
  };
  $('#main').oninput = e => { if (e.target.matches('[data-l][data-f]') && ['rate', 'prev_qty', 'cur_qty', 'pct'].includes(e.target.dataset.f)) { /* live total on blur */ } };
  $('#main').onchange = e => { if (!E) return; if (e.target.matches('#ivPay, #ivFee')) return re();
    if (e.target.matches('[data-f="item_id"],[data-f="phase_n"]')) { keep(); const l = L[+e.target.dataset.l], it = l.item_id && P.items.find(i => i.id === l.item_id);
      if (it && e.target.dataset.f === 'item_id') { l.phase_n = it.phase_n; if (!l.name?.trim()) l.name = it.name; if (!l.unit || l.unit === 'م3' || l.unit === 'مقطوعية') l.unit = it.unit || l.unit; if (!+l.rate && it.rate > 0) l.rate = it.rate; } return re(); }
    if (e.target.matches('[data-l][data-f]')) { keep(); const l = L[+e.target.dataset.l], c = $('#lv' + l._i); if (c) c.innerHTML = `<b>${nf(lnVal(l), 0)}</b>${ICUM(l.cat) && Math.abs(lnCur(l)) > 0.5 ? `<div class="cur" style="font-size:11px">الحالي ${nf(lnCur(l), 0)}</div>` : ''}`; const t = $('#ivCurT'); if (t) t.textContent = nf(invTot(L)[l.cat], 0); } };
  $('#ivPull') && ($('#ivPull').onclick = async () => { keep(); const ids = [...new Set(L.filter(l => l.cat === 'contract' && l.item_id).map(l => l.item_id))]; if (!ids.length) return toast('اربط بنود المستخلص ببنود المقايسة الأول');
    const { data: pe } = await S.sb.from('progress_entries').select('item_id,qty').in('item_id', ids); const ex = {}; (pe || []).forEach(x => ex[x.item_id] = (ex[x.item_id] || 0) + +x.qty);
    const grp = {}; L.filter(l => l.cat === 'contract' && l.item_id && l.kind === 'line').forEach(l => (grp[l.item_id] ||= []).push(l)); let n = 0;
    Object.entries(grp).forEach(([id, ls]) => { if (ls.length !== 1) return; const l = ls[0], c = Math.max(0, (ex[id] || 0) - +l.prev_qty); if (Math.abs(c - +l.cur_qty) > 1e-6) { l.cur_qty = Math.round(c * 1000) / 1000; n++; } });
    toast(n ? `اتحدّث الحالي في ${n} بند من المنفذ المعتمد` : 'مفيش كميات جديدة في التقارير المعتمدة'); renderInvOne(); });
  $('#ivLedger') && ($('#ivLedger').onclick = async () => { keep(); const cat = V.tab, m = { ...inv, ...meta() }; if (!m.period_from && !m.period_to) return toast('حدد فترة المستخلص الأول');
    const CM = { supply: ['توريدات', 'توريدوتركيب'], extra: ['نثريات', 'اكراميات_وعمالة', 'موقع', 'دعايا', 'تراخيص'], design: ['تصميمات', 'استشارات'], contract: ['مصنعيات'] }[cat] || [];
    const { data: tagged } = await S.sb.from('ledger_entries').select('*').eq('project_id', P.id).eq('status', 'approved').eq('owner_invoice_no', inv.no).gt('expense', 0).order('entry_date');
    let le = (tagged || []).filter(x => !x.category || CM.includes(x.category)), byNo = !!(tagged || []).length;
    if (!byNo) { let q = S.sb.from('ledger_entries').select('*').eq('project_id', P.id).eq('status', 'approved').is('owner_invoice_no', null).gt('expense', 0); if (m.period_from) q = q.gt('entry_date', m.period_from); if (m.period_to) q = q.lte('entry_date', m.period_to);
      const { data, error: er } = await q.order('entry_date'); if (er) return toast(er.message); le = (data || []).filter(x => !x.category || CM.includes(x.category)); }
    const have = new Set(L.map(l => l.notes || '').map(n => (n.match(/#قيد (\d+)/) || [])[1]).filter(Boolean)); le = le.filter(x => !have.has(String(x.id)));
    if (!le.length) return toast(byNo ? 'مفيش قيود جديدة من النوع ده على المستخلص ده' : 'مفيش قيود معتمدة في الفترة دي');
    const mx = Math.max(0, ...L.filter(l => l.cat === cat).map(l => l.sort)); le.forEach((x, k) => L.push({ cat, kind: 'line', name: x.description || x.supplier || 'مصروف', unit: x.unit || 'مقطوعية', rate: x.qty ? Math.round(+x.expense / +x.qty * 10000) / 10000 : +x.expense, prev_qty: 0, cur_qty: x.qty ? +x.qty : 1, pct: 1, prev_value: 0, item_id: x.item_id || null, phase_n: x.phase_n || null, notes: [x.supplier, x.entry_date && fmtD(x.entry_date), '#قيد ' + x.id].filter(Boolean).join(' · '), sort: mx + 10 * (k + 1) }));
    toast(`اتضاف ${le.length} قيد ${byNo ? 'متسجل على المستخلص ده' : 'من الفترة'} – راجعهم`); renderInvOne(); });
  $('#ivSave') && ($('#ivSave').onclick = async () => { keep(); const b = $('#ivSave'); b.disabled = true; const t = invTot(L);
    const head = { ...meta(), amt_design: t.design, amt_contract: t.contract, amt_supply: t.supply, amt_extra: t.extra, updated_at: new Date().toISOString() };
    if (inv.legacy && !L.length) { delete head.amt_design; delete head.amt_contract; delete head.amt_supply; delete head.amt_extra; }
    let { error: er } = await S.sb.from('owner_invoices').update(head).eq('id', inv.id);
    if (!er && V.del.length) ({ error: er } = await S.sb.from('owner_invoice_lines').delete().in('id', V.del));
    const clean = l => { const o = { invoice_id: inv.id }; ['cat', 'kind', 'name', 'description', 'unit', 'rate', 'prev_qty', 'cur_qty', 'pct', 'prev_value', 'notes', 'item_id', 'phase_n', 'sort'].forEach(k => o[k] = l[k] ?? (k === 'name' ? '' : null)); ['rate', 'prev_qty', 'cur_qty', 'prev_value'].forEach(k => o[k] = +o[k] || 0); o.pct = o.pct == null ? 1 : +o.pct; o.sort = +o.sort || 0; if (l.line_key) o.line_key = l.line_key; return o; };
    const up = L.filter(l => l.id).map(l => ({ id: l.id, ...clean(l) })), ins = L.filter(l => !l.id).map(clean);
    for (let k = 0; k < up.length && !er; k += 300) ({ error: er } = await S.sb.from('owner_invoice_lines').upsert(up.slice(k, k + 300)));
    for (let k = 0; k < ins.length && !er; k += 300) ({ error: er } = await S.sb.from('owner_invoice_lines').insert(ins.slice(k, k + 300)));
    if (!er && V_subPulled.length) { ({ error: er } = await S.sb.from('sub_invoices').update({ owner_invoice_id: inv.id }).in('id', V_subPulled)); if (!er) V_subPulled = []; }
    if (er) { b.disabled = false; return toast('مقدرتش أحفظ: ' + er.message); } toast('اتحفظ المستخلص'); V.edit = false; V.L = null; V.metaPend = null; renderInvOne(); });
  $('#ivSt') && ($('#ivSt').onchange = async e => { const { error: er } = await S.sb.from('owner_invoices').update({ status: e.target.value, updated_at: new Date().toISOString() }).eq('id', inv.id); if (er) return toast(er.message); toast('اتغيرت الحالة'); renderInvOne(); });
  $('#ivPrint') && ($('#ivPrint').onclick = async () => { const { data: all } = await S.sb.from('owner_invoices').select('*').eq('project_id', P.id).lte('no', inv.no).order('no'); printInv(inv, L, all || [inv]); });
  $('#ivXls') && ($('#ivXls').onclick = () => exportInv(inv, L));
  $('#ivImp') && ($('#ivImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; keep(); const n = await importInvXlsx(f, L); if (n) { toast(`اتقرى ${n} سطر من الإكسل – راجعهم واضغط حفظ`); renderInvOne(); } });
}
function invHeadHtml(inv, sub) { const p = S.P.proj; return `<div class="ph"><table class="meta"><tr><td>المشروع :</td><td>${esc(p.name)}</td></tr><tr><td>اسم المالك :</td><td>${esc(p.owner_name || '')}</td></tr><tr><td>الموقع :</td><td>${esc(p.place || '')}</td></tr><tr><td>التاريخ :</td><td>${inv.inv_date ? new Date(inv.inv_date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</td></tr></table>${LOGO()}</div><h2 class="ttl">${sub}</h2>`; }
function printInv(inv, L, all) {
  const P = S.P, p = P.proj, T = invTot(L), useLines = L.length > 0;
  const amt = k => useLines ? T[k] : +inv['amt_' + k], works = Object.keys(ICAT).reduce((s, k) => s + amt(k), 0);
  const sig = '<div class="sig"><span>ممثل المقاول</span><span>ممثل الاستشاري</span><span>مسئول حسابات</span></div>';
  const hist = all.map(i => i.id === inv.id ? { ...i, amt_design: amt('design'), amt_contract: amt('contract'), amt_supply: amt('supply'), amt_extra: amt('extra') } : i);
  const tot = k => hist.reduce((s, i) => s + +i['amt_' + k], 0);
  const sheet = c => { const R = L.filter(l => l.cat === c), cum = ICUM(c); if (!R.length) return '';
    return `<section>${invHeadHtml(inv, `${esc(inv.title || '')} – ${ICAT[c]}${c === 'contract' ? ' <span class="red">(مصاريف تراكمية)</span>' : ''}`)}<table class="g"><thead><tr><th>م</th><th>البند</th><th>الوحدة</th><th>الفئة</th>${cum ? '<th>السابق</th>' : ''}<th>الحالي</th>${cum ? '<th>إجمالي الكميات</th><th>نسبة الإنجاز</th>' : '<th>نسبة الصرف</th>'}<th>قيمة الصرف</th><th>ملاحظات</th></tr></thead><tbody>
      ${(() => { let n = 0; return R.map(l => l.kind !== 'line' ? `<tr class="${l.kind}"><td></td><td colspan="${cum ? 9 : 7}">${esc(l.name)}</td></tr>` : `<tr class="${+l.cur_qty && cum ? 'hl' : ''}"><td>${++n}</td><td class="nm">${esc(l.name)}</td><td>${esc(l.unit || '')}</td><td>${nf(l.rate)}</td>${cum ? `<td>${nf(l.prev_qty)}</td>` : ''}<td class="red">${+l.cur_qty ? nf(l.cur_qty) : '-'}</td>${cum ? `<td>${nf(+l.prev_qty + +l.cur_qty)}</td>` : ''}<td>${Math.round(l.pct * 100)}%</td><td><b>${nf(lnVal(l), 0)}</b></td><td class="nt">${esc(l.notes || '')}</td></tr>`).join(''); })()}
      </tbody></table><table class="tt"><tr><th>إجمالي ${ICAT[c]}</th><td>${nf(cum ? (c === 'contract' ? T.cumContract : T.cumDesign) : T[c], 0)}</td></tr>${cum ? `<tr><th class="red">إجمالي الأعمال السابقة</th><td class="red">${nf(c === 'contract' ? T.prevContract : T.prevDesign, 0)}</td></tr><tr><th class="red">إجمالي الأعمال الحالية</th><td class="red">${nf(T[c], 0)}</td></tr>` : ''}</table>${sig}</section>`; };
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(p.name)} – ${esc(inv.title || '')}</title><base href="${location.href.split('#')[0]}"><style>
  @page{size:A3 landscape;margin:12mm}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#111;margin:0;font-size:12px}section{page-break-after:always;padding:4mm}
  .logo .lk{display:none}.logo img{height:46px}.ph{display:flex;justify-content:space-between;align-items:flex-start}.meta td{padding:1px 6px;font-size:13px}.meta td:first-child{font-weight:700}
  .ttl{text-align:center;font-size:17px;margin:6px 0 10px;text-decoration:underline}.red{color:#c00}
  table.g{width:100%;border-collapse:collapse}table.g th{background:#203864;color:#fff;padding:6px 4px;font-size:12px;border:1px solid #203864}table.g td{border:1px solid #999;padding:3px 5px;text-align:center}
  table.g td.nm{text-align:right;white-space:pre-wrap;max-width:520px}table.g td.nt{text-align:right;font-size:11px}table.g tr.head1 td{background:#fbe5d6;font-weight:700;text-align:right;font-size:13px}table.g tr.head2 td{background:#d9d9d9;font-weight:700;text-align:right}table.g tr.hl td{background:#dce6f1}
  table.tt{margin-top:6px;border-collapse:collapse}table.tt th{background:#203864;color:#fff;padding:4px 10px;text-align:right}table.tt th.red,table.tt td.red{background:none;color:#c00}table.tt td{padding:4px 10px;font-weight:700}
  .sig{display:flex;justify-content:space-around;margin-top:22px;font-weight:700}.cover{display:flex;flex-direction:column;justify-content:center;height:250mm}.cover table{margin:0 auto;font-size:28px;font-weight:700}.cover td{padding:12px 40px}
  table.sm{width:100%;border-collapse:collapse;margin-top:30mm}table.sm th{background:#203864;color:#fff;padding:5px;border:1px solid #fff}table.sm td{border:1px solid #333;padding:5px;text-align:center}table.sm td:first-child{text-align:right}table.sm tr.tot td{font-weight:700}table.sm tr.tot td:first-child{color:#c00}
  table.pay{margin:14px 0 0 auto;border-collapse:collapse;font-size:14px}table.pay th{background:#203864;color:#fff;padding:5px 10px}table.pay td{border:1px solid #333;padding:5px 12px;text-align:center}table.pay td:first-child{text-align:right;font-weight:700}table.pay tr.net td{background:#b4c6e7;color:#c00;font-size:18px;font-weight:700}
  </style></head><body>
  <section class="cover"><table><tr><td>المشروع</td><td>${esc(p.name)}</td></tr><tr><td>الموقع</td><td>${esc(p.place || '')}</td></tr><tr><td>المالك</td><td>${esc(p.owner_name || '')}</td></tr><tr><td>الإستشاري</td><td>${esc(p.consultant_name || '')}</td></tr><tr><td>المقاول</td><td>${esc(p.contractor_name || 'شركة ريسان')}</td></tr><tr><td>المستخلص</td><td>${esc(inv.title || '')}</td></tr></table></section>
  <section>${invHeadHtml(inv, `إجمالي المنصرف ${esc(inv.title || '')} – مشروع ${esc(p.name)}`)}<table class="sm"><thead><tr><th>وصف البند</th>${hist.map(i => `<th>مستخلص ${i.no}<br>(جنيه)</th>`).join('')}<th>إجمالي<br>(جنيه)</th></tr></thead><tbody>
    ${Object.entries(ICAT).map(([k, l]) => `<tr><td>إجمالي ${l}${ICUM(k) ? ' <span class="red">(مصاريف تراكمية)</span>' : ''}</td>${hist.map(i => `<td>${nf(i['amt_' + k], 0)}</td>`).join('')}<td>${nf(tot(k), 0)}</td></tr>`).join('')}
    <tr class="tot"><td>إجمالي الأعمال</td>${hist.map(i => `<td>${nf(invSum(i), 0)}</td>`).join('')}<td>${nf(hist.reduce((s, i) => s + invSum(i), 0), 0)}</td></tr></tbody></table>
    <table class="pay"><tr><th></th><th>نسبة الصرف</th><th>القيمة</th><th>إجمالي المستحق صرفه</th></tr><tr><td>إجمالي الأعمال عن ${esc(inv.title || '')}</td><td>${Math.round(inv.pay_pct * 100)}%</td><td>${nf(works, 0)}</td><td>${nf(works * inv.pay_pct, 0)}</td></tr><tr><td>نسبة الشركة عن ${esc(inv.title || '')}</td><td>100%</td><td>${nf(works * inv.fee_pct, 0)}</td><td>${nf(works * inv.fee_pct, 0)}</td></tr><tr class="net"><td colspan="3">المستحق صرفه</td><td>${nf(works * inv.pay_pct + works * inv.fee_pct, 0)}</td></tr></table></section>
  ${['design', 'contract', 'supply', 'extra'].map(sheet).join('')}
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('المتصفح منع فتح نافذة الطباعة، اسمح بالنوافذ المنبثقة'); w.document.write(html); w.document.close();
}
function exportInv(inv, L) {
  if (!window.XLSX) return toast('مكتبة الإكسل لسه ماحمّلتش');
  const wb = XLSX.utils.book_new();
  Object.entries(ICAT).forEach(([c, nm]) => { const cum = ICUM(c), R = L.filter(l => l.cat === c); if (!R.length) return;
    const rows = [['النوع', 'البند', 'الوحدة', 'الفئة', ...(cum ? ['السابق'] : []), 'الحالي', ...(cum ? ['إجمالي الكميات'] : []), cum ? 'نسبة الإنجاز' : 'نسبة الصرف', 'قيمة الصرف', 'ملاحظات', 'كود المقايسة']];
    R.forEach(l => rows.push([l.kind === 'line' ? '' : l.kind === 'head1' ? 'عنوان' : 'فرعي', l.name, l.unit || '', +l.rate, ...(cum ? [+l.prev_qty] : []), +l.cur_qty, ...(cum ? [+l.prev_qty + +l.cur_qty] : []), +l.pct, Math.round(lnVal(l)), l.notes || '', l.item_id ? (S.P.items.find(i => i.id === l.item_id)?.code || '') : '']));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 7 }, { wch: 60 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 22 }, { wch: 10 }]; ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, nm.slice(0, 30)); });
  if (!wb.SheetNames.length) return toast('المستخلص مفيهوش بنود'); XLSX.writeFile(wb, `${S.P.proj.name} - ${inv.title || 'مستخلص'}.xlsx`);
}
async function importInvXlsx(file, L) {
  if (!window.XLSX) { toast('مكتبة الإكسل لسه ماحمّلتش'); return 0; }
  const wb = XLSX.read(await file.arrayBuffer()), T = v => String(v ?? '').trim(), N = v => typeof v === 'number' ? v : +String(v).replace(/[,%\s]/g, '') || 0; let n = 0;
  const catOf = (sn, A) => { const t = sn + ' ' + A.slice(0, 8).flat().map(T).join(' '); return /تصميم/.test(t) ? 'design' : /توريد|مشتريات/.test(t) ? 'supply' : /اضاف|إضاف|أخرى|اخرى/.test(t) ? 'extra' : /تعاقد/.test(t) ? 'contract' : null; };
  for (const sn of wb.SheetNames) {
    const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }); let hi = -1;
    for (let i = 0; i < Math.min(A.length, 25); i++) { const r = A[i].map(T); if (r.includes('البند') && r.some(x => /الفئة|الفئه/.test(x)) && r.some(x => /الحالي|الحالى/.test(x))) { hi = i; break; } }
    if (hi < 0) continue; const cat = catOf(sn, A); if (!cat) continue;
    const H = A[hi].map(T), c = re => H.findIndex(x => re.test(x)), cN = H.indexOf('البند'), cU = c(/الوحدة|الوحده/), cR = c(/الفئة|الفئه/), cP = c(/السابق/), cC = c(/الحالي|الحالى/), cX = c(/نسبة/), cNo = c(/ملاحظات/), cNum = c(/رقم البند/);
    let mx = Math.max(0, ...L.filter(l => l.cat === cat).map(l => l.sort)), desc = '';
    A.slice(hi + 1).forEach(r => { const name = T(r[cN]); if (!name) return; if (/^اجما|^أجما|^إجما/.test(name)) return; const rate = N(r[cR]), prev = cP >= 0 ? N(r[cP]) : 0, cur = cC >= 0 ? N(r[cC]) : 0, unit = cU >= 0 ? T(r[cU]) : '';
      let pct = cX >= 0 ? N(r[cX]) : 1; if (pct > 1) pct /= 100; if (!pct && (rate || prev || cur)) pct = 1;
      if (!rate && !prev && !cur && !unit) { if (name.length > 70) { desc = name; return; } L.push({ cat, kind: T(r[cNum]) ? 'head1' : 'head2', name, rate: 0, prev_qty: 0, cur_qty: 0, pct: 1, prev_value: 0, sort: (mx += 10) }); n++; return; }
      const l = { cat, kind: 'line', name: desc && name.length < 60 ? name : name, description: desc || null, unit, rate, prev_qty: ICUM(cat) ? prev : 0, cur_qty: cur, pct, prev_value: 0, notes: cNo >= 0 ? T(r[cNo]) || null : null, sort: (mx += 10) };
      if (ICUM(cat)) l.prev_value = prev * rate * pct; if (desc && l.kind === 'line' && !L.some(x => x.description === desc)) L.push({ cat, kind: 'head2', name: desc, rate: 0, prev_qty: 0, cur_qty: 0, pct: 1, prev_value: 0, sort: l.sort - 5 }); L.push(l); n++; });
  }
  if (!n) toast('مش لاقي في الملف جداول بأعمدة البند والفئة والحالي'); return n;
}

/* ---------------- documents ---------------- */
const DOC_ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv,.docx,.doc,.jpg,.jpeg,.png,.webp';
const DOC_MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const DOC_KIND = { report: 'تقارير', boq: 'مقايسات', quote: 'عروض أسعار', other: 'أخرى' };
const canUp = (pid, kind) => S.admin || (kind === 'report' ? can('docsUp', pid) : ['tech', 'management'].includes(role(pid)));
const fsize = b => b > 1048576 ? nf(b / 1048576, 1) + ' MB' : nf(b / 1024, 0) + ' KB';
const ftype = d => { const e = (d.file_name || d.path).split('.').pop().toLowerCase(); return /pdf/.test(e) ? ['PDF', 'pdf'] : /xls|csv/.test(e) ? ['XLS', 'xls'] : /doc/.test(e) ? ['DOC', 'doc'] : ['IMG', 'img']; };
const quoteBtn = d => { const P = S.P, i = d.kind === 'quote' && d.item_id && d.amount != null && P.items.find(x => x.id === d.item_id); if (!i || !['tech', 'management'].includes(role(P.id))) return '';
  return i.rdoc === d.id ? '<span class="st appr">السعر المحدّث للبند</span>' : `<button type="button" data-qapprove="${d.id}" title="يحط سعر العرض كسعر محدّث للبند ${esc(i.code)}">اعتماد كسعر محدّث</button>`; };
const docChip = d => { const [t, c] = ftype(d); return `<a href="#" class="dchip" data-open="${d.id}" title="${esc(d.file_name || '')}"><i class="fi ${c}">${t}</i>${esc(d.title)}</a>`; };
async function uploadDocs(files, meta) {
  const P = meta.P || S.P; let ok = 0;
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase(), mime = DOC_MIME[ext];
    if (!mime) { toast(`نوع الملف ${f.name} مش مسموح`); continue; } if (f.size > 25 * 1048576) { toast(`${f.name} أكبر من 25 ميجا`); continue; }
    toast(`جاري رفع ${f.name}…`); const path = `${P.id}/${meta.kind}/${crypto.randomUUID()}.${ext}`;
    const up = await S.sb.storage.from('docs').upload(path, f, { contentType: mime }); if (up.error) { toast('مقدرتش أرفع: ' + up.error.message); continue; }
    const { data: dr, error } = await S.sb.from('documents').insert({ project_id: P.id, path, file_name: f.name, mime, size: f.size, title: meta.title && files.length === 1 ? meta.title : f.name.replace(/\.[^.]+$/, ''), kind: meta.kind, doc_date: meta.doc_date || today(), report_id: meta.report_id || null, item_id: meta.item_id || null, supplier: meta.supplier || null, amount: meta.amount ?? null, notes: meta.notes || null }).select('id').single();
    if (error) { await S.sb.storage.from('docs').remove([path]); toast('مقدرتش أسجل الملف: ' + error.message); continue; } ok++; (meta.ids ||= []).push(dr?.id);
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
  ${cmp.length && (!F.kind || F.kind === 'quote') ? `<div class="card"><b>مقارنة عروض الأسعار</b>${cmp.map(([it, q]) => { const s2 = [...q].sort((a, b) => a.amount - b.amount), lo = s2[0].amount; return `<div style="margin-top:8px"><div class="mut">${esc(itemName(it))}</div><div class="scroll"><table><tbody>${s2.map((d, k) => `<tr><td>${k === 0 ? '<span class="st appr">الأقل</span> ' : ''}${esc(d.supplier || d.title)}</td><td class="n"><b>${nf(d.amount, 0)}</b>${k ? ` <small class="mut">(+${Math.round((d.amount - lo) / lo * 100)}%)</small>` : ''}</td><td>${fmtD(d.doc_date)}</td><td>${docChip(d)}</td><td>${quoteBtn(d)}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('')}</div>` : ''}
  <div class="dlist">${L.length ? L.map(d => { const [t, c] = ftype(d), r = d.report_id && P.reports.find(x => x.id === d.report_id), mine = d.uploaded_by === S.user.id || role(P.id) === 'management';
    return `<div class="drow"><i class="fi ${c}">${t}</i><div class="dm"><a href="#" data-open="${d.id}"><b>${esc(d.title)}</b></a><div class="mut">${DOC_KIND[d.kind]} · ${fmtD(d.doc_date)}${d.supplier ? ' · ' + esc(d.supplier) : ''}${d.amount != null ? ' · <b>' + nf(d.amount, 0) + ' ج.م</b>' : ''}${r ? ' · تقرير ' + r.report_date : ''}${d.item_id ? ` · <a href="#" data-item="${esc(d.item_id)}">${esc(itemName(d.item_id))}</a>` : ''}${d.notes ? ' · ' + esc(d.notes) : ''}</div><div class="mut" style="font-size:12px">${esc(d.file_name || '')} · ${fsize(d.size || 0)}${S.names[d.uploaded_by] ? ' · رفعه ' + esc(S.names[d.uploaded_by]) : ''}</div></div>
    <div class="da">${quoteBtn(d)}<button data-dl="${d.id}">تحميل</button>${mine ? `<button class="danger" data-del="${d.id}">حذف</button>` : ''}</div></div>`; }).join('') : '<p class="mut">مفيش مستندات.</p>'}</div>`;
  const f = $('#dF'); if (f) { const sync = () => f.querySelectorAll('[data-for]').forEach(x => x.hidden = !x.dataset.for.split(' ').includes(f.kind.value)); f.kind.onchange = sync; sync();
    f.onsubmit = async e => { e.preventDefault(); const g = n => f[n].value, files = [...f.files.files]; if (!files.length) return; $('#dGo').disabled = true;
      const n = await uploadDocs(files, { kind: g('kind'), title: g('title').trim(), doc_date: g('date'), report_id: g('kind') === 'report' ? g('report') || null : null, item_id: ['quote', 'boq'].includes(g('kind')) ? g('item') || null : null, supplier: g('kind') === 'quote' ? g('supplier').trim() : null, amount: g('kind') === 'quote' && g('amount') !== '' ? +g('amount') : null, notes: g('notes').trim() });
      $('#dGo').disabled = false; if (n) { F.kind = g('kind'); await loadProject(P.id); renderDocs(); } }; }
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { F.kind = b.dataset.k; renderDocs(); });
  $('#dQ').onchange = e => { F.q = e.target.value.trim(); renderDocs(); }; $('#dXi') && ($('#dXi').onclick = () => { F.item = ''; renderDocs(); });
  $('#main').onclick = async e => { const it = e.target.closest('[data-item]'); if (it) { e.preventDefault(); F.item = it.dataset.item; return renderDocs(); }
    const qa = e.target.closest('[data-qapprove]'); if (qa) { const d = P.docs.find(x => x.id === qa.dataset.qapprove), i = P.items.find(x => x.id === d.item_id); if (!i) return; const rate = +i.qty > 0 ? d.amount / +i.qty : d.amount;
      if (qa.dataset.sure !== '1') { qa.dataset.sure = '1'; qa.textContent = `متأكد؟ السعر هيبقى ${nf(rate)} / ${i.unit || 'مقطوع'}`; return; }
      const { error } = await S.sb.from('boq_rates').upsert({ item_id: i.id, rate: Math.round(rate * 100) / 100, rate_source: 'quote', rate_doc_id: d.id, rate_updated_at: new Date().toISOString() }); if (error) return toast(error.message); toast('اتعتمد العرض كسعر محدّث للبند'); await loadProject(P.id); return renderDocs(); }
    const del = e.target.closest('[data-del]'); if (del) { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'متأكد؟'; return; } const d = P.docs.find(x => x.id === del.dataset.del);
      const { error } = await S.sb.from('documents').delete().eq('id', d.id); if (error) return toast(error.message); await S.sb.storage.from('docs').remove([d.path]); toast('اتحذف'); await loadProject(P.id); return renderDocs(); }
    docClick(e); };
}

/* ---------------- quotes: fixed price per item + suppliers' offers, consultant review, owner view ---------------- */
const QST = { draft: ['', 'مسودة – مش ظاهرة للاستشاري'], submitted: ['pend', 'بانتظار الاستشاري'], approved: ['appr', 'معتمد من الاستشاري'], rejected: ['ret', 'مرفوض من الاستشاري'] };
const qVat = q => +q.unit_rate * (q.vat_included ? 1 : 1.14);
const RSRC = { quote: 'من عرض سعر', manual: 'سعر متسجل يدوي', sheet: 'من شيت الأسعار' };
function askNote(title, ph = '', need = true) {
  return new Promise(res => { const d = document.createElement('dialog'); d.className = 'adlg';
    d.innerHTML = `<form method="dialog"><h3 style="margin:0 0 10px;font-size:16px">${esc(title)}</h3><textarea name="t" rows="3" style="width:100%" placeholder="${esc(ph)}"></textarea><div class="acts"><button class="p" value="ok">تأكيد</button><button value="">إلغاء</button></div></form>`;
    document.body.append(d); d.showModal(); d.onclose = () => { const v = d.returnValue === 'ok' ? d.querySelector('textarea').value.trim() : null; d.remove(); res(v === null || (need && !v) ? null : v); }; });
}
function renderQuotes() {
  const P = S.P, F = (S.qF ||= { st: '', q: '', item: '', form: null }), ed = can('quoteEd', P.id), rev = can('quoteRev', P.id), Q = P.quotes || [], r0 = role(P.id);
  const itemOf = id => (P.qitems || []).find(x => x.id === id) || P.items.find(x => x.id === id) || { id, code: id, name: '', unit: '' };
  const byItem = {}; Q.forEach(q => (byItem[q.item_id] ||= []).push(q));
  const vis = it => (!F.item || it.id === F.item) && (!F.st || byItem[it.id].some(q => q.status === F.st)) && (!F.q || normAr(it.code + ' ' + it.name + ' ' + (it.building || '') + ' ' + byItem[it.id].map(q => (q.supplier || '') + ' ' + (q.option_label || '')).join(' ')).includes(normAr(F.q)));
  const items = Object.keys(byItem).map(itemOf).filter(vis).sort((a, b) => String(a.code).localeCompare(String(b.code), 'ar', { numeric: true }));
  const cnt = st => Q.filter(q => q.status === st).length, exp = q => q.valid_until && q.valid_until < today();
  const fixedOf = it => { const pi = P.items.find(x => x.id === it.id), rate = pi && P.showRates ? pi.rate : +it.rate || 0, src = pi && P.showRates ? pi.rsrc : it.rate_source, qid = pi?.rqid || it.rate_quote_id; return { rate, src, q: qid && Q.find(x => x.id === qid) }; };
  const intro = r0 === 'owner' ? 'عروض الأسعار اللي قدمتها الشركات لبنود المشروع، ورأي الاستشاري في كل عرض، والسعر اللي اتثبت للبند.' : rev && r0 === 'consultant' ? 'راجع كل عرض واعتمده أو ارفضه مع ذكر السبب. العروض اللي بانتظارك عليها علامة صفرا.' : 'لكل بند: سجّل عروض الشركات المقدمة، ابعتها للاستشاري يراجعها، وبعدين ثبّت سعر البند من العرض المناسب. الأسعار في المقارنة كلها شاملة ضريبة القيمة المضافة 14%.';
  const form = () => { const f = F.form, q = f.id ? Q.find(x => x.id === f.id) : {}, it = P.items.find(x => x.id === (q.item_id || f.item)), V = it ? [...vendorsFor(it), ...P.vendors.filter(v => !vendorsFor(it).includes(v))] : P.vendors;
    return `<div class="card qform"><b>${f.id ? 'تعديل عرض سعر' : '+ عرض سعر جديد'}</b><form id="qF" class="grid" style="margin-top:10px">
      <label class="wide">البند<select name="item" required><option value="">— اختار البند —</option>${P.phaseProg.map(ph => `<optgroup label="${ph.n}. ${esc(ph.name)}">${P.items.filter(i => i.phase_n === ph.n).map(i => `<option value="${esc(i.id)}"${i.id === (q.item_id || f.item) ? ' selected' : ''}>${esc(i.code + ' ' + (i.name.length > 70 ? i.name.slice(0, 70) + '…' : i.name) + (i.building ? ' – ' + i.building : ''))}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label>الشركة<select name="vendor"><option value="">— شركة مش في القائمة —</option>${V.map(v => `<option value="${v.id}"${v.id === q.vendor_id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label>أو اسم الشركة<input name="supplier" value="${esc(q.vendor_id ? '' : q.supplier || '')}" placeholder="لو مش في القائمة"></label>
      <label>البديل / المواصفة<input name="opt" value="${esc(q.option_label || '')}" placeholder="مثلاً: أبواب إيطالي"></label>
      <label>السعر<input name="price" type="number" step="any" inputmode="decimal" required value="${q.unit_rate ?? ''}"></label>
      <label>السعر ده<select name="mode"><option value="u">للوحدة</option><option value="t">إجمالي العرض</option></select></label>
      <label>الكمية في العرض<input name="qty" type="number" step="any" value="${q.qty ?? (it ? +it.qty || '' : '')}"></label>
      <label class="chk"><input type="checkbox" name="vat"${q.id ? (q.vat_included ? ' checked' : '') : ''}> السعر شامل الضريبة 14%</label>
      <label>تاريخ العرض<input type="date" name="date" value="${q.quote_date || today()}"></label><label>صالح لحد<input type="date" name="valid" value="${q.valid_until || ''}"></label>
      <label class="wide">شروط الدفع والتوريد<input name="terms" value="${esc(q.terms || '')}"></label>
      <label class="wide">ملاحظات (اللي مش داخل في السعر، إضافات…)<input name="notes" value="${esc(q.notes || '')}"></label>
      <label class="wide">ملف العرض (PDF أو صورة)${q.doc_id ? ' – <span class="mut">فيه ملف مرفوع، ارفع جديد لو عاوز تغيّره</span>' : ''}<input type="file" name="file" accept="${DOC_ACCEPT}"></label>
      ${!q.id || q.status === 'draft' ? '<label class="chk wide"><input type="checkbox" name="send" checked> ابعته للاستشاري يراجعه</label>' : ''}
      <label class="chk wide"><input type="checkbox" name="adopt"${q.adopted ? ' checked disabled' : ''}> ثبّت السعر ده كسعر البند</label>
      <div class="acts wide" style="margin:0"><button class="p" id="qGo">حفظ</button><button type="button" id="qX">إلغاء</button></div></form></div>`; };
  const row = (q, lo, it, fx) => { const [c, l] = QST[q.status], vr = qVat(q), tot = vr * (+q.qty || +it.qty || 1), d = q.doc_id && P.docs.find(x => x.id === q.doc_id), mine = ed;
    const acts = [d ? docChip(d) : '', ed && q.status === 'draft' ? `<button data-qsend="${q.id}">إرسال للاستشاري</button>` : '', ed && !q.adopted && q.status !== 'rejected' ? `<button data-qadopt="${q.id}" class="p">تثبيت السعر</button>` : '',
      rev && q.status === 'submitted' ? `<button data-qok="${q.id}" class="p">✔ اعتماد</button><button data-qno="${q.id}" class="danger">✕ رفض</button>` : '', rev && r0 === 'management' && ['approved', 'rejected'].includes(q.status) ? `<button data-qback="${q.id}">رجّعه للمراجعة</button>` : '',
      mine ? `<button data-qed="${q.id}">تعديل</button><button data-qdel="${q.id}" class="danger">حذف</button>` : ''].filter(Boolean).join('');
    return `<tr class="${q.adopted ? 'qad' : ''}${q.status === 'submitted' && rev ? ' qwait' : ''}"><td><b>${esc(q.supplier || '—')}</b>${q.option_label ? `<div class="mut">${esc(q.option_label)}</div>` : ''}</td>
      <td class="n" data-l="سعر الوحدة"><b>${nf(vr, 0)}</b>${vr === lo && byItem[it.id].length > 1 ? ' <span class="st appr">الأقل</span>' : vr > lo ? ` <small class="mut">+${Math.round((vr - lo) / lo * 100)}%</small>` : ''}${q.vat_included ? '' : `<div class="mut" style="font-size:11px">${nf(q.unit_rate, 0)} + ض</div>`}</td>
      <td class="n" data-l="الإجمالي">${nf(tot, 0)}</td><td data-l="صالح لحد">${q.valid_until ? `<span${exp(q) ? ' style="color:var(--bad)"' : ''}>${fmtD(q.valid_until)}${exp(q) ? ' – منتهي' : ''}</span>` : '–'}</td>
      <td data-l="الحالة"><span class="st ${c}">${l}</span>${q.adopted ? ' <span class="st appr">✔ السعر المثبت</span>' : ''}${q.review_note ? `<div class="mut" style="font-size:12px">الاستشاري: ${esc(q.review_note)}</div>` : ''}</td><td class="qa">${acts}</td></tr>
      ${q.terms || q.notes ? `<tr class="qsub"><td colspan="6">${q.terms ? '📄 ' + esc(q.terms) : ''}${q.terms && q.notes ? '<br>' : ''}${q.notes ? '⚠ ' + esc(q.notes) : ''}</td></tr>` : ''}`; };
  const card = it => { const L = [...byItem[it.id]].sort((a, b) => qVat(a) - qVat(b)), lo = qVat(L[0]), fx = fixedOf(it), pi = P.items.find(x => x.id === it.id);
    return `<div class="card qcard"><div class="qh"><div><div class="mut" style="font-size:12px">${esc(it.code)}${it.building ? ' · ' + esc(it.building) : ''}${it.group_name ? ' · ' + esc(it.group_name) : ''}</div><b>${esc(it.name.length > 140 ? it.name.slice(0, 140) + '…' : it.name)}</b><div class="mut" style="font-size:13px">${+it.qty ? nf(it.qty) + ' ' + esc(it.unit || '') : 'مقطوعية'} · ${L.length} ${L.length === 1 ? 'عرض' : 'عروض'}</div></div>
      <div class="qfix${fx.rate > 0 ? '' : ' none'}">${fx.rate > 0 ? `<small>السعر المثبت للبند</small><b>${nf(fx.rate, 0)} ج.م</b><small>/ ${esc(it.unit || 'مقطوع')}${+it.qty ? ' · إجمالي ' + money(fx.rate * it.qty) : ''}</small><small>${fx.q ? 'من عرض ' + esc(fx.q.supplier || '') + (fx.q.option_label ? ' – ' + esc(fx.q.option_label) : '') + (fx.q.status === 'approved' ? ' ✔ معتمد' : fx.q.status === 'submitted' ? ' · لسه بانتظار الاستشاري' : fx.q.status === 'rejected' ? '<br><b style="color:var(--bad)">⚠ العرض ده اترفض – ثبّت عرض تاني</b>' : '') : RSRC[fx.src] || ''}</small>` : '<small>لسه ماتثبتش سعر للبند</small>'}</div></div>
      <div class="scroll"><table class="qt stack"><thead><tr><th>الشركة والبديل</th><th class="n">سعر الوحدة شامل الضريبة</th><th class="n">الإجمالي</th><th>صالح لحد</th><th>الحالة</th><th></th></tr></thead><tbody>${L.map(q => row(q, lo, it, fx)).join('')}</tbody></table></div>
      ${ed && pi ? `<div class="acts" style="margin-top:8px"><button data-qadd="${esc(it.id)}">+ عرض تاني للبند</button><button data-vend="${esc(it.id)}">🏢 الشركات المناسبة</button></div>` : ''}</div>`; };
  $('#main').innerHTML = `<h2>عروض الأسعار</h2><p class="mut">${intro}</p>
  <div class="kpis"><div class="kpi"><b>${Object.keys(byItem).length}</b><span>بند عليه عروض</span></div><div class="kpi${cnt('submitted') ? ' k-warn' : ''}" data-qst="submitted"><b>${cnt('submitted')}</b><span>بانتظار الاستشاري</span></div><div class="kpi" data-qst="approved"><b>${cnt('approved')}</b><span>معتمد</span></div><div class="kpi${cnt('rejected') ? ' k-bad' : ''}" data-qst="rejected"><b>${cnt('rejected')}</b><span>مرفوض</span></div></div>
  ${ed ? (F.form ? form() : '<div class="acts"><button class="p" id="qNew">+ عرض سعر جديد</button></div>') : ''}
  <div class="filters" style="margin-top:14px"><div class="sttabs" style="margin:0;max-width:100%"><div class="seg">${[['', 'الكل'], ['submitted', 'بانتظار الاستشاري'], ['approved', 'معتمد'], ['rejected', 'مرفوض'], ...(ed ? [['draft', 'مسودات']] : [])].map(([k, l]) => `<button type="button" data-qst="${k}" class="${F.st === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><input id="qQ" type="search" placeholder="بحث بالبند أو الشركة" value="${esc(F.q)}">${F.item ? `<button id="qXi">✕ ${esc(itemOf(F.item).code)}</button>` : ''}</div>
  ${items.length ? items.map(card).join('') : `<p class="mut">${Q.length ? 'مفيش عروض بالفلتر ده.' : ed ? 'لسه مفيش عروض أسعار. دوس "+ عرض سعر جديد".' : 'لسه مفيش عروض أسعار معروضة.'}</p>`}`;
  const go = async msg => { if (msg) toast(msg); await loadProject(P.id); renderQuotes(); };
  $('#qNew') && ($('#qNew').onclick = () => { F.form = { item: F.item || '' }; renderQuotes(); });
  const f = $('#qF'); if (f) { $('#qX').onclick = () => { F.form = null; renderQuotes(); }; f.scrollIntoView({ block: 'start', behavior: 'smooth' });
    f.item.onchange = () => { F.form.item = f.item.value; const it = P.items.find(x => x.id === f.item.value); if (it && !f.qty.value) f.qty.value = +it.qty || ''; };
    f.onsubmit = async e => { e.preventDefault(); const g = n => f[n].value, it = P.items.find(x => x.id === g('item')); if (!it) return toast('اختار البند');
      const v = P.vendors.find(x => x.id === g('vendor')), sup = v ? v.name : g('supplier').trim(); if (!sup) return toast('اختار الشركة أو اكتب اسمها');
      const qty = +g('qty') || +it.qty || 1, price = +g('price'); if (!(price > 0)) return toast('اكتب السعر');
      const rec = { project_id: P.id, item_id: it.id, vendor_id: v ? v.id : null, supplier: sup, option_label: g('opt').trim() || null, unit_rate: g('mode') === 't' ? Math.round(price / qty * 100) / 100 : price, qty, vat_included: f.vat.checked, quote_date: g('date') || today(), valid_until: g('valid') || null, terms: g('terms').trim() || null, notes: g('notes').trim() || null };
      $('#qGo').disabled = true; const file = f.file.files[0];
      if (file) { const m = { kind: 'quote', title: 'عرض ' + sup + (rec.option_label ? ' – ' + rec.option_label : ''), doc_date: rec.quote_date, item_id: it.id, supplier: sup, amount: qVat(rec) * qty }; await uploadDocs([file], m); if (m.ids?.[0]) rec.doc_id = m.ids[0]; }
      const old = F.form.id && Q.find(x => x.id === F.form.id); if (!old || old.status === 'draft') rec.status = f.send?.checked ? 'submitted' : 'draft';
      const { data, error } = old ? await S.sb.from('quotes').update(rec).eq('id', old.id).select().single() : await S.sb.from('quotes').insert(rec).select().single();
      if (error) { $('#qGo').disabled = false; return toast(error.message); }
      if (f.adopt.checked && !f.adopt.disabled) { const { error: e2 } = await S.sb.rpc('adopt_quote', { p_id: data.id }); if (e2) toast(e2.message); }
      F.form = null; F.item = it.id; go(old ? 'اتحفظ التعديل' + (old.status !== 'draft' && old.status !== data.status ? ' ورجع للاستشاري يراجعه' : '') : 'اتسجل العرض' + (rec.status === 'submitted' ? ' واتبعت للاستشاري' : '')); }; }
  document.querySelectorAll('[data-qst]').forEach(b => b.onclick = () => { F.st = b.dataset.qst; renderQuotes(); });
  $('#qQ').onchange = e => { F.q = e.target.value.trim(); renderQuotes(); }; $('#qXi') && ($('#qXi').onclick = () => { F.item = ''; renderQuotes(); });
  $('#main').onclick = async e => { const b = e.target.closest('button[data-qsend],button[data-qadopt],button[data-qok],button[data-qno],button[data-qback],button[data-qed],button[data-qdel],button[data-qadd]'); if (!b) return docClick(e);
    const k = Object.keys(b.dataset)[0], id = b.dataset[k], q = Q.find(x => x.id === id);
    if (k === 'qadd') { F.form = { item: id }; return renderQuotes(); }
    if (k === 'qed') { F.form = { id }; return renderQuotes(); }
    if (k === 'qsend') { const { error } = await S.sb.from('quotes').update({ status: 'submitted' }).eq('id', id); return error ? toast(error.message) : go('اتبعت للاستشاري'); }
    if (k === 'qadopt') { const it = itemOf(q.item_id); if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = `متأكد؟ ${nf(qVat(q), 0)} / ${it.unit || 'مقطوع'}`; return; } const { error } = await S.sb.rpc('adopt_quote', { p_id: id }); return error ? toast(error.message) : go('اتثبت سعر البند من العرض ده'); }
    if (k === 'qok') { const n = await askNote('اعتماد العرض – ملاحظة (اختياري)', 'مثلاً: مطابق للمواصفات', false); if (n === null) return; const { error } = await S.sb.rpc('review_quote', { p_id: id, p_status: 'approved', p_note: n || null }); return error ? toast(error.message) : go('اتعتمد العرض'); }
    if (k === 'qno') { const n = await askNote('سبب رفض العرض', 'مثلاً: المواصفات مش مطابقة / السعر أعلى من السوق'); if (!n) return; const { error } = await S.sb.rpc('review_quote', { p_id: id, p_status: 'rejected', p_note: n }); return error ? toast(error.message) : go('اترفض العرض'); }
    if (k === 'qback') { const { error } = await S.sb.rpc('review_quote', { p_id: id, p_status: 'submitted', p_note: null }); return error ? toast(error.message) : go('رجع للمراجعة'); }
    if (k === 'qdel') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } if (q.adopted) return toast('ده السعر المثبت للبند – ثبّت عرض تاني الأول'); const { error } = await S.sb.from('quotes').delete().eq('id', id); return error ? toast(error.message) : go('اتحذف العرض'); }
  };
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
  const [st, at, lv, rp] = await Promise.all([S.sb.from('staff').select('*').order('sort'), S.sb.from('staff_attendance').select('*'), S.sb.from('staff_leaves').select('*').order('from_date', { ascending: false }), S.sb.from('daily_reports').select('id,project_id,report_date,body').gte('report_date', DS(TD(today()) - 200 * 864e5)).order('report_date')]);
  if (st.error) return $('#main').innerHTML = `<div class="note">${esc(st.error.message)}</div>`;
  S.staff = { list: st.data || [], manual: at.data || [], leaves: lv.data || [], reports: rp.data || [], tab: S.staff?.tab || 'eval', range: S.staff?.range || 60, open: S.staff?.open || null };
  drawStaff();
}
function staffRecords() {
  const T = S.staff, auto = deriveAttendance(T.reports, T.list), man = Object.fromEntries(T.manual.map(x => [x.staff_id + '|' + x.work_date, x]));
  const all = auto.filter(a => !man[a.staff_id + '|' + a.date]).concat(T.manual.map(x => ({ staff_id: x.staff_id, date: x.work_date, m: tmin(x.arrival), status: x.status, project_id: x.project_id, how: x.note || 'تسجيل يدوي', src: 'manual', id: x.id })));
  const have = new Set(all.map(r => r.staff_id + '|' + r.date));
  (T.leaves || []).filter(l => l.status === 'approved').forEach(l => { for (let d = l.from_date; d <= l.to_date; d = DS(TD(d) + 864e5)) if (!have.has(l.staff_id + '|' + d)) all.push({ staff_id: l.staff_id, date: d, m: null, status: l.kind === 'absent' ? 'absent' : l.kind === 'mission' ? 'mission' : 'leave', how: LVK[l.kind], src: 'leave' }); });
  return all;
}
const LVK = { annual: 'سنوية', casual: 'عارضة', sick: 'مرضي', unpaid: 'بدون أجر', absent: 'غياب', mission: 'مأمورية' }, LVS = { requested: ['pend', 'مطلوبة'], approved: ['appr', 'معتمدة'], rejected: ['ret', 'مرفوضة'] };
const workDaysBetween = (a, b) => { let n = 0; for (let d = a; d <= b; d = DS(TD(d) + 864e5)) if (new Date(d + 'T12:00:00Z').getUTCDay() !== 5) n++; return n; };
function leavesHtml() {
  const T = S.staff, yr = today().slice(0, 4), act = T.list.filter(x => x.active), Y = (T.leaves || []).filter(l => l.status === 'approved' && l.from_date.slice(0, 4) === yr);
  const used = (id, k) => Y.filter(l => l.staff_id === id && l.kind === k).reduce((s, l) => s + +l.days, 0), nm = id => T.list.find(x => x.id === id)?.full_name || '';
  const req = (T.leaves || []).filter(l => l.status === 'requested');
  return `${req.length ? `<div class="card shortbox"><b>طلبات مستنية اعتماد (${req.length})</b>${req.map(l => `<div class="srow">${esc(nm(l.staff_id))} – ${LVK[l.kind]} ${l.days} يوم (${fmtD(l.from_date)} – ${fmtD(l.to_date)}) <button type="button" class="xs p" data-lvst="approved|${l.id}">اعتماد</button> <button type="button" class="xs" data-lvst="rejected|${l.id}">رفض</button></div>`).join('')}</div>` : ''}
  <details class="card"${(T.leaves || []).length ? '' : ' open'}><summary><b>+ تسجيل إجازة / غياب</b></summary><form id="lvF" class="grid" style="margin-top:10px"><label>الاسم<select name="sid" required>${act.map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select></label><label>النوع<select name="kind">${Object.entries(LVK).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label>من<input name="from" type="date" required value="${today()}"></label><label>إلى<input name="to" type="date" required value="${today()}"></label><label>عدد الأيام<input name="days" type="number" step="0.5" placeholder="تلقائي (من غير الجمع)"></label><label>الحالة<select name="st"><option value="approved">معتمدة</option><option value="requested">مطلوبة</option></select></label><label class="wide">ملاحظات<input name="notes"></label><div class="acts" style="margin:0"><button class="p">تسجيل</button></div></form></details>
  <h3>أرصدة ${yr}</h3><div class="scroll"><table class="stack"><thead><tr><th>الاسم</th><th class="n">سنوية (المستخدم / الرصيد)</th><th class="n">عارضة</th><th class="n">مرضي</th><th class="n">بدون أجر</th><th class="n">غياب</th><th class="n">مأمورية</th></tr></thead><tbody>${act.map(x => { const a = used(x.id, 'annual'), c = used(x.id, 'casual'), ab = used(x.id, 'absent');
    return `<tr><td data-l="الاسم"><b>${esc(x.full_name)}</b> <span class="mut" style="font-size:12px">${esc(x.title || '')}</span></td><td class="n" data-l="سنوية">${a} / <b style="color:${x.annual_leave - a < 0 ? 'var(--bad)' : 'var(--ok)'}">${x.annual_leave - a}</b></td><td class="n" data-l="عارضة">${c} / ${x.casual_leave - c}</td><td class="n" data-l="مرضي">${used(x.id, 'sick') || '–'}</td><td class="n" data-l="بدون أجر">${used(x.id, 'unpaid') || '–'}</td><td class="n" data-l="غياب" style="${ab ? 'color:var(--bad);font-weight:700' : ''}">${ab || '–'}</td><td class="n" data-l="مأمورية">${used(x.id, 'mission') || '–'}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="mut" style="font-size:12px">الرصيد السنوي الافتراضي 21 يوم سنوية و6 عارضة – يتعدل لكل فرد من "الهيكل والبيانات". الإجازة المعتمدة بتظهر في تقييم المواعيد كإجازة ومش بتتحسب تأخير.</p>
  <h3>السجل</h3>${(T.leaves || []).length ? `<div class="vlist">${T.leaves.slice(0, 80).map(l => `<div class="vrow"><div style="flex:1"><b>${esc(nm(l.staff_id))}</b> – ${LVK[l.kind]} <span class="st ${LVS[l.status][0]}">${LVS[l.status][1]}</span><div class="mut" style="font-size:12px">${fmtD(l.from_date)}${l.to_date !== l.from_date ? ' – ' + fmtD(l.to_date) : ''} · ${l.days} يوم${l.notes ? ' · ' + esc(l.notes) : ''}</div></div><button type="button" class="danger xs" data-lvdel="${l.id}">✕</button></div>`).join('')}</div>` : '<p class="mut">مفيش إجازات مسجلة.</p>'}`;
}
function bindLeaves() {
  const f = $('#lvF'); if (f) f.onsubmit = async e => { e.preventDefault(); const g = n => f[n].value; if (g('to') < g('from')) return toast('تاريخ النهاية قبل البداية');
    const { error } = await S.sb.from('staff_leaves').insert({ staff_id: g('sid'), kind: g('kind'), from_date: g('from'), to_date: g('to'), days: g('days') ? +g('days') : workDaysBetween(g('from'), g('to')), status: g('st'), notes: g('notes').trim() || null }); if (error) return toast(error.message); toast('اتسجلت'); renderStaff(); };
  $('#main').querySelectorAll('[data-lvst]').forEach(b => b.onclick = async () => { const [st, id] = b.dataset.lvst.split('|'); const { error } = await S.sb.from('staff_leaves').update({ status: st }).eq('id', id); if (error) return toast(error.message); renderStaff(); });
  $('#main').querySelectorAll('[data-lvdel]').forEach(b => b.onclick = async () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } const { error } = await S.sb.from('staff_leaves').delete().eq('id', b.dataset.lvdel); if (error) return toast(error.message); renderStaff(); });
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
  <div class="scroll"><table class="stack sedt"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>القسم</th><th>المشروع</th><th>المدير المباشر</th><th>الأسماء في التقارير</th><th>اسم الواتساب</th><th>بداية الدوام</th><th>سماح (د)</th><th>سنوية</th><th>عارضة</th><th>نشط</th></tr></thead><tbody>${T.list.map(x => `<tr data-sid="${x.id}"><td data-l="الاسم"><input data-k="full_name" value="${esc(x.full_name)}"></td><td data-l="الوظيفة"><input data-k="title" value="${esc(x.title || '')}"></td><td data-l="القسم"><input data-k="department" value="${esc(x.department || '')}" list="deptL"></td><td data-l="المشروع"><select data-k="project_id">${opts(x.project_id, S.projects.map(p => [p.id, p.name]), 'الشركة')}</select></td><td data-l="المدير"><select data-k="manager_id">${opts(x.manager_id, T.list.filter(y => y.id !== x.id).map(y => [y.id, y.full_name]))}</select></td><td data-l="أسماء التقارير"><input data-k="aliases" value="${esc((x.aliases || []).join('، '))}"></td><td data-l="واتساب"><input data-k="wa_name" value="${esc(x.wa_name || '')}" dir="ltr"></td><td data-l="بداية الدوام"><input data-k="shift_start" type="time" value="${String(x.shift_start).slice(0, 5)}"></td><td data-l="سماح"><input data-k="grace_min" type="number" min="0" value="${x.grace_min}" style="width:70px"></td><td data-l="سنوية"><input data-k="annual_leave" type="number" value="${x.annual_leave ?? 21}" style="width:60px"></td><td data-l="عارضة"><input data-k="casual_leave" type="number" value="${x.casual_leave ?? 6}" style="width:60px"></td><td data-l="نشط"><input data-k="active" type="checkbox"${x.active ? ' checked' : ''} style="width:auto;min-height:0"></td></tr>`).join('')}</tbody></table></div>
  <datalist id="deptL">${[...new Set(T.list.map(x => x.department).filter(Boolean)).add('الإدارة').add('التنفيذ').add('المكتب الفني').add('الماليات')].map(d => `<option value="${esc(d)}">`).join('')}</datalist>
  <div class="acts"><button class="p" id="stSave">حفظ التعديلات</button><button id="stAdd">+ فرد جديد</button></div>`;
  $('#main').innerHTML = `<h2>فريق العمل</h2><p class="mut">🔒 الصفحة دي بتظهر لمدير النظام بس، ومحدش تاني يقدر يشوفها أو يقرا بياناتها.</p>
  <div class="filters"><div class="seg" style="flex:0 0 auto"><button type="button" data-tab="eval" class="${T.tab === 'eval' ? 'on' : ''}">تقييم المواعيد</button><button type="button" data-tab="leaves" class="${T.tab === 'leaves' ? 'on' : ''}">الإجازات والغياب</button><button type="button" data-tab="struct" class="${T.tab === 'struct' ? 'on' : ''}">الهيكل والبيانات</button></div>${T.tab === 'eval' ? `<select id="stR" style="max-width:200px">${[[30, 'آخر 30 يوم'], [60, 'آخر 60 يوم'], [90, 'آخر 90 يوم'], [180, 'آخر 6 شهور']].map(([v, l]) => `<option value="${v}"${v === T.range ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
  ${T.tab === 'eval' ? evalHtml : T.tab === 'leaves' ? leavesHtml() : structHtml}`;
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; drawStaff(); });
  $('#stR') && ($('#stR').onchange = e => { T.range = +e.target.value; drawStaff(); });
  if (T.tab === 'leaves') return bindLeaves();
  if (T.tab === 'eval') {
    $('#main').querySelector('.sev').onclick = e => { const tr = e.target.closest('tr.pick'); if (tr && !e.target.closest('.sdet')) { T.open = T.open === tr.dataset.sid ? null : tr.dataset.sid; drawStaff(); } };
    const f = $('#manF'); if (f) f.onsubmit = async ev => { ev.preventDefault(); const d = new FormData(f), row = { staff_id: T.open, work_date: d.get('date'), status: d.get('status'), arrival: d.get('status') === 'present' ? d.get('arrival') || null : null, note: d.get('note') || null };
      const { error } = await S.sb.from('staff_attendance').upsert(row, { onConflict: 'staff_id,work_date' }); if (error) return toast(error.message); toast('اتسجل'); renderStaff(); };
    $('#main').querySelectorAll('[data-delman]').forEach(b => b.onclick = async () => { const { error } = await S.sb.from('staff_attendance').delete().eq('id', b.dataset.delman); if (error) return toast(error.message); toast('اتمسح التسجيل اليدوي'); renderStaff(); });
  } else {
    $('#stAdd').onclick = async () => { const { error } = await S.sb.from('staff').insert({ full_name: 'فرد جديد', sort: Math.max(0, ...T.list.map(x => x.sort)) + 1 }); if (error) return toast(error.message); renderStaff(); };
    $('#stSave').onclick = async () => { const rows = [...document.querySelectorAll('.sedt tr[data-sid]')].map(tr => { const g = k => tr.querySelector(`[data-k=${k}]`);
        return { id: tr.dataset.sid, full_name: g('full_name').value.trim() || 'بدون اسم', title: g('title').value.trim() || null, department: g('department').value.trim() || null, project_id: g('project_id').value || null, manager_id: g('manager_id').value || null, aliases: g('aliases').value.split(/[،,]/).map(x => x.trim()).filter(Boolean), wa_name: g('wa_name').value.trim() || null, shift_start: g('shift_start').value || '08:00', grace_min: +g('grace_min').value || 0, annual_leave: +g('annual_leave').value || 0, casual_leave: +g('casual_leave').value || 0, active: g('active').checked }; });
      const { error } = await S.sb.from('staff').upsert(rows); if (error) return toast('مقدرتش أحفظ: ' + error.message); toast('اتحفظ الهيكل'); renderStaff(); };
  }
}
function staffDetail(e, recs) {
  const L = [...recs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), lim = tmin(e.x.shift_start) + e.x.grace_min, pj = id => S.projects.find(p => p.id === id)?.name || '';
  return `<div class="sdbox"><form id="manF" class="grid"><label>اليوم<input type="date" name="date" value="${today()}" required></label><label>الحالة<select name="status"><option value="present">حضور</option><option value="absent">غياب</option><option value="leave">إجازة</option><option value="mission">مأمورية</option></select></label><label>موعد الوصول<input type="time" name="arrival"></label><label>ملاحظة<input name="note"></label><div class="acts" style="margin:0;align-self:end"><button class="p">تسجيل / تصحيح يوم</button></div></form>
  <div class="scroll" style="margin-top:10px;max-height:320px;overflow:auto"><table><thead><tr><th>اليوم</th><th>المشروع</th><th class="n">الوصول</th><th>المصدر</th><th></th></tr></thead><tbody>${L.map(r => `<tr><td>${r.date}</td><td>${esc(pj(r.project_id))}</td><td class="n" style="color:${r.status && r.status !== 'present' ? 'inherit' : r.m > lim ? 'var(--bad)' : 'var(--ok)'}">${r.status && r.status !== 'present' ? ({ absent: 'غياب', leave: 'إجازة', mission: 'مأمورية' })[r.status] : tfmt(r.m)}</td><td class="mut">${esc(r.how)}</td><td>${r.src === 'manual' ? `<button type="button" data-delman="${r.id}" style="min-height:30px;padding:0 10px;font-size:12px">مسح</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">مفيش تسجيلات في الفترة دي.</td></tr>'}</tbody></table></div></div>`;
}

/* ---------------- admin: members ---------------- */
async function adminFn(body) { const { data, error } = await S.sb.functions.invoke('admin-users', { body }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} return { error: m }; } return data || {}; }
const ORG = { resan: 'فريق ريسان', consultant: 'الاستشاري', owner: 'المالك', subcontractor: 'مقاول باطن', other: 'جهة أخرى' };
const MODS = { construction: { name: 'Construction – المقاولات', note: 'الدور بيتحدد لكل مشروع' }, ops: { name: 'إدارة التشغيل – المولات', pos: { manager: 'مدير التشغيل (صلاحية كاملة)', accountant: 'محاسب / تحصيل', viewer: 'متابعة فقط (قراءة)' } }, study: { name: 'دراسة المشروعات – دراسات الجدوى', pos: { editor: 'إعداد الدراسات (إضافة وتعديل)', viewer: 'اطلاع على الدراسات فقط' } } };
const ORGROLES = { resan: ['site', 'tech', 'finance', 'management', 'store'], consultant: ['consultant'], owner: ['owner'], subcontractor: ['site'], other: Object.keys(ROLE) };
function userModsForm(u, mem, um) {
  const org = u.org || 'resan', hasC = S.projects.some(p => mem[u.id + '|' + p.id]) || !u.id, opsPos = um[u.id] || (u.ops ? 'manager' : ''), stPos = (S.umStudy || {})[u.id] || '';
  return `<label class="wide">الجهة<select name="org">${Object.entries(ORG).map(([k, l]) => `<option value="${k}"${org === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
  <div class="wide modbox"><label class="modh"><input type="checkbox" name="m_c"${hasC ? ' checked' : ''}> <b>1. ${MODS.construction.name}</b></label><div class="modb" data-mb="c">${S.projects.map(p => `<label>${esc(p.name)}<select name="r_${p.id}" data-rs><option value="">— ملوش دخول —</option>${Object.entries(ROLE).map(([k, l]) => `<option value="${k}"${mem[u.id + '|' + p.id] === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}<p class="mut" style="margin:0;font-size:12px">${MODS.construction.note}</p></div></div>
  <div class="wide modbox"><label class="modh"><input type="checkbox" name="m_o"${opsPos ? ' checked' : ''}> <b>2. ${MODS.ops.name}</b></label><div class="modb" data-mb="o"><label>الوظيفة<select name="opos">${Object.entries(MODS.ops.pos).map(([k, l]) => `<option value="${k}"${opsPos === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div></div>
  <div class="wide modbox"><label class="modh"><input type="checkbox" name="m_s"${stPos ? ' checked' : ''}> <b>3. ${MODS.study.name}</b></label><div class="modb" data-mb="s"><label>الصلاحية<select name="spos">${Object.entries(MODS.study.pos).map(([k, l]) => `<option value="${k}"${stPos === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div></div>`;
}
function bindModsForm(f) {
  const sync = () => { f.querySelector('[data-mb=c]').hidden = !f.m_c.checked; f.querySelector('[data-mb=o]').hidden = !f.m_o.checked; f.querySelector('[data-mb=s]').hidden = !f.m_s.checked;
    const allowed = ORGROLES[f.org.value] || Object.keys(ROLE); f.querySelectorAll('[data-rs] option[value]').forEach(o => { if (o.value) o.hidden = !allowed.includes(o.value); }); };
  f.m_c.onchange = f.m_o.onchange = f.m_s.onchange = sync; f.org.onchange = () => { const al = ORGROLES[f.org.value]; f.querySelectorAll('[data-rs]').forEach(s => { if (s.value && !al.includes(s.value)) s.value = ''; if (!s.value && al.length === 1 && f.m_c.checked) s.value = al[0]; }); sync(); }; sync();
}
const readMods = f => ({ org: f.org.value, roles: f.m_c.checked ? S.projects.map(p => ({ project_id: p.id, role: f['r_' + p.id].value })).filter(r => r.role) : [], ops: f.m_o.checked ? f.opos.value : null, study: f.m_s.checked ? f.spos.value : null });
function newUser(ctx) {
  const gen = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  const d = document.createElement('dialog'); d.className = 'adlg';
  d.innerHTML = `<form><div class="dh"><h3 style="margin:0">مستخدم جديد</h3><button type="button" class="dx">✕</button></div><div class="grid">
    <label class="wide">الاسم<input name="n" required></label><label class="wide">الإيميل (اسم الدخول)<input name="e" type="email" dir="ltr" required></label>
    <label class="wide">كلمة السر<div style="display:flex;gap:6px"><input name="p" dir="ltr" required minlength="8" value="${gen()}" style="flex:1"><button type="button" id="pg" class="xs">توليد</button></div></label>
    ${userModsForm({}, ctx.mem, ctx.um)}</div><p class="mut" style="font-size:12px">اختار الأقسام اللي هيدخل عليها، وبعدين وظيفته في كل قسم. لو له قسم واحد بيفتح عليه على طول، ولو أكتر بتظهر له الشاشة الرئيسية بالأقسام بتاعته بس.</p><div class="acts"><button class="p">إنشاء المستخدم</button></div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form'), close = () => { d.close(); d.remove(); }; bindModsForm(f);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.dx')) close(); if (e.target.id === 'pg') f.p.value = gen(); });
  f.onsubmit = async e => { e.preventDefault(); const m = readMods(f); if (!m.roles.length && !m.ops && !m.study) return toast('اختار قسم ووظيفة واحدة على الأقل'); const b = f.querySelector('button.p'); b.disabled = true;
    const r = await adminFn({ action: 'create', full_name: f.n.value.trim(), email: f.e.value.trim(), password: f.p.value, org: m.org, roles: m.roles, modules: [m.ops && { module: 'ops', position: m.ops }, m.study && { module: 'study', position: m.study }].filter(Boolean) });
    if (r.error) { b.disabled = false; return toast(r.error); }
    const msg = `رابط النظام: ${location.origin}\nالإيميل: ${f.e.value.trim()}\nكلمة السر: ${f.p.value}`;
    f.innerHTML = `<div class="dh"><h3 style="margin:0">✓ اتعمل المستخدم</h3><button type="button" class="dx">✕</button></div><p>ابعت له البيانات دي:</p><pre class="cred" dir="auto">${esc(msg)}</pre><div class="acts"><button type="button" class="p" id="cp">نسخ</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">إرسال واتساب</a></div>`;
    d.querySelector('#cp').onclick = () => navigator.clipboard?.writeText(msg).then(() => toast('اتنسخ'));
    d.addEventListener('close', () => renderAdmin(), { once: true }); };
}
function editUser(u, ctx) {
  const d = document.createElement('dialog'); d.className = 'adlg';
  d.innerHTML = `<form><div class="dh"><div><h3 style="margin:0">${esc(u.full_name || u.email)}</h3><div class="mut" style="font-size:12px" dir="ltr">${esc(u.email || '')}</div></div><button type="button" class="dx">✕</button></div><div class="grid"><label class="wide">الاسم<input name="n" value="${esc(u.full_name || '')}"></label>${userModsForm(u, ctx.mem, ctx.um)}</div>
    <div class="acts"><button class="p">حفظ</button><button type="button" id="pw">تغيير كلمة السر</button></div></form>`;
  document.body.append(d); d.showModal(); const f = d.querySelector('form'), close = () => { d.close(); d.remove(); }; bindModsForm(f);
  d.addEventListener('click', async e => { if (e.target === d || e.target.closest('.dx')) close();
    if (e.target.id === 'pw') { const v = prompt('كلمة السر الجديدة (8 حروف على الأقل)'); if (v) toast((await adminFn({ action: 'password', user_id: u.id, password: v })).error || 'اتغيرت كلمة السر'); } });
  f.onsubmit = async e => { e.preventDefault(); const m = readMods(f), b = f.querySelector('button.p'); b.disabled = true; const errs = [];
    const r1 = await S.sb.from('profiles').update({ full_name: f.n.value.trim() || u.full_name, org: m.org, ops: false }).eq('id', u.id); if (r1.error) errs.push(r1.error.message);
    for (const p of S.projects) { const role = m.roles.find(x => x.project_id === p.id)?.role, old = ctx.mem[u.id + '|' + p.id]; if (role === old) continue;
      const r = role ? await S.sb.from('project_members').upsert({ user_id: u.id, project_id: p.id, role }) : await S.sb.from('project_members').delete().eq('user_id', u.id).eq('project_id', p.id); if (r.error) errs.push(r.error.message); }
    const r2 = m.ops ? await S.sb.from('user_modules').upsert({ user_id: u.id, module: 'ops', position: m.ops }) : await S.sb.from('user_modules').delete().eq('user_id', u.id).eq('module', 'ops'); if (r2.error) errs.push(r2.error.message);
    const r3 = m.study ? await S.sb.from('user_modules').upsert({ user_id: u.id, module: 'study', position: m.study }) : await S.sb.from('user_modules').delete().eq('user_id', u.id).eq('module', 'study'); if (r3.error) errs.push(r3.error.message);
    if (errs.length) { b.disabled = false; return toast('مقدرتش أحفظ: ' + errs[0]); } toast('اتحفظ'); close(); renderAdmin(); };
}
async function renderAdmin() {
  const [{ data: users }, { data: mem }, { data: ums }] = await Promise.all([S.sb.from('profiles').select('*').order('email'), S.sb.from('project_members').select('*'), S.sb.from('user_modules').select('*')]);
  const M = {}; (mem || []).forEach(m => M[m.user_id + '|' + m.project_id] = m.role); const UM = {}; (ums || []).filter(x => x.module === 'ops').forEach(x => UM[x.user_id] = x.position); S.umStudy = {}; (ums || []).filter(x => x.module === 'study').forEach(x => S.umStudy[x.user_id] = x.position);
  const ctx = { mem: M, um: UM }, U = users || [];
  const chips = u => { const c = S.projects.filter(p => M[u.id + '|' + p.id]).map(p => `<span class="mchip c">🏗 ${esc(p.name)}: ${ROLE[M[u.id + '|' + p.id]]}</span>`), o = UM[u.id] || (u.ops ? 'manager' : '');
    return u.is_admin ? '<span class="mchip a">مدير النظام – كل الأقسام</span>' : (c.join('') + (o ? `<span class="mchip o">🏬 ${MODS.ops.pos[o].split(' (')[0]}</span>` : '') + (S.umStudy[u.id] ? `<span class="mchip s">📊 دراسة المشروعات${S.umStudy[u.id] === 'viewer' ? ' (اطلاع)' : ''}</span>` : '')) || '<span class="mut">ملوش أقسام</span>'; };
  const groups = Object.keys(ORG).map(k => [k, U.filter(u => (u.org || 'resan') === k)]).filter(([, L]) => L.length);
  $('#main').innerHTML = `<div class="sthead"><h2 style="margin:0">المستخدمين والصلاحيات</h2><button id="uNew" class="p">+ مستخدم جديد</button></div>
  <p class="mut">كل مستخدم: الجهة اللي تبعها (فريق ريسان، الاستشاري، المالك…)، وبعدين الأقسام اللي يدخل عليها، ووظيفته في كل قسم. اضغط على أي مستخدم لتعديله.</p>
  ${groups.map(([k, L]) => `<h3>${ORG[k]} <span class="mut" style="font-size:14px">(${L.length})</span></h3><div class="vlist">${L.map(u => `<button type="button" class="vrow urow" data-ue="${u.id}"><div style="flex:1;min-width:0;text-align:right"><b>${esc(u.full_name || '')}</b> <span class="mut" style="font-size:12px" dir="ltr">${esc(u.email || '')}</span><div class="mchips">${chips(u)}</div></div><span class="mut">تعديل ›</span></button>`).join('')}</div>`).join('')}`;
  $('#uNew').onclick = () => newUser(ctx);
  $('#main').onclick = e => { const b = e.target.closest('[data-ue]'); if (!b) return; const u = U.find(x => x.id === b.dataset.ue); if (u.is_admin && u.id !== S.user.id) return toast('ده مدير النظام وله كل الصلاحيات'); if (u.is_admin) return toast('حسابك مدير النظام – كل الأقسام'); editUser(u, ctx); };
}

/* ---------------- BOQ & cost ---------------- */
const lacks = r => !(+r.qty > 0) || !(r.rate > 0) || !!r.reprice;
const SCOPE = { full: 'توريد ومصنعيات', labor: 'مصنعيات فقط', supply: 'توريد فقط' };
const updVal = r => r.rate > 0 ? (+r.qty > 0 ? +r.qty * r.rate : r.rate) : 0;
function boqSummary() {
  const P = S.P, rows = S.bq.b ? P.items.filter(r => r.building === S.bq.b) : P.items, upd = rows.reduce((s, r) => s + updVal(r), 0), pr = rows.filter(r => r.rate > 0).length;
  const CL = S.bq.b ? [] : P.contract || [], ctot = CL.reduce((s, l) => s + +l.value, 0);
  // comparison groups: contract sections can span several system phases → merge overlapping phase sets
  const grp = P.phaseProg.map(x => ({ ns: [x.n], c: 0 }));
  CL.forEach(l => { const ns = (l.phase_ns || []).map(Number); if (!ns.length) return; const hit = grp.filter(g => g.ns.some(n => ns.includes(n))); const m = { ns: [...new Set([...ns, ...hit.flatMap(g => g.ns)])].sort((a, b) => a - b), c: hit.reduce((s, g) => s + g.c, 0) + +l.value };
    hit.forEach(g => grp.splice(grp.indexOf(g), 1)); grp.push(m); });
  grp.sort((a, b) => a.ns[0] - b.ns[0]);
  const LG = S.bq.b ? [] : P.ledger || [], hasA = LG.length > 0, atot = LG.reduce((s, x) => s + x.expense, 0), unph = LG.filter(x => x.phase_n == null).reduce((s, x) => s + x.expense, 0), rtot = LG.reduce((s, x) => s + x.revenue, 0);
  const G = grp.map(g => { const L = rows.filter(r => g.ns.includes(r.phase_n)), ui = L.reduce((s, r) => s + updVal(r), 0), a = LG.filter(x => g.ns.includes(x.phase_n)).reduce((s, x) => s + x.expense, 0); return { ...g, name: g.ns.map(n => n + '. ' + (P.phaseProg.find(x => x.n === n)?.name || '')).join(' + '), L, ui, a, u: Math.max(ui, a), byA: a > ui, pr: L.filter(r => r.rate > 0).length }; });
  const PB = n => +(P.phases || []).find(x => x.n === n)?.budget_rev || 0, PS = ns => [...new Set(ns.map(n => (P.phases || []).find(x => x.n === n)?.budget_rev_src).filter(Boolean))].join(' · ');
  G.forEach(g => { g.bg = S.bq.b ? 0 : g.ns.reduce((s, n) => s + PB(n), 0); g.bsrc = PS(g.ns); });
  const btot = G.reduce((s, g) => s + g.bg, 0), hasB = btot > 0;
  const updT = G.reduce((s, g) => s + g.u, 0), byAn = G.filter(g => g.byA).length;
  const dv = (a, c) => c ? `<span dir="ltr" style="unicode-bidi:isolate;color:${a > c ? 'var(--bad)' : 'var(--ok)'}">${a > c ? '+' : ''}${nf(a - c, 0)}<small> (${a > c ? '+' : ''}${Math.round((a - c) / c * 100)}%)</small></span>` : '–';
  const hasC = CL.length > 0, ci = rows.reduce((s2, r) => s2 + r.camt, 0), nz = rows.filter(r => !(r.camt > 0)).length;
  $('#bqSum').innerHTML = `<div class="kp" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
  ${hasC ? `<div class="k lyr c1"><i>1</i><b>${money(ctot)}</b><span>التسعير التعاقدي (قيمة العقد)${ci ? ` · موزّع على البنود ${Math.round(ci / ctot * 100)}%${nz ? ` · ${nz} بند من غير سعر تعاقدي` : ''}` : ' · لسه مش موزّع على البنود'}</span></div>` : ''}
  ${hasB ? `<div class="k lyr cb"><i>★</i><b>${money(btot)}</b><span>الميزانية التقديرية المحدّثة${hasC ? ` · ${btot >= ctot ? '+' : ''}${Math.round((btot - ctot) / ctot * 100)}% عن العقد (العقد زي ما هو)` : ''}</span></div>` : ''}
  <div class="k lyr c2"><i>2</i><b>${money(updT)}</b><span>التسعير المحدّث${hasC ? ` · ${updT >= ctot ? '+' : ''}${Math.round((updT - ctot) / ctot * 100)}% عن العقد` : ''} · ${pr} من ${rows.length} بند متسعّر والباقي صفر${byAn ? ` · ${byAn} مرحلة محسوبة بالفعلي لأنه أكبر` : ''}</span></div>
  ${hasA ? `<div class="k lyr c3"><i>3</i><b>${money(atot)}</b><span>التكلفة الفعلية من الحسابات${hasC ? ` · ${Math.round(atot / ctot * 100)}% من العقد` : ''}${rtot ? ` · المحصّل ${money(rtot)}` : ''}</span></div>` : ''}</div>
  <div class="scroll" style="margin-top:14px"><table class="stack"><thead><tr><th>المرحلة</th><th class="n">البنود</th><th class="n">متحدّث</th>${hasC ? '<th class="n">التعاقدي</th>' : ''}${hasB ? `<th class="n">الميزانية التقديرية</th>${hasC ? '<th class="n">الميزانية عن العقد</th>' : ''}` : ''}<th class="n">المحدّث</th>${hasC ? '<th class="n">المحدّث عن العقد</th>' : ''}${hasA ? `<th class="n">الفعلي المصروف</th>${hasC ? '<th class="n">المصروف من العقد</th>' : ''}` : ''}</tr></thead><tbody>${G.map(x => `<tr class="pick${x.ns.length === 1 && String(x.ns[0]) === S.bq.ph ? ' on' : ''}" data-ph="${x.ns[0]}"><td data-l="المرحلة">${esc(x.name)}${x.ns.length > 1 ? ' <span class="tag">مجمّعة في العقد</span>' : ''}${hasC && !x.c ? ' <span class="tag">مش في العقد</span>' : ''}</td><td class="n" data-l="البنود">${x.L.length}</td><td class="n" data-l="متحدّث">${x.pr}</td>${hasC ? `<td class="n" data-l="التعاقدي">${x.c ? nf(x.c, 0) : '–'}</td>` : ''}${hasB ? `<td class="n" data-l="الميزانية التقديرية"${x.bsrc ? ` title="${esc(x.bsrc)}"` : ''}>${x.bg ? nf(x.bg, 0) : '–'}</td>${hasC ? `<td class="n" data-l="الميزانية عن العقد">${x.bg && x.c ? dv(x.bg, x.c) : '–'}</td>` : ''}` : ''}<td class="n" data-l="المحدّث">${x.u ? nf(x.u, 0) : '–'}${x.byA ? '<div class="rsrc" title="البنود المتسعّرة ' + nf(x.ui, 0) + '">من التكلفة الفعلية</div>' : ''}</td>${hasC ? `<td class="n" data-l="المحدّث عن العقد">${x.u && x.c ? dv(x.u, x.c) : '–'}</td>` : ''}${hasA ? `<td class="n" data-l="الفعلي">${x.a ? nf(x.a, 0) : '–'}</td>${hasC ? `<td class="n" data-l="من العقد">${x.a && x.c ? pctTag(x.a / x.c) : '–'}</td>` : ''}` : ''}</tr>`).join('')}
  <tr class="tot"><td data-l="">الإجمالي</td><td class="n" data-l="البنود">${rows.length}</td><td class="n" data-l="متحدّث">${pr}</td>${hasC ? `<td class="n" data-l="التعاقدي">${nf(ctot, 0)}</td>` : ''}${hasB ? `<td class="n" data-l="الميزانية التقديرية">${nf(btot, 0)}</td>${hasC ? `<td class="n" data-l="الميزانية عن العقد">${dv(btot, ctot)}</td>` : ''}` : ''}<td class="n" data-l="المحدّث">${nf(updT, 0)}</td>${hasC ? `<td class="n" data-l="المحدّث عن العقد">${dv(updT, ctot)}</td>` : ''}${hasA ? `<td class="n" data-l="الفعلي">${nf(atot, 0)}</td>${hasC ? `<td class="n" data-l="من العقد">${pctTag(atot / ctot)}</td>` : ''}` : ''}</tr></tbody></table></div>
  <p class="mut" style="margin-top:6px">${hasB ? 'الميزانية التقديرية = الميزانية المحدّثة لكل مرحلة (من تقرير المشروع أو من إعدادات المرحلة)، ومالهاش أي تأثير على قيمة العقد. ' : ''}التعاقدي = قيمة العقد موزّعة على البنود. المحدّث = مجموع البنود اللي ليها سعر محدّث (من التحديثات وعروض الأسعار المعتمدة)، والبند اللي مالوش سعر بصفر. لو المصروف الفعلي على المرحلة أكبر من كده، المرحلة بتتحسب بتكلفتها الفعلية. الفعلي = المصروف من شيت الحسابات / أودو.</p>
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
      const m = T(r[cM]), d = r[cDt]; let dt = null, alt = null; if (d instanceof Date) { dt = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const [y, mo, da] = dt.split('-'); if (+da <= 12 && da !== mo) alt = `${y}-${da}-${mo}`; } else { const x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(T(d)); if (x) dt = `${x[3]}-${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}`; }
      out.push({ project_id: pid, entry_date: dt, description: T(r[cD]).slice(0, 300) || null, supplier: cSup >= 0 ? T(r[cSup]) || null : null, main_phase: m && m !== '=' ? m : null, sub_phase: T(r[cS]) && T(r[cS]) !== '=' ? T(r[cS]) : null, expense: e, revenue: rv, phase_n: PH[m.replace(/\s+/g, '_')] ?? null, source: 'excel', batch: file.name + ' · ' + today(), _alt: alt }); });
    if (out.length) break;
  }
  if (!out.length) return box.innerHTML = '<div class="note">مش لاقي في الملف شيت فيه أعمدة المشروع والمرحلة الأساسية والإيرادات والمصروفات.</div>';
  // إكسل أحياناً بيخزّن التاريخ يوم/شهر مقلوب: التاريخ اللي يومه ≤ 12 بنختار له القراءة الأقرب للتواريخ الأكيدة حواليه
  const td = today(), ms = x => Date.parse(x); let swapped = 0;
  out.forEach((x, i) => { if (!x._alt) return; const nb = []; for (let j = Math.max(0, i - 15); j <= Math.min(out.length - 1, i + 15); j++) if (j !== i && out[j].entry_date && !out[j]._alt) nb.push(ms(out[j].entry_date));
    let pick = x.entry_date; if (pick > td && x._alt <= td) pick = x._alt; else if (nb.length && !(x._alt > td)) { nb.sort((a, b) => a - b); const md = nb[nb.length >> 1]; if (Math.abs(ms(x._alt) - md) < Math.abs(ms(x.entry_date) - md)) pick = x._alt; }
    if (pick !== x.entry_date) { x.entry_date = pick; swapped++; } });
  out.forEach(x => delete x._alt);
  const sum = pid => out.filter(x => x.project_id === pid), tot = (L, k) => nf(L.reduce((s, x) => s + x[k], 0), 0);
  box.innerHTML = `<div class="card">${S.projects.map(p => { const L = sum(p.id); return L.length ? `<div><b>${esc(p.name)}</b>: ${L.length} قيد · مصروف ${tot(L, 'expense')} · إيراد ${tot(L, 'revenue')}</div>` : ''; }).join('')}${swapped ? `<div class="mut">اتصحّح ${swapped} تاريخ كان متسجّل يوم/شهر مقلوب في الإكسل.</div>` : ''}<div class="acts"><button class="ok" id="lgGo">استبدال بيانات الحسابات</button><button id="lgNo">إلغاء</button></div></div>`;
  $('#lgNo').onclick = () => box.innerHTML = '';
  $('#lgGo').onclick = async () => { $('#lgGo').disabled = true; const pids = [...new Set(out.map(x => x.project_id))]; let err = null;
    for (const pid of pids) { if (!can('ledger', pid)) continue; const { error } = await S.sb.from('ledger_entries').delete().eq('project_id', pid).eq('source', 'excel'); err = err || error;
      const L = out.filter(x => x.project_id === pid); for (let k = 0; k < L.length && !err; k += 500) { const { error: e2 } = await S.sb.from('ledger_entries').insert(L.slice(k, k + 500)); err = e2; } }
    if (err) { $('#lgGo').disabled = false; return toast('حصلت مشكلة: ' + err.message); } toast('اتحدثت بيانات الحسابات'); S.P.contract = null; location.hash.endsWith('/acct') ? renderAcct() : renderBoq(); };
}
async function renderBoq() {
  if (!S.P.contract) { const [c, l] = await Promise.all([S.sb.from('contract_lines').select('*').eq('project_id', S.P.id).order('sort'), S.sb.rpc('ledger_summary', { p_project: S.P.id })]); S.P.contract = c.data || []; S.P.ledger = (l.data || []).map(x => ({ ...x, expense: +x.expense, revenue: +x.revenue })); }
  const P = S.P, multi = (P.proj.buildings || []).length > 1, ed = can('editBoq', P.id), F = S.bq;
  $('#main').innerHTML = `<h2>المقايسة والتكلفة</h2><p class="mut">كل البنود محسوبة <b>توريد ومصنعيات</b> – بند متكامل بالخامات والمصنعية – والسعر المحدّث لازم يكون سعر الوحدة المتكامل. البنود اللي سعرها المسجّل كان مصنعية بس عليها علامة "محتاج سعر متكامل" ومتسجّلة في مهام المكتب الفني لحد ما تتسعّر من جديد.</p><div id="bqSum"></div>
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
    const R = ch.filter(([, v]) => 'rate' in v).map(([item_id, v]) => ({ item_id, rate: v.rate, rate_source: 'manual', rate_doc_id: null, rate_updated_at: new Date().toISOString() })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = error; }
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
  $('#bqT').innerHTML = `<div class="scroll"><table class="stack it bq"><thead><tr><th>الكود</th><th>البند</th>${multi ? '<th>المبنى</th>' : ''}<th>الوحدة</th><th class="n">الكمية</th><th class="n">المنفذ</th><th class="n">السعر التعاقدي</th><th class="n">السعر المحدّث</th><th class="n">الإجمالي التعاقدي</th><th class="n">الإجمالي المحدّث</th></tr></thead><tbody>${keys.map(k => { const L = rows.filter(r => r.phase_n + '|' + r.group_name === k), [n, g] = [L[0].phase_n, L[0].group_name], sub = L.reduce((s, r) => s + r.val, 0), csub = L.reduce((s, r) => s + r.camt, 0);
    return `<tr class="gh"><td colspan="${cols - 2}">${n}. ${esc(P.phaseProg.find(x => x.n === n)?.name || '')} – ${esc(g)} <span class="mut">(${L.length})</span></td><td class="n">${csub ? nf(csub, 0) : ''}</td><td class="n">${sub ? nf(sub, 0) : ''}</td></tr>` + L.map(r => `<tr data-id="${esc(r.id)}" class="${lacks(r) ? 'lack' : ''}"><td data-l="الكود">${esc(r.code)}</td><td data-l="البند" title="${esc(r.description || '')}">${esc(r.name)}${(() => { const n = (P.docs || []).filter(d => d.item_id === r.id).length; return n ? ` <a href="#p/${P.id}/docs" class="clip" data-docitem="${esc(r.id)}" title="مستندات وعروض أسعار البند">📎${n}</a>` : ''; })()}${vendLink(r)}${lacks(r) ? gChip(r) : ''}${r.reprice ? ' <span class="tag" style="color:var(--bad)">محتاج سعر متكامل</span>' : ''}${r.scope && r.scope !== 'full' ? ` <span class="tag">${SCOPE[r.scope]}</span>` : ''}${r.note ? `<div class="mut" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>${multi ? `<td data-l="المبنى">${esc(r.building)}</td>` : ''}<td data-l="الوحدة">${esc(r.unit)}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'qty') ? ' chg' : ''}" data-l="الكمية">${cell(r, 'qty')}</td>${exCell(r)}<td class="n${ed ? ' ed' : ''}${ed && chg(r, 'crate') ? ' chg' : ''}" data-l="السعر التعاقدي">${cell(r, 'crate')}</td><td class="n${ed ? ' ed' : ''}${ed && chg(r, 'rate') ? ' chg' : ''}" data-l="السعر المحدّث">${cell(r, 'rate')}${!ed && r.rate > 0 && r.rsrc ? `<div class="rsrc" title="${r.rdate ? 'آخر تحديث ' + r.rdate.slice(0, 10) : ''}">${({ quote: 'من عرض سعر', manual: 'تحديث يدوي', excel: 'من ملف إكسل', sheet: 'من الشيت الأصلي' })[r.rsrc] || ''}</div>` : ''}</td><td class="n ctot" data-l="الإجمالي التعاقدي">${ctot(r) ? nf(ctot(r), 0) : '–'}</td><td class="n tot" data-l="الإجمالي المحدّث">${(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val) ? nf(ed ? pv(r, 'qty') * pv(r, 'rate') : r.val, 0) : '–'}</td></tr>`).join(''); }).join('')}</tbody></table></div>`;
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
    const R = ch.filter(c => 'rate' in c).map(c => ({ item_id: c.r.id, rate: c.rate, rate_source: 'excel', rate_doc_id: null, rate_updated_at: new Date().toISOString() })); if (R.length) { const { error } = await S.sb.from('boq_rates').upsert(R); err = err || error; }
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


/* ---------------- notifications, PWA install & web push ---------------- */
async function updateBell() {
  if (!S.sb?.from) return; const { count } = await S.sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const b = $('#bellN'); if (b) { b.hidden = !count; b.textContent = count > 99 ? '99+' : count; }
  try { navigator.setAppBadge && (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()); } catch { }
}
const NK = { ops_arrears: '💰', ops_ending: '📝', stock_short: '📦', report_missing: '📝', report_returned: '↩️', review_waiting: '🧾', checklist_overdue: '📐', consultant_waiting: '✍️', digest: '📊' };
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast(/iphone|ipad/i.test(navigator.userAgent) ? 'على الآيفون: ضيف التطبيق للشاشة الرئيسية الأول، وافتحه من الأيقونة' : 'المتصفح ده مابيدعمش الإشعارات');
  const perm = await Notification.requestPermission(); if (perm !== 'granted') return toast('الإشعارات اترفضت. تقدر تسمح بيها من إعدادات المتصفح');
  const reg = (await navigator.serviceWorker.getRegistration()) || await navigator.serviceWorker.register('sw.js'), { data: key } = await S.sb.rpc('vapid_public_key'); await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
  const j = sub.toJSON(), { error } = await S.sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) });
  if (error) return toast('مقدرتش أسجل الجهاز: ' + error.message); toast('✓ الإشعارات اتفعّلت على الجهاز ده'); renderAlerts();
}
async function pushState() { try { if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'; if (Notification.permission === 'denied') return 'denied'; const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return 'off'; const s = await reg.pushManager.getSubscription(); return s ? 'on' : 'off'; } catch { return 'off'; } }
async function renderAlerts() {
  const [{ data }, st] = await Promise.all([S.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(80), pushState()]);
  const L = data || [], standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone, ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pj = id => S.projects.find(p => p.id === id)?.name || '';
  $('#main').innerHTML = `<h2>التنبيهات</h2>
  <div class="card pushcard">${st === 'on' ? '<b>🔔 الإشعارات شغالة على الجهاز ده</b><span class="mut">هيوصلك ملخص الساعة 10 الصبح و6 بالليل لو فيه حاجة متأخرة تخصك.</span>' : st === 'denied' ? '<b>الإشعارات مقفولة من المتصفح</b><span class="mut">افتح إعدادات الموقع في المتصفح واسمح بالإشعارات.</span>' : st === 'unsupported' && ios && !standalone ? '<b>عشان توصلك إشعارات على الآيفون</b><span class="mut">اضغط زرار المشاركة ⬆️ تحت، واختار "إضافة إلى الشاشة الرئيسية"، وافتح التطبيق من الأيقونة، وارجع للصفحة دي.</span>' : `<b>فعّل الإشعارات على الجهاز ده</b><span class="mut">عشان يوصلك تنبيه لو فيه تقرير متأخر أو اعتماد مستني أو نشاط متأخر.</span><button class="p" id="pushOn">تفعيل الإشعارات</button>`}
  ${!standalone ? `<div class="mut" style="margin-top:6px">${S.installEvt ? '<button id="instBtn">⬇️ تثبيت التطبيق على الجهاز</button>' : ios ? 'لتثبيت التطبيق: زرار المشاركة ⬆️ ← إضافة إلى الشاشة الرئيسية.' : 'لتثبيت التطبيق: من قائمة المتصفح ← تثبيت التطبيق / إضافة للشاشة الرئيسية.'}</div>` : ''}</div>
  <div class="acts" style="margin-top:6px">${L.some(n => !n.read_at) ? '<button id="allRead">تعليم الكل كمقروء</button>' : ''}</div>
  <div class="nlist">${L.length ? L.map(n => `<a href="${esc(n.url || '#home')}" class="nrow${n.read_at ? '' : ' un'}" data-nid="${n.id}"><i>${NK[n.kind] || '🔔'}</i><div><b>${esc(n.title)}</b>${n.project_id ? ` <span class="mut">· ${esc(pj(n.project_id))}</span>` : ''}<div>${esc(n.body || '')}</div><small class="mut">${fmtD(n.day)}</small></div></a>`).join('') : '<p class="mut">مفيش تنبيهات. كل حاجة ماشية في ميعادها 👌</p>'}</div>`;
  $('#pushOn') && ($('#pushOn').onclick = enablePush);
  $('#instBtn') && ($('#instBtn').onclick = async () => { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; renderAlerts(); });
  $('#allRead') && ($('#allRead').onclick = async () => { await S.sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); renderAlerts(); updateBell(); });
  $('#main').querySelector('.nlist').onclick = async e => { const a = e.target.closest('[data-nid]'); if (a && a.classList.contains('un')) S.sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.nid).then(updateBell); };
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
if ('serviceWorker' in navigator && !window.__SB_MOCK__ && !window.__MOCKDATA__) navigator.serviceWorker.register('sw.js').catch(() => { });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user) updateBell(); });

addEventListener('beforeunload', e => { if (S.bq?.pend?.size) { e.preventDefault(); e.returnValue = ''; } });
boot();
