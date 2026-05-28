// =====================================================================
// SIAM AUTOWORKS — Main app (auth, routing, dashboard, editor)
// =====================================================================
(function () {
  const cfg = window.SIAM_CONFIG || {};
  const app = document.getElementById("app");
  const printMount = document.getElementById("printMount");
  let sb = null;          // supabase client
  let session = null;
  let state = { view: "loading", jobs: [], filter: "all", current: null };

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

  // ---------- dashboard ----------
  async function openDashboard() {
    state.view = "dashboard";
    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between"><h1>Jobs</h1>
        <div class="row">
          <button class="btn" id="newRepair">+ Repair job</button>
          <button class="btn btn-ghost" id="newPPI">+ Inspection</button>
        </div>
      </div>
      <div class="tabs" style="margin-top:14px">
        <div class="tab active" data-f="all">All</div>
        <div class="tab" data-f="repair">Repairs</div>
        <div class="tab" data-f="ppi">Inspections</div>
      </div>
      <div class="card" id="listCard"><p class="muted">Loading…</p></div>
    </div>`;
    wireTop();
    $("#newRepair").onclick = () => openEditor("repair");
    $("#newPPI").onclick = () => openEditor("ppi");
    app.querySelectorAll(".tab").forEach(t => t.onclick = () => {
      app.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active"); state.filter = t.dataset.f; renderList();
    });
    await loadJobs();
  }

  async function loadJobs() {
    const { data, error } = await sb.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) { $("#listCard").innerHTML = `<p class="muted">Error: ${error.message}</p>`; return; }
    state.jobs = data || []; renderList();
  }

  function renderList() {
    const list = state.jobs.filter(j => state.filter === "all" || j.doc_type === state.filter);
    if (!list.length) { $("#listCard").innerHTML = `<p class="muted">No jobs yet. Create one above.</p>`; return; }
    $("#listCard").innerHTML = `<div class="joblist">` + list.map(j => `
      <div class="jobitem" data-id="${j.id}">
        <span class="tag ${j.doc_type}">${j.doc_type === "ppi" ? "PPI" : "REPAIR"}</span>
        <div class="main">
          <div class="t">${escapeHtml(j.customer || "(no name)")} — ${escapeHtml(j.vehicle || "")}</div>
          <div class="s">${escapeHtml(j.job_no || "")} · ${escapeHtml(j.rego || "")} · ${new Date(j.created_at).toLocaleDateString("en-AU")}</div>
        </div>
        <div class="amt">$${window.SIAM_DOCGEN.money(j.total)}</div>
      </div>`).join("") + `</div>`;
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
    state.current = { id: job ? job.id : null, type, data };

    app.innerHTML = topbar() + `<div class="wrap">
      <div class="row between">
        <button class="btn btn-ghost btn-sm" id="backBtn">← Back</button>
        <h2 style="margin:0">${form.title}</h2>
        <span></span>
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
      return `<div class="field" style="grid-column:1/-1"><label>${escapeHtml(f.label)}</label><textarea data-k="${f.k}" ${f.big?'style="min-height:120px"':''}>${escapeHtml(v)}</textarea></div>`;
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
    return `<div class="field" style="grid-column:1/-1">
      <table class="litems" id="litems">
        <thead><tr><th>Qty</th><th>Description</th><th>Unit $</th><th>GST $</th><th>Total</th><th></th></tr></thead>
        <tbody>${items.map((it,i)=>litemRow(it,i)).join("")}</tbody>
      </table>
      <button type="button" class="btn btn-ghost btn-sm" id="addItem">+ Add line</button>
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

  boot();
})();
