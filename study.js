// RESAN On the go — قسم دراسة المشروعات (دراسات الجدوى المالية): محرك حساب شهري + شاشة إدخال موحدة + تقرير
/* ===== محرك الحساب: دراسة جدوى مشروع عقاري (شهري) ===== */
const ENG = (() => {
  const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
  const num = x => (isFinite(+x) ? +x : 0);

  /* جدول الأدوار (شاشة الإدخال الموحدة) يولد بنود التنفيذ والمبيعات */
  function fromFloors(P) {
    if (!Array.isArray(P.floors)) return P;
    const A = num(P.land.area);
    const build = [], sales = [];
    P.floors.forEach(f => {
      const area = num(f.ratio) * A;
      const n = Math.max(1, num(f.count) || 1);
      build.push({ zone: '', name: f.name, use: f.use, ratio: 0, fixed: area, floors: n, cost: num(f.cost) });
      if (num(f.price) > 0) sales.push({ name: f.name, use: f.use, cat: f.plan, area: area * n * (num(f.load) || 1), price: num(f.price) });
    });
    return { ...P, zones: [], build, sales };
  }

  function compute(P, adj) {
    adj = adj || { price: 1, cost: 1 };
    P = fromFloors(P);
    const L = P.land, X = P.exec, E = P.exp, F = P.fin;
    let H = 480;
    const z = () => new Array(H + 1).fill(0);
    const warn = [];

    /* ---------- الأرض ---------- */
    const landPrice = num(L.price) * (1 + num(L.fx));
    const landVal = num(L.area) * landPrice;
    const landDown = landVal * num(L.down);
    const instTotal = landVal - landDown;
    const n = Math.max(0, Math.round(num(L.n)));
    const inst = [];
    let bal = instTotal;
    for (let i = 0; i < n; i++) {
      const p = instTotal / n;
      const it = bal * num(L.rate) * (num(L.freq) / 12);
      inst.push({ k: i + 1, month: Math.round(num(L.first) + i * num(L.freq)), principal: p, interest: it, total: p + it, balance: bal - p });
      bal -= p;
    }
    const landInterest = sum(inst.map(r => r.interest));
    const landAdmin = landVal * num(L.admin);
    const landOver = num(L.over);
    const landTotal = landVal + landInterest + landOver + landAdmin;

    /* ---------- التنفيذ ---------- */
    const zones = {};
    (P.zones || []).forEach(zn => (zones[zn.id] = zn));
    const build = (P.build || []).map(r => {
      const zn = zones[r.zone];
      const base = num(L.area) * (zn ? num(zn.share) : 1);
      const area = num(r.fixed) > 0 ? num(r.fixed) : num(r.ratio) * base;
      const floors = num(r.floors) || 1;
      const total = area * floors * num(r.cost) * adj.cost;
      return { ...r, area, floors, total, zoneName: zn ? zn.name : '' };
    });
    const constr = sum(build.map(r => r.total));
    const dist = X.dist || [];
    const distSum = sum(dist.map(d => d.pct));
    if (dist.length && Math.abs(distSum - 1) > 0.001) warn.push('مجموع توزيع تكلفة التنفيذ على السنوات = ' + (distSum * 100).toFixed(1) + '% (يجب أن يكون 100%)');

    /* ---------- المبيعات ---------- */
    const plans = P.plans || [];
    const planIdx = {};
    plans.forEach((p, i) => (planIdx[p.id] = i));
    const sales = (P.sales || []).map(r => ({ ...r, value: num(r.area) * num(r.price) * adj.price }));
    sales.forEach(r => { if (!(r.cat in planIdx)) warn.push('البند "' + (r.name || '') + '" غير مربوط بخطة بيع'); });
    const listValue = sum(sales.map(r => r.value));

    const salesM = z(), downM = z(), instM = z();
    const byPlan = plans.map(p => {
      const total = sum(sales.filter(r => r.cat === p.id).map(r => r.value));
      const ys = (p.years || []).map(num);
      const s = sum(ys);
      if (total > 0 && Math.abs(s - 1) > 0.001) warn.push('خطة "' + p.name + '": مجموع نسب البيع السنوية = ' + (s * 100).toFixed(1) + '%' + (s < 1 ? ' — جزء من الوحدات لن يُباع خلال الدراسة' : ' — أكثر من 100%'));
      let sold = 0;
      ys.forEach((pct, y) => {
        const pl = (p.plan && p.plan.length) ? p.plan[Math.min(y, p.plan.length - 1)] : { down: 1, months: 0 };
        const dn = num(pl.down), N = Math.max(0, Math.round(num(pl.months)));
        if (dn > 1) warn.push('خطة "' + p.name + '": مقدم أكبر من 100%');
        for (let mm = 0; mm < 12; mm++) {
          const m = Math.round(num(p.start)) + 12 * y + mm;
          const s1 = total * pct / 12 * Math.pow(1 + num(P.priceInc), y);
          if (!s1) continue;
          sold += s1;
          salesM[m] += s1;
          downM[m] += s1 * (N ? dn : 1);
          if (N) {
            const each = s1 * (1 - dn) / N;
            for (let j = 0; j < N; j++) {
              const t = m + Math.round(num(P.grace)) + j;
              if (t <= H) instM[t] += each; else instM[H] += each;
            }
          }
        }
      });
      return { id: p.id, name: p.name, total, sold };
    });
    const revenue = sum(salesM);

    /* ---------- المصروفات ---------- */
    const selling = revenue * num(E.sell), marketing = revenue * num(E.mkt), ga = revenue * num(E.ga);
    const mgmtSales = revenue * num(E.mgmtSales);
    const design = num(X.design), consult = num(X.consult), lic = num(X.lic);
    const licMonths = String(X.licMonths || '0').split(/[,،\s]+/).map(Number).filter(v => isFinite(v));
    const escM = z(), conM = z();
    dist.forEach((d, y) => {
      for (let mm = 0; mm < 12; mm++) {
        const m = Math.round(num(X.start)) + 12 * y + mm;
        const c = constr * num(d.pct) / 12;
        conM[m] += c; escM[m] += c * num(d.esc);
      }
    });
    const escalation = sum(escM);

    const costBeforeTax = landTotal + constr + escalation + design + lic + consult + selling + marketing + ga + mgmtSales;
    const gross = revenue - (landTotal + constr + escalation);
    const ebit = revenue - costBeforeTax;
    const tax = E.taxBasis === 'profit' ? Math.max(0, ebit) * num(E.tax) : revenue * num(E.tax);
    const npat = ebit - tax;
    const mgmtProfit = Math.max(0, npat) * num(E.mgmt);
    const net = npat - mgmtProfit;

    /* ---------- التدفق الشهري ---------- */
    const rec = z();
    for (let m = 0; m <= H; m++) rec[m] = downM[m] + instM[m];
    const totalRec = sum(rec);
    const pay = {
      land: z(), landInst: z(), landInt: z(), design: z(), lic: z(), consult: z(),
      constr: conM, esc: escM, sell: z(), mkt: z(), ga: z(), mgmtS: z(), tax: z(), mgmtP: z()
    };
    pay.land[0] = landDown + landOver + landAdmin;
    inst.forEach(r => { const m = Math.min(H, Math.max(0, r.month)); pay.landInst[m] += r.principal; pay.landInt[m] += r.interest; });
    pay.design[0] = design; pay.consult[0] = consult;
    if (licMonths.length) licMonths.forEach(m => (pay.lic[Math.min(H, Math.max(0, m))] += lic / licMonths.length));
    const gaN = Math.max(1, Math.round(num(E.gaMonths)));
    for (let m = 1; m <= gaN; m++) pay.ga[m] = ga / gaN;
    for (let m = 0; m <= H; m++) {
      pay.sell[m] = salesM[m] * num(E.sell);
      pay.mkt[m] = salesM[m] * num(E.mkt);
      pay.mgmtS[m] = totalRec ? mgmtSales * rec[m] / totalRec : 0;
    }
    // آخر شهر به حركة
    let last = 0;
    for (let m = 0; m <= H; m++) {
      if (rec[m] || Object.values(pay).some(a => a[m])) last = m;
    }
    // الضرائب: تُسدد في نهاية كل سنة بنسبة متحصلات السنة
    const nYears = Math.ceil(Math.max(1, last) / 12);
    for (let y = 1; y <= nYears; y++) {
      let c = 0;
      for (let m = 12 * (y - 1) + 1; m <= 12 * y; m++) c += rec[m];
      if (y === 1) c += rec[0];
      pay.tax[Math.min(H, 12 * y)] += totalRec ? tax * c / totalRec : 0;
    }
    last = Math.max(last, 12 * nYears);
    pay.mgmtP[last] = mgmtProfit;
    H = last;

    const payM = [], netM = [], cum = [];
    let c = 0;
    for (let m = 0; m <= H; m++) {
      const p = Object.values(pay).reduce((s, a) => s + a[m], 0);
      payM.push(p); netM.push(rec[m] - p); c += rec[m] - p; cum.push(c);
    }
    const minCum = Math.min(0, ...cum);
    const peakMonth = cum.indexOf(Math.min(...cum));
    const equity = num(F.equity);
    const balM = cum.map(v => equity + v);
    const minBal = Math.min(...balM);
    const gap = minBal < 0 ? -minBal : 0;
    let payback = null;
    for (let m = H; m >= 0; m--) { if (cum[m] < 0) { payback = m + 1 <= H ? m + 1 : null; break; } if (m === 0) payback = 0; }

    /* ---------- سنوي ---------- */
    const years = [];
    for (let y = 0; y <= nYears; y++) {
      const a = y === 0 ? 0 : 12 * (y - 1) + 1, b = y === 0 ? 0 : Math.min(H, 12 * y);
      const row = { y, rec: 0, down: 0, inst: 0, pay: 0, parts: {} };
      Object.keys(pay).forEach(k => (row.parts[k] = 0));
      for (let m = a; m <= b; m++) {
        row.rec += rec[m]; row.down += downM[m]; row.inst += instM[m]; row.pay += payM[m];
        Object.keys(pay).forEach(k => (row.parts[k] += pay[k][m]));
      }
      row.sales = 0; for (let m = a; m <= b; m++) row.sales += salesM[m];
      row.net = row.rec - row.pay; row.cum = cum[b]; row.bal = balM[b];
      years.push(row);
    }

    /* ---------- مؤشرات ---------- */
    const disc = num(F.disc), reinv = num(F.reinv);
    const rm = Math.pow(1 + disc, 1 / 12) - 1;
    let npv = 0; netM.forEach((v, m) => (npv += v / Math.pow(1 + rm, m)));
    const irrM = irr(netM);
    const irrA = irrM == null ? null : Math.pow(1 + irrM, 12) - 1;
    const yNet = years.map(r => r.net);
    const mirr = MIRR(yNet, disc, reinv);
    const totalCost = costBeforeTax + tax + mgmtProfit;

    return {
      P, adj, warn, landPrice, landVal, landDown, instTotal, inst, landInterest, landAdmin, landOver, landTotal,
      build, constr, escalation, sales, listValue, byPlan, revenue, selling, marketing, ga, mgmtSales, design, consult, lic,
      gross, ebit, tax, npat, mgmtProfit, net, totalCost,
      months: H, rec, payM, netM, cum, balM, salesM, downM, instM, pay,
      minCum, peakMonth, peak: -minCum, equity, minBal, gap, payback, years,
      npv, irrA, irrM, mirr,
      margin: revenue ? net / revenue : 0,
      onCost: totalCost ? net / totalCost : 0,
      onLand: landTotal ? net / landTotal : 0,
      roi: -minCum > 0 ? net / -minCum : null,
      roiEq: equity > 0 ? net / equity : null
    };
  }

  function npvAt(cf, r) { let v = 0; for (let i = 0; i < cf.length; i++) v += cf[i] / Math.pow(1 + r, i); return v; }
  function irr(cf) {
    if (!cf.some(v => v < 0) || !cf.some(v => v > 0)) return null;
    // مسح من معدل صفر للخارج لإيجاد أقرب جذر منطقي
    let lo = null, hi = null, flo = 0;
    const f0 = npvAt(cf, 0);
    let prev = 0, fp = f0;
    for (let r = 0.0025; r <= 1; r += 0.0025) { const f = npvAt(cf, r); if (f * fp <= 0) { lo = prev; hi = r; flo = fp; break; } prev = r; fp = f; }
    if (lo === null) { prev = 0; fp = f0; for (let r = -0.0025; r >= -0.5; r -= 0.0025) { const f = npvAt(cf, r); if (f * fp <= 0) { lo = r; hi = prev; flo = f; break; } prev = r; fp = f; } }
    if (lo === null) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = npvAt(cf, mid);
      if (Math.abs(fm) < 1e-6) return mid;
      if (flo * fm < 0) { hi = mid; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }
  function MIRR(cf, fin, re) {
    const n = cf.length - 1; if (n < 1) return null;
    let pvN = 0, fvP = 0;
    cf.forEach((v, i) => { if (v < 0) pvN += v / Math.pow(1 + fin, i); else fvP += v * Math.pow(1 + re, n - i); });
    if (pvN >= 0 || fvP <= 0) return null;
    return Math.pow(fvP / -pvN, 1 / n) - 1;
  }
  function breakEven(P) {
    let lo = 0, hi = 1;
    if (compute(P, { price: 1, cost: 1 }).net <= 0) return null;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (compute(P, { price: mid, cost: 1 }).net > 0) hi = mid; else lo = mid; }
    return 1 - hi;
  }
  return { compute, irr, breakEven, sum };
})();

