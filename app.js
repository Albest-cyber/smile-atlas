/* ============================================================
   Smile Atlas — interactions
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     LEAD CAPTURE → AIRTABLE
     ------------------------------------------------------------
     Paste your webhook URL below to start sending leads to Airtable.
     Recommended: Airtable Automation → trigger "When webhook received"
     → action "Create record". (Make.com / Zapier webhooks also work.)
     Leave it empty and the site runs in DEMO mode — leads are saved in
     this browser only (handy for testing the form before you go live).
     Your Airtable token NEVER goes on the public site — only this URL.
     ============================================================ */
  const LEAD_ENDPOINT = '/api/lead';

  function sendLead(data, source) {
    const payload = {
      firstName: data.firstName || '',
      lastName:  data.lastName  || '',
      email:     data.email     || '',
      phone:     ((data.dialCode || '') + ' ' + (data.phone || '')).trim(),
      treatment: data.treatment || '',
      clinic:    data.clinic    || '',
      consent:   !!data.consent,
      source:    source,
      submittedAt: new Date().toISOString(),
      page:      location.href
    };
    return fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }).catch((err) => {
      // Never lose a lead: if the webhook is unreachable, queue it locally.
      console.warn('[SmileAtlas] Lead webhook failed — kept locally to retry:', err);
      try {
        const q = JSON.parse(localStorage.getItem('smileatlas_pending') || '[]');
        q.push(payload);
        localStorage.setItem('smileatlas_pending', JSON.stringify(q));
      } catch (e) { /* ignore */ }
    });
  }

  /* ---- Header shadow on scroll ---- */
  const head = document.getElementById('siteHead');
  const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Mobile drawer ---- */
  const drawer = document.getElementById('mobileDrawer');
  const openDrawer = () => drawer.classList.add('open');
  const closeDrawer = () => drawer.classList.remove('open');
  document.getElementById('navToggle').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.querySelectorAll('[data-close-drawer]').forEach((el) =>
    el.addEventListener('click', () => setTimeout(closeDrawer, 0))
  );

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!open) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---- Clinic filters ---- */
  const filterWrap = document.getElementById('clinicFilters');
  const cards = Array.from(document.querySelectorAll('#clinicGrid .clinic-card'));
  const noClinics = document.getElementById('noClinics');
  filterWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filterWrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const f = chip.dataset.filter;
    let shown = 0;
    cards.forEach((card) => {
      const match = f === 'all' || (card.dataset.tags || '').split(' ').includes(f);
      card.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    noClinics.style.display = shown ? 'none' : 'block';
  });

  /* ---- Reveal on scroll (rect-based; robust across environments) ---- */
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  function revealCheck() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (let i = revealEls.length - 1; i >= 0; i--) {
      const el = revealEls[i];
      const r = el.getBoundingClientRect();
      if (r.top < vh - 40 && r.bottom > 0) {
        el.classList.add('in');
        revealEls.splice(i, 1);
      }
    }
  }
  revealCheck();
  window.addEventListener('scroll', revealCheck, { passive: true });
  window.addEventListener('resize', revealCheck);
  window.addEventListener('load', revealCheck);
  // safety net: never let content stay hidden
  setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach((el) => el.classList.add('in')), 2500);

  /* ---- Validation helpers ---- */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validateField(input) {
    const field = input.closest('.field');
    if (!field) return true;
    let ok = true;
    const v = (input.value || '').trim();
    if (input.name === 'email') ok = emailRe.test(v);
    else if (input.name === 'phone') ok = v.replace(/[^\d]/g, '').length >= 6;
    else ok = v.length > 0;
    field.classList.toggle('invalid', !ok);
    return ok;
  }

  function wireForm(form, source, onSuccess) {
    if (!form) return;
    // live-clear errors
    form.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.closest('.field');
        if (field && field.classList.contains('invalid')) validateField(input);
      });
    });
    // consent: clear its error as soon as it's ticked
    const consentBox = form.querySelector('input[name="consent"]');
    if (consentBox) {
      consentBox.addEventListener('change', () => {
        const lbl = consentBox.closest('.consent');
        if (lbl) lbl.classList.toggle('invalid', !consentBox.checked);
      });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Honeypot anti-spam: server-side only (client-side removed to avoid Chrome Autofill false positives)
      const required = form.querySelectorAll('input[name="firstName"], input[name="lastName"], input[name="email"], input[name="phone"]');
      let valid = true;
      let firstBad = null;
      required.forEach((input) => {
        if (!validateField(input)) {
          valid = false;
          if (!firstBad) firstBad = input;
        }
      });
      if (!valid) {
        firstBad && firstBad.focus();
        return;
      }
      // consent is legally required (GDPR) — must be ticked to submit
      const consent = form.querySelector('input[name="consent"]');
      if (consent && !consent.checked) {
        const lbl = consent.closest('.consent');
        if (lbl) lbl.classList.add('invalid');
        consent.focus();
        return;
      }
      // collect lead
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const leads = JSON.parse(localStorage.getItem('smileatlas_leads') || '[]');
        leads.push({ ...data, at: new Date().toISOString() });
        localStorage.setItem('smileatlas_leads', JSON.stringify(leads));
      } catch (err) { /* ignore */ }
      // push the lead to Airtable (fire-and-forget; UI confirms immediately)
      sendLead(data, source);
      onSuccess(data);
    });
  }

  /* ---- Main lead form ---- */
  const leadForm = document.getElementById('leadForm');
  const formSuccess = document.getElementById('formSuccess');
  wireForm(leadForm, 'Website form', (data) => {
    document.getElementById('successMsg').textContent =
      `Thanks ${data.firstName || ''}! One of our patient coordinators will be in touch within 24 hours with your personalised plan.`;
    leadForm.style.display = 'none';
    formSuccess.classList.add('show');
  });

  /* ---- Modal ---- */
  const scrim = document.getElementById('modalScrim');
  const modalForm = document.getElementById('modalForm');
  const modalSuccess = document.getElementById('modalSuccess');
  const modalClinicBox = document.getElementById('modalClinic');
  let lastFocused = null;

  function resetModal() {
    modalForm.reset();
    modalForm.style.display = '';
    modalForm.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    modalSuccess.classList.remove('show');
  }

  function openModal(clinicName, clinicLoc) {
    resetModal();
    if (clinicName) {
      modalClinicBox.style.display = 'flex';
      document.getElementById('modalClinicName').textContent = clinicName;
      document.getElementById('modalClinicLoc').textContent = clinicLoc || 'Istanbul, Turkey';
      document.getElementById('modalClinicField').value = clinicName;
      document.getElementById('modalTitle').textContent = 'Book a free consultation';
      document.getElementById('modalSub').textContent =
        `Leave your details and we’ll connect you with ${clinicName} for a free, no-obligation consultation.`;
    } else {
      modalClinicBox.style.display = 'none';
      document.getElementById('modalClinicField').value = '';
      document.getElementById('modalTitle').textContent = 'Get your free quote';
      document.getElementById('modalSub').textContent =
        'Leave your details and we’ll send a personalised treatment plan within 24 hours.';
    }
    lastFocused = document.activeElement;
    scrim.classList.add('open');
    scrim.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = modalForm.querySelector('input[name="firstName"]');
      first && first.focus();
    }, 280);
  }

  function closeModal() {
    scrim.classList.remove('open');
    scrim.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lastFocused && lastFocused.focus && lastFocused.focus();
  }

  // open triggers
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.clinic-card');
      if (card) openModal(card.dataset.name, card.dataset.loc);
      else openModal(btn.dataset.clinic || '', '');
    });
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scrim.classList.contains('open')) closeModal();
  });

  wireForm(modalForm, 'Clinic enquiry', (data) => {
    const who = data.firstName ? `${data.firstName}, ` : '';
    document.getElementById('modalSuccessMsg').textContent = data.clinic
      ? `${who}we’ve sent your interest to ${data.clinic}. A coordinator will be in touch within 24 hours.`
      : `${who}we’ve received your details and will be in touch within 24 hours.`;
    modalForm.style.display = 'none';
    modalSuccess.classList.add('show');
  });

  /* ---- Staggered reveal delays (group children animate in sequence) ---- */
  document.querySelectorAll('.steps, .treat-grid, .clinic-grid, .ba-grid, .review-grid, .pkg-list, .faq-list').forEach((grp) => {
    Array.from(grp.querySelectorAll(':scope > .reveal')).forEach((el, i) => {
      el.style.animationDelay = Math.min(i * 80, 480) + 'ms';
    });
  });

  /* ---- Count-up numbers (trust bar) ---- */
  function findNumberNode(root) {
    for (const n of root.childNodes) {
      const txt = n.textContent || '';
      if (/\d/.test(txt)) return n;
    }
    return null;
  }
  function animateCount(node) {
    const finalText = (node.textContent || '').trim();
    const m = finalText.match(/^([^\d]*)([\d.,]+)(.*)$/);
    if (!m) return;
    const prefix = m[1], suffix = m[3];
    const raw = m[2];
    const decimals = (raw.split('.')[1] || '').length;
    const target = parseFloat(raw.replace(/,/g, ''));
    const hasComma = raw.indexOf(',') !== -1;
    const dur = 1500, start = performance.now();
    function fmt(v) {
      let s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
      if (hasComma) s = Number(s).toLocaleString('en-US');
      return prefix + s + suffix;
    }
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = finalText;
    }
    requestAnimationFrame(step);
  }
  const trustbar = document.querySelector('.trustbar');
  if (trustbar && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let counted = false;
    const tick = () => {
      if (counted) return;
      const r = trustbar.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh - 60 && r.bottom > 0) {
        counted = true;
        trustbar.querySelectorAll('.trust-item .num').forEach((num) => {
          const node = findNumberNode(num);
          if (node) animateCount(node);
        });
        window.removeEventListener('scroll', tick);
      }
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
  }

  /* ---- Hero parallax / tilt on pointer move ---- */
  const heroVisual = document.querySelector('.hero-visual');
  const heroShot = document.querySelector('.hero-visual .main-shot');
  if (heroVisual && heroShot && window.matchMedia('(min-width: 1081px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const floats = heroVisual.querySelectorAll('.hero-float');
    let raf = null;
    heroVisual.addEventListener('pointermove', (e) => {
      const rect = heroVisual.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        heroShot.style.transform = `perspective(1000px) rotateY(${dx * 7}deg) rotateX(${-dy * 7}deg) translateZ(0)`;
        floats.forEach((f, i) => {
          const depth = (i + 1) * 14;
          f.style.transform = `translate(${dx * depth}px, ${dy * depth}px)`;
        });
      });
    });
    heroVisual.addEventListener('pointerleave', () => {
      heroShot.style.transform = '';
      floats.forEach((f) => { f.style.transform = ''; });
    });
  }

  /* ---- Magnetic primary buttons ---- */
  if (window.matchMedia('(pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.btn-primary').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.25;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---- Scroll progress beam ---- */
  const progress = document.getElementById('scrollProgress');
  if (progress) {
    const updProgress = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    updProgress();
    window.addEventListener('scroll', updProgress, { passive: true });
    window.addEventListener('resize', updProgress);
  }

  /* ---- Cursor-follow spotlight on cards ---- */
  if (window.matchMedia('(pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.treat-card, .review-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---- Timestamp-ish screen labels already set in markup ---- */
})();
