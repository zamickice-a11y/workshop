// =====================================================================
// SIAM AUTOWORKS — Main app (auth, routing, dashboard, editor)
// =====================================================================
(function () {
  const cfg = window.SIAM_CONFIG || {};
  const app = document.getElementById("app");
  const printMount = document.getElementById("printMount");
  let sb = null;          // supabase client
  let session = null;
  let state = { view: "loading", jobs: [], expenses: [], bookings: [], customSnippets: [], filter: "all", search: "", moneyPeriod: "month", bookingsFilter: "new", current: null };

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
    startAutoRefresh();
  }

  // ---------- auto-refresh (polling) ----------
  // Refreshes data every 15s on dashboard/bookings views so new bookings
  // and jobs appear without a manual reload. Skips when tab is hidden.
  let _refreshing = false;
  async function autoRefresh(force) {
    if (!session || _refreshing) return;
    if (!force && document.visibilityState !== "visible") return;
    if (state.view !== "dashboard" && state.view !== "bookings" && state.view !== "schedule") return; // don't disrupt editor/money
    _refreshing = true;
    try {
      const prevNew = (state.bookings || []).filter(b => b.status === "new").length;
      if (state.view === "dashboard") {
        await Promise.all([loadJobs(), loadExpenses(), loadBookings()]);
        renderMoneyBar(); renderBookingsBar(); renderScheduleBar();   // loadJobs already re-renders the list
      } else if (state.view === "bookings") {
        await loadBookings();
        renderBookingsList();
      } else if (state.view === "schedule") {
        await loadBookings();
        renderScheduleList();
      }
      const nowNew = (state.bookings || []).filter(b => b.status === "new").length;
      if (nowNew > prevNew) {
        const n = nowNew - prevNew;
        toast(`🔔 ${n} new booking${n > 1 ? "s" : ""} received`, "ok");
      }
    } catch (e) { /* network blip — ignore, try again next tick */ }
    _refreshing = false;
  }
  function startAutoRefresh() {
    setInterval(() => autoRefresh(false), 15000);   // every 15 seconds
    // When the user returns to the tab, refresh immediately
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") autoRefresh(true);
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
        <p class="hint" style="margin-top:14px">Staff access only. Accounts are created by the owner.</p>
      </div></div>`;
    $("#loginBtn").onclick = doLogin;
    $("#password").onkeydown = (e) => { if (e.key === "Enter") doLogin(); };
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
      <div class="card" id="moneyBar" style="margin-bottom:12px;cursor:pointer">
        <div class="muted" style="font-size:12px">Loading totals…</div>
      </div>
      <div class="card" id="bookingsBar" style="margin-bottom:12px;cursor:pointer">
        <div class="muted" style="font-size:12px">Loading bookings…</div>
      </div>
      <div class="card" id="scheduleBar" style="margin-bottom:14px;cursor:pointer">
        <div class="muted" style="font-size:12px">Loading schedule…</div>
      </div>
      <div class="row between"><h1>Jobs</h1>
        <div class="row">
          <button class="btn" id="newRepair">+ Repair job</button>
          <button class="btn btn-ghost" id="newPPI">+ Inspection</button>
          <button class="btn btn-ghost" id="newQuote">+ Quote</button>
          <button class="btn btn-ghost" id="newCash">+ Cash sale</button>
        </div>
      </div>
      <div class="field" style="margin-top:12px">
        <input id="searchBox" type="search" placeholder="Search job no, name, phone or rego…" />
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
    $("#newQuote").onclick = () => openEditor("quote");
    $("#newCash").onclick = openCashSale;
    $("#moneyBar").onclick = openMoney;
    $("#bookingsBar").onclick = openBookings;
    $("#scheduleBar").onclick = openSchedule;
    $("#searchBox").oninput = (e) => { state.search = e.target.value.trim().toLowerCase(); renderList(); };
    app.querySelectorAll(".tab").forEach(t => t.onclick = () => {
      app.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active"); state.filter = t.dataset.f; renderList();
    });
    await Promise.all([loadJobs(), loadExpenses(), loadBookings(), loadCustomSnippets()]);
    renderMoneyBar(); renderBookingsBar(); renderScheduleBar();
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
  async function loadBookings() {
    const { data, error } = await sb.from("bookings").select("*").order("created_at", { ascending: false });
    state.bookings = error ? [] : (data || []);
  }
  async function loadCustomSnippets() {
    const { data, error } = await sb.from("presets").select("*").eq("kind", "snippet").order("created_at", { ascending: false });
    state.customSnippets = error ? [] : (data || []);
  }
  function renderBookingsBar() {
    const bar = $("#bookingsBar"); if (!bar) return;
    const newCount = state.bookings.filter(b => b.status === "new").length;
    const pendingCount = state.bookings.filter(b => b.status === "new" || b.status === "contacted").length;
    const hot = newCount > 0;
    bar.style.borderColor = hot ? "var(--brand)" : "var(--line)";
    bar.innerHTML = `<div class="row between" style="align-items:center">
      <div><div class="muted" style="font-size:12px">Bookings</div>
        <div style="font-size:13px;margin-top:2px">
          ${hot ? `<b style="color:var(--brand)">${newCount} new</b> · ` : ""}<span style="color:var(--muted)">${pendingCount} pending</span> · <span class="muted">${state.bookings.length} total</span>
        </div>
      </div>
      <span class="btn ${hot?'':'btn-ghost'} btn-sm">Open →</span>
    </div>`;
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
        <span class="tag ${j.doc_type}">${j.doc_type === "ppi" ? "PPI" : (j.doc_type === "quote" ? "QUOTE" : (j.data && j.data.cash ? "CASH" : "REPAIR"))}</span>
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

  function openEditor(type, job, prefill) {
    state.view = "editor";
    const form = window.SIAM_FORMS[type];
    const data = job ? Object.assign({}, job.data) : Object.assign(
      { items: [{ qty: 1, desc: "", unit: 0, gst: 0 }],
        date: new Date().toISOString().slice(0,10),
        job_no: nextJobNo() },
      form.defaults || {},
      prefill || {});
    state.current = { id: job ? job.id : null, type, data,
      status: job ? (job.status || (type === "quote" ? "quote" : "paid")) : (type === "quote" ? "quote" : "paid"),
      fromBookingId: (prefill && prefill._bookingId) || null };
    // strip internal markers from data before render/save
    delete state.current.data._bookingId;

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
    // Use a custom snippet → append its text to the matching textarea
    root.querySelectorAll("[data-csk]").forEach(btn => {
      btn.onclick = () => {
        const s = state.customSnippets.find(x => x.id === btn.dataset.csk);
        if (!s || !s.data) return;
        const ta = root.querySelector(`textarea[data-k="${s.data.field}"]`);
        if (!ta) return;
        const cur = ta.value.trim();
        ta.value = cur ? (cur + "\n" + s.data.text) : s.data.text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
      };
    });
    // Delete a custom snippet
    root.querySelectorAll("[data-csd]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Delete this snippet?")) return;
        const { error } = await sb.from("presets").delete().eq("id", btn.dataset.csd);
        if (error) return toast(error.message, "bad");
        await loadCustomSnippets();
        // re-render the form to refresh chips (preserve current values)
        collect(form);
        renderForm(form, state.current.data);
        toast("Snippet deleted", "ok");
      };
    });
    // Save current textarea content as a new snippet
    root.querySelectorAll("[data-savesnip]").forEach(btn => {
      btn.onclick = () => {
        const fk = btn.dataset.savesnip;
        const ta = root.querySelector(`textarea[data-k="${fk}"]`);
        if (!ta) return;
        openSaveSnippet(fk, ta.value);
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
        chips = f.quick.map(key => W[key] ? `<button type="button" class="btn btn-ghost btn-sm" data-quick="${f.k}" data-qkey="${key}">+ ${escapeHtml(W[key].label)}</button>` : "").join("");
      }
      // Custom user snippets for this field
      const customs = (state.customSnippets || []).filter(s => s.data && s.data.field === f.k);
      const customChips = customs.map(s =>
        `<span style="display:inline-flex;align-items:stretch;border:1px solid var(--brand);border-radius:8px;overflow:hidden">
          <button type="button" data-csk="${s.id}" style="background:transparent;color:var(--brand);border:0;padding:7px 9px;font-size:13px;font-weight:700;cursor:pointer">★ ${escapeHtml(s.label || "snippet")}</button>
          <button type="button" data-csd="${s.id}" title="Delete snippet" style="background:transparent;color:var(--brand);border:0;border-left:1px solid var(--brand);padding:7px 8px;cursor:pointer">×</button>
        </span>`).join("");
      // Save snippet button (only for fields that support custom snippets)
      const saveable = ["notes","work_performed","diagnosis","reported_issue"];
      const saveBtn = saveable.includes(f.k)
        ? `<button type="button" class="btn btn-ghost btn-sm" data-savesnip="${f.k}" style="color:var(--brand)">+ Save as snippet</button>`
        : "";
      const chipRow = (chips || customChips || saveBtn)
        ? `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${chips}${customChips}${saveBtn}</div>`
        : "";
      return `<div class="field" style="grid-column:1/-1"><label>${escapeHtml(f.label)}</label><textarea data-k="${f.k}" ${f.big?'style="min-height:120px"':''}>${escapeHtml(v)}</textarea>${chipRow}</div>`;
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
          <option value="">Quick add item…</option>${opts}
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
    // If this job was created from a booking, mark the booking as converted
    if (state.current.fromBookingId) {
      await sb.from("bookings").update({ status: "converted", job_id: res.data.id }).eq("id", state.current.fromBookingId);
      state.current.fromBookingId = null;
      await loadBookings();
    }
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
      <div class="row between" style="margin-top:20px;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">Parts expenses</h3>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost btn-sm" id="exportCSV">⬇ Export CSV (period)</button>
          <button class="btn btn-sm" id="addExp">+ Add expense / refund</button>
        </div>
      </div>
      <div class="card" id="expList" style="margin-top:10px"></div>
    </div>`;
    wireTop();
    $("#backBtn").onclick = openDashboard;
    $("#addExp").onclick = () => openExpense();
    $("#exportCSV").onclick = exportFinanceCSV;
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

  // =====================================================================
  // BOOKINGS — view, manage, convert to jobs
  // =====================================================================
  // =====================================================================
  // SCHEDULING — assign bookings to a date/time, avoid double-booking
  // =====================================================================
  const WORK = { start: "08:00", end: "17:00" };  // working hours for free-slot suggestions
  const DEFAULT_DURATION = 60;                      // default job length (minutes)

  function t2m(t){ if(!t) return null; const p=String(t).split(":"); return (+p[0])*60 + (+(p[1]||0)); }
  function m2t(m){ m=((m%1440)+1440)%1440; const h=Math.floor(m/60), mm=m%60; return String(h).padStart(2,"0")+":"+String(mm).padStart(2,"0"); }
  function fmtTime12(t){ const m=t2m(t); if(m==null) return ""; let h=Math.floor(m/60); const mm=m%60; const ap=h<12?"AM":"PM"; h=h%12||12; return h+":"+String(mm).padStart(2,"0")+" "+ap; }

  // ---- absolute datetime helpers (so long jobs can span across days) ----
  function bStartMs(b){ return new Date((b.scheduled_date||"") + "T" + (b.scheduled_time||"00:00")).getTime(); }
  function bEndMs(b){ return bStartMs(b) + Number(b.duration_min||DEFAULT_DURATION)*60000; }
  function ms12(ms){ const d=new Date(ms); let h=d.getHours(); const mm=d.getMinutes(); const ap=h<12?"AM":"PM"; h=h%12||12; return h+":"+String(mm).padStart(2,"0")+" "+ap; }
  function msDateShort(ms){ return new Date(ms).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"}); }
  function dayCount(b){ // how many calendar days this job touches
    const s=new Date(bStartMs(b)); s.setHours(0,0,0,0);
    const e=new Date(bEndMs(b)-1); e.setHours(0,0,0,0);
    return Math.round((e-s)/86400000)+1;
  }
  function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function bookingDays(b){ // local date strings this job touches (1+ for multi-day)
    const days=[]; const cur=new Date(bStartMs(b)); cur.setHours(0,0,0,0);
    const end=new Date(bEndMs(b)-1); end.setHours(0,0,0,0);
    while(cur<=end){ days.push(ymd(cur)); cur.setDate(cur.getDate()+1); }
    return days;
  }
  // All scheduled jobs as absolute intervals (excluding one id, excluding archived)
  function scheduledIntervals(excludeId){
    return (state.bookings||[])
      .filter(b => b.scheduled_date && b.scheduled_time && b.id!==excludeId && b.status!=="archived")
      .map(b => ({ id:b.id, name:b.name, vehicle:b.vehicle, start:bStartMs(b), end:bEndMs(b) }));
  }
  // Find a job that clashes with the proposed absolute window [startMs,endMs)
  function findClash(startMs, endMs, excludeId){
    return scheduledIntervals(excludeId).find(d => startMs < d.end && endMs > d.start);
  }
  // Jobs overlapping a given calendar day (for the "on this day" list)
  function intervalsOnDay(dateStr, excludeId){
    const dayStart = new Date(dateStr+"T00:00").getTime();
    const dayEnd = dayStart + 86400000;
    return scheduledIntervals(excludeId)
      .filter(d => d.start < dayEnd && d.end > dayStart)
      .sort((a,b)=>a.start-b.start);
  }
  // Free gaps within a day's working hours, accounting for jobs spilling in from other days
  function freeGapsForDay(dateStr, excludeId){
    const workStart = new Date(dateStr+"T"+WORK.start).getTime();
    const workEnd   = new Date(dateStr+"T"+WORK.end).getTime();
    const busy = scheduledIntervals(excludeId)
      .filter(d => d.start < workEnd && d.end > workStart)
      .map(d => ({ start: Math.max(d.start, workStart), end: Math.min(d.end, workEnd) }))
      .sort((a,b)=>a.start-b.start);
    const gaps=[]; let cur=workStart;
    busy.forEach(b=>{ if(b.start>cur) gaps.push({start:cur,end:b.start}); cur=Math.max(cur,b.end); });
    if(cur<workEnd) gaps.push({start:cur,end:workEnd});
    return gaps.filter(g=>g.end>g.start);
  }

  // ---------- manual booking (phone / SMS) ----------
  function openManualBooking() {
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:320;background:rgba(0,0,0,.6);overflow:auto;padding:20px 12px">
      <div class="login-card" style="max-width:520px;text-align:left;margin:auto">
        <div class="row between" style="margin-bottom:6px">
          <h2 style="margin:0">Add booking (phone / SMS)</h2>
          <button class="btn btn-ghost btn-sm" id="mb_close">✕</button>
        </div>
        <p class="muted" style="font-size:12px;margin-top:0">For customers who called or texted you directly.</p>
        <div class="grid2">
          <div class="field"><label>Name</label><input id="mb_name"/></div>
          <div class="field"><label>Phone</label><input id="mb_phone"/></div>
        </div>
        <div class="grid2">
          <div class="field"><label>Vehicle (make / model / year)</label><input id="mb_vehicle"/></div>
          <div class="field"><label>Rego</label><input id="mb_rego"/></div>
        </div>
        <div class="field"><label>Service type</label><input id="mb_service" placeholder="e.g. Logbook service, Brakes, Diagnostics"/></div>
        <div class="field"><label>Problem / notes</label><textarea id="mb_symptoms" style="min-height:80px"></textarea></div>
        <div class="grid2">
          <div class="field"><label>Location</label><input id="mb_location"/></div>
          <div class="field"><label>Contact via</label><select id="mb_contact"><option>Phone call</option><option>SMS</option><option>Email</option></select></div>
        </div>
        <div class="row" style="gap:10px;margin-top:14px">
          <button class="btn" id="mb_save" style="flex:1">Save &amp; schedule</button>
          <button class="btn btn-ghost" id="mb_saveonly">Save only</button>
          <button class="btn btn-ghost" id="mb_cancel">Cancel</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    $("#mb_close", overlay).onclick = close;
    $("#mb_cancel", overlay).onclick = close;
    async function save(thenSchedule) {
      const name = $("#mb_name", overlay).value.trim();
      const phone = $("#mb_phone", overlay).value.trim();
      if (!name && !phone) return toast("Enter at least a name or phone", "bad");
      const row = {
        name: name || null, phone: phone || null,
        vehicle: $("#mb_vehicle", overlay).value.trim() || null,
        rego: $("#mb_rego", overlay).value.trim() || null,
        service_type: $("#mb_service", overlay).value.trim() || null,
        symptoms: $("#mb_symptoms", overlay).value.trim() || null,
        location: $("#mb_location", overlay).value.trim() || null,
        contact_method: $("#mb_contact", overlay).value,
        status: "new", notes: "Added manually (phone/SMS)",
      };
      const res = await sb.from("bookings").insert(row).select().single();
      if (res.error) return toast(res.error.message, "bad");
      await loadBookings(); close();
      if (state.view==="bookings") openBookings(); else if (state.view==="schedule") openSchedule();
      toast("Booking added ✓", "ok");
      if (thenSchedule) openScheduleModal(res.data);
    }
    $("#mb_save", overlay).onclick = () => save(true);
    $("#mb_saveonly", overlay).onclick = () => save(false);
    setTimeout(() => $("#mb_name", overlay).focus(), 50);
  }

  // ---------- schedule a booking onto a date/time ----------
  function openScheduleModal(b) {
    const today = new Date().toISOString().slice(0,10);
    let date = b.scheduled_date || today;
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:330;background:rgba(0,0,0,.6);overflow:auto;padding:20px 12px">
      <div class="login-card" style="max-width:520px;text-align:left;margin:auto">
        <div class="row between" style="margin-bottom:6px">
          <h2 style="margin:0">Schedule job</h2>
          <button class="btn btn-ghost btn-sm" id="sc_close">✕</button>
        </div>
        <div class="muted" style="font-size:13px;margin-bottom:12px">${escapeHtml(b.name||"(no name)")}${b.vehicle?(" · "+escapeHtml(b.vehicle)):""}${b.phone?(" · "+escapeHtml(b.phone)):""}</div>
        <div class="grid2">
          <div class="field"><label>Date</label><input id="sc_date" type="date" value="${date}"/></div>
          <div class="field"><label>Time</label><input id="sc_time" type="time" value="${b.scheduled_time||""}"/></div>
        </div>
        <div class="field"><label>Duration (hours)</label><input id="sc_dur" type="number" step="0.5" min="0.5" value="${(Number(b.duration_min||DEFAULT_DURATION)/60)}"/></div>
        <div id="sc_day" style="margin-top:6px"></div>
        <div id="sc_conflict" style="margin-top:10px"></div>
        <div class="row" style="gap:10px;margin-top:14px">
          <button class="btn" id="sc_save" style="flex:1">Save to schedule</button>
          ${b.scheduled_date ? '<button class="btn btn-ghost" id="sc_unschedule">Unschedule</button>' : ''}
          <button class="btn btn-ghost" id="sc_cancel">Cancel</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    $("#sc_close", overlay).onclick = close;
    $("#sc_cancel", overlay).onclick = close;

    function renderConflict() {
      const box = $("#sc_conflict", overlay);
      const time = $("#sc_time", overlay).value;
      const hrs = Number($("#sc_dur", overlay).value || 1);
      if (!time || !date) { box.innerHTML = ""; box.dataset.clash=""; return; }
      const startMs = new Date(date+"T"+time).getTime();
      const endMs = startMs + hrs*3600000;
      const sd = new Date(startMs); sd.setHours(0,0,0,0);
      const ed = new Date(endMs-1); ed.setHours(0,0,0,0);
      const spanDays = Math.round((ed-sd)/86400000)+1;
      const clash = findClash(startMs, endMs, b.id);
      if (clash) {
        box.innerHTML = `<div style="background:rgba(255,69,58,.12);border:1px solid var(--bad);border-radius:9px;padding:10px;font-size:13px;color:var(--bad)">⚠ Clashes with <b>${escapeHtml(clash.name||"another job")}</b> (${ms12(clash.start)} ${msDateShort(clash.start)} – ${ms12(clash.end)}). Pick another time.</div>`;
        box.dataset.clash = "1";
      } else {
        const spanNote = spanDays>1 ? ` · <b>spans ${spanDays} days</b>, until ${ms12(endMs)} ${msDateShort(endMs)}` : "";
        box.innerHTML = `<div style="background:rgba(52,199,89,.12);border:1px solid var(--ok);border-radius:9px;padding:10px;font-size:13px;color:var(--ok)">✓ ${ms12(startMs)} – ${ms12(endMs)} free${spanNote}</div>`;
        box.dataset.clash = "";
      }
    }
    function renderDay() {
      date = $("#sc_date", overlay).value;
      const dayStart = new Date(date+"T00:00").getTime();
      const dayEnd = dayStart + 86400000;
      const dayB = intervalsOnDay(date, b.id);
      const panel = $("#sc_day", overlay);
      let html = `<div class="card" style="padding:12px"><div class="muted" style="font-size:12px;margin-bottom:6px">${new Date(date).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"short"})} — ${dayB.length} booked:</div>`;
      if (!dayB.length) html += `<div style="font-size:13px;color:var(--ok)">Nothing booked — whole day free</div>`;
      else html += dayB.map(d => {
        const from = d.start < dayStart ? "(from prev day)" : ms12(d.start);
        const to = d.end > dayEnd ? "(continues)" : ms12(d.end);
        return `<div style="font-size:13px;margin:3px 0">${from}–${to} · <b>${escapeHtml(d.name||"(job)")}</b>${d.vehicle?(" · "+escapeHtml(d.vehicle)):""}</div>`;
      }).join("");
      const gaps = freeGapsForDay(date, b.id);
      html += `<div class="muted" style="font-size:12px;margin:8px 0 6px">Free slots (${WORK.start}–${WORK.end}) — tap to use:</div>`;
      if (!gaps.length) html += `<div style="font-size:13px;color:var(--warn)">No free time left in working hours</div>`;
      else html += `<div class="row" style="gap:6px;flex-wrap:wrap">` + gaps.map(g => { const st=new Date(g.start); const hhmm=String(st.getHours()).padStart(2,"0")+":"+String(st.getMinutes()).padStart(2,"0"); return `<button type="button" class="btn btn-ghost btn-sm" data-slot="${hhmm}">${ms12(g.start)}–${ms12(g.end)}</button>`; }).join("") + `</div>`;
      html += `</div>`;
      panel.innerHTML = html;
      panel.querySelectorAll("[data-slot]").forEach(btn => btn.onclick = () => { $("#sc_time", overlay).value = btn.dataset.slot; renderConflict(); });
      renderConflict();
    }
    $("#sc_date", overlay).onchange = renderDay;
    $("#sc_time", overlay).oninput = renderConflict;
    $("#sc_dur", overlay).oninput = renderConflict;

    if ($("#sc_unschedule", overlay)) $("#sc_unschedule", overlay).onclick = async () => {
      const { error } = await sb.from("bookings").update({ scheduled_date:null, scheduled_time:null, status: b.status==="scheduled" ? "contacted" : b.status }).eq("id", b.id);
      if (error) return toast(error.message, "bad");
      await loadBookings(); close();
      if (state.view==="schedule") openSchedule(); else if (state.view==="bookings") openBookings();
      toast("Unscheduled", "ok");
    };
    $("#sc_save", overlay).onclick = async () => {
      date = $("#sc_date", overlay).value;
      const time = $("#sc_time", overlay).value;
      const hrs = Number($("#sc_dur", overlay).value || 1);
      if (!date || !time) return toast("Pick a date and time", "bad");
      if (!hrs || hrs <= 0) return toast("Enter duration in hours", "bad");
      if ($("#sc_conflict", overlay).dataset.clash === "1" && !confirm("This time clashes with another job. Save anyway?")) return;
      const { error } = await sb.from("bookings").update({
        scheduled_date: date, scheduled_time: time, duration_min: Math.round(hrs*60),
        status: (b.status==="new"||b.status==="contacted") ? "scheduled" : b.status,
      }).eq("id", b.id);
      if (error) return toast(error.message, "bad");
      await loadBookings(); close();
      if (state.view==="schedule") openSchedule(); else if (state.view==="bookings") openBookings();
      toast("Scheduled ✓", "ok");
    };
    renderDay();
  }

  // ---------- schedule (agenda) view ----------
  async function openSchedule() {
    state.view = "schedule";
    if (!state.bookings.length) await loadBookings();
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between">
        <button class="btn btn-ghost btn-sm" id="backBtn">← Back</button>
        <h2 style="margin:0">Schedule</h2><span></span>
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn btn-sm" id="addManual">+ Add booking (phone/SMS)</button>
      </div>
      <div class="card" id="scheduleList" style="margin-top:14px"></div>
    </div>`;
    wireTop();
    $("#backBtn").onclick = openDashboard;
    $("#addManual").onclick = openManualBooking;
    renderScheduleList();
  }

  function renderScheduleList() {
    const box = $("#scheduleList"); if (!box) return;
    const sched = (state.bookings||[]).filter(b => b.scheduled_date && b.scheduled_time && b.status!=="archived");
    if (!sched.length) { box.innerHTML = `<p class="muted">No scheduled jobs yet. Open a booking and tap “Schedule”, or add one manually above.</p>`; return; }
    // expand each job across the days it spans (multi-day jobs show on every day they touch)
    const byDate = {};
    sched.forEach(b => {
      const days = bookingDays(b);
      days.forEach((d, i) => { (byDate[d] = byDate[d] || []).push({ b, idx:i, isFirst:i===0, isLast:i===days.length-1, span:days.length }); });
    });
    const today = ymd(new Date());
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate()+1); const tomorrow = ymd(tmrw);
    const dayLabel = (d) => d===today ? "Today" : d===tomorrow ? "Tomorrow" : new Date(d+"T00:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"short"});
    const sk = (e)=> e.isFirst ? (new Date(bStartMs(e.b)).getHours()*60 + new Date(bStartMs(e.b)).getMinutes()) : -1;
    let html = "";
    Object.keys(byDate).sort().forEach(d => {
      const isPast = d < today;
      html += `<div style="margin:14px 0 6px;font-weight:800;color:${isPast?'var(--muted)':'var(--brand)'}">${dayLabel(d)}${isPast?' (past)':''} <span class="muted" style="font-weight:400;font-size:12px">· ${new Date(d+"T00:00").toLocaleDateString("en-AU")}</span></div>`;
      html += `<div class="joblist">` + byDate[d].sort((x,y)=>sk(x)-sk(y)).map(({b,idx,isFirst,isLast,span}) => {
        const startMs=bStartMs(b), endMs=bEndMs(b);
        let timeBadge, sub;
        if (span===1) { timeBadge = ms12(startMs); sub = "til "+ms12(endMs); }
        else if (isFirst) { timeBadge = ms12(startMs); sub = `→ continues · day 1/${span}`; }
        else if (isLast) { timeBadge = "ends"; sub = `by ${ms12(endMs)} · day ${span}/${span}`; }
        else { timeBadge = "all day"; sub = `continues · day ${idx+1}/${span}`; }
        return `<div class="jobitem" data-bid="${b.id}" style="${isPast?'opacity:.55':''}">
          <span class="tag" style="background:var(--panel2);color:var(--text);min-width:78px;text-align:center">${timeBadge}</span>
          <div class="main">
            <div class="t">${escapeHtml(b.name||"(no name)")}${b.vehicle?(" — "+escapeHtml(b.vehicle)):""}${span>1?` <span style="color:#4aa3df">· ${span}-day job</span>`:""}</div>
            <div class="s">${b.service_type?escapeHtml(b.service_type)+" · ":""}${sub}${b.location?(" · "+escapeHtml(b.location)):""}${b.phone?(" · "+escapeHtml(b.phone)):""}</div>
          </div>
          <div class="amt" style="font-size:12px;color:var(--muted)">${(b.status||"").toUpperCase()}</div>
        </div>`;
      }).join("") + `</div>`;
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-bid]").forEach(it => it.onclick = () => {
      const b = state.bookings.find(x => x.id === it.dataset.bid); openBookingDetail(b);
    });
  }

  function renderScheduleBar() {
    const bar = $("#scheduleBar"); if (!bar) return;
    const today = new Date().toISOString().slice(0,10);
    const todayJobs = (state.bookings||[]).filter(b => b.scheduled_date===today && b.status!=="archived").sort((a,b)=>(a.scheduled_time||"").localeCompare(b.scheduled_time||""));
    const upcoming = (state.bookings||[]).filter(b => b.scheduled_date && b.scheduled_date>today && b.status!=="archived").length;
    const next = todayJobs[0];
    bar.innerHTML = `<div class="row between" style="align-items:center">
      <div><div class="muted" style="font-size:12px">Schedule</div>
        <div style="font-size:13px;margin-top:2px">
          ${todayJobs.length ? `<b style="color:var(--brand)">${todayJobs.length} today</b>${next?` · next ${fmtTime12(next.scheduled_time)} ${escapeHtml(next.name||"")}`:""}` : `<span class="muted">Nothing scheduled today</span>`}${upcoming?` · <span class="muted">${upcoming} upcoming</span>`:""}
        </div>
      </div>
      <span class="btn btn-ghost btn-sm">View →</span>
    </div>`;
  }

  const BSTATUS = [
    { k:"new",       label:"New" },
    { k:"contacted", label:"Contacted" },
    { k:"scheduled", label:"Scheduled" },
    { k:"converted", label:"Converted" },
    { k:"archived",  label:"Archived" },
    { k:"all",       label:"All" },
  ];

  async function openBookings() {
    state.view = "bookings";
    if (!state.bookings.length) await loadBookings();
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between">
        <button class="btn btn-ghost btn-sm" id="backBtn">← Back</button>
        <h2 style="margin:0">Bookings</h2><span></span>
      </div>
      <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" id="addManual">+ Add booking (phone/SMS)</button>
        <button class="btn btn-ghost btn-sm" id="goSchedule"> Schedule view</button>
      </div>
      <div class="tabs" id="bTabs" style="margin-top:14px;flex-wrap:wrap">
        ${BSTATUS.map(s => {
          const n = s.k === "all" ? state.bookings.length : state.bookings.filter(b => b.status === s.k).length;
          return `<div class="tab ${s.k===state.bookingsFilter?'active':''}" data-bs="${s.k}">${s.label} (${n})</div>`;
        }).join("")}
      </div>
      <div class="card" id="bookingsList" style="margin-top:14px"></div>
    </div>`;
    wireTop();
    $("#backBtn").onclick = openDashboard;
    $("#addManual").onclick = openManualBooking;
    $("#goSchedule").onclick = openSchedule;
    app.querySelectorAll("#bTabs .tab").forEach(t => t.onclick = () => {
      state.bookingsFilter = t.dataset.bs; openBookings();
    });
    renderBookingsList();
  }

  function renderBookingsList() {
    const f = state.bookingsFilter;
    const list = state.bookings.filter(b => f === "all" || b.status === f);
    const box = $("#bookingsList"); if (!box) return;
    if (!list.length) { box.innerHTML = `<p class="muted">No bookings in this view.</p>`; return; }
    const stColor = { new:"var(--brand)", contacted:"var(--warn)", scheduled:"#4aa3df", converted:"var(--ok)", archived:"var(--muted)" };
    box.innerHTML = `<div class="joblist">` + list.map(b => `
      <div class="jobitem" data-bid="${b.id}">
        <span class="tag" style="background:rgba(255,94,0,.16);color:${stColor[b.status]||'var(--muted)'}">${(b.status||"new").toUpperCase()}</span>
        <div class="main">
          <div class="t">${escapeHtml(b.name || "(no name)")}${b.phone ? ' · '+escapeHtml(b.phone) : ''}</div>
          <div class="s">${escapeHtml(b.vehicle || "")}${b.rego?(' · '+escapeHtml(b.rego)):''} · ${new Date(b.created_at).toLocaleString("en-AU", {dateStyle:"short", timeStyle:"short"})}</div>
          ${b.scheduled_date ? `<div class="s" style="margin-top:3px;color:#4aa3df;font-weight:700"> ${new Date(b.scheduled_date+"T00:00").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})} · ${fmtTime12(b.scheduled_time)}${dayCount(b)>1?` · ${dayCount(b)}-day`:""}</div>` : ''}
          ${b.symptoms ? `<div class="s" style="margin-top:3px;color:var(--text);opacity:.85">"${escapeHtml((b.symptoms||"").slice(0,90))}${b.symptoms.length>90?'…':''}"</div>` : ''}
        </div>
        <div class="amt" style="font-size:18px">→</div>
      </div>`).join("") + `</div>`;
    box.querySelectorAll("[data-bid]").forEach(it => it.onclick = () => {
      const b = state.bookings.find(x => x.id === it.dataset.bid);
      openBookingDetail(b);
    });
  }

  function openBookingDetail(b) {
    const fmt = (k, v) => v ? `<div class="field" style="margin-bottom:8px"><div class="muted" style="font-size:11px">${k}</div><div>${escapeHtml(v)}</div></div>` : "";
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6);overflow:auto;padding:20px 12px">
      <div class="login-card" style="max-width:520px;text-align:left;margin:auto">
        <div class="row between" style="margin-bottom:8px"><h2 style="margin:0">Booking detail</h2>
          <button class="btn btn-ghost btn-sm" id="b_close">✕</button></div>
        <div class="muted" style="font-size:12px;margin-bottom:14px">Received ${new Date(b.created_at).toLocaleString("en-AU")} · Status: <b style="text-transform:uppercase">${b.status||"new"}</b></div>
        ${fmt("Name", b.name)}
        ${fmt("Phone", b.phone)}
        ${fmt("Email", b.email)}
        ${fmt("Vehicle", b.vehicle)}
        ${fmt("Rego", b.rego)}
        ${fmt("VIN", b.vin)}
        ${fmt("Odometer", b.odometer)}
        ${fmt("Service type", b.service_type)}
        ${fmt("Symptoms", b.symptoms)}
        ${fmt("Location", b.location)}
        ${fmt("Preferred time", b.preferred_time)}
        ${fmt("Contact via", b.contact_method)}
        ${b.job_id ? `<div class="hint" style="color:var(--ok);margin-top:6px">✓ Already converted to a job</div>` : ""}
        ${b.scheduled_date ? `<div class="hint" style="color:#4aa3df;margin-top:6px"> Scheduled: ${new Date(b.scheduled_date+"T00:00").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})} at ${fmtTime12(b.scheduled_time)} · ${(Number(b.duration_min||DEFAULT_DURATION)/60)} hr${dayCount(b)>1?` → until ${ms12(bEndMs(b))} ${msDateShort(bEndMs(b))} (${dayCount(b)} days)`:""}</div>` : ""}
        <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn" id="b_schedule"> ${b.scheduled_date ? "Reschedule" : "Schedule"}</button>
          ${b.status!=="converted" ? `<button class="btn btn-ghost" id="b_repair">+ Create Repair</button>
          <button class="btn btn-ghost" id="b_ppi">+ Create Inspection</button>` : ""}
        </div>
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          ${b.status==="new" ? `<button class="btn btn-ghost btn-sm" id="b_contacted">Mark contacted</button>` : ""}
          ${b.status!=="archived" && b.status!=="converted" ? `<button class="btn btn-ghost btn-sm" id="b_archive">Archive</button>` : ""}
          ${b.status==="archived" ? `<button class="btn btn-ghost btn-sm" id="b_unarchive">Unarchive</button>` : ""}
          <button class="btn btn-danger btn-sm" id="b_delete">Delete</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    $("#b_close", overlay).onclick = close;
    $("#b_schedule", overlay).onclick = () => { close(); openScheduleModal(b); };
    if ($("#b_repair", overlay)) $("#b_repair", overlay).onclick = () => { close(); convertBookingToJob(b, "repair"); };
    if ($("#b_ppi", overlay)) $("#b_ppi", overlay).onclick = () => { close(); convertBookingToJob(b, "ppi"); };
    if ($("#b_contacted", overlay)) $("#b_contacted", overlay).onclick = () => updateBookingStatus(b, "contacted", close);
    if ($("#b_archive", overlay)) $("#b_archive", overlay).onclick = () => updateBookingStatus(b, "archived", close);
    if ($("#b_unarchive", overlay)) $("#b_unarchive", overlay).onclick = () => updateBookingStatus(b, "new", close);
    $("#b_delete", overlay).onclick = async () => {
      if (!confirm("Delete this booking permanently?")) return;
      const { error } = await sb.from("bookings").delete().eq("id", b.id);
      if (error) return toast(error.message, "bad");
      await loadBookings(); close(); openBookings(); toast("Deleted", "ok");
    };
  }

  async function updateBookingStatus(b, status, onDone) {
    const { error } = await sb.from("bookings").update({ status }).eq("id", b.id);
    if (error) return toast(error.message, "bad");
    await loadBookings(); if (onDone) onDone(); openBookings(); toast("Updated ✓", "ok");
  }

  function convertBookingToJob(b, type) {
    // Map booking fields to job data fields
    const prefill = {
      customer_name: b.name || "",
      phone: b.phone || "",
      email: b.email || "",
      vehicle: b.vehicle || "",
      rego: b.rego || "",
      vin: b.vin || "",
      odometer: b.odometer || "",
      address: b.location || "",
      reported_issue: [b.service_type, b.symptoms].filter(Boolean).join(" — "),
      _bookingId: b.id,   // tracked by openEditor → saveJob
    };
    openEditor(type, null, prefill);
    toast("Booking data filled in — review and save", "ok");
  }

  // =====================================================================
  // CSV EXPORT — financial summary for ATO / accountant
  // =====================================================================
  function csvCell(v) {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function csvRow(arr) { return arr.map(csvCell).join(",") + "\r\n"; }

  function exportFinanceCSV() {
    const key = state.moneyPeriod;
    const r = periodRange(key);
    const periodLabel = (PERIODS.find(p => p.k === key) || { label: key }).label;

    // Build rows
    const rows = [];
    // Header
    rows.push(["Date","Type","Reference","Name","Description","Amount (AUD)"]);

    let income = 0, parts = 0;

    // Paid jobs = income (status logic respected via jobIncomeClass)
    const incomeRows = [];
    (state.jobs || []).forEach(j => {
      if (!inRange(jobDate(j), r)) return;
      if (jobIncomeClass(j) !== "income") return;
      const desc = (j.vehicle || "") + (j.rego ? " · "+j.rego : "");
      incomeRows.push([
        jobDate(j).toISOString().slice(0,10),
        j.doc_type === "ppi" ? "Income (PPI)" : (j.data && j.data.cash ? "Income (cash sale)" : "Income (repair)"),
        j.job_no || "",
        j.customer || "",
        desc,
        Number(j.total || 0).toFixed(2),
      ]);
      income += Number(j.total || 0);
    });
    incomeRows.sort((a,b) => a[0].localeCompare(b[0]));
    incomeRows.forEach(rw => rows.push(rw));

    // Expenses (purchases + refunds)
    const expRows = [];
    (state.expenses || []).forEach(e => {
      const d = new Date(e.date || e.created_at);
      if (!inRange(d, r)) return;
      const signed = expenseSigned(e);
      parts += signed;
      expRows.push([
        d.toISOString().slice(0,10),
        e.kind === "refund" ? "Parts refund" : "Parts purchase",
        e.receipt_no || "",
        e.supplier || "",
        e.note || "",
        signed.toFixed(2),
      ]);
    });
    expRows.sort((a,b) => a[0].localeCompare(b[0]));
    expRows.forEach(rw => rows.push(rw));

    // Blank then summary
    rows.push([]);
    rows.push(["","","","","TOTAL INCOME", income.toFixed(2)]);
    rows.push(["","","","","TOTAL PARTS (net of refunds)", parts.toFixed(2)]);
    rows.push(["","","","","NET (income − parts)", (income - parts).toFixed(2)]);
    rows.push([]);
    rows.push(["","","","","Period:", periodLabel]);
    rows.push(["","","","","Generated:", new Date().toISOString()]);
    rows.push(["","","","","Business:", (window.SIAM_CONFIG && window.SIAM_CONFIG.BUSINESS && window.SIAM_CONFIG.BUSINESS.name) || ""]);
    rows.push(["","","","","ABN:", (window.SIAM_CONFIG && window.SIAM_CONFIG.BUSINESS && window.SIAM_CONFIG.BUSINESS.abn) || ""]);
    rows.push([]);
    rows.push(["","","","","Note: Counts PAID jobs only. Cancelled / Quote / Draft excluded. Net is before labour, fuel, tools & other business expenses. Provide to your accountant for ATO purposes."]);

    // Build CSV blob, add UTF-8 BOM so Excel opens it cleanly (Thai/non-ASCII names)
    const csv = "\uFEFF" + rows.map(csvRow).join("");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const slug = periodLabel.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
    const fname = `siam-finance-${slug}-${new Date().toISOString().slice(0,10)}.csv`;
    window.saveAs ? window.saveAs(blob, fname) : (() => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })();
    toast(`Exported ${incomeRows.length} income + ${expRows.length} expense rows`, "ok");
  }

  // ---------- save custom snippet ----------
  function openSaveSnippet(fieldKey, initialText) {
    const overlay = el(`<div class="login-wrap" style="position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6)">
      <div class="login-card" style="max-width:480px;text-align:left">
        <h2 style="text-align:center">Save snippet</h2>
        <p class="muted" style="font-size:12px;text-align:center;margin-top:-6px">For field: <b>${escapeHtml(fieldKey)}</b></p>
        <div class="field"><label>Label (short name for the button)</label><input id="sn_label" placeholder="e.g. 'Brakes good' or 'Standard inspection'"/></div>
        <div class="field"><label>Text (edit before saving)</label><textarea id="sn_text" style="min-height:140px">${escapeHtml(initialText || "")}</textarea></div>
        <div class="row" style="gap:10px;margin-top:6px">
          <button class="btn" id="sn_save" style="flex:1">Save snippet</button>
          <button class="btn btn-ghost" id="sn_cancel">Cancel</button>
        </div>
      </div></div>`);
    document.body.appendChild(overlay);
    setTimeout(() => $("#sn_label", overlay).focus(), 50);
    $("#sn_cancel", overlay).onclick = () => overlay.remove();
    $("#sn_save", overlay).onclick = async () => {
      const label = $("#sn_label", overlay).value.trim();
      const text = $("#sn_text", overlay).value.trim();
      if (!label) return toast("Enter a label", "bad");
      if (!text) return toast("Snippet is empty", "bad");
      const row = { user_id: session.user.id, kind: "snippet", label,
        data: { field: fieldKey, text } };
      const { error } = await sb.from("presets").insert(row);
      if (error) return toast(error.message, "bad");
      overlay.remove();
      await loadCustomSnippets();
      // re-render the form so the new chip appears (preserve current values)
      const form = window.SIAM_FORMS[state.current.type];
      collect(form);
      renderForm(form, state.current.data);
      toast("Snippet saved ✓", "ok");
    };
  }

  boot();
})();