/* مثال: بيانات الشيت الأصلي (مشروع تجاري إداري وسكني — حي جنوب الأكاديمية) */
const SAMPLE = {
  info: { name: 'مشروع تجاري إداري وسكني — جنوب الأكاديمية', location: 'القاهرة الجديدة — حي جنوب الأكاديمية', type: 'تجاري / إداري / سكني', date: '2027-01', by: '', notes: '' },
  land: { area: 30000, price: 12500, fx: 0, down: 0.25, n: 3, freq: 12, first: 15, rate: 0.20, over: 105000000, admin: 0.015 },
  floors: [
    { name: 'بدروم 1 — جراجات', use: 'جراج', ratio: 0.3, count: 1, cost: 14000, load: 0.8, price: 5000, plan: 'c' },
    { name: 'بدروم 2 — تجاري', use: 'تجاري', ratio: 0.3, count: 1, cost: 14000, load: 1, price: 150000, plan: 'c' },
    { name: 'أرضي', use: 'تجاري', ratio: 0.09, count: 1, cost: 21000, load: 1.15, price: 250000, plan: 'c' },
    { name: 'لاند سكيب', use: 'خدمات (غير مباع)', ratio: 0.21, count: 1, cost: 4000, load: 1, price: 0, plan: 'c' },
    { name: 'آوت دور', use: 'تجاري', ratio: 1 / 12, count: 1, cost: 0, load: 1, price: 70000, plan: 'c' },
    { name: 'أول', use: 'تجاري', ratio: 0.099, count: 1, cost: 21000, load: 1.15, price: 190000, plan: 'c' },
    { name: 'ثاني', use: 'إداري', ratio: 0.099, count: 1, cost: 25000, load: 1.15, price: 150000, plan: 'c' },
    { name: 'ثالث', use: 'طبي', ratio: 0.099, count: 1, cost: 25000, load: 1.15, price: 120000, plan: 'c' },
    { name: 'بدروم سكني — جراجات', use: 'جراج', ratio: 0.35, count: 1, cost: 8000, load: 1, price: 5000, plan: 'r' },
    { name: 'أرضي سكني', use: 'سكني', ratio: 0.175, count: 1, cost: 8000, load: 1.15, price: 85000, plan: 'r' },
    { name: 'متكرر سكني (أول — رابع)', use: 'سكني', ratio: 0.189, count: 4, cost: 8000, load: 1.15, price: 85000, plan: 'r' },
    { name: 'روف', use: 'سكني', ratio: 0.04375, count: 1, cost: 8000, load: 1.15, price: 85000, plan: 'r' }
  ],
  plans: [
    { id: 'c', name: 'تجاري + إداري + طبي', start: 1, years: [0.35, 0.40, 0.25, 0, 0], plan: [ { down: 0.15, months: 72 }, { down: 0.20, months: 60 }, { down: 0.40, months: 60 } ] },
    { id: 'r', name: 'سكني', start: 1, years: [0.30, 0.40, 0.30, 0, 0], plan: [ { down: 0.10, months: 72 }, { down: 0.15, months: 72 }, { down: 0.15, months: 72 } ] }
  ],
  grace: 2, priceInc: 0,
  exec: { start: 13, dist: [ { pct: 0.3, esc: 0.1 }, { pct: 0.3, esc: 0.1 }, { pct: 0.4, esc: 0.1 } ], design: 15000000, consult: 20000000, lic: 25000000, licMonths: '6, 36' },
  exp: { sell: 0.05, mkt: 0.05, ga: 0.02, gaMonths: 60, mgmtSales: 0, tax: 0.05, taxBasis: 'sales', mgmt: 0.10 },
  fin: { equity: 350000000, disc: 0.25, reinv: 0.25 }
};
const BLANK = {
  info: { name: 'مشروع جديد', location: '', type: '', date: '', by: '', notes: '' },
  land: { area: 0, price: 0, fx: 0, down: 0.25, n: 3, freq: 12, first: 12, rate: 0.2, over: 0, admin: 0.015 },
  floors: [
    { name: 'بدروم', use: 'جراج', ratio: 0.6, count: 1, cost: 0, load: 1, price: 0, plan: 'c' },
    { name: 'أرضي', use: 'تجاري', ratio: 0.5, count: 1, cost: 0, load: 1.15, price: 0, plan: 'c' },
    { name: 'أدوار متكررة', use: 'إداري', ratio: 0.5, count: 3, cost: 0, load: 1.15, price: 0, plan: 'c' }
  ],
  plans: [ { id: 'c', name: 'خطة البيع الأساسية', start: 1, years: [0.3, 0.4, 0.3, 0, 0], plan: [ { down: 0.1, months: 60 } ] } ],
  grace: 2, priceInc: 0,
  exec: { start: 12, dist: [ { pct: 0.3, esc: 0.1 }, { pct: 0.4, esc: 0.1 }, { pct: 0.3, esc: 0.1 } ], design: 0, consult: 0, lic: 0, licMonths: '6' },
  exp: { sell: 0.03, mkt: 0.03, ga: 0.02, gaMonths: 60, mgmtSales: 0, tax: 0.225, taxBasis: 'profit', mgmt: 0 },
  fin: { equity: 0, disc: 0.25, reinv: 0.2 }
};

