// =====================================================================
// SIAM AUTOWORKS — Document generator
//   renderDocHTML(form, data)  -> HTML string (preview + print to PDF)
//   generateDocx(form, data)   -> builds & downloads a .docx
// =====================================================================
(function () {
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const money = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function computeTotals(items) {
    let sub = 0, gst = 0;
    (items || []).forEach(it => {
      const line = Number(it.qty || 0) * Number(it.unit || 0);
      sub += line;
      gst += Number(it.gst || 0);
    });
    return { sub, gst, total: sub + gst };
  }

  const BIZ = () => (window.SIAM_CONFIG && window.SIAM_CONFIG.BUSINESS) || {};

  // ---------- shared header block ----------
  function docHead(title) {
    const b = BIZ();
    return `
      <div class="head">
        <div class="logo"><img src="assets/logo.png" alt="SIAM AUTOWORKS"/></div>
        <div class="ttl">
          <div class="big">${esc(title)}</div>
          <div class="biz">${esc(b.name)}
            <small>ABN: ${esc(b.abn)} | Phone: ${esc(b.phone)}</small>
            <small>Email: ${esc(b.email)} | Address: ${esc(b.address)}</small>
          </div>
        </div>
      </div>`;
  }

  // ---------- header info table (customer/vehicle) ----------
  function headerTable(d, isPPI) {
    const rows = [
      [`${isPPI ? "Job No:" : "Invoice No:"}`, d.job_no, "Date:", d.date],
      ["Due Date:", d.due_date, "Payment Terms:", d.payment_terms],
      ["Customer Name:", d.customer_name, "Phone:", d.phone],
      [isPPI ? "Address/Location:" : "Customer Address:", d.address, "Email:", d.email],
      ["Vehicle:", d.vehicle, "Rego:", d.rego],
      ["Odometer (km):", d.odometer, "VIN:", d.vin],
    ];
    if (isPPI) rows.push(["Seller (on-site):", d.seller, "Purpose:", d.purpose]);
    return `<table class="info">${rows.map(r => `
      <tr>
        <td class="lbl">${esc(r[0])}</td><td>${esc(r[1])}</td>
        <td class="lbl">${esc(r[2])}</td><td>${esc(r[3])}</td>
      </tr>`).join("")}</table>`;
  }

  // ---------- invoice line items + totals ----------
  function invoiceBody(d, invoiceTitle) {
    const items = d.items || [];
    const t = computeTotals(items);
    const blankRows = Math.max(0, 6 - items.length);
    const rowsHtml = items.map(it => {
      const line = Number(it.qty || 0) * Number(it.unit || 0);
      return `<tr>
        <td class="c">${esc(it.qty)}</td>
        <td>${esc(it.desc)}</td>
        <td class="r">$${money(it.unit)}</td>
        <td class="r">$${money(it.gst)}</td>
        <td class="r">$${money(line)}</td></tr>`;
    }).join("") + Array(blankRows).fill(`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join("");

    return `
      <table class="items">
        <tr><th>Qty</th><th>Description (Parts &amp; Labour)</th><th>Unit Price</th><th>GST</th><th>Line Total</th></tr>
        ${rowsHtml}
      </table>
      <table class="tots">
        <tr><td class="lbl r">Subtotal (ex GST):</td><td class="r">$ ${money(t.sub)}</td></tr>
        <tr><td class="lbl r">GST:</td><td class="r">$ ${money(t.gst)}</td></tr>
        <tr class="grand"><td class="lbl r">Total (inc GST):</td><td class="r">$ ${money(t.total)}</td></tr>
      </table>`;
  }

  // ---------- a labelled section row (for job sheet) ----------
  function sect(label, valueHtml) {
    return `<tr><td class="lbl">${esc(label)}</td><td>${valueHtml || ""}</td></tr>`;
  }
  const nl2br = (s) => esc(s).replace(/\n/g, "<br/>");

  // ---------- checklist grid ----------
  function checklistGrid(checklist, items) {
    const cells = items.map(it => {
      const on = checklist && checklist[it];
      return `<td>${on ? "☑" : "☐"} ${esc(it)}</td>`;
    });
    let rows = "";
    for (let i = 0; i < cells.length; i += 4) {
      rows += `<tr>${cells.slice(i, i + 4).join("")}${
        cells.slice(i, i + 4).length < 4 ? "<td></td>".repeat(4 - cells.slice(i, i + 4).length) : ""
      }</tr>`;
    }
    return `<h4>Inspection Checklist:</h4><table class="checkgrid">${rows}</table>`;
  }

  function prioLine(label, val) {
    const opts = ["Low","Medium","High"].map(o =>
      `<b>${o === val ? "[" + o + "]" : o}</b>`).join(" / ");
    return `${esc(label)} &nbsp; Priority: ${opts}`;
  }

  // =====================================================================
  // HTML for REPAIR
  // =====================================================================
  function repairHTML(d) {
    const cl = window.SIAM_FORMS.checklistItems;
    return `<div class="doc">
      <!-- INVOICE PAGE -->
      <div class="page">
        <div class="pno">Page 1 of 2</div>
        ${docHead("TAX INVOICE")}
        ${headerTable(d, false)}
        ${invoiceBody(d, "TAX INVOICE")}
        <p class="note"><b>Payment Method:</b> Cash / EFT / Card</p>
        <p class="note"><b>Warranty:</b> Workmanship warranty 3 months / 5,000 km (whichever comes first). Customer-supplied parts are not covered.</p>
        <p class="note"><b>GST Note:</b> No GST has been charged.</p>
      </div>
      <!-- JOB SHEET PAGE -->
      <div class="page">
        <div class="pno">Page 2 of 2</div>
        ${docHead("JOB SHEET / WORK ORDER + VEHICLE REPORT")}
        ${headerTable(d, false)}
        <table class="sect">
          ${sect("Customer Reported Issue:", nl2br(d.reported_issue))}
          ${sect("Diagnosis / Inspection:", nl2br(d.diagnosis))}
          ${sect("Work Performed:", nl2br(d.work_performed))}
          ${sect("Parts / Materials Used:", nl2br(d.parts_used))}
          ${sect("Special Tools Used:", nl2br(d.special_tools))}
        </table>
        ${checklistGrid(d.checklist, cl)}
        <table class="sect">
          ${sect("Before/After Photos Attached:", `${d.photos_attached === "Yes" ? "☑ YES ☐ NO" : d.photos_attached === "No" ? "☐ YES ☑ NO" : "☐ YES ☐ NO"} &nbsp;|&nbsp; Road Test: ${d.road_test === "Yes" ? "☑ YES ☐ NO" : d.road_test === "No" ? "☐ YES ☑ NO" : "☐ YES ☐ NO"}`)}
          ${sect("Outcome After Repair:", nl2br(d.outcome))}
          ${sect("Notes / Recommendations (Next Service):", nl2br(d.notes))}
        </table>
        <h4>Customer Authorisation</h4>
        <table class="auth">
          ${sect("Customer authorised repairs up to (AUD):", "$" + money(d.authorised_amount))}
          ${sect("Customer Name & Signature:", "")}
          ${sect("Mechanic Name & Signature:", esc(BIZ().mechanic || ""))}
        </table>
      </div>
    </div>`;
  }

  // =====================================================================
  // HTML for PPI
  // =====================================================================
  function ppiHTML(d) {
    const cl = window.SIAM_FORMS.checklistItems.concat(["4WD engagement","Diff/Transfer","VIN verification","Photos taken"]);
    const fill = (s) => `<span class="fill">${esc(s || "")}</span>`;
    const ck = (v) => v ? "☑" : "☐";

    const identity = `
      ${ck(d.identity_vin)} VIN on compliance plate confirmed and matches dash VIN.<br/>
      ${ck(d.identity_plate)} Build / compliance plate present and legible.<br/>
      ☐ Engine number recorded: ${fill(d.identity_engineno)}<br/>
      ${ck(d.identity_rego)} Rego confirmed: ${fill(d.identity_rego)}<br/>
      ${ck(d.identity_ppsr)} Customer advised to perform PPSR check independently for finance owing, written-off, stolen or encumbrance status.`;

    const diag1 = `
      <b>Exterior &amp; Body:</b> Condition ${fill(d.ext_body)}. Panel gaps/alignment ${fill(d.ext_panels)}. Paintwork ${fill(d.ext_paint)}. Repaint/overspray/colour mismatch: ${fill(d.ext_repaint)}. Underbody/chassis rust: ${fill(d.ext_underbody)}. Windscreen: ${fill(d.ext_windscreen)}.<br/><br/>
      <b>Interior &amp; Cabin:</b> Condition ${fill(d.int_cond)}. Seats/belts/dash/infotainment/camera: ${fill(d.int_electronics)}. Water/flood: ${fill(d.int_flood)}. Keys present: ${fill(d.int_keys)}.<br/><br/>
      <b>Tyres &amp; Wheels:</b> Brand/size: ${fill(d.tyre_brand)}. Tread F-LH ${fill(d.tyre_fl)} / F-RH ${fill(d.tyre_fr)} / R-LH ${fill(d.tyre_rl)} / R-RH ${fill(d.tyre_rr)} mm. Wear: ${fill(d.tyre_wear)}. Wheel: ${fill(d.tyre_wheel)}. Spare: ${fill(d.tyre_spare)}.<br/><br/>
      <b>Brakes:</b> Front pad LH ${fill(d.brk_fl)} / RH ${fill(d.brk_fr)} mm. Rear LH ${fill(d.brk_rl)} / RH ${fill(d.brk_rr)} mm. Rotors ${fill(d.brk_rotors)}. Fluid ${fill(d.brk_fluid)}. Handbrake ${fill(d.brk_handbrake)}. Pedal ${fill(d.brk_pedal)}.`;

    const diag2 = `
      <b>Suspension &amp; Steering:</b> Shocks/struts ${fill(d.sus_shocks)}. Bushes/joints/tie rods ${fill(d.sus_joints)}. Steering &amp; power steering ${fill(d.sus_steering)}. Looseness/noise: ${fill(d.sus_noise)}.<br/><br/>
      <b>Engine:</b> Cold start ${fill(d.eng_start)}. Idle ${fill(d.eng_idle)}. Oil ${fill(d.eng_oil)}. Oil leaks: ${fill(d.eng_leak)}. Blow-by: ${fill(d.eng_blowby)}. Belts/hoses/air filter ${fill(d.eng_belts)}. Timing belt/service history: ${fill(d.eng_timing)}.<br/><br/>
      <b>Cooling System:</b> Coolant ${fill(d.cool_level)}. Radiator/hoses/pump/fans ${fill(d.cool_radiator)}. Cross-contamination: ${fill(d.cool_cross)}. Operating temp ${fill(d.cool_temp)}.`;

    const driveline = `Auto trans fluid: ${fill(d.trans_fluid)}. Gear shifts/kickdown ${fill(d.trans_shift)}. Transfer case H4/L4: ${fill(d.trans_transfer)}. Diff lock ${fill(d.trans_difflock)}. CV boots/shafts/uni joints ${fill(d.trans_cv)}. Diff/transfer leaks: ${fill(d.trans_diffleak)}. 4WD tested only where safe.`;

    const fuelelec = `Fuel lines/tank: ${fill(d.fuel_lines)}. Exhaust: ${fill(d.exh_system)}. Mounts/hangers ${fill(d.exh_mounts)}.<br/><br/>Battery resting ${fill(d.bat_resting)} V. Charging ${fill(d.bat_charging)} V. Battery age ${fill(d.bat_age)}. Exterior lighting: ${fill(d.elec_lights)}. Wipers/washers ${fill(d.elec_wipers)}. Air-con ${fill(d.elec_aircon)}.`;

    const scan = `Scan tool: ${fill(d.scan_tool)}. Warning lights at key-on: ${fill(d.scan_warning)}. Current DTCs: ${fill(d.scan_dtc)}. Pending/history DTCs: ${fill(d.scan_pending)}. Readiness: ${fill(d.scan_readiness)}. ECU mileage: ${fill(d.scan_ecu)}. Note: absence of fault codes does not guarantee absence of mechanical or intermittent faults.`;

    const roadtest = `Road-tested approx ${fill(d.road_km)} km. Acceleration/shifts/braking/steering/drivetrain: ${fill(d.road_behaviour)}. Abnormal vibration/pulling/overheating: ${fill(d.road_abnormal)}.`;

    const history = `Service history sighted: ${fill(d.hist_sighted)}. Last service: ${fill(d.hist_last)}. Timing belt/major service record: ${fill(d.hist_timing)}. Owner manual/logbook present: ${fill(d.hist_logbook)}. Ownership, registration and finance status are not verified by SIAM AUTOWORKS and must be checked separately by the customer.`;

    const opinion = `${["GOOD","FAIR","POOR","NOT SUITABLE FOR PURCHASE"].map(o => `${d.overall === o ? "☑" : "☐"} ${o}`).join("&nbsp;&nbsp;&nbsp;")}<br/><br/><b>Inspector's Summary:</b> ${nl2br(d.summary)}<br/><br/><b>Recommendation:</b> ${esc(d.recommendation)}`;

    const prio = [
      prioLine("Engine:", d.prio_engine),
      prioLine("Transmission / 4WD:", d.prio_trans),
      prioLine("Brakes:", d.prio_brakes),
      prioLine("Suspension / Steering:", d.prio_suspension),
      prioLine("Tyres:", d.prio_tyres),
      prioLine("Body / Rust:", d.prio_body),
      prioLine("Diagnostics:", d.prio_diag),
    ].join("<br/>");

    return `<div class="doc">
      <!-- INVOICE PAGE -->
      <div class="page">
        <div class="pno">Page 1 of 4</div>
        ${docHead("INVOICE")}
        ${headerTable(d, true)}
        ${invoiceBody(d, "INVOICE")}
        <p class="note"><b>Payment Method:</b> Cash / EFT / Card / Bank Transfer</p>
        <p class="note"><b>Warranty:</b> Inspection service only. Repair workmanship warranty applies to repair work only; customer-supplied parts are not covered.</p>
        <p class="note"><b>GST Note:</b> No GST has been charged.</p>
        <p class="note"><b>${esc(BIZ().name)}  Ref: ${esc(d.job_no)}</b></p>
        <p class="note">Note: This pre-purchase inspection is a professional opinion based on visual and operational assessment at the time of inspection only. See report for limitations and disclaimer.</p>
      </div>
      <!-- REPORT PAGES -->
      <div class="page">
        <div class="pno">Page 2 of 4</div>
        ${docHead("JOB SHEET / WORK ORDER + VEHICLE REPORT")}
        ${headerTable(d, true)}
        <table class="sect">
          ${sect("Customer Reported Issue:", nl2br(d.reported_issue))}
          ${sect("Inspection Scope:", nl2br(d.inspection_scope))}
          ${sect("Vehicle Identity Verification:", identity)}
          ${sect("Diagnosis / Inspection:", diag1)}
        </table>
      </div>
      <div class="page">
        <div class="pno">Page 3 of 4</div>
        <table class="sect">
          ${sect("Diagnosis / Inspection (cont.):", diag2)}
          ${sect("Transmission / Driveline / 4WD:", driveline)}
          ${sect("Fuel / Exhaust / Electrical:", fuelelec)}
          ${sect("Scan Tool / Diagnostics:", scan)}
          ${sect("Road Test:", roadtest)}
          ${sect("Service History / Documents:", history)}
        </table>
      </div>
      <div class="page">
        <div class="pno">Page 4 of 4</div>
        ${checklistGrid(d.checklist, cl)}
        <table class="sect">
          ${sect("Overall Opinion:", opinion)}
          ${sect("Priority Summary:", prio)}
          ${sect("Outcome After Repair:", nl2br(d.outcome))}
          ${sect("Work Performed:", nl2br(d.work_performed))}
          ${sect("Parts / Materials Used:", nl2br(d.parts_used))}
          ${sect("Special Tools Used:", nl2br(d.special_tools))}
          ${sect("Notes / Recommendations (Next Service):", nl2br(d.notes))}
          ${sect("Items Not Tested / Unable To Verify:", nl2br(d.items_not_tested))}
          ${sect("Limitations / Disclaimer:", nl2br(d.limitations))}
        </table>
        <h4>Customer Authorisation</h4>
        <table class="auth">
          ${sect("Authorised up to (AUD):", "$" + money(d.authorised_amount))}
          ${sect("Customer Name & Signature:", "")}
          ${sect("Mechanic Name & Signature:", esc(BIZ().mechanic || ""))}
        </table>
      </div>
    </div>`;
  }

  // =====================================================================
  // HTML for QUOTE (one page — invoice-style with QUOTE title)
  // =====================================================================
  function quoteHTML(d) {
    const validity = Number(d.validity_days || 30);
    let validUntil = "";
    if (d.date) {
      const dt = new Date(d.date); dt.setDate(dt.getDate() + validity);
      validUntil = dt.toLocaleDateString("en-AU");
    }
    const items = d.items || [];
    const t = computeTotals(items);
    const blankRows = Math.max(0, 6 - items.length);
    const rowsHtml = items.map(it => {
      const line = Number(it.qty || 0) * Number(it.unit || 0);
      return `<tr>
        <td class="c">${esc(it.qty)}</td>
        <td>${esc(it.desc)}</td>
        <td class="r">$${money(it.unit)}</td>
        <td class="r">$${money(it.gst)}</td>
        <td class="r">$${money(line)}</td></tr>`;
    }).join("") + Array(blankRows).fill(`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join("");
    const headerRows = [
      ["Quote No:", d.job_no, "Date:", d.date],
      ["Valid for:", `${validity} days`, "Valid until:", validUntil],
      ["Customer Name:", d.customer_name, "Phone:", d.phone],
      ["Customer Address:", d.address, "Email:", d.email],
      ["Vehicle:", d.vehicle, "Rego:", d.rego],
      ["Odometer (km):", d.odometer, "VIN:", d.vin],
    ];
    return `<div class="doc">
      <div class="page">
        <div class="pno">Quote — Page 1 of 1</div>
        ${docHead("QUOTE")}
        <table class="info">${headerRows.map(r => `
          <tr>
            <td class="lbl">${esc(r[0])}</td><td>${esc(r[1])}</td>
            <td class="lbl">${esc(r[2])}</td><td>${esc(r[3])}</td>
          </tr>`).join("")}</table>
        <table class="items">
          <tr><th>Qty</th><th>Description (Parts &amp; Labour) — estimate</th><th>Unit Price</th><th>GST</th><th>Line Total</th></tr>
          ${rowsHtml}
        </table>
        <table class="tots">
          <tr><td class="lbl r">Subtotal (ex GST):</td><td class="r">$ ${money(t.sub)}</td></tr>
          <tr><td class="lbl r">GST:</td><td class="r">$ ${money(t.gst)}</td></tr>
          <tr class="grand"><td class="lbl r">Quote Total (inc GST):</td><td class="r">$ ${money(t.total)}</td></tr>
        </table>
        <p class="note"><b>Conditions:</b></p>
        <p class="note">${nl2br(d.notes)}</p>
        <p class="note" style="margin-top:14px"><b>GST Note:</b> No GST has been charged.</p>
        <p class="note"><b>This is a quote, not a tax invoice.</b> A tax invoice will be issued on completion of approved work.</p>
      </div>
    </div>`;
  }

  function renderDocHTML(form, data) {
    if (form.type === "quote") return quoteHTML(data);
    return form.type === "ppi" ? ppiHTML(data) : repairHTML(data);
  }

  // =====================================================================
  // DOCX generation (docx.js) — structural match, editable in Word
  // =====================================================================
  function generateDocx(form, data) {
    const D = window.docx;
    if (!D) { alert("Word library not loaded yet, try again in a moment."); return; }
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            WidthType, BorderStyle, AlignmentType, ShadingType, ImageRun, HeadingLevel } = D;

    const b = BIZ();
    const isPPI = form.type === "ppi";
    const isQuote = form.type === "quote";
    const border = { style: BorderStyle.SINGLE, size: 1, color: "B9B9B9" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const CW = 9026; // A4 content width approx

    const tcell = (text, opts = {}) => new TableCell({
      borders,
      width: { size: opts.w || CW / 2, type: WidthType.DXA },
      shading: opts.lbl ? { fill: "EFEFEF", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 40, bottom: 40, left: 90, right: 90 },
      children: (Array.isArray(text) ? text : [text]).map(t =>
        typeof t === "string"
          ? new Paragraph({ children: [new TextRun({ text: t, bold: !!opts.bold, size: 19 })] })
          : t),
    });

    const labelRow = (l, v, l2, v2) => new TableRow({ children: [
      tcell(l, { lbl: true, bold: true, w: CW * 0.23 }),
      tcell(v || "", { w: CW * 0.27 }),
      tcell(l2, { lbl: true, bold: true, w: CW * 0.23 }),
      tcell(v2 || "", { w: CW * 0.27 }),
    ]});

    const sectRow = (l, v) => new TableRow({ children: [
      tcell(l, { lbl: true, bold: true, w: CW * 0.24 }),
      tcell((v || "").split("\n").map(line =>
        new Paragraph({ children: [new TextRun({ text: line, size: 19 })] })), { w: CW * 0.76 }),
    ]});

    const headerInfoTable = () => new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [CW*0.23, CW*0.27, CW*0.23, CW*0.27],
      rows: [
        labelRow(isPPI ? "Job No:" : "Invoice No:", data.job_no, "Date:", data.date),
        labelRow("Due Date:", data.due_date, "Payment Terms:", data.payment_terms),
        labelRow("Customer Name:", data.customer_name, "Phone:", data.phone),
        labelRow(isPPI ? "Address/Location:" : "Customer Address:", data.address, "Email:", data.email),
        labelRow("Vehicle:", data.vehicle, "Rego:", data.rego),
        labelRow("Odometer (km):", data.odometer, "VIN:", data.vin),
        ...(isPPI ? [labelRow("Seller (on-site):", data.seller, "Purpose:", data.purpose)] : []),
      ],
    });

    const titlePara = (txt, size = 44) => new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: txt, bold: true, size })],
    });
    const bizPara = () => [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: b.name, bold: true, size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `ABN: ${b.abn} | Phone: ${b.phone}`, size: 17 })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Email: ${b.email} | Address: ${b.address}`, size: 17 })] }),
      new Paragraph({ text: "" }),
    ];

    // Invoice items table
    const t = computeTotals(data.items);
    const itemsTable = () => {
      const head = new TableRow({ children: ["Qty","Description (Parts & Labour)","Unit Price","GST","Line Total"].map(h =>
        tcell(h, { bold: true, w: CW/5 })) });
      const rows = (data.items || []).map(it => new TableRow({ children: [
        tcell(String(it.qty || ""), { w: CW*0.1 }),
        tcell(it.desc || "", { w: CW*0.5 }),
        tcell("$" + money(it.unit), { w: CW*0.13 }),
        tcell("$" + money(it.gst), { w: CW*0.12 }),
        tcell("$" + money(Number(it.qty||0)*Number(it.unit||0)), { w: CW*0.15 }),
      ]}));
      return new Table({ width: { size: CW, type: WidthType.DXA },
        columnWidths: [CW*0.1, CW*0.5, CW*0.13, CW*0.12, CW*0.15],
        rows: [head, ...rows] });
    };
    const totalsTable = () => new Table({ width:{size:CW*0.5,type:WidthType.DXA}, columnWidths:[CW*0.3,CW*0.2],
      rows: [
        new TableRow({ children:[ tcell("Subtotal (ex GST):",{lbl:true,bold:true,w:CW*0.3}), tcell("$ "+money(t.sub),{w:CW*0.2}) ]}),
        new TableRow({ children:[ tcell("GST:",{lbl:true,bold:true,w:CW*0.3}), tcell("$ "+money(t.gst),{w:CW*0.2}) ]}),
        new TableRow({ children:[ tcell("Total (inc GST):",{lbl:true,bold:true,w:CW*0.3}), tcell("$ "+money(t.total),{w:CW*0.2}) ]}),
      ]});

    const p = (txt, opts={}) => new Paragraph({ children:[new TextRun({ text: txt, size: 18, bold: !!opts.bold })] });
    const h4 = (txt) => new Paragraph({ spacing:{before:160,after:60}, children:[new TextRun({ text: txt, bold:true, size:21 })] });

    // Build sections per type
    const children = [];

    if (isQuote) {
      // Single-page QUOTE document
      const validity = Number(data.validity_days || 30);
      let validUntil = "";
      if (data.date) { const dt = new Date(data.date); dt.setDate(dt.getDate()+validity); validUntil = dt.toLocaleDateString("en-AU"); }
      const quoteHeader = new Table({
        width: { size: CW, type: WidthType.DXA },
        columnWidths: [CW*0.23, CW*0.27, CW*0.23, CW*0.27],
        rows: [
          labelRow("Quote No:", data.job_no, "Date:", data.date),
          labelRow("Valid for:", `${validity} days`, "Valid until:", validUntil),
          labelRow("Customer Name:", data.customer_name, "Phone:", data.phone),
          labelRow("Customer Address:", data.address, "Email:", data.email),
          labelRow("Vehicle:", data.vehicle, "Rego:", data.rego),
          labelRow("Odometer (km):", data.odometer, "VIN:", data.vin),
        ],
      });
      children.push(titlePara("QUOTE"));
      children.push(...bizPara());
      children.push(quoteHeader);
      children.push(new Paragraph({ text: "" }));
      children.push(itemsTable());
      children.push(new Paragraph({ text: "" }));
      children.push(totalsTable());
      children.push(new Paragraph({ text: "" }));
      children.push(p("Conditions:", { bold: true }));
      (data.notes || "").split("\n").forEach(line => children.push(p(line)));
      children.push(new Paragraph({ text: "" }));
      children.push(p("GST Note: No GST has been charged.", { bold: true }));
      children.push(p("This is a quote, not a tax invoice. A tax invoice will be issued on completion of approved work.", { bold: true }));
    } else {
      // Page 1: invoice
      children.push(titlePara(isPPI ? "INVOICE" : "TAX INVOICE"));
      children.push(...bizPara());
      children.push(headerInfoTable());
      children.push(new Paragraph({ text: "" }));
      children.push(itemsTable());
      children.push(new Paragraph({ text: "" }));
      children.push(totalsTable());
      children.push(new Paragraph({ text: "" }));
      children.push(p("Payment Method: " + (isPPI ? "Cash / EFT / Card / Bank Transfer" : "Cash / EFT / Card"), {bold:true}));
      children.push(p("Warranty: " + (isPPI
        ? "Inspection service only. Repair workmanship warranty applies to repair work only; customer-supplied parts are not covered."
        : "Workmanship warranty 3 months / 5,000 km (whichever comes first). Customer-supplied parts are not covered."), {bold:true}));
      children.push(p("GST Note: No GST has been charged.", {bold:true}));

      // Page 2+: job sheet
      children.push(new Paragraph({ pageBreakBefore: true }));
      children.push(titlePara("JOB SHEET / WORK ORDER + VEHICLE REPORT", 28));
      children.push(...bizPara());
      children.push(headerInfoTable());
      children.push(new Paragraph({ text: "" }));
    }

    const sectionRows = [];
    if (!isQuote) {
    if (isPPI) {
      sectionRows.push(
        sectRow("Customer Reported Issue:", data.reported_issue),
        sectRow("Inspection Scope:", data.inspection_scope),
        sectRow("Diagnosis / Inspection:",
          `Exterior/body ${data.ext_body||""}; paint ${data.ext_paint||""}; underbody ${data.ext_underbody||""}. ` +
          `Interior ${data.int_cond||""}. Tyres F ${data.tyre_fl||""}/${data.tyre_fr||""} R ${data.tyre_rl||""}/${data.tyre_rr||""} mm. ` +
          `Brakes F ${data.brk_fl||""}/${data.brk_fr||""} R ${data.brk_rl||""}/${data.brk_rr||""} mm. ` +
          `Engine: start ${data.eng_start||""}, idle ${data.eng_idle||""}, oil ${data.eng_oil||""}, leaks ${data.eng_leak||""}. ` +
          `Cooling ${data.cool_level||""}.`),
        sectRow("Transmission / Driveline / 4WD:",
          `Trans fluid ${data.trans_fluid||""}; shifts ${data.trans_shift||""}; transfer ${data.trans_transfer||""}; CV/shafts ${data.trans_cv||""}; diff leaks ${data.trans_diffleak||""}.`),
        sectRow("Fuel / Exhaust / Electrical:",
          `Fuel lines ${data.fuel_lines||""}; exhaust ${data.exh_system||""}. Battery ${data.bat_resting||""}V resting / ${data.bat_charging||""}V charging. Lighting ${data.elec_lights||""}. Air-con ${data.elec_aircon||""}.`),
        sectRow("Scan Tool / Diagnostics:",
          `Tool ${data.scan_tool||""}. Current DTCs: ${data.scan_dtc||""}. Pending: ${data.scan_pending||""}. Readiness ${data.scan_readiness||""}.`),
        sectRow("Road Test:", `Approx ${data.road_km||""} km. ${data.road_behaviour||""}. ${data.road_abnormal||""}.`),
        sectRow("Service History / Documents:", `Sighted ${data.hist_sighted||""}. Last service ${data.hist_last||""}. Timing belt ${data.hist_timing||""}. Logbook ${data.hist_logbook||""}.`),
        sectRow("Overall Opinion:", `${data.overall||""}. ${data.summary||""}. Recommendation: ${data.recommendation||""}`),
        sectRow("Priority Summary:",
          `Engine ${data.prio_engine||""}; Trans/4WD ${data.prio_trans||""}; Brakes ${data.prio_brakes||""}; Suspension ${data.prio_suspension||""}; Tyres ${data.prio_tyres||""}; Body ${data.prio_body||""}; Diagnostics ${data.prio_diag||""}.`),
        sectRow("Notes / Recommendations (Next Service):", data.notes),
        sectRow("Items Not Tested / Unable To Verify:", data.items_not_tested),
        sectRow("Limitations / Disclaimer:", data.limitations),
      );
    } else {
      sectionRows.push(
        sectRow("Customer Reported Issue:", data.reported_issue),
        sectRow("Diagnosis / Inspection:", data.diagnosis),
        sectRow("Work Performed:", data.work_performed),
        sectRow("Parts / Materials Used:", data.parts_used),
        sectRow("Special Tools Used:", data.special_tools),
        sectRow("Outcome After Repair:", data.outcome),
        sectRow("Notes / Recommendations (Next Service):", data.notes),
      );
    }
    children.push(new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:[CW*0.24,CW*0.76], rows: sectionRows }));

    // Authorisation
    children.push(h4("Customer Authorisation"));
    children.push(new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:[CW*0.38,CW*0.62], rows:[
      new TableRow({children:[ tcell(isPPI?"Authorised up to (AUD):":"Customer authorised repairs up to (AUD):",{lbl:true,bold:true,w:CW*0.38}), tcell("$"+money(data.authorised_amount),{w:CW*0.62}) ]}),
      new TableRow({children:[ tcell("Customer Name & Signature:",{lbl:true,bold:true,w:CW*0.38}), tcell("",{w:CW*0.62}) ]}),
      new TableRow({children:[ tcell("Mechanic Name & Signature:",{lbl:true,bold:true,w:CW*0.38}), tcell(b.mechanic||"",{w:CW*0.62}) ]}),
    ]}));
    } // end if (!isQuote)

    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, right: 700, bottom: 800, left: 700 } } },
        children,
      }],
    });

    Packer.toBlob(doc).then(blob => {
      const suffix = isQuote ? "QUOTE" : (isPPI ? "PPI" : "JOB");
      const name = `${(data.job_no || form.type)}_${suffix}.docx`;
      window.saveAs(blob, name);
    });
  }

  window.SIAM_DOCGEN = { renderDocHTML, generateDocx, computeTotals, money };
})();
