// =====================================================================
// SIAM AUTOWORKS — Form definitions (data-driven)
// app.js renders these into the editor; docgen.js reads the same data.
// =====================================================================
(function () {

  // Common reusable phrases → become <datalist> suggestions.
  // User can pick with one tap OR type their own.
  const V = {
    cond:      ["serviceable","fair","good","poor","appears serviceable","normal wear and minor scratches"],
    normal:    ["operating normally","operating normally at time of inspection","tested and operating normally at time of inspection","normal","stable"],
    leak:      ["no visible leaks observed","no visible leaks observed from ground-level inspection","minor seepage observed","significant leak observed"],
    appear:    ["appear serviceable","appear normal","minor wear","minor wear observed","no major looseness observed"],
    level:     ["level ok, condition serviceable","level ok, colour serviceable","low","topped up"],
    yesno:     ["YES","NO","N/A"],
    prio:      ["Low","Medium","High"],
    rust:      ["no major rust observed from ground-level inspection","surface rust observed","significant rust observed"],
    scan:      ["Foxwell NT909","Launch X431","none present","complete"],
  };

  // ---- Header block shared by both doc types ----
  const headerFields = [
    { k:"job_no",   label:"Invoice / Job No.", type:"text", col:1 },
    { k:"date",     label:"Date", type:"date", col:1 },
    { k:"due_date", label:"Due Date", type:"date", col:1 },
    { k:"payment_terms", label:"Payment Terms", type:"text", col:1 },
    { k:"customer_name", label:"Customer Name", type:"text", col:1 },
    { k:"phone",    label:"Phone", type:"text", col:1 },
    { k:"address",  label:"Address / Location", type:"text", col:2 },
    { k:"email",    label:"Email", type:"text", col:1 },
    { k:"vehicle",  label:"Vehicle (make model year)", type:"text", col:1 },
    { k:"rego",     label:"Rego", type:"text", col:1 },
    { k:"odometer", label:"Odometer (km)", type:"text", col:1 },
    { k:"vin",      label:"VIN", type:"text", col:1 },
  ];

  const checklistItems = [
    "Tyres","Brakes","Battery","Lights",
    "Fluids","Leaks","Belts/Hoses","Cooling system",
    "Steering","Suspension","Exhaust","Road test",
    "Scan/Diagnostics","Air-con check","Wipers/Washer","Underbody",
  ];

  // =====================================================================
  // REPAIR JOB
  // =====================================================================
  const repair = {
    type: "repair",
    title: "Repair / Service Job",
    invoiceTitle: "TAX INVOICE",
    header: headerFields,
    sections: [
      { legend:"Invoice line items", fields:[ { k:"items", type:"lineitems" } ] },
      { legend:"Job sheet", fields:[
        { k:"reported_issue", label:"Customer reported issue", type:"textarea" },
        { k:"diagnosis", label:"Diagnosis / Inspection", type:"textarea", big:true },
        { k:"work_performed", label:"Work performed", type:"textarea", big:true },
        { k:"parts_used", label:"Parts / Materials used", type:"textarea" },
        { k:"special_tools", label:"Special tools used", type:"text" },
      ]},
      { legend:"Inspection checklist", fields:[ { k:"checklist", type:"checks", items:checklistItems } ] },
      { legend:"Outcome & notes", fields:[
        { k:"photos_attached", label:"Before/After photos attached", type:"select", opts:["","Yes","No"], col:1 },
        { k:"road_test", label:"Road test", type:"select", opts:["","Yes","No"], col:1 },
        { k:"outcome", label:"Outcome after repair", type:"textarea" },
        { k:"notes", label:"Notes / Recommendations (next service)", type:"textarea", big:true },
      ]},
      { legend:"Authorisation", fields:[
        { k:"authorised_amount", label:"Customer authorised repairs up to (AUD)", type:"text", col:1 },
      ]},
    ],
  };

  // =====================================================================
  // PRE-PURCHASE INSPECTION
  // =====================================================================
  const ppi = {
    type: "ppi",
    title: "Pre-purchase Inspection",
    invoiceTitle: "INVOICE",
    header: headerFields,
    extraHeader: [
      { k:"seller", label:"Seller (on-site)", type:"text", col:1 },
      { k:"purpose", label:"Purpose", type:"text", col:1 },
    ],
    sections: [
      { legend:"Invoice line items", fields:[ { k:"items", type:"lineitems" } ] },
      { legend:"Scope & identity", fields:[
        { k:"reported_issue", label:"Customer reported issue", type:"textarea" },
        { k:"inspection_scope", label:"Inspection scope", type:"textarea", big:true },
        { k:"identity_vin", label:"VIN on compliance plate matches dash VIN", type:"checkbox" },
        { k:"identity_plate", label:"Build / compliance plate present & legible", type:"checkbox" },
        { k:"identity_engineno", label:"Engine number recorded", type:"text", col:1 },
        { k:"identity_rego", label:"Rego confirmed", type:"text", col:1 },
        { k:"identity_ppsr", label:"Customer advised to perform PPSR check independently", type:"checkbox" },
      ]},
      { legend:"Exterior, interior, tyres, brakes", fields:[
        { k:"ext_body", label:"Exterior/body condition", type:"text", list:V.cond },
        { k:"ext_panels", label:"Panel gaps & alignment", type:"text", list:V.appear },
        { k:"ext_paint", label:"Paintwork", type:"text", list:V.cond },
        { k:"ext_repaint", label:"Repaint/overspray/colour mismatch", type:"text", list:["not observed during visual inspection"] },
        { k:"ext_underbody", label:"Underbody/chassis rust", type:"text", list:V.rust },
        { k:"ext_windscreen", label:"Windscreen", type:"text", list:V.cond },
        { k:"int_cond", label:"Interior condition", type:"text", list:V.cond },
        { k:"int_electronics", label:"Seats/belts/dash/infotainment/camera", type:"text", list:V.normal },
        { k:"int_flood", label:"Water/flood evidence", type:"text", list:["no visible evidence observed at time of inspection"] },
        { k:"int_keys", label:"Keys present", type:"text", col:1 },
        { k:"tyre_brand", label:"Tyre brand/size", type:"text", col:1 },
        { k:"tyre_fl", label:"Tread Front LH (mm)", type:"text", col:1 },
        { k:"tyre_fr", label:"Tread Front RH (mm)", type:"text", col:1 },
        { k:"tyre_rl", label:"Tread Rear LH (mm)", type:"text", col:1 },
        { k:"tyre_rr", label:"Tread Rear RH (mm)", type:"text", col:1 },
        { k:"tyre_wear", label:"Wear pattern", type:"text", list:V.cond },
        { k:"tyre_wheel", label:"Wheel condition", type:"text", list:V.cond },
        { k:"tyre_spare", label:"Spare tyre", type:"text", list:V.cond },
        { k:"brk_fl", label:"Front pad LH (mm)", type:"text", col:1 },
        { k:"brk_fr", label:"Front pad RH (mm)", type:"text", col:1 },
        { k:"brk_rl", label:"Rear pad/shoe LH (mm)", type:"text", col:1 },
        { k:"brk_rr", label:"Rear pad/shoe RH (mm)", type:"text", col:1 },
        { k:"brk_rotors", label:"Rotors", type:"text", list:["minor wear","serviceable","significant wear"] },
        { k:"brk_fluid", label:"Brake fluid level/colour", type:"text", list:V.level },
        { k:"brk_handbrake", label:"Handbrake", type:"text", list:V.normal },
        { k:"brk_pedal", label:"Pedal feel", type:"text", list:V.normal },
      ]},
      { legend:"Suspension, engine, cooling", fields:[
        { k:"sus_shocks", label:"Shocks/struts", type:"text", list:V.appear },
        { k:"sus_joints", label:"Bushes/ball joints/tie rods", type:"text", list:V.appear },
        { k:"sus_steering", label:"Steering rack & power steering", type:"text", list:V.normal },
        { k:"sus_noise", label:"Looseness/abnormal noise", type:"text", list:["no abnormal looseness or noise observed during inspection"] },
        { k:"eng_start", label:"Cold start / start behaviour", type:"text", list:V.normal },
        { k:"eng_idle", label:"Idle quality", type:"text", list:V.normal },
        { k:"eng_oil", label:"Engine oil level/condition", type:"text", list:V.level },
        { k:"eng_leak", label:"Oil leaks observed", type:"text", list:["no oil leaks observed","oil leak observed at rocker cover","minor seepage observed"] },
        { k:"eng_blowby", label:"Crankcase pressure / blow-by", type:"text", list:["no excessive crankcase pressure observed"] },
        { k:"eng_belts", label:"Belts/hoses/air filter", type:"text", list:V.appear },
        { k:"eng_timing", label:"Timing belt / service history", type:"text", list:["unable to verify service history"] },
        { k:"cool_level", label:"Coolant level/condition", type:"text", list:V.level },
        { k:"cool_radiator", label:"Radiator/hoses/water pump/fans", type:"text", list:V.leak },
        { k:"cool_cross", label:"Coolant/oil cross-contamination", type:"text", list:["no coolant/oil cross-contamination"] },
        { k:"cool_temp", label:"Operating temp during test drive", type:"text", list:V.normal },
      ]},
      { legend:"Transmission / driveline / 4WD", fields:[
        { k:"trans_fluid", label:"Auto trans fluid colour/smell", type:"text", list:["not checked – sealed transmission / no dipstick access"] },
        { k:"trans_shift", label:"Gear shifts / kickdown", type:"text", list:V.normal },
        { k:"trans_transfer", label:"Transfer case H4 / L4", type:"text", list:["H4/L4 tested and operating"] },
        { k:"trans_difflock", label:"Centre/rear diff lock", type:"text", list:V.normal },
        { k:"trans_cv", label:"CV boots/shafts/tailshaft/uni joints", type:"text", list:V.appear },
        { k:"trans_diffleak", label:"Diffs/transfer case leaks", type:"text", list:V.leak },
      ]},
      { legend:"Fuel / exhaust / electrical", fields:[
        { k:"fuel_lines", label:"Fuel lines & tank connections", type:"text", list:V.leak },
        { k:"exh_system", label:"Exhaust system", type:"text", list:["visually inspected, appears serviceable"] },
        { k:"exh_mounts", label:"Mounts & hangers", type:"text", list:V.appear },
        { k:"bat_resting", label:"Battery voltage resting (V)", type:"text", col:1 },
        { k:"bat_charging", label:"Charging voltage at idle (V)", type:"text", col:1 },
        { k:"bat_age", label:"Battery age", type:"text", list:["not visible"] },
        { k:"elec_lights", label:"Exterior lighting", type:"text", list:["all exterior lighting tested and operational"] },
        { k:"elec_wipers", label:"Wipers/washers", type:"text", list:V.normal },
        { k:"elec_aircon", label:"Air-con cold output", type:"text", list:V.normal },
      ]},
      { legend:"Scan tool / diagnostics", fields:[
        { k:"scan_tool", label:"Scan tool used", type:"text", list:V.scan },
        { k:"scan_warning", label:"Dash warning lights at key-on", type:"text", list:["normal bulb check observed"] },
        { k:"scan_dtc", label:"Current DTCs", type:"text", list:["none present"] },
        { k:"scan_pending", label:"Pending/history DTCs", type:"text", list:["none present"] },
        { k:"scan_readiness", label:"Readiness monitors", type:"text", list:["complete"] },
        { k:"scan_ecu", label:"ECU mileage vs cluster", type:"text", list:["not available"] },
      ]},
      { legend:"Road test & service history", fields:[
        { k:"road_km", label:"Road test distance (km approx)", type:"text", col:1 },
        { k:"road_behaviour", label:"Acceleration/shifts/braking/steering/drivetrain", type:"text", list:["operating normally at time of road test"] },
        { k:"road_abnormal", label:"Abnormal vibration/pulling/overheating", type:"text", list:["no abnormal vibration, pulling, overheating or drivability issues observed during test drive"] },
        { k:"hist_sighted", label:"Service history sighted", type:"text", list:["PARTIAL","FULL","NONE"] },
        { k:"hist_last", label:"Last recorded service (km / date)", type:"text" },
        { k:"hist_timing", label:"Timing belt / major service record", type:"text", list:["unable to verify service history"] },
        { k:"hist_logbook", label:"Owner manual / logbook present", type:"select", opts:["","YES","NO"], col:1 },
      ]},
      { legend:"Inspection checklist", fields:[ { k:"checklist", type:"checks", items:checklistItems.concat(["4WD engagement","Diff/Transfer","VIN verification","Photos taken"]) } ] },
      { legend:"Overall opinion & priority", fields:[
        { k:"overall", label:"Overall opinion", type:"select", opts:["","GOOD","FAIR","POOR","NOT SUITABLE FOR PURCHASE"], col:1 },
        { k:"recommendation", label:"Recommendation", type:"select", opts:["","Suitable for purchase - no significant defects observed","Suitable for purchase with reservations - items below should be addressed","Not recommended - significant defects observed (see notes)"] },
        { k:"summary", label:"Inspector's summary", type:"textarea", big:true },
        { k:"prio_engine", label:"Engine", type:"prio" },
        { k:"prio_trans", label:"Transmission / 4WD", type:"prio" },
        { k:"prio_brakes", label:"Brakes", type:"prio" },
        { k:"prio_suspension", label:"Suspension / Steering", type:"prio" },
        { k:"prio_tyres", label:"Tyres", type:"prio" },
        { k:"prio_body", label:"Body / Rust", type:"prio" },
        { k:"prio_diag", label:"Diagnostics", type:"prio" },
      ]},
      { legend:"Outcome & notes", fields:[
        { k:"photos_attached", label:"Before/After photos attached", type:"select", opts:["","Yes","No"], col:1 },
        { k:"road_test", label:"Road test", type:"select", opts:["","Yes","No"], col:1 },
        { k:"work_performed", label:"Work performed", type:"textarea" },
        { k:"parts_used", label:"Parts / Materials used", type:"text" },
        { k:"special_tools", label:"Special tools used", type:"text", list:["Scan tool: Foxwell NT909. Tyre tread depth gauge: YES. Multimeter/battery tester: YES. Torch/inspection mirror: YES."] },
        { k:"notes", label:"Notes / Recommendations (next service)", type:"textarea", big:true },
        { k:"items_not_tested", label:"Items not tested / unable to verify", type:"textarea" },
        { k:"limitations", label:"Limitations / disclaimer", type:"textarea" },
        { k:"authorised_amount", label:"Authorised up to (AUD)", type:"text", col:1 },
      ]},
    ],
  };

  // Default disclaimer/scope text pre-filled for PPI (saves typing)
  ppi.defaults = {
    inspection_scope: "Pre-purchase inspection carried out visually and operationally at the seller's location. Inspection includes exterior/interior checks, visible engine bay and underbody checks from ground level, fluid/leak checks, tyre/brake visual assessment, electrical/lighting checks, scan tool diagnostic where accessible, 4WD operational checks where safe to test, road test and written report. Vehicle was not raised on a hoist and no dismantling/internal mechanical inspection was performed unless specifically stated.",
    items_not_tested: "Internal engine condition, compression/leak-down, internal transmission wear, wheel alignment, hidden accident repair, concealed rust, long-distance performance, towing under load, PPSR/finance/write-off/stolen status, and faults that were not present or could not reasonably be detected at the time of inspection.",
    limitations: "This report represents the vehicle's condition at the time of inspection only and is not a roadworthy certificate, safety certificate or guarantee of future reliability. SIAM AUTOWORKS PTY LTD makes no warranty regarding hidden defects, future faults or components that could not reasonably be inspected without workshop equipment, hoist access, dismantling or extended road testing. The customer is responsible for verifying ownership, PPSR/finance, registration, insurance and purchase decision independently.",
    outcome: "Pre-purchase inspection completed only. No repairs carried out unless separately authorised and stated in WORK PERFORMED.",
  };

  window.SIAM_FORMS = { repair, ppi, checklistItems };
})();