/* ================= واجهة قسم دراسة المشروعات ================= */
const CSS = `
.fs{--fy:var(--acc);--fneg:var(--bad,#b3261e);--fb1:light-dark(#9a9b9e,#7d7f84);--fb2:var(--ink);--fcum:var(--acc)}
.fs *{box-sizing:border-box;min-width:0}
.fs-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.fs-tabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px}
.fs-tab{border:0;background:none;padding:6px 16px;border-radius:9px;cursor:pointer;min-height:38px;font:inherit;font-weight:700;color:var(--mut)}
.fs-tab.on{background:var(--ink);color:var(--bg)}
.fs-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:6px 14px;min-height:40px;cursor:pointer;font:inherit;font-weight:700;white-space:nowrap}
.fs-btn:hover{border-color:var(--ink)}.fs-btn.p{background:var(--acc);border-color:var(--acc);color:#fff}.fs-btn.sm{min-height:34px;padding:3px 10px;font-size:14px}.fs-btn.d{color:var(--fneg)}
.fs-sel{min-height:40px;border:1px solid var(--line);border-radius:10px;padding:4px 10px;background:var(--card);color:var(--ink);font:inherit;max-width:280px}
.fs-st{font-size:13px;color:var(--mut)}
.fs-side{position:sticky;top:0;z-index:6;background:var(--bg);padding:8px 0;display:grid;grid-template-columns:minmax(220px,290px) minmax(0,1fr);gap:10px;margin-bottom:6px}
.fs-hero{background:var(--fy);color:#fff;border-radius:16px;padding:12px 16px}
.fs-hero .l{font-size:13px;font-weight:600;opacity:.9}
.fs-hero .b{font-size:clamp(26px,2.6vw,34px);font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap;margin:3px 0}
.fs-vd{display:inline-block;margin-top:5px;padding:2px 10px;border-radius:99px;background:rgba(0,0,0,.25);font-size:13px;font-weight:700}
.fs-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.fs-kpi{background:var(--card);padding:10px 12px;display:flex;flex-direction:column;justify-content:center}
.fs-kpi span{font-size:12px;color:var(--mut)}.fs-kpi b{font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.fs-warn{grid-column:1/-1;border:1px solid var(--fneg);border-radius:12px;padding:8px 14px;font-size:14px;color:var(--fneg);background:var(--card)}
.fs-warn ul{margin:4px 0 0;padding-inline-start:18px}
.fs-sheet{display:flex;flex-direction:column;gap:12px}
.fs-blk{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.fs-bh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.fs-bh h3{font-size:17px;margin:0}.fs-bh span{font-size:13px;color:var(--mut);font-variant-numeric:tabular-nums}
.fs-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 12px}
.fs-f{display:flex;flex-direction:column;gap:3px;font-size:13px;color:var(--mut)}.fs-f.w2{grid-column:span 2}
.fs-f>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs .fs-in{border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-height:40px;background:var(--bg);font:inherit;font-size:16px;width:100%;color:var(--ink)}
.fs .fs-in.n{direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
.fs .fs-in:focus{border-color:var(--acc);outline:none}
.fs select.fs-in{padding:4px}
.fs-calc{font-size:13px;color:var(--mut);margin:10px 0 0}.fs-calc b{color:var(--ink);font-variant-numeric:tabular-nums}
.fs-tw{overflow-x:auto}
.fs-et{border-collapse:collapse;width:100%}
.fs-et th{font-size:12px;color:var(--mut);font-weight:600;text-align:right;padding:6px 3px;border-bottom:1px solid var(--line);white-space:nowrap}
.fs-et td{padding:3px;border-bottom:1px solid var(--line)}
.fs-et .fs-in{min-height:36px;padding:4px 8px;font-size:15px}
.fs-et td.o{font-variant-numeric:tabular-nums;white-space:nowrap;text-align:left;padding-inline:8px;font-size:14px}
.fs-et tfoot td{border-bottom:0;font-weight:700}
.fs-fl{min-width:1060px}.fs-fl td:not(.wn):not(.wu):not(.o){width:92px}.fs-et .wn{min-width:150px}.fs-et .wu{width:125px}
.fs-pl{min-width:620px}.fs-pl td.lab{font-size:13px;color:var(--mut);white-space:nowrap}.fs-pl tr.p1 td{border-top:2px solid var(--line)}
.fs-x{border:0;background:none;color:var(--mut);cursor:pointer;font-size:20px;width:34px;height:34px;border-radius:8px;min-height:0;padding:0}.fs-x:hover{color:var(--fneg)}
.fs-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}
.fs-hint{font-size:12px;color:var(--mut)}
.fs-rep{max-width:1060px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:clamp(16px,3vw,36px)}
.fs-rh{border-bottom:3px solid var(--ink);padding-bottom:14px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:end}
.fs-rh h2{font-size:clamp(24px,3.4vw,36px);line-height:1.1;margin:4px 0}.fs-rh .m{color:var(--mut);font-size:14px}
.fs-find{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;margin-bottom:10px}
.fs-find .fs-hero .b{font-size:clamp(32px,4.4vw,48px)}.fs-find p{margin:8px 0 0;font-size:14px}
.fs-rep h4{font-size:19px;margin:28px 0 8px;padding-top:10px;border-top:1px solid var(--line)}.fs-rep h4 small{font-size:13px;color:var(--mut);font-weight:500}
.fs-rt{border-collapse:collapse;width:100%;font-size:14px}
.fs-rt th,.fs-rt td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right}
.fs-rt th{background:var(--bg);font-weight:600;font-size:12px;color:var(--mut);white-space:nowrap}
.fs-rt .n{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr}
.fs-rt tr.t td{font-weight:700;border-top:2px solid var(--ink)}.fs-rt tr.s td{font-weight:700;background:var(--bg)}
.fs-rt tr.k td,.fs-rt td.k{font-weight:700;background:var(--acc);color:#fff}
.fs-rt .neg,.fs .neg{color:var(--fneg)}.fs-rt td.k.neg{color:#fff}
.fs-sens td{text-align:center!important}.fs-sens small{color:var(--mut)}.fs-sens td.k small{color:#fff}
.fs-chart{width:100%;height:auto;display:block}
.fs-leg{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--mut);margin-top:4px}.fs-leg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-inline-end:5px}
.fs-hb{display:grid;grid-template-columns:160px minmax(0,1fr) 110px;gap:10px;align-items:center;font-size:14px;margin:6px 0}
.fs-hb .tr{background:var(--bg);border-radius:4px;height:14px;overflow:hidden}.fs-hb .tr div{height:100%;background:var(--ink)}.fs-hb .v{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}
.fs-c2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
.fs-foot{margin-top:26px;color:var(--mut);font-size:12px;border-top:1px solid var(--line);padding-top:10px}
.fs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.fs-card{display:flex;flex-direction:column;gap:4px;text-align:right;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;font:inherit;color:inherit}
.fs-card:hover{border-color:var(--acc)}.fs-card b{font-size:16px}.fs-card .r{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--mut)}.fs-card .r em{font-style:normal;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.fs-card.new{border-style:dashed;align-items:center;justify-content:center;min-height:120px;color:var(--acc);font-weight:700}
@media(max-width:1100px){.fs-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.fs-side{position:static;grid-template-columns:minmax(0,1fr)}.fs-kpis{grid-template-columns:1fr 1fr}.fs-find,.fs-c2{grid-template-columns:minmax(0,1fr)}.fs-hb{grid-template-columns:100px minmax(0,1fr) 90px}.fs-f.w2{grid-column:auto}}
@media print{body.fs-print header,body.fs-print .fs-bar,body.fs-print .fs-noprint{display:none!important}body.fs-print main{padding:0;max-width:none}body.fs-print .fs-rep{border:0;padding:0}.fs-rep h4{break-after:avoid}.fs-rt tr{break-inside:avoid}}
`;

