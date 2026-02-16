(() => {
  "use strict";

  // ===== Helpers =====
  const $ = (sel) => document.querySelector(sel);

  function cleanRego(value) {
    return (value || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  function stateToUrl(state, rego) {
    // Official / common rego-check pages (they may change over time)
    // Some states require VIN or captcha. We still open the best known page.
    const map = {
      SA: "https://www.service.sa.gov.au/transaction/vehicle-registration-check",
      NSW: "https://check-registration.service.nsw.gov.au/",
      VIC: "https://www.vicroads.vic.gov.au/registration/rego-check",
      QLD: "https://www.service.transport.qld.gov.au/checkrego/public/Welcome.xhtml",
      WA: "https://online.transport.wa.gov.au/webExternal/registration/?0",
      TAS: "https://www.transport.tas.gov.au/registration/vehicle_registration/check_registration",
      ACT: "https://rego.act.gov.au/regosoawicket/public/reg/FindRegistrationPage",
      NT: "https://nt.gov.au/driving/rego/check-a-vehicles-registration"
    };

    // If we don't have a URL, fallback to google query
    if (!map[state]) {
      return `https://www.google.com/search?q=${encodeURIComponent(state + " rego check " + rego)}`;
    }
    return map[state];
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback method
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function showInlineMessage(targetEl, msg) {
    // Create / reuse a message node right under the rego input block
    let box = $("#regoMsg");
    if (!box) {
      box = document.createElement("div");
      box.id = "regoMsg";
      box.style.marginTop = "8px";
      box.style.fontSize = ".9rem";
      box.style.opacity = ".9";
      box.style.padding = "10px 12px";
      box.style.borderRadius = "12px";
      box.style.border = "1px solid rgba(255,255,255,.14)";
      box.style.background = "rgba(255,255,255,.06)";
      targetEl.appendChild(box);
    }
    box.textContent = msg;
  }

  // ===== Wire up Check button =====
  function initRegoCheck() {
    const btn = $("#checkRegoBtn");
    const stateEl = $("#state");
    const regoEl = $("#rego");

    if (!btn || !stateEl || !regoEl) return;

    btn.addEventListener("click", async () => {
      const state = (stateEl.value || "").trim();
      const regoRaw = regoEl.value || "";
      const rego = cleanRego(regoRaw);

      // Put cleaned rego back (nice UX)
      regoEl.value = rego;

      // Where to show message? Use the rego field container
      const regoRow = regoEl.closest(".form-row") || regoEl.parentElement;

      if (!state) {
        showInlineMessage(regoRow, "Please select a State first.");
        stateEl.focus();
        return;
      }
      if (!rego) {
        showInlineMessage(regoRow, "Please enter the Rego (plate number).");
        regoEl.focus();
        return;
      }

      // Copy rego to clipboard
      const copied = await copyToClipboard(rego);

      // Open official check page
      const url = stateToUrl(state, rego);
      window.open(url, "_blank", "noopener,noreferrer");

      showInlineMessage(
        regoRow,
        copied
          ? `Opened the ${state} rego check page in a new tab. Rego copied: ${rego}`
          : `Opened the ${state} rego check page in a new tab. (Could not auto-copy — please copy manually): ${rego}`
      );
    });
  }

  // ===== Init on load =====
  document.addEventListener("DOMContentLoaded", () => {
    initRegoCheck();
  });
})();
// ===== Services slider (2s / image loop) =====
(function () {
  const slider = document.getElementById("servicesSlider");
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll(".slide"));
  if (slides.length <= 1) return;

  const dotsWrap = slider.querySelector(".dots");
  let dots = [];

  // build dots
  if (dotsWrap) {
    dotsWrap.innerHTML = "";
    dots = slides.map((_, i) => {
      const b = document.createElement("span");
      b.className = "dot" + (i === 0 ? " active" : "");
      dotsWrap.appendChild(b);
      return b;
    });
  }

  let idx = 0;
  const INTERVAL = 2000; // 2 seconds

  function show(i) {
    slides[idx].classList.remove("active");
    if (dots[idx]) dots[idx].classList.remove("active");

    idx = i;

    slides[idx].classList.add("active");
    if (dots[idx]) dots[idx].classList.add("active");
  }

  let timer = setInterval(() => {
    show((idx + 1) % slides.length);
  }, INTERVAL);

  // pause on hover (desktop)
  slider.addEventListener("mouseenter", () => clearInterval(timer));
  slider.addEventListener("mouseleave", () => {
    timer = setInterval(() => show((idx + 1) % slides.length), INTERVAL);
  });
})();
