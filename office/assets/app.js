// =====================================================================
// SIAM AUTOWORKS — Main app (auth, routing, dashboard, editor)
// =====================================================================
(function () {
  const cfg = window.SIAM_CONFIG || {};
  const app = document.getElementById("app");
  const printMount = document.getElementById("printMount");
  let sb = null;          // supabase client
  let session = null;
  let state = { view: "loading", jobs: [], expenses: [], filter: "all", search: "", moneyPeriod: "month", current: null };

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  function toast(msg, kind = "") {
    const t = el(`<div class="toast ${kind}">${msg}</div>`);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  const configured = () =>
    cfg.SUPABASE_URL && cfg.SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

  // ---------- boot ----------
  function boot() {
    if (!configured()) { renderConfigNeeded(); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    sb.auth.getSession().then(({ data }) => {
      session = data.session;
      session ? openDashboard() : renderLogin();
    });
    sb.auth.onAuthStateChange((_e, s) => {
      session = s;
      if (!s) renderLogin();
    });
  }

  // ---------- config needed screen ----------
  function renderConfigNeeded() {
    app.innerHTML = `
      <div class="login-wrap"><div class="login-card">
        <img src="assets/logo.png" alt="logo"/>
        <h1>Setup required</h1>
        <p class="muted">Add your Supabase URL and key in <b>config.js</b>, then reload. See <b>SETUP.md</b>.</p>
      </div></div>`;
  }

  // ---------- login ----------
  function renderLogin() {
    state.view = "login";
    app.innerHTML = `
      <div class="login-wrap"><div class="login-card">
        <img src="assets/logo.png" alt="logo"/>
        <h1>Office Login</h1>
        <div class="field" style="text-align:left;margin-top:14px">
          <label>Email</label><input id="email" type="email" autocomplete="username" placeholder="you@example.com"/>
        </div>
        <div class="field" style="text-align:left">
          <label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="••••••••"/>
        </div>
        <button class="btn btn-block" id="loginBtn">Sign in</button>
        <p class="hint" style="margin-top:14px">First time? <a href="#" id="signupLink">Create an account</a></p>
      </div></div>`;
    $("#loginBtn").onclick = doLogin;
    $("#password").onkeydown = (e) => { if (e.key === "Enter") doLogin(); };
    $("#signupLink").onclick = (e) => { e.preventDefault(); renderSignup(); };
  }

  function renderSignup() {
    app.innerHTML = `
      <div class="login-wrap"><div class="login-card">
        <img src="assets/logo.png" alt="logo"/>
        <h1>Create account</h1>
        <div class="field" style="text-align:left;margin-top:14px">
          <label>Email</label><input id="email" type="email" placeholder="you@example.com"/>
        </div>
        <div class="field" style="text-align:left">
          <label>Password (min 6 chars)</label><input id="password" type="password" placeholder="••••••••"/>
        </div>
        <button class="btn btn-block" id="signupBtn">Create account</button>
        <p class="hint" style="margin-top:14px"><a href="#" id="backLink">Back to sign in</a></p>
      </div></div>`;
    $("#signupBtn").onclick = doSignup;
    $("#backLink").onclick = (e) => { e.preventDefault(); renderLogin(); };
  }

  async function doLogin() {
    const email = $("#email").value.trim(), password = $("#password").value;
    if (!email || !password) return toast("Enter email and password", "bad");
    $("#loginBtn").disabled = true; $("#loginBtn").textContent = "Signing in…";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { toast(error.message, "bad"); $("#loginBtn").disabled = false; $("#loginBtn").textContent = "Sign in"; return; }
    openDashboard();
  }

  async function doSignup() {
    const email = $("#email").value.trim(), password = $("#password").value;
    if (!email || password.length < 6) return toast("Valid email + 6+ char password", "bad");
    $("#signupBtn").disabled = true; $("#signupBtn").textContent = "Creating…";
    const { error } = await sb.auth.signUp({ email, password });
    if (error) { toast(error.message, "bad"); $("#signupBtn").disabled = false; $("#signupBtn").textContent = "Create account"; return; }
    toast("Account created. You can sign in now.", "ok");
    renderLogin();
  }

  // ---------- top bar ----------
  function topbar() {
    return `<div class="topbar">
      <img src="assets/logo.png" alt="logo"/>
      <span class="sp"></span>
      <span class="who">${session && session.user ? session.user.email : ""}</span>
      <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>
    </div>`;
  }
  function wireTop() { const b = $("#logoutBtn"); if (b) b.onclick = async () => { await sb.auth.signOut(); }; }

  // ---------- money helpers ----------
  const money = (n) => window.SIAM_DOCGEN.money(n);
  function jobDate(j) {
    const d = j.job_date || (j.data && j.data.date) || j.created_at;
    return new Date(d);
  }
  function expenseSigned(e) { return e.kind === "refund" ? -Number(e.amount || 0) : Number(e.amount || 0); }

  // Australian financial year periods (FY runs 1 Jul – 30 Jun)
  function periodRange(key) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const fyStartYear = (m >= 6) ? y : y - 1; // July = month 6
    const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (key === "month")    return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    if (key === "quarter") { const qs = Math.floor(m / 3) * 3; return [new Date(y, qs, 1), new Date(y, qs + 3, 1)]; }
    if (key === "fy")       return [new Date(fyStartYear, 6, 1), new Date(fyStartYear + 1, 6, 1)];
    if (key === "lastfy")   return [new Date(fyStartYear - 1, 6, 1), new Date(fyStartYear, 6, 1)];
    return [new Date(2000, 0, 1), new Date(2999, 0, 1)]; // all
  }
  function inRange(date, [a, b]) { return date >= a && date < b; }

  // Classify a job for money reporting based on its status.
  // Legacy/blank status is treated as 'paid' so real income is never hidden by default.
  function jobIncomeClass(j) {
    const s = (j.status || "paid");
    if (s === "cancelled" || s === "quote" || s === "draft") return "excluded";
    if (s === "unpaid") return "outstanding";
    return "income"; // paid (and legacy/blank)
  }

  function periodTotals(key) {
    const r = periodRange(key);
    let income = 0, jobsN = 0, parts = 0, outstanding = 0;
    (state.jobs || []).forEach(j => {
      if (!inRange(jobDate(j), r)) return;
      const cls = jobIncomeClass(j);
      if (cls === "income") { income += Number(j.total || 0); jobsN++; }
      else if (cls === "outstanding") { outstanding += Number(j.total || 0); }
    });
    (state.expenses || []).forEach(e => { if (inRange(new Date(e.date || e.created_at), r)) parts += expenseSigned(e); });
    return { income, parts, net: income - parts, jobsN, outstanding };
  }

  // ---------- dashboard ----------
  async function openDashboard() {
    state.view = "dashboard";
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="card" id="moneyBar" style="margin-bottom:14px;cursor:pointer">
        <div class="muted" style="font-size:12px">Loading totals…</div>
      </div>
      <div class="row between"><h1>Jobs</h1>
        <div class="row">
          <button class="btn" id="newRepair">+ Repair job</button>
          <button class="btn btn-ghost" id="newPPI">+ Inspection</button>
          <button class="btn btn-ghost" id="newCash">+ Cash sale</button>
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <input id="searchBox" type="search" placeholder="🔍 Search job no, name, phone or rego…" />
      </div>
      <div class="tabs">
        <div class="tab active" data-f="all">All</div>
        <div class="tab" data-f="repair">Repairs</div>
        <div class="tab" data-f="ppi">Inspections</div>
      </div>
      <div class="card" id="listCard"><p class="muted">Loading…</p></div>
    </div>`;
    wireTop();
    $("#newRepair").onclick = () => openEditor("repair");
    $("#newPPI").onclick = () => openEditor("ppi");
    $("#newCash").onclick = openCashSale;
    $("#moneyBar").onclick = openMoney;
    $("#searchBox").oninput = (e) => { state.search = e.target.value.trim().toLowerCase(); renderList(); };
    app.querySelectorAll(".tab").forEach(t => t.onclick = () => {
      app.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active"); state.filter = t.dataset.f; renderList();
    });
    await Promise.all([loadJobs(), loadExpenses()]);
    renderMoneyBar();
  }

  function renderMoneyBar() {
    const bar = $("#moneyBar"); if (!bar) return;
    const t = periodTotals("month");
    bar.innerHTML = `<div class="row between" style="align-items:center">
      <div><div class="muted" style="font-size:12px">This month</div>
        <div style="font-size:13px;margin-top:2px">
          <span style="color:var(--ok)">Income $${money(t.income)}</span> ·
          <span style="color:var(--warn)">Parts $${money(t.parts)}</span> ·
          <b style="color:${t.net>=0?'var(--ok)':'var(--bad)'}">Net $${money(t.net)}</b>
        </div>
      </div>
      <span class="btn btn-ghost btn-sm">Money →</span>
    </div>`;
  }

  async function loadJobs() {
    const { data, error } = await sb.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) { const lc=$("#listCard"); if(lc) lc.innerHTML = `<p class="muted">Error: ${error.message}</p>`; return; }
    state.jobs = data || []; renderList();
  }
  async function loadExpenses() {
    const { data, error } = await sb.from("expenses").select("*").order("date", { ascending: false });
    state.expenses = error ? [] : (data || []);
  }

  function renderList() {
    let list = state.jobs.filter(j => state.filter === "all" || j.doc_type === state.filter);
    const q = state.search;
    if (q) list = list.filter(j => {
      const ph = (j.phone || (j.data && j.data.phone) || "");
      return [j.job_no, j.customer, j.rego, j.vehicle, ph].some(v => String(v||"").toLowerCase().includes(q));
    });
    const lc = $("#listCard"); if (!lc) return;
    if (!list.length) { lc.innerHTML = `<p class="muted">${q ? "No matches." : "No jobs yet. Create one above."}</p>`; return; }
    lc.innerHTML = `<div class="joblist">` + list.map(j => {
      const cls = jobIncomeClass(j);
      const st = (j.status || "paid");
      const stLabel = { paid:"Paid", unpaid:"Unpaid", cancelled:"Cancelled", quote:"Quote", draft:"Draft" }[st] || st;
      const stColor = st==="paid" ? "var(--ok)" : st==="unpaid" ? "var(--warn)" : "var(--muted)";
      const dim = cls === "excluded" ? "opacity:.5" : "";
      return `
      <div class="jobitem" data-id="${j.id}" style="${dim}">
        <span class="tag ${j.doc_type}">${j.doc_type === "ppi" ? "PPI" : (j.data && j.data.cash ? "CASH" : "REPAIR")}</span>
        <div class="main">
          <div class="t">${escapeHtml(j.customer || "(no name)")} — ${escapeHtml(j.vehicle || "")}</div>
          <div class="s">${escapeHtml(j.job_no || "")} · ${escapeHtml(j.rego || "")} · ${jobDate(j).toLocaleDateString("en-AU")} · <span style="color:${stColor};font-weight:700">${stLabel}</span></div>
        </div>
        <div class="amt">$${money(j.total)}</div>
      </div>`;
    }).join("") + `</div>`;
    app.querySelectorAll(".jobitem").forEach(it => it.onclick = () => {
      const job = state.jobs.find(j => j.id === it.dataset.id);
      openEditor(job.doc_type, job);
    });
  }

  function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}

  // ---------- editor ----------
  function nextJobNo() {
    // Format: DDMMYYYY_N  (matches existing numbering)
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const prefix = `${dd}${mm}${yyyy}`;
    const todayCount = (state.jobs || []).filter(j => (j.job_no||"").startsWith(prefix)).length;
    return `${prefix}_${todayCount + 1}`;
  }

  function openEditor(type, job) {
    state.view = "editor";
    const form = window.SIAM_FORMS[type];
    const data = job ? Object.assign({}, job.data) : Object.assign(
      { items: [{ qty: 1, desc: "", unit: 0, gst: 0 }],
        date: new Date().toISOString().slice(0,10),
        job_no: nextJobNo() },
      form.defaults || {});
    state.current = { id: job ? job.id : null, type, data, status: job ? (job.status || "paid") : "paid" };

    const STATUSES = [
      ["paid","Paid (income received)"],
      ["unpaid","Unpaid (owed, not yet received)"],
      ["cancelled","Cancelled (no money)"],
      ["quote","Quote (not a sale)"],
      ["draft","Draft"],
    ];
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between">
        <button class="btn btn-ghost btn-sm" id="backBtn">← Back</button>
        <h2 style="margin:0">${form.title}</h2>
        <span></span>
      </div>
      <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label style="margin:0">Status</label>
        <select id="jobStatus" style="max-width:280px">
          ${STATUSES.map(([v,l]) => `<option value="${v}" ${state.current.status===v?"selected":""}>${l}</option>`).join("")}
        </select>
        <span class="hint" style="margin:0">Only <b>Paid</b> counts as income received. Cancelled / Quote / Draft are excluded from reports.</span>
      </div>
      <form id="editForm" style="margin-top:14px"></form>
      <div class="sticky-actions">
        <button class="btn" id="saveBtn">Save</button>
        <button class="btn btn-ghost" id="saveNewBtn">Save as new</button>
        <button class="btn btn-ghost" id="previewBtn">Preview / PDF</button>
        <button class="btn btn-ghost" id="wordBtn">Download Word</button>
        ${state.current.id ? '<button class="btn btn-danger" id="delBtn">Delete</button>' : ''}
      </div>
    </div>`;
    wireTop();
    $("#backBtn").onclick = openDashboard;
    $("#jobStatus").onchange = (e) => { state.current.status = e.target.value; };
    renderForm(form, data);
    $("#saveBtn").onclick = () => saveJob(form);
    $("#saveNewBtn").onclick = () => saveJob(form, true);
    $("#previewBtn").onclick = () => { collect(form); openPreview(form); };
    $("#wordBtn").onclick = () => { collect(form); window.SIAM_DOCGEN.generateDocx(form, state.current.data); };
    if (state.current.id) $("#delBtn").onclick = deleteJob;
  }

  function renderForm(form, data) {
    const root = $("#editForm");
    // datalists for suggestions
    let dls = "";
    const allLists = {};
    [form.header, form.extraHeader, ...form.sections.map(s => s.fields)].forEach(grp => (grp||[]).forEach(f => {
      if (f.list) allLists[f.k] = f.list;
    }));
    Object.entries(allLists).forEach(([k, vals]) => {
      dls += `<datalist id="dl_${k}">${vals.map(v => `<option value="${escapeHtml(v)}">`).join("")}</datalist>`;
    });

    // header (+ extra header for PPI)
    const headerFields = (form.header || []).concat(form.extraHeader || []);
    let html = `<fieldset><legend>Customer &amp; Vehicle</legend><div class="grid2">` +
      headerFields.map(f => fieldHtml(f, data)).join("") + `</div></fieldset>`;

    form.sections.forEach(s => {
      html += `<fieldset><legend>${escapeHtml(s.legend)}</legend>`;
      const grid = s.fields.some(f => f.col === 1);
      if (grid) html += `<div class="grid2">`;
      s.fields.forEach(f => html += fieldHtml(f, data));
      if (grid) html += `</div>`;
      html += `</fieldset>`;
    });

    root.innerHTML = dls + html;
    wireLineItems(data);

    // Wire quick work-block chips: append canned text into the matching textarea
    root.querySelectorAll("[data-quick]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.qkey;
        const targetK = btn.dataset.quick;
        const W = window.SIAM_FORMS.PRESETS.work;
        const ta = root.querySelector(`textarea[data-k="${targetK}"]`);
        if (!ta || !W[key]) return;
        const cur = ta.value.trim();
        ta.value = cur ? (cur + "\n" + W[key].text) : W[key].text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
      };
    });
  }

  function fieldHtml(f, data) {
    const v = data[f.k];
    if (f.type === "lineitems") return lineItemsHtml(data);
    if (f.type === "checks") {
      return `<div class="field" style="grid-column:1/-1"><div class="checks">` +
        f.items.map(it => `<label class="chk"><input type="checkbox" data-chk="${escapeHtml(it)}" ${data.checklist && data.checklist[it] ? "checked":""}/> ${escapeHtml(it)}</label>`).join("") +
        `</div></div>`;
    }
    if (f.type === "checkbox") {
      return `<div class="field"><label class="chk"><input type="checkbox" data-k="${f.k}" ${v?"checked":""}/> ${escapeHtml(f.label)}</label></div>`;
    }
    if (f.type === "prio") {
      return `<div class="field"><label>${escapeHtml(f.label)}</label><div class="prio">` +
        ["Low","Medium","High"].map(o => `<label><input type="radio" name="${f.k}" data-k="${f.k}" value="${o}" ${v===o?"checked":""}/> ${o}</label>`).join("") +
        `</div></div>`;
    }
    if (f.type === "textarea") {
      let chips = "";
      if (f.quick && f.quick.length) {
        const W = window.SIAM_FORMS.PRESETS.work;
        chips = `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">` +
          f.quick.map(key => W[key] ? `<button type="button" class="btn btn-ghost btn-sm" data-quick="${f.k}" data-qkey="${key}">+ ${escapeHtml(W[key].label)}</button>` : "").join("") +
          `</div>`;
      }
      return `<div class="field" style="grid-column:1/-1"><label>${escapeHtml(f.label)}</label><textarea data-k="${f.k}" ${f.big?'style="min-height:120px"':''}>${escapeHtml(v)}</textarea>${chips}</div>`;
    }
    if (f.type === "select") {
      return `<div class="field"><label>${escapeHtml(f.label)}</label><select data-k="${f.k}">` +
        f.opts.map(o => `<option value="${escapeHtml(o)}" ${v===o?"selected":""}>${escapeHtml(o||"—")}</option>`).join("") + `</select></div>`;
    }
    // text / number / date
    const t = f.type === "date" ? "date" : (f.type === "number" ? "number" : "text");
    const list = f.list ? `list="dl_${f.k}"` : "";
    const span = f.col === 2 ? 'style="grid-column:1/-1"' : "";
    return `<div class="field" ${span}><label>${escapeHtml(f.label)}</label><input type="${t}" data-k="${f.k}" ${list} value="${escapeHtml(v)}"/></div>`;
  }

  // ----- line items -----
  function lineItemsHtml(data) {
    const items = data.items || [];
    const presets = (window.SIAM_FORMS.PRESETS && window.SIAM_FORMS.PRESETS.lineItems) || [];
    const opts = presets.map(g =>
      `<optgroup label="${escapeHtml(g.group)}">` +
      g.items.map((it, i) => `<option value="${escapeHtml(g.group)}|${i}">${escapeHtml(it.label)} — $${it.unit}</option>`).join("") +
      `</optgroup>`).join("");
    return `<div class="field" style="grid-column:1/-1">
      <div class="row" style="margin-bottom:8px;gap:8px;align-items:center">
        <select id="quickItem" style="max-width:280px">
          <option value="">⚡ Quick add item…</option>${opts}
        </select>
      </div>
      <table class="litems" id="litems">
        <thead><tr><th>Qty</th><th>Description</th><th>Unit $</th><th>GST $</th><th>Total</th><th></th></tr></thead>
        <tbody>${items.map((it,i)=>litemRow(it,i)).join("")}</tbody>
      </table>
      <button type="button" class="btn btn-ghost btn-sm" id="addItem">+ Add blank line</button>
      <div style="text-align:right;margin-top:8px" id="totLine"></div>
    </div>`;
  }
  function litemRow(it, i) {
    const line = Number(it.qty||0)*Number(it.unit||0);
    return `<tr data-i="${i}">
      <td class="num"><input data-f="qty" value="${escapeHtml(it.qty)}"/></td>
      <td><input data-f="desc" value="${escapeHtml(it.desc)}"/></td>
      <td class="price"><input data-f="unit" value="${escapeHtml(it.unit)}"/></td>
      <td class="price"><input data-f="gst" value="${escapeHtml(it.gst)}"/></td>
      <td class="tot">$${window.SIAM_DOCGEN.money(line)}</td>
      <td class="x" data-del="${i}">✕</td>
    </tr>`;
  }
  function wireLineItems(data) {
    const tbl = $("#litems"); if (!tbl) return;
    const refreshTot = () => {
      const t = window.SIAM_DOCGEN.computeTotals(data.items);
      const tl = $("#totLine");
      if (tl) tl.innerHTML = `<span class="muted">Subtotal $${window.SIAM_DOCGEN.money(t.sub)} · GST $${window.SIAM_DOCGEN.money(t.gst)} · </span><b>Total $${window.SIAM_DOCGEN.money(t.total)}</b>`;
    };
    const rebind = () => {
      tbl.querySelectorAll("tbody tr").forEach(tr => {
        const i = +tr.dataset.i;
        tr.querySelectorAll("input").forEach(inp => {
          inp.oninput = () => {
            data.items[i][inp.dataset.f] = inp.value;
            tr.querySelector(".tot").textContent = "$" + window.SIAM_DOCGEN.money(Number(data.items[i].qty||0)*Number(data.items[i].unit||0));
            refreshTot();
          };
        });
        const x = tr.querySelector("[data-del]");
        if (x) x.onclick = () => { data.items.splice(i,1); redrawItems(data); };
      });
    };
    const redrawItems = (d) => {
      tbl.querySelector("tbody").innerHTML = (d.items||[]).map((it,i)=>litemRow(it,i)).join("");
      rebind(); refreshTot();
    };
    $("#addItem").onclick = () => { data.items.push({qty:1,desc:"",unit:0,gst:0}); redrawItems(data); };
    // Quick-add from presets
    const qi = $("#quickItem");
    if (qi) qi.onchange = () => {
      const v = qi.value; qi.value = "";
      if (!v) return;
      const [grp, idx] = v.split("|");
      const presets = window.SIAM_FORMS.PRESETS.lineItems;
      const g = presets.find(x => x.group === grp);
      if (!g) return;
      const it = g.items[+idx];
      data.items.push({ qty: 1, desc: it.desc, unit: it.unit, gst: 0 });
      redrawItems(data);
    };
    rebind(); refreshTot();
  }

  // ----- collect form values into state.current.data -----
  function collect(form) {
    const d = state.current.data;
    app.querySelectorAll("[data-k]").forEach(inp => {
      const k = inp.dataset.k;
      if (inp.type === "checkbox") d[k] = inp.checked;
      else if (inp.type === "radio") { if (inp.checked) d[k] = inp.value; }
      else d[k] = inp.value;
    });
    // checklist
    const cl = {};
    app.querySelectorAll("[data-chk]").forEach(c => { if (c.checked) cl[c.dataset.chk] = true; });
    d.checklist = cl;
    // derived fields for list/search
    d._derived = true;
    return d;
  }

  // ----- save -----
  async function saveJob(form, asNew) {
    collect(form);
    const d = state.current.data;
    // If saving as a new copy, give it a fresh job number so it doesn't clash
    if (asNew) {
      d.job_no = nextJobNo();
      // reflect new number in the visible field if present
      const jn = app.querySelector('[data-k="job_no"]'); if (jn) jn.value = d.job_no;
    }
    const totals = window.SIAM_DOCGEN.computeTotals(d.items);
    const row = {
      doc_type: form.type, job_no: d.job_no || null,
      customer: d.customer_name || null, vehicle: d.vehicle || null, rego: d.rego || null,
      phone: d.phone || null,
      job_date: d.date || null,
      status: state.current.status || "paid",
      total: totals.total, data: d, user_id: session.user.id,
    };
    const btn = asNew ? $("#saveNewBtn") : $("#saveBtn");
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Saving…";
    let res;
    if (state.current.id && !asNew) res = await sb.from("jobs").update(row).eq("id", state.current.id).select().single();
    else res = await sb.from("jobs").insert(row).select().single();   // insert when new OR save-as-new
    btn.disabled = false; btn.textContent = orig;
    if (res.error) return toast(res.error.message, "bad");
    state.current.id = res.data.id;   // now editing the (new) saved record
    toast(asNew ? "Saved as new job ✓" : "Saved ✓", "ok");
    if (!$("#delBtn")) {
      const del = el('<button class="btn btn-danger" id="delBtn">Delete</button>');
      $(".sticky-actions").appendChild(del); del.onclick = deleteJob;
    }
  }

  async function deleteJob() {
    if (!confirm("Delete this job permanently?")) return;
    const { error } = await sb.from("jobs").delete().eq("id", state.current.id);
    if (error) return toast(error.message, "bad");
    toast("Deleted", "ok"); openDashboard();
  }

  // ----- preview / print -----
  function openPreview(form) {
    printMount.innerHTML = window.SIAM_DOCGEN.renderDocHTML(form, state.current.data);
    document.body.classList.add("doc-preview");
    const bar = el(`<div class="preview-bar">
      <button class="btn btn-ghost btn-sm" id="closePrev">← Back</button>
      <span class="sp" style="flex:1"></span>
      <button class="btn btn-sm" id="printBtn">Print / Save as PDF</button>
    </div>`);
    document.body.appendChild(bar);
    $("#closePrev").onclick = () => { document.body.classList.remove("doc-preview"); bar.remove(); printMount.innerHTML=""; };
    $("#printBtn").onclick = () => window.print();
  }

  // =====================================================================
  // MONEY view — income, parts expenses, net, by ATO period
  // =====================================================================
  const PERIODS = [
    { k:"month",   label:"This month" },
    { k:"quarter", label:"This quarter" },
    { k:"fy",      label:"This FY (Jul–Jun)" },
    { k:"lastfy",  label:"Last FY" },
    { k:"all",     label:"All time" },
  ];

  async function openMoney() {
    state.view = "money";
    if (!state.jobs.length && !state.expenses.length) await Promise.all([loadJobs(), loadExpenses()]);
    state.moneyPeriod = state.moneyPeriod || "month";
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between">
        <button class="btn btn-ghost btn-sm" id="backBtn">← Back</button>
        <h2 style="margin:0">Money</h2><span></span>
      </div>
      <div class="tabs" id="periodTabs" style="margin-top:14px;flex-wrap:wrap">
        ${PERIODS.map(p => `<div class="tab ${p.k===state.moneyPeriod?'active':''}" data-p="${p.k}">${p.label}</div>`).join("")}
      </div>
      <div id="moneySummary"></div>
      <div class="row between" style="margin-top:20px">
        <h3 style="margin:0">Parts expenses</h3>
        <button class="btn btn-sm" id="addExp">+ Add expense / refund</button>
      </div>
      <div class="card" id="expList" style="margin-top:10px"></div>
    </div>`;
    wireTop();
    $("#backBtn").onclick = openDashboard;
    $("#addExp").onclick = () => openExpense();
    app.querySelectorAll("#periodTabs .tab").forEach(t => t.onclick = () => {
      state.moneyPeriod = t.dataset.p; openMoney();
    });
    renderMoneySummary(); renderExpenseList();
  }

  function renderMoneySummary() {
    const t = periodTotals(state.moneyPeriod);
    const box = $("#moneySummary"); if (!box) return;
    box.innerHTML = `<div class="grid2" style="margin-top:14px">
      <div class="card"><div class="muted" style="font-size:12px">Income received (${t.jobsN} paid jobs)</div>
        <div style="font-size:26px;font-weight:800;color:var(--ok)">$${money(t.income)}</div></div>
      <div class="card"><div class="muted" style="font-size:12px">Parts expenses</div>
        <div style="font-size:26px;font-weight:800;color:var(--warn)">$${money(t.parts)}</div></div>
      <div class="card" style="grid-column:1/-1"><div class="muted" style="font-size:12px">Net (income − parts)</div>
        <div style="font-size:30px;font-weight:900;color:${t.net>=0?'var(--ok)':'var(--bad)'}">$${money(t.net)}</div>
        ${t.outstanding ? `<div style="font-size:12px;margin-top:6px;color:var(--muted)">Outstanding (unpaid, not counted): <b style="color:var(--warn)">$${money(t.outstanding)}</b></div>` : ""}
        <div class="muted" style="font-size:11px;margin-top:4px">Counts <b>Paid</b> jobs only. Cancelled / Quote / Draft excluded. Net is before your own time/labour, fuel, tools etc. — confirm figures with your accountant for ATO.</div></div>
    </div>`;
  }

  function renderExpenseList() {
    const r = periodRange(state.moneyPeriod);
    const list = (state.expenses || []).filter(e => inRange(new Date(e.date || e.created_at), r));
    const box = $("#expList"); if (!box) return;
    if (!list.length) { box.innerHTML = `<p class="muted">No expenses recorded for this period.</p>`; return; }
    box.innerHTML = `<div class="joblist">` + list.map(e => `
      <div class="jobitem" data-eid="${e.id}">
        <span class="tag ${e.kind==='refund'?'ppi':'repair'}">${e.kind==='refund'?'REFUND':'PARTS'}</span>
        <div class="main">
          <div class="t">${escapeHtml(e.supplier || "(supplier)")} ${e.receipt_no?('· #'+escapeHtml(e.receipt_no)):''}</div>
          <div class="s">${new Date(e.date||e.created_at).toLocaleDateString("en-AU")}${e.note?(' · '+escapeHtml(e.note)):''}</div>
        </div>
        <div class="amt" style="color:${e.kind==='refund'?'var(--ok)':'var(--warn)'}">${e.kind==='refund'?'−':''}$${money(e.amount)}</div>
      </div>`).join("") + `</div>`;
    box.querySelectorAll("[data-eid]").forEach(it => it.onclick = () => {
      const e = state.expenses.find(x => x.id === it.dataset.eid); openExpense(e);
    });
  }

  function openExpense(exp) {
    const e = exp || { date: new Date().toISOString().slice(0,10), kind: "purchase" };
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6)">
      <div class="login-card" style="max-width:420px;text-align:left">
        <h2 style="text-align:center">${exp?'Edit':'Add'} expense</h2>
        <div class="grid2">
          <div class="field"><label>Date</label><input id="e_date" type="date" value="${escapeHtml(e.date||"")}"/></div>
          <div class="field"><label>Type</label><select id="e_kind">
            <option value="purchase" ${e.kind!=='refund'?'selected':''}>Purchase (parts in)</option>
            <option value="refund" ${e.kind==='refund'?'selected':''}>Refund (parts returned)</option>
          </select></div>
        </div>
        <div class="field">
          <label>Supplier</label>
          <input id="e_supplier" value="${escapeHtml(e.supplier||"")}" placeholder="e.g. Repco, Bursons, Toyota"/>
          <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost btn-sm" data-sup="Autopro Kilkenny">Autopro Kilkenny</button>
            <button type="button" class="btn btn-ghost btn-sm" data-sup="Repco">Repco</button>
          </div>
        </div>
        <div class="grid2">
          <div class="field"><label>Receipt no.</label><input id="e_receipt" value="${escapeHtml(e.receipt_no||"")}"/></div>
          <div class="field"><label>Amount (AUD)</label><input id="e_amount" type="number" step="0.01" value="${escapeHtml(e.amount||"")}"/></div>
        </div>
        <div class="field"><label>Note</label><input id="e_note" value="${escapeHtml(e.note||"")}" placeholder="optional"/></div>
        <div class="row" style="gap:10px;margin-top:6px">
          <button class="btn" id="e_save" style="flex:1">Save</button>
          ${exp?'<button class="btn btn-danger" id="e_del">Delete</button>':''}
          <button class="btn btn-ghost" id="e_cancel">Cancel</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    $("#e_cancel", overlay).onclick = close;
    overlay.querySelectorAll("[data-sup]").forEach(b => b.onclick = () => {
      $("#e_supplier", overlay).value = b.dataset.sup;
      $("#e_supplier", overlay).focus();
    });
    $("#e_save", overlay).onclick = async () => {
      const row = {
        date: $("#e_date",overlay).value || null,
        kind: $("#e_kind",overlay).value,
        supplier: $("#e_supplier",overlay).value.trim() || null,
        receipt_no: $("#e_receipt",overlay).value.trim() || null,
        amount: Number($("#e_amount",overlay).value || 0),
        note: $("#e_note",overlay).value.trim() || null,
        user_id: session.user.id,
      };
      if (!row.amount) return toast("Enter an amount", "bad");
      let res;
      if (exp) res = await sb.from("expenses").update(row).eq("id", exp.id).select().single();
      else res = await sb.from("expenses").insert(row).select().single();
      if (res.error) return toast(res.error.message, "bad");
      close(); await loadExpenses(); renderMoneySummary(); renderExpenseList(); toast("Saved ✓","ok");
    };
    if (exp) $("#e_del", overlay).onclick = async () => {
      if (!confirm("Delete this expense?")) return;
      const { error } = await sb.from("expenses").delete().eq("id", exp.id);
      if (error) return toast(error.message,"bad");
      close(); await loadExpenses(); renderMoneySummary(); renderExpenseList(); toast("Deleted","ok");
    };
  }

  // ---------- quick cash sale (fast income entry) ----------
  function openCashSale() {
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6)">
      <div class="login-card" style="max-width:420px;text-align:left">
        <h2 style="text-align:center">Quick cash sale</h2>
        <p class="muted" style="font-size:12px;text-align:center;margin-top:-6px">Fast income entry — no full invoice. You can open it later to add detail.</p>
        <div class="field"><label>Date</label><input id="c_date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
        <div class="field"><label>Customer / description</label><input id="c_desc" placeholder="e.g. Roadside jump-start — John"/></div>
        <div class="field"><label>Amount (AUD)</label><input id="c_amount" type="number" step="0.01" placeholder="0.00"/></div>
        <div class="row" style="gap:10px;margin-top:6px">
          <button class="btn" id="c_save" style="flex:1">Save cash sale</button>
          <button class="btn btn-ghost" id="c_cancel">Cancel</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    $("#c_cancel", overlay).onclick = () => overlay.remove();
    $("#c_save", overlay).onclick = async () => {
      const amount = Number($("#c_amount",overlay).value || 0);
      const desc = $("#c_desc",overlay).value.trim();
      const date = $("#c_date",overlay).value;
      if (!amount) return toast("Enter an amount","bad");
      const data = { date, job_no: nextJobNo(), customer_name: desc, cash: true,
        items: [{ qty:1, desc: desc || "Cash sale", unit: amount, gst: 0 }] };
      const row = { doc_type:"repair", job_no:data.job_no, customer:desc||"Cash sale",
        total:amount, job_date:date, status:"paid", data, user_id:session.user.id };
      const res = await sb.from("jobs").insert(row).select().single();
      if (res.error) return toast(res.error.message,"bad");
      overlay.remove(); await loadJobs(); renderMoneyBar(); toast("Cash sale saved ✓","ok");
    };
  }

  boot();
})();