const clone = o => JSON.parse(JSON.stringify(o));
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const N = v => (v == null || !isFinite(v)) ? '—' : nf0.format(Math.round(v));
const Mn = v => (v == null || !isFinite(v)) ? '—' : nf2.format(Math.round(v / 1e5) / 10) + ' مليون';
const Pc = v => (v == null || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const mLabel = m => m === 0 ? 'قبل البدء' : 'شهر ' + m + ' (سنة ' + Math.ceil(m / 12) + ')';
const USES = ['تجاري', 'إداري', 'طبي', 'سكني', 'فندقي', 'جراج', 'خدمات (غير مباع)'];

export async function mount(root, ctx) {
  const { sb, toast, esc, canEdit } = ctx;
  if (!document.getElementById('fs-css')) { const st = document.createElement('style'); st.id = 'fs-css'; st.textContent = CSS; document.head.append(st); }
  const q = s => root.querySelector(s);
  let S = null, R = null, curId = '', dirty = false, view = 'list', list = [];

  /* ---------- قائمة الدراسات ---------- */
  async function loadList() {
    const { data, error } = await sb.from('feasibility_studies').select('id,name,location,net_profit,irr,updated_at').order('updated_at', { ascending: false });
    if (error) { root.innerHTML = `<div class="note">${esc(error.message)}</div>`; return false; }
    list = data || []; return true;
  }
  async function showList() {
    view = 'list'; document.body.classList.remove('fs-print');
    root.innerHTML = '<p class="mut">جاري التحميل…</p>';
    if (!(await loadList())) return;
    root.innerHTML = `<div class="fs"><div class="fs-bar"><h2 style="margin:0;font-size:26px">دراسات الجدوى</h2><span class="mut" style="margin-inline-start:auto">${list.length} دراسة</span></div>
      <div class="fs-list">
        ${canEdit ? `<button class="fs-card new" data-new>+ دراسة جديدة</button><button class="fs-card new" data-sample style="color:var(--mut)">فتح مثال (الشيت الأصلي)</button>` : ''}
        ${list.map(s => `<button class="fs-card" data-open="${s.id}"><b>${esc(s.name)}</b><span class="mut">${esc(s.location || '')}</span>
          <div class="r"><span>صافي الربح</span><em>${Mn(+s.net_profit)}</em></div><div class="r"><span>IRR</span><em>${Pc(s.irr == null ? null : +s.irr)}</em></div>
          <div class="r"><span>آخر تعديل</span><span>${new Date(s.updated_at).toLocaleDateString('ar-EG')}</span></div></button>`).join('')}
        ${!list.length && !canEdit ? '<p class="mut">لا توجد دراسات بعد.</p>' : ''}
      </div></div>`;
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.new != null) openStudy(clone(BLANK), '');
      else if (b.dataset.sample != null) openStudy(clone(SAMPLE), '');
      else if (b.dataset.open) { const { data, error } = await sb.from('feasibility_studies').select('*').eq('id', b.dataset.open).single(); if (error) return toast(error.message); openStudy(data.data, data.id); }
    };
    root.oninput = root.onchange = root.onfocusout = null;
  }

  /* ---------- فتح دراسة ---------- */
  function openStudy(data, id) {
    S = Object.assign(clone(BLANK), data); curId = id; dirty = false; view = 'in';
    root.innerHTML = `<div class="fs"><div class="fs-bar">
      <button class="fs-btn sm" data-back>‹ كل الدراسات</button>
      <div class="fs-tabs"><button class="fs-tab on" data-v="in">المدخلات</button><button class="fs-tab" data-v="rep">التقرير</button></div>
      ${canEdit ? '<button class="fs-btn p" data-save>حفظ</button><button class="fs-btn" data-dup>نسخة</button>' : ''}
      <button class="fs-btn" data-xlsx>Excel</button><button class="fs-btn" data-print>طباعة / PDF</button>
      ${canEdit && curId ? '<button class="fs-btn d" data-del-study>حذف</button>' : ''}
      <span class="fs-st" id="fsSt">${curId ? '' : 'دراسة غير محفوظة'}</span></div>
      <div id="fsIn"><div class="fs-side" id="fsSide"></div><div id="fsForm"></div></div>
      <div id="fsRep" hidden></div></div>`;
    renderForm(); recalc(true); bind();
  }
  const status = t => { const e = q('#fsSt'); if (e) e.textContent = t; };
  function touch() { dirty = true; status(curId ? 'تعديلات غير محفوظة' : 'دراسة غير محفوظة'); }
  function setView(v) {
    view = v; q('#fsIn').hidden = v !== 'in'; q('#fsRep').hidden = v !== 'rep';
    root.querySelectorAll('.fs-tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
    if (v === 'rep') q('#fsRep').innerHTML = reportHTML(R);
  }

  /* ---------- مسارات ---------- */
  const getP = p => p.split('.').reduce((o, k) => o == null ? o : o[k], S);
  function setP(p, v) { const ks = p.split('.'); let o = S; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }
  function fmtIn(v, t) {
    if (t === 'text') return esc(v);
    if (t === 'dist') return (v || []).map(d => +(d.pct * 100).toFixed(2)).join(', ');
    if (t === 'esc') return v && v[0] ? String(+(v[0].esc * 100).toFixed(2)) : '0';
    if (v === '' || v == null) return '';
    return t === 'pct' ? String(+(v * 100).toFixed(4)) : nf2.format(+v);
  }
  const ro = canEdit ? '' : ' disabled';
  const inp = (p, t = 'num', ph = '') => `<input class="fs-in${t === 'text' ? '' : ' n'}" data-p="${p}" data-t="${t}" ${t === 'text' ? '' : 'inputmode="decimal"'} value="${fmtIn(getP(p), t)}" placeholder="${ph}" autocomplete="off"${ro}>`;
  const fld = (lab, p, t, unit, cls = '') => `<label class="fs-f ${cls}"><span>${lab}${unit ? ' <small>(' + unit + ')</small>' : ''}</span>${inp(p, t)}</label>`;
  const sel = (p, opts) => `<select class="fs-in" data-p="${p}" data-t="text"${ro}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${getP(p) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const parse = (v, t) => { if (t === 'text') return v; const x = parseFloat(String(v).replace(/[,،\s]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return isFinite(x) ? (t === 'pct' ? x / 100 : x) : 0; };

  function ensurePlans() {
    const L = Math.max(3, ...S.plans.map(p => p.years.length));
    S.plans.forEach(p => { while (p.years.length < L) p.years.push(0); while (p.plan.length < L) p.plan.push(clone(p.plan[p.plan.length - 1] || { down: 0.1, months: 60 })); });
    const ids = S.plans.map(p => p.id); S.floors.forEach(f => { if (!ids.includes(f.plan)) f.plan = ids[0]; });
  }

  /* ---------- شاشة الإدخال ---------- */
  function renderForm() {
    ensurePlans();
    const pl = S.plans.map(x => [x.id, x.name]), yrs = S.plans[0].years.length, mp = pl.length > 1;
    const x = canEdit;
    q('#fsForm').innerHTML = `<div class="fs-sheet">
    <div class="fs-blk"><div class="fs-bh"><h3>المشروع</h3></div><div class="fs-fields">
      ${fld('اسم المشروع', 'info.name', 'text', '', 'w2')}${fld('الموقع', 'info.location', 'text')}${fld('نوع المشروع', 'info.type', 'text')}${fld('تاريخ البدء', 'info.date', 'text')}${fld('ملاحظات للتقرير', 'info.notes', 'text', '', 'w2')}
    </div></div>
    <div class="fs-blk"><div class="fs-bh"><h3>الأرض</h3><span id="fsLs"></span></div><div class="fs-fields">
      ${fld('مساحة الأرض', 'land.area', 'num', 'م²')}${fld('سعر المتر', 'land.price', 'num', 'جنيه')}${fld('قيمة الأوفر', 'land.over', 'num', 'جنيه')}
      ${fld('مقدم الأرض', 'land.down', 'pct', '%')}${fld('عدد الأقساط', 'land.n', 'num')}${fld('كل', 'land.freq', 'num', 'شهر')}
      ${fld('أول قسط في شهر', 'land.first', 'num')}${fld('الفائدة السنوية', 'land.rate', 'pct', '%')}${fld('مصاريف إدارية', 'land.admin', 'pct', '%')}${fld('فرق العملة', 'land.fx', 'pct', '%')}
    </div><p class="fs-calc" id="fsLc"></p></div>
    <div class="fs-blk"><div class="fs-bh"><h3>الأدوار: النسبة البنائية والتخصيص والتكلفة وسعر البيع</h3><span id="fsFs"></span></div>
      <div class="fs-tw"><table class="fs-et fs-fl"><thead><tr><th>الدور</th><th>التخصيص</th><th>النسبة البنائية %</th><th>عدد الأدوار</th><th>مساحة الدور م²</th><th>تكلفة التنفيذ / م²</th><th>معامل التحميل</th><th>سعر البيع / م²</th>${mp ? '<th>خطة البيع</th>' : ''}<th>تكلفة التنفيذ</th><th>قيمة المبيعات</th><th></th></tr></thead><tbody>
      ${S.floors.map((r, i) => `<tr><td class="wn">${inp('floors.' + i + '.name', 'text')}</td><td class="wu">${sel('floors.' + i + '.use', USES.concat(USES.includes(r.use) ? [] : [r.use]).map(u => [u, u]))}</td><td>${inp('floors.' + i + '.ratio', 'pct')}</td><td>${inp('floors.' + i + '.count')}</td><td class="o" data-o="fa${i}"></td><td>${inp('floors.' + i + '.cost')}</td><td>${inp('floors.' + i + '.load')}</td><td>${inp('floors.' + i + '.price')}</td>${mp ? `<td class="wu">${sel('floors.' + i + '.plan', pl)}</td>` : ''}<td class="o" data-o="fc${i}"></td><td class="o" data-o="fs${i}"></td><td>${x ? `<button class="fs-x" data-del="floors.${i}" aria-label="حذف الدور">×</button>` : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">الإجمالي</td><td class="o" data-o="fat"></td><td colspan="${mp ? 4 : 3}"></td><td class="o" data-o="fct"></td><td class="o" data-o="fst"></td><td></td></tr></tfoot></table></div>
      <div class="fs-act">${x ? '<button class="fs-btn sm" data-add="floors">+ دور</button>' : ''}<span class="fs-hint">مساحة الدور = النسبة البنائية × مساحة الأرض · المساحة البيعية = المساحة × عدد الأدوار × معامل التحميل · سعر بيع صفر = غير مباع</span></div>
    </div>
    <div class="fs-blk"><div class="fs-bh"><h3>البيع والتحصيل</h3></div>
      <div class="fs-tw"><table class="fs-et fs-pl"><thead><tr><th>خطة البيع</th><th>بدء البيع (شهر)</th><th></th>${Array.from({ length: yrs }, (_, y) => `<th>سنة ${y + 1}</th>`).join('')}<th>المجموع</th><th></th></tr></thead><tbody>
      ${S.plans.map((p, i) => `
        <tr class="p1"><td rowspan="3" class="wn">${inp('plans.' + i + '.name', 'text')}</td><td rowspan="3" style="width:80px">${inp('plans.' + i + '.start')}</td><td class="lab">نسبة البيع %</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.years.' + y, 'pct')}</td>`).join('')}<td class="o" data-o="ps${i}"></td><td rowspan="3">${x && S.plans.length > 1 ? `<button class="fs-x" data-del="plans.${i}" aria-label="حذف الخطة">×</button>` : ''}</td></tr>
        <tr><td class="lab">المقدم %</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.plan.' + y + '.down', 'pct')}</td>`).join('')}<td></td></tr>
        <tr><td class="lab">أقساط (شهر)</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.plan.' + y + '.months')}</td>`).join('')}<td></td></tr>`).join('')}
      </tbody></table></div>
      <div class="fs-act">${x ? '<button class="fs-btn sm" data-add="plans">+ خطة بيع</button><button class="fs-btn sm" data-addyear>+ سنة بيع</button>' : ''}</div>
      <div class="fs-fields" style="margin-top:12px">${fld('سماح قبل أول قسط', 'grace', 'num', 'شهر')}${fld('زيادة سعر البيع سنوياً', 'priceInc', 'pct', '%')}</div>
    </div>
    <div class="fs-blk"><div class="fs-bh"><h3>التنفيذ والمصروفات والتمويل</h3></div><div class="fs-fields">
      ${fld('بدء التنفيذ في شهر', 'exec.start', 'num')}<label class="fs-f"><span>توزيع التنفيذ على السنوات <small>(%)</small></span>${inp('exec.dist', 'dist', '30, 30, 40')}</label>${fld('مخصص ارتفاع الأسعار', 'exec.dist', 'esc', '% سنوياً')}
      ${fld('التصميمات', 'exec.design', 'num', 'جنيه')}${fld('الاستشاري', 'exec.consult', 'num', 'جنيه')}${fld('الرسوم والتراخيص', 'exec.lic', 'num', 'جنيه')}${fld('سداد التراخيص في الأشهر', 'exec.licMonths', 'text')}
      ${fld('مصروفات بيعية', 'exp.sell', 'pct', '% مبيعات')}${fld('مصروفات تسويقية', 'exp.mkt', 'pct', '% مبيعات')}${fld('عمومية وإدارية', 'exp.ga', 'pct', '% مبيعات')}${fld('توزع على', 'exp.gaMonths', 'num', 'شهر')}
      <label class="fs-f"><span>وعاء الضريبة</span>${sel('exp.taxBasis', [['sales', 'من المبيعات'], ['profit', 'من صافي الربح']])}</label>${fld('نسبة الضريبة', 'exp.tax', 'pct', '%')}${fld('نسبة الإدارة', 'exp.mgmt', 'pct', '% من الربح')}${fld('مقابل إدارة', 'exp.mgmtSales', 'pct', '% مبيعات')}
      ${fld('رأس المال المتاح', 'fin.equity', 'num', 'جنيه')}${fld('معدل الخصم', 'fin.disc', 'pct', '%')}${fld('معدل إعادة الاستثمار', 'fin.reinv', 'pct', '%')}
    </div></div></div>`;
    fillCalc();
  }

  let tmr = 0;
  function recalc(now) { clearTimeout(tmr); const go = () => { R = ENG.compute(S); fillCalc(); renderSide(); if (view === 'rep') q('#fsRep').innerHTML = reportHTML(R); }; now ? go() : (tmr = setTimeout(go, 120)); }
  function fillCalc() {
    if (!R) return;
    const set = (k, v) => { const e = root.querySelector(`[data-o="${k}"]`); if (e) e.textContent = v; };
    let ta = 0, tc = 0, ts = 0;
    S.floors.forEach((f, i) => { const A = (+f.ratio || 0) * (+S.land.area || 0), n = +f.count || 1, c = A * n * (+f.cost || 0), v = A * n * (+f.load || 1) * (+f.price || 0); ta += A * n; tc += c; ts += v; set('fa' + i, N(A) + (n > 1 ? ' × ' + n : '')); set('fc' + i, N(c)); set('fs' + i, v ? N(v) : '—'); });
    set('fat', N(ta)); set('fct', N(tc)); set('fst', N(ts));
    S.plans.forEach((p, i) => set('ps' + i, Pc(ENG.sum(p.years))));
    const fs = q('#fsFs'); if (fs) fs.textContent = 'تنفيذ ' + Mn(tc) + ' · مبيعات ' + Mn(ts);
    const ls = q('#fsLs'); if (ls) ls.textContent = Mn(R.landTotal);
    const lc = q('#fsLc'); if (lc) lc.innerHTML = `قيمة الأرض <b>${N(R.landVal)}</b> · المقدم <b>${N(R.landDown)}</b> · الفوائد <b>${N(R.landInterest)}</b> · الإجمالي شامل الفوائد والأوفر <b>${N(R.landTotal)}</b> · سعر المتر الفعلي <b>${N(R.landTotal / (S.land.area || 1))}</b>`;
  }
  const verdict = r => (r.net > 0 && r.npv > 0 && (r.irrA == null || r.irrA > S.fin.disc)) ? 'المشروع مجدٍ — يوصى بالقبول' : (r.net > 0 ? 'مربح لكن العائد أقل من معدل الخصم' : 'غير مجدٍ بهذه الافتراضات');
  function renderSide() {
    const r = R;
    q('#fsSide').innerHTML = `<div class="fs-hero"><div class="l">صافي الربح المتوقع</div><div class="b">${Mn(r.net)}</div><div class="l">${Pc(r.margin)} من المبيعات · ${Pc(r.onCost)} على التكلفة</div><span class="fs-vd">${verdict(r)}</span></div>
    <div class="fs-kpis">
      <div class="fs-kpi"><span>إجمالي المبيعات</span><b>${Mn(r.revenue)}</b></div><div class="fs-kpi"><span>إجمالي التكاليف</span><b>${Mn(r.totalCost)}</b></div>
      <div class="fs-kpi"><span>صافي القيمة الحالية NPV</span><b class="${r.npv < 0 ? 'neg' : ''}">${Mn(r.npv)}</b></div><div class="fs-kpi"><span>معدل العائد الداخلي IRR</span><b>${Pc(r.irrA)}</b></div>
      <div class="fs-kpi"><span>أقصى احتياج تمويلي</span><b>${Mn(r.peak)}</b></div><div class="fs-kpi"><span>فترة الاسترداد</span><b>${r.payback == null ? 'لا يسترد' : r.payback + ' شهر'}</b></div></div>
    ${r.gap > 0 ? `<div class="fs-warn"><b>عجز تمويلي:</b> رأس المال المتاح لا يكفي — العجز الأقصى ${N(r.gap)} جنيه في ${mLabel(r.balM.indexOf(r.minBal))}.</div>` : ''}
    ${r.warn.length ? `<div class="fs-warn"><b>تنبيهات المدخلات</b><ul>${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}`;
  }

  /* ---------- الرسم السنوي ---------- */
  function chartYears(r) {
    const W = 900, H = 320, ys = r.years, n = ys.length;
    const vals = ys.flatMap(a => [a.rec, -a.pay, a.cum]); const mx = Math.max(...vals, 0), mn = Math.min(...vals, 0), rg = (mx - mn) || 1;
    const pl = 70, pr = 10, top = 14, bot = 34, cw = (W - pl - pr) / n, bw = Math.min(26, cw * 0.32);
    const y = v => top + (H - top - bot) * (mx - v) / rg, cx = i => W - pr - cw * (i + 0.5);
    const ticks = [mx, (mx + mn) / 2, mn, 0].filter((v, i, a) => a.indexOf(v) === i);
    let s = `<svg class="fs-chart" style="direction:ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="التدفقات النقدية السنوية">`;
    ticks.forEach(t => s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="currentColor" stroke-opacity="${t === 0 ? .45 : .1}"/><text x="${pl - 6}" y="${y(t) + 4}" font-size="12" text-anchor="end" fill="currentColor" fill-opacity=".65">${nf0.format(Math.round(t / 1e6))}</text>`);
    ys.forEach((a, i) => {
      s += `<rect x="${cx(i) - bw - 1}" y="${y(a.rec)}" width="${bw}" height="${Math.max(0, y(0) - y(a.rec))}" fill="var(--fb1)" rx="2"/>`;
      s += `<rect x="${cx(i) + 1}" y="${y(0)}" width="${bw}" height="${Math.max(0, y(-a.pay) - y(0))}" fill="var(--fb2)" rx="2"/>`;
      s += `<text x="${cx(i)}" y="${H - 12}" font-size="12" text-anchor="middle" fill="currentColor" fill-opacity=".7">${i === 0 ? 'قبل' : i}</text>`;
    });
    s += `<polyline points="${ys.map((a, i) => cx(i) + ',' + y(a.cum)).join(' ')}" fill="none" stroke="var(--fcum)" stroke-width="3"/>`;
    ys.forEach((a, i) => s += `<circle cx="${cx(i)}" cy="${y(a.cum)}" r="4" fill="var(--fcum)"/>`);
    return s + `<text x="${pl - 6}" y="${H - 12}" font-size="11" text-anchor="end" fill="currentColor" fill-opacity=".6">مليون</text></svg>`;
  }
  const hbars = items => { const mx = Math.max(...items.map(i => Math.abs(i[1])), 1); return items.map(([l, v]) => `<div class="fs-hb"><span>${esc(l)}</span><div class="tr"><div style="width:${(Math.abs(v) / mx * 100).toFixed(1)}%"></div></div><span class="v">${Mn(v)}</span></div>`).join(''); };

  /* ---------- التقرير ---------- */
  function reportHTML(r) {
    const I = S.info, rv = r.revenue || 1;
    const pr = (l, v, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="n ${v < 0 ? 'neg' : ''}">${N(v)}</td><td class="n">${Pc(v / rv)}</td></tr>`;
    const steps = [-0.2, -0.1, 0, 0.1, 0.2];
    const sens = steps.map(c => steps.map(p => ENG.compute(S, { price: 1 + p, cost: 1 + c })));
    const be = ENG.breakEven(S);
    const uses = {}; r.sales.forEach(s => uses[s.use || 'أخرى'] = (uses[s.use || 'أخرى'] || 0) + s.value);
    const parts = [['مقدم وأقساط الأرض', 'land', 'landInst'], ['فوائد الأرض', 'landInt'], ['التنفيذ', 'constr'], ['ارتفاع الأسعار', 'esc'], ['تصميمات واستشاري وتراخيص', 'design', 'consult', 'lic'], ['بيعية وتسويقية', 'sell', 'mkt'], ['عمومية وإدارية', 'ga', 'mgmtS'], ['ضرائب', 'tax'], ['نسبة الإدارة', 'mgmtP']];
    const yh = r.years.map(a => `<th class="n">${a.y === 0 ? 'قبل البدء' : 'سنة ' + a.y}</th>`).join('');
    const yr = (l, f, cls = '') => `<tr class="${cls}"><td>${l}</td>${r.years.map(a => { const v = f(a); return `<td class="n ${v < 0 ? 'neg' : ''}">${N(v)}</td>`; }).join('')}</tr>`;
    return `<div class="fs-rep">
    <div class="fs-rh"><div><div class="m">ريسان للمقاولات · دراسة جدوى مالية مبدئية${I.date ? ' · بداية ' + esc(I.date) : ''}</div><h2>${esc(I.name)}</h2><div class="m">${esc(I.location || '')}${I.type ? ' · ' + esc(I.type) : ''}</div></div>
    <div class="m">مساحة الأرض ${N(S.land.area)} م² · مدة الدراسة ${r.months} شهر</div></div>
    <div class="fs-find">
      <div class="fs-hero"><div class="l">صافي الربح بعد الضرائب ونسبة الإدارة</div><div class="b">${Mn(r.net)}</div><div class="l">هامش ${Pc(r.margin)} · IRR ${Pc(r.irrA)} · NPV ${Mn(r.npv)} عند خصم ${Pc(S.fin.disc)}</div><span class="fs-vd">${verdict(r)}</span></div>
      <div><table class="fs-rt"><tbody>
        <tr><td>إجمالي المبيعات المتوقعة</td><td class="n">${Mn(r.revenue)}</td></tr><tr><td>إجمالي التكاليف (شامل الضرائب)</td><td class="n">${Mn(r.totalCost)}</td></tr>
        <tr><td>أقصى احتياج تمويلي (${mLabel(r.peakMonth)})</td><td class="n">${Mn(r.peak)}</td></tr><tr><td>فترة الاسترداد</td><td class="n">${r.payback == null ? 'لا يسترد' : r.payback + ' شهر'}</td></tr>
        <tr><td>العائد على أقصى استثمار</td><td class="n">${Pc(r.roi)}</td></tr><tr><td>يتحمل انخفاض أسعار البيع حتى</td><td class="n">${be == null ? '—' : Pc(be)}</td></tr></tbody></table>
      ${r.gap > 0 ? `<p class="neg"><b>تنبيه:</b> رأس المال المتاح (${Mn(r.equity)}) لا يغطي الاحتياج؛ العجز الأقصى ${Mn(r.gap)}.</p>` : `<p>رأس المال المتاح ${Mn(r.equity)} يغطي الاحتياج التمويلي طوال الدراسة.</p>`}
      ${I.notes ? `<p>${esc(I.notes)}</p>` : ''}</div></div>
    <h4>التدفقات النقدية السنوية <small>بالمليون جنيه</small></h4>${chartYears(r)}
    <div class="fs-leg"><span><i style="background:var(--fb1)"></i>المقبوضات</span><span><i style="background:var(--fb2)"></i>المدفوعات</span><span><i style="background:var(--fcum)"></i>الرصيد التراكمي</span></div>
    <h4>قائمة الدخل التقديرية</h4>
    <div class="fs-tw"><table class="fs-rt"><thead><tr><th>البيان</th><th class="n">القيمة (جنيه)</th><th class="n">% من المبيعات</th></tr></thead><tbody>
      ${pr('إجمالي المبيعات', r.revenue, 's')}${pr('تكلفة الأرض (شاملة الفوائد والأوفر والمصاريف)', -r.landTotal)}${pr('تكاليف الإنشاءات', -r.constr)}${pr('مخصص ارتفاع الأسعار', -r.escalation)}
      ${pr('مجمل الربح', r.gross, 's')}${pr('التصميمات', -r.design)}${pr('الرسوم والتراخيص', -r.lic)}${pr('الاستشاري', -r.consult)}${pr('المصروفات البيعية', -r.selling)}${pr('المصروفات التسويقية', -r.marketing)}${pr('عمومية وإدارية', -r.ga)}${r.mgmtSales ? pr('مقابل إدارة', -r.mgmtSales) : ''}
      ${pr('صافي الربح قبل الضرائب', r.ebit, 's')}${pr('الضرائب', -r.tax)}${pr('صافي الربح بعد الضرائب', r.npat, 's')}${pr('نسبة الإدارة ' + Pc(S.exp.mgmt) + ' من صافي الربح', -r.mgmtProfit)}${pr('صافي الربح', r.net, 'k')}
    </tbody></table></div>
    <h4>معايير التقييم المالي</h4>
    <div class="fs-tw"><table class="fs-rt"><thead><tr><th>المؤشر</th><th class="n">القيمة</th><th>الدلالة</th></tr></thead><tbody>
      <tr><td>صافي القيمة الحالية NPV</td><td class="n">${N(r.npv)}</td><td>${r.npv > 0 ? 'موجب: العائد يفوق معدل الخصم' : 'سالب: العائد أقل من معدل الخصم'} (${Pc(S.fin.disc)})</td></tr>
      <tr><td>معدل العائد الداخلي IRR (سنوي)</td><td class="n">${Pc(r.irrA)}</td><td>من التدفقات الشهرية</td></tr><tr><td>معدل العائد الداخلي المعدل MIRR</td><td class="n">${Pc(r.mirr)}</td><td>بإعادة استثمار ${Pc(S.fin.reinv)}</td></tr>
      <tr><td>هامش صافي الربح</td><td class="n">${Pc(r.margin)}</td><td>صافي الربح ÷ المبيعات</td></tr><tr><td>صافي الربح إلى إجمالي التكلفة</td><td class="n">${Pc(r.onCost)}</td><td></td></tr>
      <tr><td>صافي الربح إلى تكلفة الأرض</td><td class="n">${Pc(r.onLand)}</td><td></td></tr><tr><td>العائد على أقصى احتياج تمويلي</td><td class="n">${Pc(r.roi)}</td><td>صافي الربح ÷ ${Mn(r.peak)}</td></tr>
      ${r.roiEq != null ? `<tr><td>العائد على رأس المال المتاح</td><td class="n">${Pc(r.roiEq)}</td><td>صافي الربح ÷ ${Mn(r.equity)}</td></tr>` : ''}
    </tbody></table></div>
    <div class="fs-c2"><div><h4>هيكل التكاليف</h4>${hbars([['الأرض', r.landTotal], ['الإنشاءات', r.constr], ['ارتفاع الأسعار', r.escalation], ['تصميم وتراخيص واستشاري', r.design + r.lic + r.consult], ['بيعية وتسويقية', r.selling + r.marketing], ['عمومية وإدارية', r.ga + r.mgmtSales], ['ضرائب', r.tax], ['نسبة الإدارة', r.mgmtProfit]].filter(a => a[1]))}</div>
      <div><h4>المبيعات حسب التخصيص</h4>${hbars(Object.entries(uses).sort((a, b) => b[1] - a[1]))}</div></div>
    <h4>تكلفة الأرض وجدول الأقساط</h4>
    <div class="fs-tw"><table class="fs-rt"><tbody>
      <tr><td>مساحة الأرض × سعر المتر</td><td class="n">${N(S.land.area)} × ${N(r.landPrice)}</td><td class="n">${N(r.landVal)}</td></tr><tr><td>الدفعة المقدمة ${Pc(S.land.down)}</td><td></td><td class="n">${N(r.landDown)}</td></tr>
      <tr><td>الأوفر + المصاريف الإدارية</td><td></td><td class="n">${N(r.landOver + r.landAdmin)}</td></tr><tr><td>الفوائد على الأقساط (${Pc(S.land.rate)} متناقصة)</td><td></td><td class="n">${N(r.landInterest)}</td></tr>
      <tr class="t"><td>إجمالي تكلفة الأرض</td><td class="n">${N(r.landTotal / (S.land.area || 1))} للمتر</td><td class="n">${N(r.landTotal)}</td></tr></tbody></table>
    ${r.inst.length ? `<table class="fs-rt" style="margin-top:10px"><thead><tr><th>القسط</th><th>شهر السداد</th><th class="n">قيمة القسط</th><th class="n">الفائدة</th><th class="n">الإجمالي</th><th class="n">الرصيد بعده</th></tr></thead><tbody>
      ${r.inst.map(a => `<tr><td>${a.k}</td><td>${mLabel(a.month)}</td><td class="n">${N(a.principal)}</td><td class="n">${N(a.interest)}</td><td class="n">${N(a.total)}</td><td class="n">${N(a.balance)}</td></tr>`).join('')}
      <tr class="t"><td>الإجمالي</td><td></td><td class="n">${N(r.instTotal)}</td><td class="n">${N(r.landInterest)}</td><td class="n">${N(r.instTotal + r.landInterest)}</td><td></td></tr></tbody></table>` : ''}</div>
    <h4>الأدوار: التنفيذ والمبيعات</h4>
    <div class="fs-tw"><table class="fs-rt"><thead><tr><th>الدور</th><th>التخصيص</th><th class="n">النسبة البنائية</th><th class="n">مساحة الدور</th><th class="n">عدد</th><th class="n">تكلفة/م²</th><th class="n">تكلفة التنفيذ</th><th class="n">المساحة البيعية</th><th class="n">سعر البيع/م²</th><th class="n">قيمة المبيعات</th></tr></thead><tbody>
      ${S.floors.map(f => { const A = (+f.ratio || 0) * (+S.land.area || 0), n = +f.count || 1, sa = A * n * (+f.load || 1); return `<tr><td>${esc(f.name)}</td><td>${esc(f.use)}</td><td class="n">${Pc(+f.ratio)}</td><td class="n">${N(A)}</td><td class="n">${n}</td><td class="n">${N(+f.cost)}</td><td class="n">${N(A * n * (+f.cost || 0))}</td><td class="n">${+f.price ? N(sa) : '—'}</td><td class="n">${+f.price ? N(+f.price) : '—'}</td><td class="n">${+f.price ? N(sa * f.price) : '—'}</td></tr>`; }).join('')}
      <tr class="t"><td colspan="6">الإجمالي</td><td class="n">${N(r.constr)}</td><td class="n">${N(r.sales.reduce((a, s) => a + s.area, 0))}</td><td></td><td class="n">${N(r.listValue)}</td></tr></tbody></table>
    <p class="fs-hint">التنفيذ يبدأ ${mLabel(+S.exec.start)} ويوزع: ${S.exec.dist.map((d, i) => 'السنة ' + (i + 1) + ' ' + Pc(d.pct)).join(' · ')}، مع مخصص ارتفاع أسعار ${N(r.escalation)}.</p></div>
    <h4>خطط البيع والتحصيل</h4>
    <div class="fs-tw"><table class="fs-rt"><thead><tr><th>الخطة</th><th>توزيع البيع</th><th>شروط السداد</th><th class="n">المبيعات المحققة</th></tr></thead><tbody>
      ${S.plans.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${p.years.map((v, y) => v ? 'س' + (y + 1) + ' ' + Pc(v) : '').filter(Boolean).join(' · ')}</td><td>${p.plan.filter((_, y) => p.years[y]).map((x, y) => 'س' + (y + 1) + ': ' + Pc(x.down) + ' مقدم + ' + x.months + ' شهر').join(' · ')}</td><td class="n">${N(r.byPlan[i] && r.byPlan[i].sold)}</td></tr>`).join('')}
    </tbody></table><p class="fs-hint">أول قسط للعميل بعد ${S.grace} شهر من التعاقد${+S.priceInc ? '، وزيادة سعر ' + Pc(S.priceInc) + ' سنوياً' : ''}.</p></div>
    <h4>الموازنة النقدية السنوية <small>جنيه</small></h4>
    <div class="fs-tw"><table class="fs-rt" style="min-width:${180 + r.years.length * 115}px"><thead><tr><th>البيان</th>${yh}</tr></thead><tbody>
      ${yr('دفعات التعاقد', a => a.down)}${yr('الأقساط المحصلة', a => a.inst)}${yr('إجمالي المقبوضات', a => a.rec, 's')}
      ${parts.map(([l, ...k]) => yr(l, a => k.reduce((s, kk) => s + a.parts[kk], 0))).join('')}
      ${yr('إجمالي المدفوعات', a => a.pay, 's')}${yr('صافي التدفق', a => a.net, 't')}${yr('التراكمي', a => a.cum)}${yr('رصيد النقدية (مع رأس المال)', a => a.bal)}
    </tbody></table></div>
    <h4>تحليل الحساسية <small>صافي الربح (مليون) و IRR عند تغير أسعار البيع والتكلفة</small></h4>
    <div class="fs-tw"><table class="fs-rt fs-sens"><thead><tr><th>التكلفة ↓ / سعر البيع ←</th>${steps.map(p => `<th>${p > 0 ? '+' : ''}${p * 100}%</th>`).join('')}</tr></thead><tbody>
      ${sens.map((row, i) => `<tr><th>${steps[i] > 0 ? '+' : ''}${steps[i] * 100}%</th>${row.map((c, j) => `<td class="${i === 2 && j === 2 ? 'k' : ''} ${c.net < 0 ? 'neg' : ''}"><div class="n">${nf0.format(Math.round(c.net / 1e6))}</div><small>${Pc(c.irrA)}</small></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    ${r.warn.length ? `<h4>ملاحظات على المدخلات</h4><ul>${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="fs-foot">دراسة مبدئية مبنية على الافتراضات المدخلة. المبيعات تُحسب على ما يُباع فعلاً خلال الدراسة، والضرائب تُسدد نهاية كل سنة بنسبة متحصلاتها، ونسبة الإدارة في نهاية المشروع. أُعدت في ${new Date().toLocaleDateString('ar-EG')}.</div></div>`;
  }

  /* ---------- الأحداث ---------- */
  const NEW = { floors: () => ({ name: 'دور جديد', use: 'تجاري', ratio: 0.5, count: 1, cost: 0, load: 1.15, price: 0, plan: S.plans[0].id }), plans: () => ({ id: 'p' + Date.now().toString(36), name: 'خطة جديدة', start: 1, years: [0.3, 0.4, 0.3], plan: [{ down: 0.1, months: 60 }] }) };
  function bind() {
    root.oninput = e => { const t = e.target; if (!t.dataset || !t.dataset.p) return; const ty = t.dataset.t;
      if (ty === 'dist') { const es = S.exec.dist[0] ? S.exec.dist[0].esc : 0.1; const v = t.value.split(/[,،\s]+/).map(x => parse(x, 'pct')).filter(x => x > 0); if (v.length) S.exec.dist = v.map(p => ({ pct: p, esc: es })); }
      else if (ty === 'esc') { const v = parse(t.value, 'pct'); S.exec.dist.forEach(d => d.esc = v); }
      else if (t.tagName !== 'SELECT') setP(t.dataset.p, parse(t.value, ty));
      else return;
      touch(); recalc(); };
    root.onchange = e => { const t = e.target; if (t.tagName === 'SELECT' && t.dataset.p) { setP(t.dataset.p, t.value); touch(); recalc(true); } };
    if (!root._fsfo) root._fsfo = 1, root.addEventListener('focusout', e => { const t = e.target; if (view === 'list' || !t.dataset || !t.dataset.p) return; if (t.tagName === 'INPUT' && t.dataset.t !== 'text') t.value = fmtIn(getP(t.dataset.p), t.dataset.t); if (/^plans\.\d+\.name$/.test(t.dataset.p)) renderForm(); });
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
      if (d.back != null) { if (dirty && !confirm('فيه تعديلات مش محفوظة. ترجع من غير حفظ؟')) return; return showList(); }
      if (d.v) return setView(d.v);
      if (d.print != null) { setView('rep'); document.body.classList.add('fs-print'); setTimeout(() => { window.print(); document.body.classList.remove('fs-print'); }, 50); return; }
      if (d.xlsx != null) return exportX();
      if (d.save != null) return save();
      if (d.dup != null) { const c = clone(S); c.info.name = (c.info.name || '') + ' — نسخة'; openStudy(c, ''); touch(); return toast('اتعملت نسخة — احفظها باسم جديد'); }
      if (d.delStudy != null) { if (!confirm('حذف الدراسة دي نهائياً؟')) return; const { error } = await sb.from('feasibility_studies').delete().eq('id', curId); if (error) return toast(error.message); toast('اتحذفت'); dirty = false; return showList(); }
      if (d.add) S[d.add].push(NEW[d.add]());
      else if (d.addyear != null) S.plans.forEach(p => { p.years.push(0); p.plan.push(clone(p.plan[p.plan.length - 1])); });
      else if (d.del) { const ks = d.del.split('.'); const i = +ks.pop(); getP(ks.join('.')).splice(i, 1); }
      else return;
      touch(); renderForm(); recalc(true);
    };
  }
  async function save() {
    R = ENG.compute(S);
    const row = { name: S.info.name || 'دراسة بدون اسم', location: S.info.location || null, data: S, net_profit: Math.round(R.net), irr: R.irrA, updated_at: new Date().toISOString() };
    status('جارٍ الحفظ…');
    const res = curId ? await sb.from('feasibility_studies').update(row).eq('id', curId).select('id').single() : await sb.from('feasibility_studies').insert(row).select('id').single();
    if (res.error) { status('تعذر الحفظ'); return toast('مقدرتش أحفظ: ' + res.error.message); }
    const first = !curId; curId = res.data.id; dirty = false; status('محفوظ'); toast('اتحفظت الدراسة');
    if (first) { const bar = q('[data-dup]'); if (bar && !q('[data-del-study]')) bar.insertAdjacentHTML('afterend', '<button class="fs-btn d" data-del-study>حذف</button>'); }
  }
  function exportX() {
    const X = window.XLSX; if (!X) return toast('مكتبة Excel لسه بتحمّل، جرب تاني');
    const r = R, wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const add = (name, rows, w) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = (w || [40, 18, 18, 18, 18, 18, 18, 18, 18, 18]).map(c => ({ wch: c })); X.utils.book_append_sheet(wb, ws, name); };
    const R0 = v => Math.round(v);
    add('الملخص', [[S.info.name], [S.info.location || ''], [], ['المؤشر', 'القيمة'], ['إجمالي المبيعات', R0(r.revenue)], ['إجمالي التكاليف', R0(r.totalCost)], ['صافي الربح', R0(r.net)], ['هامش صافي الربح', r.margin], ['NPV', R0(r.npv)], ['IRR سنوي', r.irrA], ['MIRR', r.mirr], ['أقصى احتياج تمويلي', R0(r.peak)], ['فترة الاسترداد (شهر)', r.payback], ['ROI', r.roi], ['القرار', verdict(r)]]);
    add('قائمة الدخل', [['البيان', 'القيمة', '% من المبيعات'], ...[['إجمالي المبيعات', r.revenue], ['تكلفة الأرض', -r.landTotal], ['الإنشاءات', -r.constr], ['ارتفاع الأسعار', -r.escalation], ['مجمل الربح', r.gross], ['التصميمات', -r.design], ['التراخيص', -r.lic], ['الاستشاري', -r.consult], ['بيعية', -r.selling], ['تسويقية', -r.marketing], ['عمومية وإدارية', -r.ga], ['مقابل إدارة', -r.mgmtSales], ['صافي الربح قبل الضرائب', r.ebit], ['الضرائب', -r.tax], ['بعد الضرائب', r.npat], ['نسبة الإدارة', -r.mgmtProfit], ['صافي الربح', r.net]].map(([l, v]) => [l, R0(v), r.revenue ? v / r.revenue : 0])]);
    add('الأدوار', [['الدور', 'التخصيص', 'النسبة البنائية', 'مساحة الدور', 'عدد', 'تكلفة/م2', 'تكلفة التنفيذ', 'معامل التحميل', 'المساحة البيعية', 'سعر البيع/م2', 'قيمة المبيعات'], ...S.floors.map(f => { const A = (+f.ratio || 0) * (+S.land.area || 0), n = +f.count || 1, sa = +f.price ? A * n * (+f.load || 1) : 0; return [f.name, f.use, +f.ratio, R0(A), n, +f.cost, R0(A * n * f.cost), +f.load, R0(sa), +f.price, R0(sa * f.price)]; })]);
    add('الأرض', [['قيمة الأرض', R0(r.landVal)], ['المقدم', R0(r.landDown)], ['الأوفر', R0(r.landOver)], ['مصاريف إدارية', R0(r.landAdmin)], ['الفوائد', R0(r.landInterest)], ['الإجمالي', R0(r.landTotal)], [], ['القسط', 'الشهر', 'القيمة', 'الفائدة', 'الإجمالي', 'الرصيد'], ...r.inst.map(a => [a.k, a.month, R0(a.principal), R0(a.interest), R0(a.total), R0(a.balance)])]);
    const keys = Object.keys(r.pay), lab = { land: 'مقدم الأرض والأوفر', landInst: 'أقساط الأرض', landInt: 'فوائد الأرض', design: 'تصميمات', lic: 'تراخيص', consult: 'استشاري', constr: 'التنفيذ', esc: 'ارتفاع الأسعار', sell: 'بيعية', mkt: 'تسويقية', ga: 'عمومية', mgmtS: 'مقابل إدارة', tax: 'ضرائب', mgmtP: 'نسبة الإدارة' };
    add('التدفق السنوي', [['البيان', ...r.years.map(a => a.y === 0 ? 'قبل البدء' : 'سنة ' + a.y)], ['المبيعات المتعاقد عليها', ...r.years.map(a => R0(a.sales))], ['دفعات التعاقد', ...r.years.map(a => R0(a.down))], ['الأقساط', ...r.years.map(a => R0(a.inst))], ['إجمالي المقبوضات', ...r.years.map(a => R0(a.rec))], ...keys.map(k => [lab[k], ...r.years.map(a => R0(a.parts[k]))]), ['إجمالي المدفوعات', ...r.years.map(a => R0(a.pay))], ['صافي التدفق', ...r.years.map(a => R0(a.net))], ['التراكمي', ...r.years.map(a => R0(a.cum))], ['رصيد النقدية', ...r.years.map(a => R0(a.bal))]], [26, ...r.years.map(() => 16)]);
    const mh = ['الشهر', 'المبيعات', 'دفعات التعاقد', 'الأقساط', 'المقبوضات', ...keys.map(k => lab[k]), 'المدفوعات', 'الصافي', 'التراكمي', 'الرصيد'];
    add('التدفق الشهري', [mh, ...r.rec.map((_, m) => [m, R0(r.salesM[m]), R0(r.downM[m]), R0(r.instM[m]), R0(r.rec[m]), ...keys.map(k => R0(r.pay[k][m])), R0(r.payM[m]), R0(r.netM[m]), R0(r.cum[m]), R0(r.balM[m])])], mh.map(() => 14));
    X.writeFile(wb, ('دراسة جدوى - ' + (S.info.name || 'مشروع')).replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + '.xlsx');
  }

  await showList();
}
