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
.fs .neg{color:var(--fneg)}
.fs-dlg{border:1px solid var(--line);border-radius:16px;padding:20px;max-width:min(560px,92vw);width:100%;background:var(--card);color:var(--ink)}.fs-dlg::backdrop{background:rgba(0,0,0,.45)}
.fs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.fs-card{display:flex;flex-direction:column;gap:4px;text-align:right;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;font:inherit;color:inherit}
.fs-card:hover{border-color:var(--acc)}.fs-card b{font-size:16px}.fs-card .r{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--mut)}.fs-card .r em{font-style:normal;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.fs-card.new{border-style:dashed;align-items:center;justify-content:center;min-height:120px;color:var(--acc);font-weight:700}
@media(max-width:1100px){.fs-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.fs-side{position:static;grid-template-columns:minmax(0,1fr)}.fs-kpis{grid-template-columns:1fr 1fr}.fs-f.w2{grid-column:auto}}
.fs-rep{--pi:#1b1c1e;--pm:#6b6c6f;--pl:#e6e3dc;--pb:#f6f4ef;color-scheme:light;color:var(--pi);max-width:1000px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:16px;padding:clamp(14px,3vw,34px);font-size:15px}
.fs-cov{background:#1b1c1e;color:#fff;border-radius:14px;padding:18px 22px 16px;border-bottom:5px solid #f26b1d;margin-bottom:14px}
.fs-cov .t{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.85}.fs-cov img{height:38px;width:auto}
.fs-cov h2{font-size:clamp(24px,3.4vw,34px);line-height:1.15;margin:12px 0 10px}
.fs-cov .ch{display:flex;flex-wrap:wrap;gap:6px}.fs-cov .ch span{background:rgba(255,255,255,.12);border-radius:99px;padding:2px 11px;font-size:13px}
.fs-vb{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;border-radius:14px;padding:14px 18px;margin-bottom:14px;border:1px solid}
.fs-vb.good{background:#eaf6ef;border-color:#9fd3b4}.fs-vb.mid{background:#fdf4e3;border-color:#ecc77d}.fs-vb.bad{background:#fbeceb;border-color:#e8a7a1}
.fs-vb span{font-size:12px;color:var(--pm);display:block}.fs-vb b{font-size:20px}.fs-vb p{margin:4px 0 0;font-size:14px}
.fs-vb.good b{color:#1f6b43}.fs-vb.mid b{color:#94600c}.fs-vb.bad b{color:#a2271f}
.fs-vb .nv{text-align:center;border-inline-start:1px solid rgba(0,0,0,.12);padding-inline-start:18px}.fs-vb .nv b{font-size:30px;display:block;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}.fs-vb .nv small{color:var(--pm)}
.fs-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:6px}
.fs-tile{position:relative;background:var(--pb);border-radius:12px;padding:12px 14px 12px 50px;border-top:4px solid var(--c);min-height:86px}
.fs-tile svg{position:absolute;left:12px;top:14px;width:28px;height:28px;fill:none;stroke:var(--c);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.fs-tile span{display:block;font-size:13px;color:var(--pm)}.fs-tile b{display:block;font-size:22px;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap}.fs-tile small{font-size:12px;color:var(--pm)}
.fs-sec{margin-top:18px}
.fs-rep h4{font-size:18px;margin:0 0 10px;padding-inline-start:10px;border-inline-start:4px solid #f26b1d;line-height:1.3}.fs-rep h4 small{font-size:13px;color:var(--pm);font-weight:500}
.fs-story{margin:0;padding:0;list-style:none;display:grid;gap:8px}.fs-story li{background:var(--pb);border-radius:10px;padding:10px 14px;font-size:15px;line-height:1.7}.fs-story b{font-variant-numeric:tabular-nums}
.fs-rep .neg{color:#b3261e}
.fs-rt{border-collapse:collapse;width:100%;font-size:14px;background:#fff;border:0;border-radius:0;overflow:visible}
.fs-rt th,.fs-rt td{padding:6px 8px;border-bottom:1px solid var(--pl);text-align:right}
.fs-rt thead th{background:#2b3a55;color:#fff;font-weight:600;font-size:12.5px;white-space:nowrap}
.fs-rt tbody tr:nth-child(even) td{background:#fbfaf7}
.fs-rt .n{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr}
.fs-rt tbody tr.t td{font-weight:700;border-top:2px solid var(--pi)}.fs-rt tbody tr.s td{font-weight:700;background:var(--pb)}
.fs-rt .nr{text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}
.fs-rt tbody tr.s.in td{background:#e6f1f3;color:#145564}.fs-rt tbody tr.s.out td{background:#fdeee4;color:#9a3f0b}.fs-rt tr.cm td{font-weight:700;color:#2b3a55}
.fs-rt tbody tr.k td{font-weight:700;background:#f26b1d;color:#fff}
.fs-cb{font-size:13px}.fs-cb td:first-child{white-space:nowrap}
.fs-sens td{text-align:center!important;border:2px solid #fff!important;border-radius:6px}.fs-sens td b{display:block;font-size:16px;font-variant-numeric:tabular-nums}.fs-sens td small{opacity:.8;font-size:12px}
.fs-sens td.cur{outline:3px solid #1b1c1e;outline-offset:-3px}.fs-sens tbody th{background:#2b3a55;color:#fff;font-size:12.5px;text-align:center}
.fs-chart{width:100%;height:auto;display:block;direction:ltr;font-family:inherit}
.fs-leg{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--pm);margin-top:4px;justify-content:center}.fs-leg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-inline-end:5px}
.fs-c2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
.fs-dnw{display:flex;gap:14px;align-items:center}.fs-dn{width:170px;flex:none;direction:ltr}
.fs-dl{list-style:none;margin:0;padding:0;flex:1;display:grid;gap:5px;font-size:13.5px}.fs-dl li{display:grid;grid-template-columns:12px minmax(0,1fr) 40px 86px;gap:7px;align-items:center}
.fs-dl i{width:12px;height:12px;border-radius:3px}.fs-dl b,.fs-dl em{text-align:left;font-variant-numeric:tabular-nums;font-style:normal}.fs-dl em{color:var(--pm)}
.fs-mts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 24px}
.fs-mt .h{display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-bottom:5px}.fs-mt .h b{font-variant-numeric:tabular-nums}.fs-mt .tr{background:var(--pb);border-radius:99px;height:12px;overflow:hidden}.fs-mt .tr div{height:100%;border-radius:99px}
.fs-rep .fs-hint{color:var(--pm)}
.fs-foot{margin-top:24px;color:var(--pm);font-size:12px;border-top:1px solid var(--pl);padding-top:10px}
@media(max-width:760px){.fs-tiles{grid-template-columns:1fr 1fr}.fs-vb{grid-template-columns:minmax(0,1fr)}.fs-vb .nv{border:0;padding:0;text-align:start}.fs-c2,.fs-mts{grid-template-columns:minmax(0,1fr)}.fs-dnw{flex-direction:column;align-items:stretch}.fs-dn{margin:0 auto}.fs-rep .fs-tw,.fs-sec{overflow-x:auto}}
#fsPrint{display:none}
@page{size:A4;margin:11mm}
@page wide{size:A4 landscape;margin:10mm}
@media print{
body.fs-print>*:not(#fsPrint){display:none!important}body.fs-print{background:#fff!important}
body.fs-print #fsPrint{display:block}
#fsPrint *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
#fsPrint .fs-rep{max-width:none;border:0;border-radius:0;padding:0;font-size:12.5px}
#fsPrint .fs-sec,#fsPrint .fs-vb,#fsPrint .fs-tiles,#fsPrint .fs-cov,#fsPrint .fs-story li,#fsPrint .fs-tile{break-inside:avoid;page-break-inside:avoid}
#fsPrint .fs-sec{margin-top:12px}
#fsPrint .fs-pb{break-before:page;page-break-before:always}
#fsPrint .wide{page:wide}
#fsPrint h4{break-after:avoid}
#fsPrint .fs-rt{font-size:11px}#fsPrint .fs-rt th,#fsPrint .fs-rt td{padding:4px 6px}
#fsPrint thead{display:table-header-group}#fsPrint tr{break-inside:avoid}
#fsPrint .fs-chart{max-height:68mm}
#fsPrint .fs-cov{padding:12px 18px 12px;margin-bottom:10px}#fsPrint .fs-cov h2{font-size:24px;margin:8px 0 8px}#fsPrint .fs-cov img{height:32px}
#fsPrint .fs-vb{padding:10px 14px;margin-bottom:10px}#fsPrint .fs-tiles{gap:8px}#fsPrint .fs-tile{min-height:0;padding:8px 12px 8px 44px}
#fsPrint .fs-story{gap:5px}#fsPrint .fs-story li{padding:6px 12px;font-size:12.5px;line-height:1.6}
#fsPrint .fs-dn{width:130px}#fsPrint .fs-dnw{gap:10px}#fsPrint .fs-dl{font-size:11.5px;gap:3px}#fsPrint .fs-dl li{grid-template-columns:10px minmax(0,1fr) 34px 74px;gap:5px}
#fsPrint .fs-tile b{font-size:19px}#fsPrint .fs-vb .nv b{font-size:26px}
#fsPrint .fs-c2{grid-template-columns:1fr 1fr}#fsPrint .fs-tiles{grid-template-columns:repeat(3,1fr)}
}
`;

const clone = o => JSON.parse(JSON.stringify(o));
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const N = v => (v == null || !isFinite(v)) ? '—' : nf0.format(Math.round(v));
const Mn = v => (v == null || !isFinite(v)) ? '—' : Math.abs(v) >= 1e9 ? nf2.format(Math.round(v / 1e7) / 100) + ' مليار' : nf2.format(Math.round(v / 1e5) / 10) + ' مليون';
const Pc = v => (v == null || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const mLabel = m => m === 0 ? 'قبل البدء' : 'شهر ' + m + ' (سنة ' + Math.ceil(m / 12) + ')';
const USES = ['تجاري', 'إداري', 'طبي', 'سكني', 'فندقي', 'جراج', 'خدمات (غير مباع)'];

export async function mount(root, ctx) {
  const { sb, toast, esc, canEdit } = ctx;
  if (!document.getElementById('fs-css')) { const st = document.createElement('style'); st.id = 'fs-css'; st.textContent = CSS; document.head.append(st); }
  const q = s => root.querySelector(s);
  let S = null, R = null, curId = '', dirty = false, view = 'list', list = [], shareTok = null;

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
      else if (b.dataset.open) { const { data, error } = await sb.from('feasibility_studies').select('*').eq('id', b.dataset.open).single(); if (error) return toast(error.message); shareTok = data.share_token || null; openStudy(data.data, data.id); }
    };
    root.oninput = root.onchange = root.onfocusout = null;
  }

  /* ---------- فتح دراسة ---------- */
  function openStudy(data, id) {
    S = Object.assign(clone(BLANK), data); curId = id; dirty = false; view = 'in';
    while (S.plans[0].years.length > 1 && S.plans.every(p => !+p.years[p.years.length - 1])) S.plans.forEach(p => p.years.pop());
    root.innerHTML = `<div class="fs"><div class="fs-bar">
      <button class="fs-btn sm" data-back>‹ كل الدراسات</button>
      <div class="fs-tabs"><button class="fs-tab on" data-v="in">المدخلات</button><button class="fs-tab" data-v="rep">التقرير الكامل</button><button class="fs-tab" data-v="brief">التقرير المختصر</button></div>
      ${canEdit ? '<button class="fs-btn p" data-save>حفظ</button><button class="fs-btn" data-dup>نسخة</button>' : ''}
      <button class="fs-btn" data-xlsx>Excel</button><button class="fs-btn" data-print>طباعة / PDF</button>
      ${canEdit && curId ? '<button class="fs-btn" data-share>🔗 رابط عرض</button><button class="fs-btn d" data-del-study>حذف</button>' : ''}
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
    if (v !== 'in') q('#fsRep').innerHTML = repOf(v);
  }
  const repOf = v => v === 'brief' ? reportBrief(R) : reportFull(R);

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
    const L = Math.max(1, ...S.plans.map(p => p.years.length));
    S.plans.forEach(p => { while (p.years.length < L) p.years.push(0); while (p.plan.length < L) p.plan.push(clone(p.plan[p.plan.length - 1] || { down: 0.1, months: 60 })); });
    const ids = S.plans.map(p => p.id); S.floors.forEach(f => { if (!ids.includes(f.plan)) f.plan = ids[0]; });
  }

  /* ---------- شاشة الإدخال ---------- */
  function renderForm() {
    ensurePlans();
    const pl = S.plans.map(x => [x.id, x.name]), yrs = S.plans[0].years.length, mp = pl.length > 1, ey = S.exec.dist.length;
    const cnt = (lab, k, v) => `<label class="fs-f"><span>${lab}</span><input class="fs-in n" data-cnt="${k}" type="number" min="1" max="15" inputmode="numeric" value="${v}"${ro}></label>`;
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
      <div class="fs-fields" style="margin-bottom:12px">${cnt('عدد سنوات البيع', 'sale', yrs)}${fld('سماح قبل أول قسط', 'grace', 'num', 'شهر')}${fld('زيادة سعر البيع سنوياً', 'priceInc', 'pct', '%')}</div>
      <div class="fs-tw"><table class="fs-et fs-pl"><thead><tr><th>خطة البيع</th><th>بدء البيع (شهر)</th><th></th>${Array.from({ length: yrs }, (_, y) => `<th>سنة ${y + 1}</th>`).join('')}<th>المجموع</th><th></th></tr></thead><tbody>
      ${S.plans.map((p, i) => `
        <tr class="p1"><td rowspan="3" class="wn">${inp('plans.' + i + '.name', 'text')}</td><td rowspan="3" style="width:80px">${inp('plans.' + i + '.start')}</td><td class="lab">نسبة البيع %</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.years.' + y, 'pct')}</td>`).join('')}<td class="o" data-o="ps${i}"></td><td rowspan="3">${x && S.plans.length > 1 ? `<button class="fs-x" data-del="plans.${i}" aria-label="حذف الخطة">×</button>` : ''}</td></tr>
        <tr><td class="lab">المقدم %</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.plan.' + y + '.down', 'pct')}</td>`).join('')}<td></td></tr>
        <tr><td class="lab">أقساط (شهر)</td>${Array.from({ length: yrs }, (_, y) => `<td>${inp('plans.' + i + '.plan.' + y + '.months')}</td>`).join('')}<td></td></tr>`).join('')}
      </tbody></table></div>
      <div class="fs-act">${x ? '<button class="fs-btn sm" data-add="plans">+ خطة بيع</button>' : ''}<span class="fs-hint">تغيير عدد سنوات البيع بيوزّع النسب بالتساوي، وبعدها تقدر تعدّل نسبة كل سنة.</span></div>
    </div>
    <div class="fs-blk"><div class="fs-bh"><h3>التنفيذ</h3><span>مدة التنفيذ ${ey} سنة</span></div><div class="fs-fields">
      ${fld('بدء التنفيذ في شهر', 'exec.start', 'num')}${cnt('عدد سنوات التنفيذ', 'exec', ey)}${fld('مخصص ارتفاع الأسعار', 'exec.dist', 'esc', '% سنوياً')}
      ${fld('التصميمات', 'exec.design', 'num', 'جنيه')}${fld('الاستشاري', 'exec.consult', 'num', 'جنيه')}${fld('الرسوم والتراخيص', 'exec.lic', 'num', 'جنيه')}${fld('سداد التراخيص في الأشهر', 'exec.licMonths', 'text')}</div>
      <div class="fs-tw" style="margin-top:12px"><table class="fs-et fs-pl"><thead><tr><th></th>${S.exec.dist.map((_, y) => `<th>سنة ${y + 1}</th>`).join('')}<th>المجموع</th></tr></thead><tbody><tr><td class="lab">نسبة التنفيذ من التكلفة %</td>${S.exec.dist.map((_, y) => `<td>${inp('exec.dist.' + y + '.pct', 'pct')}</td>`).join('')}<td class="o" data-o="eds"></td></tr></tbody></table></div></div>
    <div class="fs-blk"><div class="fs-bh"><h3>المصروفات والتمويل</h3></div><div class="fs-fields">
      ${fld('مصروفات بيعية', 'exp.sell', 'pct', '% مبيعات')}${fld('مصروفات تسويقية', 'exp.mkt', 'pct', '% مبيعات')}${fld('عمومية وإدارية', 'exp.ga', 'pct', '% مبيعات')}${fld('توزع على', 'exp.gaMonths', 'num', 'شهر')}
      <label class="fs-f"><span>وعاء الضريبة</span>${sel('exp.taxBasis', [['sales', 'من المبيعات'], ['profit', 'من صافي الربح']])}</label>${fld('نسبة الضريبة', 'exp.tax', 'pct', '%')}${fld('نسبة الإدارة', 'exp.mgmt', 'pct', '% من الربح')}${fld('مقابل إدارة', 'exp.mgmtSales', 'pct', '% مبيعات')}
      ${fld('رأس المال المتاح', 'fin.equity', 'num', 'جنيه')}${fld('معدل الخصم', 'fin.disc', 'pct', '%')}${fld('معدل إعادة الاستثمار', 'fin.reinv', 'pct', '%')}
    </div></div></div>`;
    fillCalc();
  }

  let tmr = 0;
  function recalc(now) { clearTimeout(tmr); const go = () => { R = ENG.compute(S); fillCalc(); renderSide(); if (view !== 'in') q('#fsRep').innerHTML = repOf(view); }; now ? go() : (tmr = setTimeout(go, 120)); }
  function fillCalc() {
    if (!R) return;
    const set = (k, v) => { const e = root.querySelector(`[data-o="${k}"]`); if (e) e.textContent = v; };
    let ta = 0, tc = 0, ts = 0;
    S.floors.forEach((f, i) => { const A = (+f.ratio || 0) * (+S.land.area || 0), n = +f.count || 1, c = A * n * (+f.cost || 0), v = A * n * (+f.load || 1) * (+f.price || 0); ta += A * n; tc += c; ts += v; set('fa' + i, N(A) + (n > 1 ? ' × ' + n : '')); set('fc' + i, N(c)); set('fs' + i, v ? N(v) : '—'); });
    set('fat', N(ta)); set('fct', N(tc)); set('fst', N(ts));
    S.plans.forEach((p, i) => set('ps' + i, Pc(ENG.sum(p.years)))); set('eds', Pc(ENG.sum(S.exec.dist.map(d => d.pct))));
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

  /* ---------- رسومات التقرير (SVG) ---------- */
  const PAL = ['#f26b1d', '#1f7a8c', '#2b3a55', '#d9a21b', '#3a9d6a', '#b8433a', '#7b5ea7', '#8a8f98', '#c97b4a'];
  const C = { in: '#1f7a8c', out: '#f26b1d', cum: '#2b3a55', good: '#2e8b57', bad: '#c0392b', mid: '#d08a12' };
  const M1 = v => (v == null || !isFinite(v)) ? '—' : (v / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const M2 = v => (v == null || !isFinite(v)) ? '—' : (v / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const UN = v => Math.abs(v) >= 1e9 ? [(v / 1e9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'مليار'] : [M1(v), 'مليون'];
  const Sm = v => (v == null || !isFinite(v)) ? '—' : UN(v).join(' ');
  const axU = vals => Math.max(...vals.map(Math.abs)) >= 1e9 ? [1e9, 'مليار', 1] : [1e6, 'مليون', 0];
  const yrsTxt = m => m == null ? '—' : m < 12 ? m + ' شهر' : (m / 12).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' سنة';
  const tx = (x, y, t, o = '') => `<text x="${x}" y="${y}" ${o}>\u2067${esc(t)}\u2069</text>`;
  const ticksOf = (mn, mx, n = 4) => { const rg = mx - mn || 1, st0 = rg / n, p = Math.pow(10, Math.floor(Math.log10(st0))), st = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= st0) || st0; const a = []; for (let v = Math.ceil(mn / st) * st; v <= mx + 1e-6; v += st) a.push(v); return a; };

  function donut(items, centerTop, centerBot) {
    items = items.filter(i => i[1] > 0); const tot = items.reduce((s, i) => s + i[1], 0) || 1;
    const R = 80, r = 52, c = 90; let a = -Math.PI / 2, s = `<svg class="fs-dn" viewBox="0 0 180 180" role="img">`;
    items.forEach(([, v], k) => { const f = v / tot, b = a + f * 2 * Math.PI, col = PAL[k % PAL.length];
      if (f > 0.9999) s += `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${col}" stroke-width="${R - r}"/>`;
      else { const L = f > 0.5 ? 1 : 0, P = (rr, t) => (c + rr * Math.cos(t)).toFixed(2) + ' ' + (c + rr * Math.sin(t)).toFixed(2);
        s += `<path d="M${P(R, a)} A${R} ${R} 0 ${L} 1 ${P(R, b)} L${P(r, b)} A${r} ${r} 0 ${L} 0 ${P(r, a)}Z" fill="${col}" stroke="#fff" stroke-width="1.5"/>`; }
      a = b; });
    s += tx(c, c - 2, centerTop, 'text-anchor="middle" font-size="22" font-weight="800" fill="#1b1c1e"') + tx(c, c + 18, centerBot, 'text-anchor="middle" font-size="11" fill="#6b6c6f"') + '</svg>';
    return `<div class="fs-dnw">${s}<ul class="fs-dl">${items.map(([l, v], k) => `<li><i style="background:${PAL[k % PAL.length]}"></i><span>${esc(l)}</span><b>${Math.round(v / tot * 100)}%</b><em>${Sm(v)}</em></li>`).join('')}</ul></div>`;
  }

  function waterfall(r) {
    const st = [['المبيعات', r.revenue, 'in'], ['الأرض', -r.landTotal], ['الإنشاءات', -(r.constr + r.escalation)], ['تصميم وتراخيص', -(r.design + r.lic + r.consult)], ['بيع وإدارة', -(r.selling + r.marketing + r.ga + r.mgmtSales)], ['ضرائب وإدارة', -(r.tax + r.mgmtProfit)], ['صافي الربح', r.net, 'tot']].filter((x, i) => i === 0 || i === 6 || x[1]);
    let run = 0; const bars = st.map(([l, v, k]) => { if (k === 'tot') return { l, a: 0, b: v, v, col: v >= 0 ? C.good : C.bad }; if (k === 'in') { run = v; return { l, a: 0, b: v, v, col: C.in }; } const a = run; run += v; return { l, a, b: run, v, col: C.out }; });
    const W = 900, H = 300, top = 30, bot = 40, pl = 10, pr = 10, mx = Math.max(...bars.map(b => Math.max(b.a, b.b)), 0), mn = Math.min(...bars.map(b => Math.min(b.a, b.b)), 0), rg = mx - mn || 1;
    const y = v => top + (H - top - bot) * (mx - v) / rg, cw = (W - pl - pr) / bars.length, bw = cw * 0.56, cx = i => W - pr - cw * (i + 0.5);
    let s = `<svg class="fs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="من المبيعات إلى صافي الربح"><line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="#1b1c1e" stroke-opacity=".35"/>`;
    bars.forEach((b, i) => { const y1 = y(Math.max(b.a, b.b)), h = Math.max(1.5, Math.abs(y(b.a) - y(b.b)));
      s += `<rect x="${cx(i) - bw / 2}" y="${y1}" width="${bw}" height="${h}" rx="4" fill="${b.col}"/>`;
      if (i < bars.length - 1) s += `<line x1="${cx(i) - bw / 2}" x2="${cx(i + 1) + bw / 2}" y1="${y(b.b)}" y2="${y(b.b)}" stroke="#1b1c1e" stroke-opacity=".3" stroke-dasharray="4 3"/>`;
      s += tx(cx(i), y1 - 8, (b.v < 0 && i && i < bars.length - 1 ? Sm(Math.abs(b.v)).replace(/^([\d.,]+)/, '\u2066−$1\u2069') : Sm(b.v)), `text-anchor="middle" font-size="15" font-weight="700" fill="${b.col}"`);
      s += tx(cx(i), H - 14, b.l, 'text-anchor="middle" font-size="14" fill="#3a3b3e"'); });
    return s + '</svg>';
  }

  function chartYears(r) {
    const W = 900, H = 320, ys = r.years, n = ys.length;
    const vals = ys.flatMap(a => [a.rec, -a.pay, a.cum]), T = ticksOf(Math.min(...vals, 0), Math.max(...vals, 0)), mx = Math.max(...T, ...vals), mn = Math.min(...T, ...vals), rg = (mx - mn) || 1;
    const pl = 54, pr = 10, top = 14, bot = 34, cw = (W - pl - pr) / n, bw = Math.min(30, cw * 0.32), [ud, un, ux] = axU(vals);
    const y = v => top + (H - top - bot) * (mx - v) / rg, cx = i => W - pr - cw * (i + 0.5);
    let s = `<svg class="fs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="التدفقات النقدية السنوية">`;
    T.forEach(t => s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#1b1c1e" stroke-opacity="${Math.abs(t) < 1 ? .45 : .08}"/>` + tx(pl - 6, y(t) + 4, (t / ud).toLocaleString('en-US', { maximumFractionDigits: ux }), 'font-size="12" text-anchor="end" fill="#6b6c6f"'));
    ys.forEach((a, i) => {
      s += `<rect x="${cx(i) + 1}" y="${y(a.rec)}" width="${bw}" height="${Math.max(0, y(0) - y(a.rec))}" fill="${C.in}" rx="3"/>`;
      s += `<rect x="${cx(i) - bw - 1}" y="${y(0)}" width="${bw}" height="${Math.max(0, y(-a.pay) - y(0))}" fill="${C.out}" rx="3"/>`;
      s += tx(cx(i), H - 12, i === 0 ? 'قبل البدء' : 'سنة ' + i, 'font-size="12" text-anchor="middle" fill="#3a3b3e"');
    });
    s += `<polyline points="${ys.map((a, i) => cx(i) + ',' + y(a.cum)).join(' ')}" fill="none" stroke="${C.cum}" stroke-width="3" stroke-linejoin="round"/>`;
    ys.forEach((a, i) => s += `<circle cx="${cx(i)}" cy="${y(a.cum)}" r="4.5" fill="#fff" stroke="${C.cum}" stroke-width="2.5"/>`);
    return s + tx(pl - 6, top - 2, un, 'font-size="11" text-anchor="end" fill="#6b6c6f"') + '</svg>';
  }

  function chartCum(r) {
    const W = 900, H = 290, cum = r.cum, n = cum.length - 1 || 1, T = ticksOf(Math.min(...cum, 0), Math.max(...cum, 0)), mx = Math.max(...T, ...cum), mn = Math.min(...T, ...cum), rg = mx - mn || 1;
    const [ud, un, ux] = axU(cum), pl = 54, pr = 10, top = 34, bot = 30, x = m => W - pr - (W - pl - pr) * m / n, y = v => top + (H - top - bot) * (mx - v) / rg, z = y(0);
    const pts = cum.map((v, m) => x(m).toFixed(1) + ',' + y(v).toFixed(1)).join(' '), area = `${x(0)},${z} ${pts} ${x(n)},${z}`;
    let s = `<svg class="fs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="الرصيد النقدي التراكمي"><defs><clipPath id="fsUp"><rect x="0" y="0" width="${W}" height="${z}"/></clipPath><clipPath id="fsDn"><rect x="0" y="${z}" width="${W}" height="${H}"/></clipPath></defs>`;
    T.forEach(t => s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#1b1c1e" stroke-opacity="${Math.abs(t) < 1 ? .45 : .08}"/>` + tx(pl - 6, y(t) + 4, (t / ud).toLocaleString('en-US', { maximumFractionDigits: ux }), 'font-size="12" text-anchor="end" fill="#6b6c6f"'));
    for (let k = 1; k * 12 <= n; k++) s += `<line x1="${x(k * 12)}" x2="${x(k * 12)}" y1="${top}" y2="${H - bot}" stroke="#1b1c1e" stroke-opacity=".06"/>` + tx(x(k * 12), H - 10, 'سنة ' + k, 'font-size="12" text-anchor="middle" fill="#3a3b3e"');
    s += `<polygon points="${area}" fill="${C.good}" fill-opacity=".22" clip-path="url(#fsUp)"/><polygon points="${area}" fill="${C.bad}" fill-opacity=".18" clip-path="url(#fsDn)"/><polyline points="${pts}" fill="none" stroke="${C.cum}" stroke-width="2.5" stroke-linejoin="round"/>`;
    if (r.peak > 0) { const px = x(r.peakMonth), py = y(cum[r.peakMonth]); s += `<circle cx="${px}" cy="${py}" r="6" fill="${C.bad}" stroke="#fff" stroke-width="2"/>` + tx(px, Math.min(H - bot - 4, py + 22), 'أقصى احتياج ' + Sm(r.peak), `text-anchor="${px < 200 ? 'start' : px > W - 200 ? 'end' : 'middle'}" font-size="13" font-weight="700" fill="${C.bad}"`); }
    if (r.payback != null && r.payback > 0) { const px = x(r.payback); s += `<line x1="${px}" x2="${px}" y1="${top - 6}" y2="${H - bot}" stroke="${C.good}" stroke-width="2" stroke-dasharray="5 4"/>` + tx(px, top - 12, 'استرداد كامل: شهر ' + r.payback, `text-anchor="${px < 200 ? 'start' : px > W - 200 ? 'end' : 'middle'}" font-size="13" font-weight="700" fill="${C.good}"`); }
    return s + tx(pl - 6, top - 14, un, 'font-size="11" text-anchor="end" fill="#6b6c6f"') + '</svg>';
  }

  const meter = (val, max, col, lab, txt) => `<div class="fs-mt"><div class="h"><span>${lab}</span><b style="color:${col}">${txt}</b></div><div class="tr"><div style="width:${Math.max(2, Math.min(100, (val || 0) / max * 100)).toFixed(1)}%;background:${col}"></div></div></div>`;

  /* ---------- مكونات التقرير ---------- */
  const tone = r => (r.net > 0 && r.npv > 0 && (r.irrA == null || r.irrA > S.fin.disc)) ? 'good' : r.net > 0 ? 'mid' : 'bad';
  const ICO = { profit: 'M4 17l5-5 4 4 7-8M15 8h5v5', sales: 'M4 7h16v10H4zM8 12h8', cost: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6', irr: 'M4 20V10M10 20V4M16 20v-7M22 20H2', peak: 'M12 4v12m-5-5 5 5 5-5M4 20h16', time: 'M12 7v5l3 3M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18' };
  const tile = (ico, col, lab, val, hint) => `<div class="fs-tile" style="--c:${col}"><svg viewBox="0 0 24 24"><path d="${ICO[ico]}"/></svg><span>${lab}</span><b>${val}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  function cover(r, sub) {
    const I = S.info, sy = Math.max(...S.plans.map(p => { let k = p.years.length; while (k > 1 && !+p.years[k - 1]) k--; return k; })), ey = S.exec.dist.length;
    const chips = [I.location, I.type, 'أرض ' + N(S.land.area) + ' م²', 'بيع ' + sy + ' سنة', 'تنفيذ ' + ey + ' سنة', 'مدة الدراسة ' + yrsTxt(r.months)].filter(Boolean);
    return `<div class="fs-cov"><div class="t"><img src="logo-light.png" alt="ريسان للمقاولات"><span>${sub}${I.date ? ' · بداية ' + esc(I.date) : ''}</span></div><h2>${esc(I.name)}</h2><div class="ch">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div></div>`;
  }
  function verdictBox(r) {
    const t = tone(r), be = ENG.breakEven(S);
    const why = t === 'good' ? `العائد السنوي ${Pc(r.irrA)} أعلى من معدل الخصم ${Pc(S.fin.disc)}، وصافي القيمة الحالية موجب.` : t === 'mid' ? `المشروع يحقق ربحاً، لكن عائده السنوي ${Pc(r.irrA)} أقل من معدل الخصم ${Pc(S.fin.disc)}.` : 'التكاليف أعلى من المبيعات بهذه الافتراضات.';
    return `<div class="fs-vb ${t}"><div><span>النتيجة</span><b>${verdict(r)}</b><p>${why}${be != null && r.net > 0 ? ` ويظل رابحاً حتى لو انخفضت أسعار البيع ${Pc(be)}.` : ''}</p></div><div class="nv"><span>صافي الربح</span><b>${Mn(r.net)}</b><small>${Pc(r.margin)} من المبيعات</small></div></div>`;
  }
  const tiles = r => `<div class="fs-tiles">${tile('sales', C.in, 'إجمالي المبيعات', Mn(r.revenue))}${tile('cost', C.out, 'إجمالي التكاليف', Mn(r.totalCost), 'شامل الأرض والضرائب')}${tile('profit', r.net >= 0 ? C.good : C.bad, 'صافي الربح', Mn(r.net), Pc(r.onCost) + ' على التكلفة')}${tile('irr', C.cum, 'العائد السنوي IRR', Pc(r.irrA), 'معدل الخصم ' + Pc(S.fin.disc))}${tile('peak', C.bad, 'أقصى تمويل مطلوب', Mn(r.peak), mLabel(r.peakMonth))}${tile('time', PAL[3], 'استرداد الفلوس', r.payback == null ? 'لا يسترد' : yrsTxt(r.payback), r.payback == null ? '' : 'شهر ' + r.payback)}</div>`;
  function story(r) {
    const be = ENG.breakEven(S), L = [
      `المشروع يبيع بإجمالي <b>${Mn(r.revenue)}</b> ويتكلف <b>${Mn(r.totalCost)}</b>، فيتبقى صافي ربح <b>${Mn(r.net)}</b>.`,
      `أكبر مبلغ يحتاجه المشروع من جيب المستثمر <b>${Mn(r.peak)}</b>، ويحدث في ${mLabel(r.peakMonth)}${S.fin.equity ? (r.gap > 0 ? `، ورأس المال المتاح (${Mn(r.equity)}) <b class="neg">لا يكفي</b> — العجز ${Mn(r.gap)}` : `، ورأس المال المتاح (${Mn(r.equity)}) يكفي`) : ''}.`,
      r.payback == null ? 'المشروع لا يسترد ما صُرف عليه خلال مدة الدراسة.' : `يسترد المشروع كل ما صُرف عليه بعد <b>${yrsTxt(r.payback)}</b> (شهر ${r.payback})، وبعدها تبدأ الفلوس الزيادة.`,
      be != null && r.net > 0 ? `هامش الأمان: يظل المشروع رابحاً حتى لو انخفضت أسعار البيع <b>${Pc(be)}</b>.` : ''
    ].filter(Boolean);
    return `<ul class="fs-story">${L.map(l => `<li>${l}</li>`).join('')}</ul>`;
  }
  const costItems = r => [['الأرض', r.landTotal], ['الإنشاءات', r.constr], ['ارتفاع الأسعار', r.escalation], ['تصميم وتراخيص واستشاري', r.design + r.lic + r.consult], ['بيعية وتسويقية', r.selling + r.marketing], ['عمومية وإدارية', r.ga + r.mgmtSales], ['ضرائب', r.tax], ['نسبة الإدارة', r.mgmtProfit]];
  const useItems = r => { const u = {}; r.sales.forEach(s => u[s.use || 'أخرى'] = (u[s.use || 'أخرى'] || 0) + s.value); return Object.entries(u).sort((a, b) => b[1] - a[1]); };
  const leg = a => `<div class="fs-leg">${a.map(([c, l, line]) => `<span><i style="background:${c}${line ? ';height:4px;vertical-align:3px' : ''}"></i>${l}</span>`).join('')}</div>`;
  const sec = (title, body, cls = '', small = '') => `<section class="fs-sec ${cls}"><h4>${title}${small ? ` <small>${small}</small>` : ''}</h4>${body}</section>`;
  const foot = () => `<div class="fs-foot">دراسة مبدئية مبنية على الافتراضات المدخلة؛ المبالغ بالجنيه المصري. أُعدت بواسطة ريسان للمقاولات في ${new Date().toLocaleDateString('ar-EG')}.</div>`;

  /* ---------- التقرير المختصر ---------- */
  function reportBrief(r) {
    const be = ENG.breakEven(S);
    return `<div class="fs-rep">${cover(r, 'ملخص دراسة الجدوى')}${verdictBox(r)}${tiles(r)}
    ${sec('الخلاصة', story(r))}
    ${sec('من المبيعات إلى صافي الربح', waterfall(r), '', 'بالجنيه')}
    ${sec('حركة الفلوس عبر الزمن', chartCum(r) + leg([[C.bad + '55', 'فترة الصرف من جيب المستثمر'], [C.good + '55', 'فترة الربح'], [C.cum, 'الرصيد التراكمي', 1]]), 'fs-pb', 'بالجنيه')}
    <section class="fs-sec"><div class="fs-c2"><div><h4>أين تذهب التكلفة؟</h4>${donut(costItems(r), UN(r.totalCost)[0], UN(r.totalCost)[1] + ' جنيه')}</div><div><h4>من أين تأتي المبيعات؟</h4>${donut(useItems(r), UN(r.revenue)[0], UN(r.revenue)[1] + ' جنيه')}</div></div></section>
    ${sec('مؤشرات سريعة', `<div class="fs-mts">${meter(r.margin, 0.5, r.margin > 0 ? C.good : C.bad, 'هامش صافي الربح', Pc(r.margin))}${meter(r.irrA, Math.max(0.6, (r.irrA || 0) * 1.1), (r.irrA || 0) > S.fin.disc ? C.good : C.mid, 'العائد السنوي IRR (معدل الخصم ' + Pc(S.fin.disc) + ')', Pc(r.irrA))}${be != null ? meter(be, 0.6, be > 0.15 ? C.good : C.mid, 'أقصى انخفاض يتحمله سعر البيع', Pc(be)) : ''}${meter(r.roi, Math.max(1, (r.roi || 0) * 1.1), C.cum, 'العائد على أقصى تمويل', Pc(r.roi))}</div>`)}
    ${foot()}</div>`;
  }

  /* ---------- التقرير الكامل ---------- */
  function reportFull(r) {
    const rv = r.revenue || 1;
    const pr = (l, v, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="n ${v < 0 ? 'neg' : ''}">${M2(v)}</td><td class="n">${Pc(v / rv)}</td></tr>`;
    const steps = [-0.2, -0.1, 0, 0.1, 0.2], sens = steps.map(c => steps.map(p => ENG.compute(S, { price: 1 + p, cost: 1 + c }))), smx = Math.max(...sens.flat().map(c => Math.abs(c.net)), 1);
    const heat = v => { const t = Math.min(1, Math.abs(v) / smx); return v >= 0 ? `background:hsl(150 42% ${94 - 44 * t}%);color:${t > .6 ? '#fff' : '#14361f'}` : `background:hsl(4 62% ${94 - 40 * t}%);color:${t > .6 ? '#fff' : '#5a1510'}`; };
    const parts = [['مقدم وأقساط الأرض', 'land', 'landInst'], ['فوائد الأرض', 'landInt'], ['التنفيذ', 'constr'], ['ارتفاع الأسعار', 'esc'], ['تصميمات واستشاري وتراخيص', 'design', 'consult', 'lic'], ['بيعية وتسويقية', 'sell', 'mkt'], ['عمومية وإدارية', 'ga', 'mgmtS'], ['ضرائب', 'tax'], ['نسبة الإدارة', 'mgmtP']];
    const yh = r.years.map(a => `<th class="n">${a.y === 0 ? 'قبل البدء' : 'سنة ' + a.y}</th>`).join('');
    const yr = (l, f, cls = '') => { const v0 = r.years.map(f); return v0.some(v => Math.abs(v) >= 5e3) || cls ? `<tr class="${cls}"><td>${l}</td>${v0.map(v => `<td class="n ${v < -1 ? 'neg' : ''}">${Math.abs(v) < 5e3 ? '–' : M1(v)}</td>`).join('')}</tr>` : ''; };
    const be = ENG.breakEven(S), wide = r.years.length > 7;
    return `<div class="fs-rep">${cover(r, 'دراسة جدوى مالية')}${verdictBox(r)}${tiles(r)}
    ${sec('الخلاصة', story(r))}
    ${sec('من المبيعات إلى صافي الربح', waterfall(r), '', 'بالجنيه')}
    ${sec('التدفقات النقدية السنوية', chartYears(r) + leg([[C.in, 'المقبوضات'], [C.out, 'المدفوعات'], [C.cum, 'الرصيد التراكمي', 1]]), 'fs-pb', 'بالجنيه')}
    ${sec('الرصيد النقدي التراكمي شهرياً', chartCum(r) + leg([[C.bad + '55', 'فترة الصرف من جيب المستثمر'], [C.good + '55', 'فترة الربح'], [C.cum, 'الرصيد التراكمي', 1]]), '', 'بالجنيه')}
    <section class="fs-sec fs-pb"><div class="fs-c2"><div><h4>هيكل التكاليف</h4>${donut(costItems(r), UN(r.totalCost)[0], UN(r.totalCost)[1] + ' جنيه')}</div><div><h4>المبيعات حسب التخصيص</h4>${donut(useItems(r), UN(r.revenue)[0], UN(r.revenue)[1] + ' جنيه')}</div></div></section>
    ${sec('قائمة الدخل التقديرية', `<table class="fs-rt"><thead><tr><th>البيان</th><th class="n">مليون جنيه</th><th class="n">% من المبيعات</th></tr></thead><tbody>
      ${pr('إجمالي المبيعات', r.revenue, 's')}${pr('تكلفة الأرض (شاملة الفوائد والأوفر والمصاريف)', -r.landTotal)}${pr('تكاليف الإنشاءات', -r.constr)}${pr('مخصص ارتفاع الأسعار', -r.escalation)}
      ${pr('مجمل الربح', r.gross, 's')}${pr('التصميمات', -r.design)}${pr('الرسوم والتراخيص', -r.lic)}${pr('الاستشاري', -r.consult)}${pr('المصروفات البيعية', -r.selling)}${pr('المصروفات التسويقية', -r.marketing)}${pr('عمومية وإدارية', -r.ga)}${r.mgmtSales ? pr('مقابل إدارة', -r.mgmtSales) : ''}
      ${pr('صافي الربح قبل الضرائب', r.ebit, 's')}${pr('الضرائب', -r.tax)}${pr('صافي الربح بعد الضرائب', r.npat, 's')}${r.mgmtProfit ? pr('نسبة الإدارة ' + Pc(S.exp.mgmt) + ' من صافي الربح', -r.mgmtProfit) : ''}${pr('صافي الربح', r.net, 'k')}
    </tbody></table>`)}
    ${sec('معايير التقييم المالي', `<table class="fs-rt"><thead><tr><th>المؤشر</th><th class="n">القيمة</th><th>المعنى</th></tr></thead><tbody>
      <tr><td>صافي القيمة الحالية NPV</td><td class="nr ${r.npv < 0 ? 'neg' : ''}">${Mn(r.npv)}</td><td>${r.npv > 0 ? 'موجب: العائد يفوق' : 'سالب: العائد أقل من'} معدل الخصم ${Pc(S.fin.disc)}</td></tr>
      <tr><td>معدل العائد الداخلي IRR (سنوي)</td><td class="n">${Pc(r.irrA)}</td><td>العائد السنوي الفعلي على الفلوس المصروفة</td></tr><tr><td>معدل العائد الداخلي المعدل MIRR</td><td class="n">${Pc(r.mirr)}</td><td>بإعادة استثمار ${Pc(S.fin.reinv)}</td></tr>
      <tr><td>هامش صافي الربح</td><td class="n">${Pc(r.margin)}</td><td>صافي الربح ÷ المبيعات</td></tr><tr><td>صافي الربح إلى إجمالي التكلفة</td><td class="n">${Pc(r.onCost)}</td><td>كل 100 جنيه تكلفة تكسب ${Math.round(r.onCost * 100)} جنيه</td></tr>
      <tr><td>صافي الربح إلى تكلفة الأرض</td><td class="n">${Pc(r.onLand)}</td><td></td></tr><tr><td>العائد على أقصى احتياج تمويلي</td><td class="n">${Pc(r.roi)}</td><td>صافي الربح ÷ ${Mn(r.peak)}</td></tr>
      ${r.roiEq != null ? `<tr><td>العائد على رأس المال المتاح</td><td class="n">${Pc(r.roiEq)}</td><td>صافي الربح ÷ ${Mn(r.equity)}</td></tr>` : ''}
      <tr><td>نقطة التعادل في سعر البيع</td><td class="n">${be == null ? '—' : '−' + Pc(be)}</td><td>أقصى انخفاض في الأسعار قبل الخسارة</td></tr>
    </tbody></table>`)}
    ${sec('تكلفة الأرض وجدول الأقساط', `<table class="fs-rt"><tbody>
      <tr><td>مساحة الأرض × سعر المتر</td><td class="nr">${N(S.land.area)} م² × ${N(r.landPrice)} جنيه</td><td class="n">${M2(r.landVal)}</td></tr><tr><td>الدفعة المقدمة ${Pc(S.land.down)}</td><td></td><td class="n">${M2(r.landDown)}</td></tr>
      <tr><td>الأوفر + المصاريف الإدارية</td><td></td><td class="n">${M2(r.landOver + r.landAdmin)}</td></tr><tr><td>الفوائد على الأقساط (${Pc(S.land.rate)} متناقصة)</td><td></td><td class="n">${M2(r.landInterest)}</td></tr>
      <tr class="t"><td>إجمالي تكلفة الأرض (مليون جنيه)</td><td class="nr">${N(r.landTotal / (S.land.area || 1))} جنيه للمتر</td><td class="n">${M2(r.landTotal)}</td></tr></tbody></table>
    ${r.inst.length ? `<table class="fs-rt" style="margin-top:10px"><thead><tr><th>القسط</th><th>موعد السداد</th><th class="n">القسط</th><th class="n">الفائدة</th><th class="n">الإجمالي</th><th class="n">الرصيد بعده</th></tr></thead><tbody>
      ${r.inst.map(a => `<tr><td>${a.k}</td><td>${mLabel(a.month)}</td><td class="n">${M2(a.principal)}</td><td class="n">${M2(a.interest)}</td><td class="n">${M2(a.total)}</td><td class="n">${M2(a.balance)}</td></tr>`).join('')}
      <tr class="t"><td>الإجمالي</td><td></td><td class="n">${M2(r.instTotal)}</td><td class="n">${M2(r.landInterest)}</td><td class="n">${M2(r.instTotal + r.landInterest)}</td><td></td></tr></tbody></table>` : ''}`, '', 'المبالغ بالمليون جنيه')}
    ${sec('الأدوار: التنفيذ والمبيعات', `<table class="fs-rt"><thead><tr><th>الدور</th><th>التخصيص</th><th class="n">مساحة الدور م²</th><th class="n">عدد</th><th class="n">تكلفة/م²</th><th class="n">التنفيذ (مليون)</th><th class="n">المساحة البيعية م²</th><th class="n">سعر البيع/م²</th><th class="n">المبيعات (مليون)</th></tr></thead><tbody>
      ${S.floors.map(f => { const A = (+f.ratio || 0) * (+S.land.area || 0), n = +f.count || 1, sa = A * n * (+f.load || 1); return `<tr><td>${esc(f.name)}</td><td>${esc(f.use)}</td><td class="n">${N(A)}</td><td class="n">${n}</td><td class="n">${N(+f.cost)}</td><td class="n">${M1(A * n * (+f.cost || 0))}</td><td class="n">${+f.price ? N(sa) : '—'}</td><td class="n">${+f.price ? N(+f.price) : '—'}</td><td class="n">${+f.price ? M1(sa * f.price) : '—'}</td></tr>`; }).join('')}
      <tr class="t"><td colspan="5">الإجمالي</td><td class="n">${M1(r.constr)}</td><td class="n">${N(r.sales.reduce((a, s) => a + s.area, 0))}</td><td></td><td class="n">${M1(r.listValue)}</td></tr></tbody></table>
      <p class="fs-hint">التنفيذ يبدأ ${mLabel(+S.exec.start)} على ${S.exec.dist.length} سنة: ${S.exec.dist.map((d, i) => 'السنة ' + (i + 1) + ' ' + Pc(d.pct)).join(' · ')}، مع مخصص ارتفاع أسعار ${Mn(r.escalation)}.</p>`)}
    ${sec('خطط البيع والتحصيل', `<table class="fs-rt"><thead><tr><th>الخطة</th><th>توزيع البيع على السنوات</th><th>شروط السداد</th><th class="n">المبيعات (مليون)</th></tr></thead><tbody>
      ${S.plans.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${p.years.map((v, y) => v ? 'س' + (y + 1) + ' ' + Pc(v) : '').filter(Boolean).join(' · ')}</td><td>${p.plan.map((x, y) => p.years[y] ? 'س' + (y + 1) + ': ' + Pc(x.down) + ' مقدم + ' + x.months + ' شهر' : '').filter(Boolean).join(' · ')}</td><td class="n">${M1(r.byPlan[i] && r.byPlan[i].sold)}</td></tr>`).join('')}
    </tbody></table><p class="fs-hint">أول قسط للعميل بعد ${S.grace} شهر من التعاقد${+S.priceInc ? '، وزيادة سعر ' + Pc(S.priceInc) + ' سنوياً' : ''}.</p>`)}
    ${sec('الموازنة النقدية السنوية', `<table class="fs-rt fs-cb"><thead><tr><th>البيان</th>${yh}</tr></thead><tbody>
      ${yr('دفعات التعاقد', a => a.down)}${yr('الأقساط المحصلة', a => a.inst)}${yr('إجمالي المقبوضات', a => a.rec, 's in')}
      ${parts.map(([l, ...k]) => yr(l, a => k.reduce((s, kk) => s + a.parts[kk], 0))).join('')}
      ${yr('إجمالي المدفوعات', a => a.pay, 's out')}${yr('صافي التدفق', a => a.net, 't')}${yr('التراكمي', a => a.cum, 'cm')}${S.fin.equity ? yr('رصيد النقدية (مع رأس المال)', a => a.bal) : ''}
    </tbody></table>`, wide ? 'fs-pb wide' : 'fs-pb', 'بالمليون جنيه')}
    ${sec('تحليل الحساسية', `<p class="fs-hint" style="margin-top:0">كل خانة = صافي الربح (مليون) والعائد السنوي لو اتغيرت أسعار البيع (أفقي) أو التكلفة (رأسي). الأخضر ربح والأحمر خسارة، والخانة المحددة هي الدراسة الحالية.</p><table class="fs-rt fs-sens"><thead><tr><th>التكلفة ↓ / سعر البيع ←</th>${steps.map(p => `<th>${p > 0 ? '+' : ''}${p * 100}%</th>`).join('')}</tr></thead><tbody>
      ${sens.map((row, i) => `<tr><th>${steps[i] > 0 ? '+' : ''}${steps[i] * 100}%</th>${row.map((c, j) => `<td class="${i === 2 && j === 2 ? 'cur' : ''}" style="${heat(c.net)}"><b>${nf0.format(Math.round(c.net / 1e6))}</b><small>${Pc(c.irrA)}</small></td>`).join('')}</tr>`).join('')}
    </tbody></table>`)}
    ${r.warn.length ? sec('ملاحظات على المدخلات', `<ul>${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`) : ''}
    ${S.info.notes ? sec('ملاحظات', `<p>${esc(S.info.notes)}</p>`) : ''}
    <div class="fs-foot">المبيعات تُحسب على ما يُباع فعلاً خلال الدراسة، والضرائب تُسدد نهاية كل سنة بنسبة متحصلاتها، ونسبة الإدارة في نهاية المشروع. دراسة مبدئية مبنية على الافتراضات المدخلة؛ أُعدت بواسطة ريسان للمقاولات في ${new Date().toLocaleDateString('ar-EG')}.</div></div>`;
  }

  /* ---------- الأحداث ---------- */
  const even = n => { const a = Array.from({ length: n }, () => Math.round(10000 / n) / 10000); a[n - 1] = Math.round((1 - a.slice(0, -1).reduce((s, x) => s + x, 0)) * 10000) / 10000; return a; };
  const NEW = { floors: () => ({ name: 'دور جديد', use: 'تجاري', ratio: 0.5, count: 1, cost: 0, load: 1.15, price: 0, plan: S.plans[0].id }), plans: () => ({ id: 'p' + Date.now().toString(36), name: 'خطة جديدة', start: 1, years: even(S.plans[0].years.length), plan: [{ down: 0.1, months: 60 }] }) };
  function bind() {
    root.oninput = e => { const t = e.target; if (!t.dataset || !t.dataset.p) return; const ty = t.dataset.t;
      if (ty === 'dist') { const es = S.exec.dist[0] ? S.exec.dist[0].esc : 0.1; const v = t.value.split(/[,،\s]+/).map(x => parse(x, 'pct')).filter(x => x > 0); if (v.length) S.exec.dist = v.map(p => ({ pct: p, esc: es })); }
      else if (ty === 'esc') { const v = parse(t.value, 'pct'); S.exec.dist.forEach(d => d.esc = v); }
      else if (t.tagName !== 'SELECT') setP(t.dataset.p, parse(t.value, ty));
      else return;
      touch(); recalc(); };
    root.onchange = e => { const t = e.target;
      if (t.dataset.cnt) { const n = Math.min(15, Math.max(1, Math.round(parse(t.value, 'num')) || 1)), ev = even(n);
        if (t.dataset.cnt === 'sale') S.plans.forEach(p => { p.years = ev.slice(); while (p.plan.length < n) p.plan.push(clone(p.plan[p.plan.length - 1] || { down: 0.1, months: 60 })); p.plan.length = n; });
        else { const es = S.exec.dist[0] ? S.exec.dist[0].esc : 0.1; S.exec.dist = ev.map(pct => ({ pct, esc: es })); }
        touch(); setTimeout(() => { renderForm(); recalc(true); }, 0); return; }
      if (t.tagName === 'SELECT' && t.dataset.p) { setP(t.dataset.p, t.value); touch(); recalc(true); } };
    if (!root._fsfo) root._fsfo = 1, root.addEventListener('focusout', e => { const t = e.target; if (view === 'list' || !t.dataset || !t.dataset.p) return; if (t.tagName === 'INPUT' && t.dataset.t !== 'text') t.value = fmtIn(getP(t.dataset.p), t.dataset.t); if (/^plans\.\d+\.name$/.test(t.dataset.p)) renderForm(); });
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
      if (d.back != null) { if (dirty && !confirm('فيه تعديلات مش محفوظة. ترجع من غير حفظ؟')) return; return showList(); }
      if (d.v) return setView(d.v);
      if (d.print != null) return printRep();
      if (d.share != null) return shareDlg();
      if (d.xlsx != null) return exportX();
      if (d.save != null) return save();
      if (d.dup != null) { const c = clone(S); c.info.name = (c.info.name || '') + ' — نسخة'; openStudy(c, ''); touch(); return toast('اتعملت نسخة — احفظها باسم جديد'); }
      if (d.delStudy != null) { if (!confirm('حذف الدراسة دي نهائياً؟')) return; const { error } = await sb.from('feasibility_studies').delete().eq('id', curId); if (error) return toast(error.message); toast('اتحذفت'); dirty = false; return showList(); }
      if (d.add) S[d.add].push(NEW[d.add]());
      else if (d.del) { const ks = d.del.split('.'); const i = +ks.pop(); getP(ks.join('.')).splice(i, 1); }
      else return;
      touch(); renderForm(); recalc(true);
    };
  }
  function shareDlg() {
    const dlg = document.createElement('dialog'); dlg.className = 'fs-dlg'; document.body.append(dlg);
    const url = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'view.html?s=' + shareTok;
    const draw = () => { dlg.innerHTML = `<h3 style="margin:0 0 6px">رابط عرض الدراسة</h3><p class="mut" style="margin:0 0 12px">أي حد معاه الرابط يقدر يشوف التقرير الكامل والمختصر ويطبعهم، من غير تسجيل دخول ومن غير ما يعدّل أي حاجة.</p>
      ${shareTok ? `<input class="fs-in" readonly value="${esc(url())}" dir="ltr" style="width:100%;text-align:left" onclick="this.select()">
      <div class="fs-act" style="margin-top:12px"><button class="fs-btn p" data-cp>نسخ الرابط</button><a class="fs-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('دراسة جدوى: ' + (S.info.name || '') + '\n' + url())}">واتساب</a><a class="fs-btn" target="_blank" rel="noopener" href="${esc(url())}">فتح</a><button class="fs-btn d" data-off>إيقاف الرابط</button></div>
      <p class="fs-hint">الرابط بيعرض آخر نسخة <b>محفوظة</b> — احفظ تعديلاتك الأول عشان تظهر. إيقاف الرابط بيقفله فوراً، ولو عملت رابط جديد بيتغير.</p>`
      : `<div class="fs-act"><button class="fs-btn p" data-on>إنشاء رابط عرض</button></div>`}
      <div class="fs-act" style="margin-top:10px"><button class="fs-btn" data-x>إغلاق</button></div>`; };
    const setTok = async t => { const { error } = await sb.from('feasibility_studies').update({ share_token: t }).eq('id', curId); if (error) { toast(error.message); return false; } shareTok = t; draw(); return true; };
    draw(); dlg.showModal();
    dlg.onclick = async e => { const b = e.target.closest('button'); if (e.target === dlg || (b && b.dataset.x != null)) { dlg.close(); dlg.remove(); return; } if (!b) return;
      if (b.dataset.on != null) { if (dirty) toast('في تعديلات مش محفوظة — الرابط هيعرض آخر نسخة محفوظة'); await setTok(crypto.randomUUID()); }
      else if (b.dataset.off != null) { if (await setTok(null)) toast('الرابط اتقفل'); }
      else if (b.dataset.cp != null) { try { await navigator.clipboard.writeText(url()); toast('الرابط اتنسخ'); } catch { dlg.querySelector('input').select(); } } };
  }
  function printRep() {
    if (view === 'in') setView('rep');
    let box = document.getElementById('fsPrint'); if (!box) { box = document.createElement('div'); box.id = 'fsPrint'; document.body.append(box); }
    box.innerHTML = repOf(view); const t0 = document.title; document.title = (view === 'brief' ? 'ملخص دراسة جدوى - ' : 'دراسة جدوى - ') + (S.info.name || '');
    document.body.classList.add('fs-print');
    const done = () => { document.body.classList.remove('fs-print'); box.innerHTML = ''; document.title = t0; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80);
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

  /* ---------- عرض فقط (رابط مشاركة) ---------- */
  if (ctx.shared) {
    S = Object.assign(clone(BLANK), ctx.shared.data || {}); view = 'brief';
    while (S.plans[0].years.length > 1 && S.plans.every(p => !+p.years[p.years.length - 1])) S.plans.forEach(p => p.years.pop());
    R = ENG.compute(S);
    root.innerHTML = `<div class="fs"><div class="fs-bar"><div class="fs-tabs"><button class="fs-tab on" data-v="brief">التقرير المختصر</button><button class="fs-tab" data-v="rep">التقرير الكامل</button></div>
      <button class="fs-btn" data-print>طباعة / PDF</button><span class="fs-st">عرض فقط · آخر تحديث ${new Date(ctx.shared.updated_at).toLocaleDateString('ar-EG')}</span></div><div id="fsRep"></div></div>`;
    const draw = () => { q('#fsRep').innerHTML = repOf(view); root.querySelectorAll('.fs-tab').forEach(t => t.classList.toggle('on', t.dataset.v === view)); };
    draw();
    root.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v) { view = b.dataset.v; draw(); } else if (b.dataset.print != null) printRep(); };
    return;
  }

  await showList();
}
