/* ============================================================
   Adam Bruneau — Portfolio scrollytelling
   JavaScript vanilla — moteur de particules, scroll-driven
   animations, palette de commandes — aucune dépendance
   ============================================================ */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* État de scroll partagé (vitesse pour marquee + skew) */
let scrollVel = 0;
let lastScrollY = window.scrollY;

/* ============ TOAST ============ */
let toastTimer = null;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ============ THÈME CLAIR / SOMBRE ============ */
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
function applyThemeIcon() {
  const dark = currentTheme() === 'dark';
  $('#theme-toggle .ico-moon').style.display = dark ? 'none' : 'block';
  $('#theme-toggle .ico-sun').style.display = dark ? 'block' : 'none';
}
function setTheme(theme) {
  const html = document.documentElement;
  html.classList.add('theme-switching');
  html.dataset.theme = theme;
  try { localStorage.setItem('ab-theme', theme); } catch (e) {}
  applyThemeIcon();
  setTimeout(() => html.classList.remove('theme-switching'), 450);
}
function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  applyThemeIcon();
  $('#theme-toggle').addEventListener('click', toggleTheme);
}

/* ============ CURSEUR PERSONNALISÉ ============ */
function initCursor() {
  if (!finePointer) return;
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  let started = false;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';
    if (!started) {
      started = true;
      rx = mx; ry = my;
      document.body.classList.add('cursor-on');
    }
  });

  (function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();

  document.addEventListener('mouseover', (e) => {
    const hot = e.target.closest('a, button, input, [data-tilt], .chips span');
    document.body.classList.toggle('cursor-hover', !!hot);
  });
}

/* ============ PARTICULES DU HERO ============ */
function initHeroParticles() {
  const hero = $('#hero');
  const canvas = $('#hero-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  const mouse = { x: -9999, y: -9999 };
  let heroVisible = true;

  function resize() {
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
    const count = Math.min(80, Math.floor((W * H) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.7,
    }));
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  new IntersectionObserver((entries) => {
    heroVisible = entries[0].isIntersecting;
  }).observe(hero);

  if (reducedMotion) return;

  function frame() {
    requestAnimationFrame(frame);
    if (!heroVisible || document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    const dark = currentTheme() === 'dark';
    const pc = dark ? 'rgba(96,165,250,' : 'rgba(37,99,235,';
    const LINK = 120;

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && d > 0.1) {
        p.x += (dx / d) * 0.9;
        p.y += (dy / d) * 0.9;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = pc + (dark ? '0.5)' : '0.4)');
      ctx.fill();
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const alpha = (1 - Math.sqrt(d2) / LINK) * (dark ? 0.22 : 0.16);
          ctx.strokeStyle = pc + alpha.toFixed(3) + ')';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }
  frame();
}

/* ============ HISTOIRE — MOTEUR DE PARTICULES MORPHING ============
   Une section épinglée : le scroll fait morpher ~1300 particules
   entre les mots-clés du parcours (2025 → ESILV → PYTHON → CYBER → 2028)
   pendant que les chapitres textuels s'enchaînent. */
const story = { onScroll: null };
function initStory() {
  const section = $('#histoire');
  const track = $('.story-track');
  const sticky = $('.story-sticky');
  const canvas = $('#story-canvas');
  const steps = $$('.story-step');
  const railBtns = $$('.story-rail button');
  const overline = $('.story-overline');

  const WORDS = ['2025', 'ESILV', 'PYTHON', 'CYBER', '2028'];
  const N = WORDS.length;

  if (reducedMotion) {
    document.body.classList.add('rm');
    steps.forEach((s) => s.classList.add('active'));
    story.onScroll = () => {};
    return;
  }

  const ctx = canvas.getContext('2d');
  const PMAX = innerWidth < 760 ? 650 : 1300;
  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let targetsCache = {};
  let current = -1;
  let visible = false;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = sticky.clientWidth;
    H = sticky.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetsCache = {};
    if (current >= 0) retarget(current);
  }

  function sampleWord(word) {
    if (targetsCache[word]) return targetsCache[word];
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    const octx = oc.getContext('2d', { willReadFrequently: true });
    let size = Math.min(H * 0.4, 250);
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    for (;;) {
      octx.font = '700 ' + size + 'px "Space Grotesk", "Segoe UI", sans-serif';
      if (octx.measureText(word).width <= W * 0.84 || size <= 60) break;
      size -= 10;
    }
    octx.fillStyle = '#000';
    octx.fillText(word, W / 2, H * 0.42);
    const data = octx.getImageData(0, 0, W, H).data;
    const step = innerWidth < 760 ? 5 : 6;
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          pts.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
        }
      }
    }
    // Mélange (Fisher–Yates) puis limite au nombre de particules
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const out = pts.slice(0, PMAX);
    targetsCache[word] = out.length ? out : [{ x: W / 2, y: H / 2 }];
    return targetsCache[word];
  }

  function initParticles() {
    particles = Array.from({ length: PMAX }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0, vy: 0,
      tx: W / 2, ty: H / 2,
      r: Math.random() * 1.3 + 0.9,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function retarget(i) {
    const pts = sampleWord(WORDS[i]);
    for (let k = 0; k < particles.length; k++) {
      const t = pts[k % pts.length];
      particles[k].tx = t.x;
      particles[k].ty = t.y;
    }
  }

  function setChapter(i) {
    if (i === current) return;
    current = i;
    steps.forEach((s, k) => s.classList.toggle('active', k === i));
    railBtns.forEach((b, k) => b.classList.toggle('active', k === i));
    retarget(i);
  }

  // Couleurs (dégradé bleu → violet selon la position x de la cible)
  const C_LIGHT = [[37, 99, 235], [124, 58, 237]];
  const C_DARK = [[96, 165, 250], [167, 139, 250]];

  let tick = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    tick++;
    ctx.clearRect(0, 0, W, H);
    const [c1, c2] = currentTheme() === 'dark' ? C_DARK : C_LIGHT;

    for (const p of particles) {
      p.vx += (p.tx - p.x) * 0.045;
      p.vy += (p.ty - p.y) * 0.045;
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx + Math.sin(tick * 0.02 + p.tw) * 0.18;
      p.y += p.vy + Math.cos(tick * 0.018 + p.tw) * 0.18;

      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 85 && d > 0.1) {
        p.x += (dx / d) * 2.6;
        p.y += (dy / d) * 2.6;
      }

      const m = clamp(p.tx / W, 0, 1);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * m);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * m);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * m);
      const a = 0.55 + 0.35 * Math.sin(tick * 0.05 + p.tw);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Scroll → progression du récit
  story.onScroll = function () {
    const vh = innerHeight;
    const total = track.offsetHeight - vh;
    const top = section.offsetTop;
    const p = clamp((scrollY - top) / total, 0, 1);
    setChapter(Math.min(N - 1, Math.floor(p * N)));
    overline.style.opacity = Math.max(0, 1 - p * 9);
  };

  // Navigation par la barre de chapitres
  railBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10);
      const vh = innerHeight;
      const total = track.offsetHeight - vh;
      window.scrollTo({
        top: section.offsetTop + ((i + 0.5) / N) * total,
        behavior: 'smooth',
      });
    });
  });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(section);

  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  window.addEventListener('resize', resize);

  resize();
  initParticles();
  setChapter(0);
  frame();

  // Ré-échantillonner une fois les polices chargées (le mot est plus net)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      targetsCache = {};
      if (current >= 0) retarget(current);
    });
  }
}

/* ============ BANDEAU DÉFILANT (réactif au scroll) ============ */
function initMarquee() {
  const track = $('#marquee-track');
  const WORDS = ['PYTHON', 'CYBERSÉCURITÉ', 'MACHINE LEARNING', 'ESILV', 'BACKTESTING', 'LINUX', 'RÉSEAUX', 'GIT'];
  let html = '';
  WORDS.forEach((w, i) => {
    html += '<span class="mq' + (i % 3 === 1 ? ' fill' : '') + '">' + w + '</span><span class="sep">✦</span>';
  });
  track.innerHTML = html + html; // dupliqué pour la boucle infinie

  if (reducedMotion) return;

  let pos = 0;
  let half = 0;
  const measure = () => { half = track.scrollWidth / 2; };
  measure();
  window.addEventListener('resize', measure);

  let inView = true;
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
  }).observe(track.parentElement);

  (function loop() {
    requestAnimationFrame(loop);
    if (!inView || document.hidden || !half) return;
    pos -= 0.7 + Math.min(7, Math.abs(scrollVel) * 0.12);
    if (-pos >= half) pos += half;
    track.style.transform = 'translateX(' + pos.toFixed(1) + 'px)';
  })();
}

/* ============ INCLINAISON LIÉE À LA VITESSE DE SCROLL ============ */
function initVelocityEffects() {
  if (reducedMotion) return;
  const targets = $$('[data-skew]');
  let skew = 0;
  (function loop() {
    requestAnimationFrame(loop);
    scrollVel *= 0.88;
    const goal = clamp(scrollVel * 0.02, -1.6, 1.6);
    skew += (goal - skew) * 0.12;
    const val = Math.abs(skew) < 0.02 ? '' : 'skewY(' + skew.toFixed(3) + 'deg)';
    targets.forEach((el) => { el.style.transform = val; });
  })();
}

/* ============ ANIMATION DU TITRE (lettres) ============ */
function initTitleReveal() {
  const w1 = $('#word-1');
  const w2 = $('#word-2');
  const BASE = 0.12, STEP = 0.05;

  const split = (el, offset) => {
    const chars = el.textContent.split('');
    el.textContent = '';
    chars.forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ltr';
      s.textContent = ch;
      s.style.transitionDelay = (BASE + (offset + i) * STEP) + 's';
      el.appendChild(s);
    });
    return chars.length;
  };
  const n = split(w1, 0);
  split(w2, n);

  setTimeout(() => document.body.classList.add('loaded'), 120);
}

/* ============ TITRES DE SECTION MOT À MOT ============ */
function initSectionTitles() {
  $$('.section-title').forEach((title) => {
    const words = title.textContent.trim().split(/\s+/);
    title.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'tw';
      s.textContent = w;
      s.style.transitionDelay = (i * 0.06) + 's';
      title.appendChild(s);
      if (i < words.length - 1) title.appendChild(document.createTextNode(' '));
    });
  });
}

/* ============ FENÊTRE DE CODE (frappe automatique) ============ */
function initCodeWindow() {
  const pre = $('#code-body');
  const CODE = [
    ['c-c', '# trading_agent.py — extrait du projet\n'],
    ['c-k', 'class '], ['c-l', 'TradingAgent'], ['', ':\n'],
    ['c-s', '    """Agent autonome d\'analyse de marchés."""\n\n'],
    ['c-k', '    def '], ['c-d', '__init__'], ['', '(self):\n'],
    ['', '        self.strategies = ['], ['c-l', 'RSI'], ['', '(), '], ['c-l', 'MACD'], ['', '(), '], ['c-l', 'MLStrategy'], ['', '()]\n'],
    ['', '        self.risk = '], ['c-l', 'RiskManager'], ['', '(max_drawdown='], ['c-n', '0.05'], ['', ')\n\n'],
    ['c-k', '    def '], ['c-d', 'run'], ['', '(self, market):\n'],
    ['', '        signal = self.best_strategy(market).predict()\n'],
    ['c-k', '        if '], ['', 'self.risk.validate(signal):\n'],
    ['c-k', '            return '], ['', 'self.execute(signal)\n\n'],
    ['c-c', '# Backtest terminé ✔  ·  1 247 trades simulés\n'],
  ];

  function renderInstant() {
    pre.innerHTML = '';
    for (const [cls, text] of CODE) {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = text;
      pre.appendChild(s);
    }
  }

  if (reducedMotion) { renderInstant(); return; }

  const caret = document.createElement('span');
  caret.className = 'code-caret';

  let ti = 0, ci = 0, span = null;

  function typeNext() {
    if (ti >= CODE.length) {
      setTimeout(() => {
        pre.innerHTML = '';
        ti = 0; ci = 0; span = null;
        typeNext();
      }, 12000);
      return;
    }
    const [cls, text] = CODE[ti];
    if (ci === 0) {
      span = document.createElement('span');
      if (cls) span.className = cls;
      pre.insertBefore(span, caret.parentNode === pre ? caret : null);
      if (caret.parentNode !== pre) pre.appendChild(caret);
    }
    span.textContent += text[ci];
    ci++;
    if (ci >= text.length) { ti++; ci = 0; }
    setTimeout(typeNext, text[ci - 1] === '\n' ? 90 : 14 + Math.random() * 26);
  }
  setTimeout(typeNext, 1100);
}

/* ============ MOT ROTATIF (HERO) ============ */
function initRotator() {
  const el = $('#rotator');
  const words = [
    'la cybersécurité',
    "l'intelligence artificielle",
    'le développement logiciel',
    'les nouvelles technologies',
  ];
  if (reducedMotion) { el.textContent = words[0]; return; }
  let i = 0;
  setInterval(() => {
    i = (i + 1) % words.length;
    el.classList.remove('fade');
    void el.offsetWidth;
    el.textContent = words[i];
    el.classList.add('fade');
  }, 3000);
}

/* ============ PARALLAXE DES HALOS DU HERO ============ */
function initBlobParallax() {
  if (!finePointer || reducedMotion) return;
  const hero = $('#hero');
  const b1 = $('.bw1'), b2 = $('.bw2');
  hero.addEventListener('mousemove', (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    b1.style.transform = `translate(${x * -28}px, ${y * -20}px)`;
    b2.style.transform = `translate(${x * 22}px, ${y * 16}px)`;
  });
}

/* ============ BOUTONS MAGNÉTIQUES ============ */
function initMagnetic() {
  if (!finePointer || reducedMotion) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate(${(dx * 8).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ============ CARTES 3D (TILT + REFLET) ============ */
function initTilt() {
  if (!finePointer || reducedMotion) return;
  $$('[data-tilt]').forEach((card) => {
    const MAX = card.classList.contains('code-window') ? 4 : 6;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rotY = (px - 0.5) * MAX * 2;
      const rotX = (0.5 - py) * MAX * 2;
      card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-3px)`;
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ============ HEADER + PROGRESSION + TIMELINE + HISTOIRE (scroll) ============ */
function initScrollEffects() {
  const header = $('#site-header');
  const bar = $('#scroll-progress');
  const tl = $('.timeline');
  const tlProgress = $('.tl-progress');
  const tlItems = $$('.tl-item');

  function onScroll() {
    const y = window.scrollY;
    scrollVel = y - lastScrollY;
    lastScrollY = y;

    header.classList.toggle('scrolled', y > 10);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    const rect = tl.getBoundingClientRect();
    const p = clamp((innerHeight * 0.75 - rect.top) / rect.height, 0, 1);
    tlProgress.style.height = (p * 100) + '%';
    tlItems.forEach((it) => {
      it.classList.toggle('lit', it.getBoundingClientRect().top < innerHeight * 0.75);
    });

    if (story.onScroll) story.onScroll();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ============ APPARITION AU SCROLL + NAV ACTIVE ============ */
function initReveals() {
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('visible');
      obs.unobserve(e.target);
    }
  }, { threshold: 0.12 });
  $$('.reveal, .stagger').forEach((el) => obs.observe(el));

  const links = $$('.nav-links a');
  const navObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((l) =>
        l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id)
      );
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main section').forEach((s) => navObs.observe(s));
}

/* ============ COMPTEURS ANIMÉS ============ */
function initCounters() {
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      obs.unobserve(el);
      const target = parseInt(el.dataset.target, 10);
      if (reducedMotion) { el.textContent = target.toLocaleString('fr-FR'); continue; }
      const start = performance.now();
      const DURATION = 1500;
      (function step(now) {
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString('fr-FR');
        if (t < 1) requestAnimationFrame(step);
      })(start);
    }
  }, { threshold: 0.6 });
  $$('.counter').forEach((el) => obs.observe(el));
}

/* ============ COPIER L'EMAIL ============ */
const EMAIL = 'raphael.bruneau@outlook.com';
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    showToast('Adresse copiée dans le presse-papiers ✓');
  } catch {
    showToast(EMAIL);
  }
}
function initCopyEmail() {
  $('#copy-email').addEventListener('click', copyEmail);
}

/* ============ PALETTE DE COMMANDES (Ctrl+K) ============ */
function initPalette() {
  const palette = $('#palette');
  const input = $('#palette-input');
  const list = $('#palette-list');
  let items = [];
  let filtered = [];
  let active = 0;

  const goTo = (id) => () => {
    document.getElementById(id).scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const ICONS = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" stroke="none"/></svg>',
  };

  function buildItems() {
    items = [
      { label: 'Aller à — Mon histoire', hint: 'Section', ico: ICONS.arrow, fn: goTo('histoire') },
      { label: 'Aller à — À propos', hint: 'Section', ico: ICONS.arrow, fn: goTo('apropos') },
      { label: 'Aller à — Compétences', hint: 'Section', ico: ICONS.arrow, fn: goTo('competences') },
      { label: 'Aller à — Projets', hint: 'Section', ico: ICONS.arrow, fn: goTo('projets') },
      { label: 'Aller à — Parcours', hint: 'Section', ico: ICONS.arrow, fn: goTo('parcours') },
      { label: 'Aller à — Contact', hint: 'Section', ico: ICONS.arrow, fn: goTo('contact') },
      { label: 'Envoyer un email', hint: 'Action', ico: ICONS.mail, fn: () => { location.href = 'mailto:' + EMAIL; } },
      { label: "Copier l'adresse email", hint: 'Action', ico: ICONS.copy, fn: copyEmail },
      {
        label: currentTheme() === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre',
        hint: 'Action', ico: ICONS.theme, fn: toggleTheme,
      },
    ];
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    filtered = q ? items.filter((it) => it.label.toLowerCase().includes(q)) : items;
    active = 0;
    list.innerHTML = '';
    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Aucun résultat';
      list.appendChild(li);
      return;
    }
    filtered.forEach((it, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="ico">${it.ico}</span><span>${it.label}</span><span class="hint">${it.hint}</span>`;
      li.className = i === active ? 'active' : '';
      li.addEventListener('click', () => { close(); it.fn(); });
      li.addEventListener('mousemove', () => setActive(i));
      list.appendChild(li);
    });
  }

  function setActive(i) {
    active = i;
    [...list.children].forEach((li, k) => li.classList.toggle('active', k === active));
    const el = list.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    buildItems();
    palette.hidden = false;
    input.value = '';
    render('');
    input.focus();
  }
  function close() { palette.hidden = true; }
  function toggle() { palette.hidden ? open() : close(); }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggle();
      return;
    }
    if (palette.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && filtered[active]) { close(); filtered[active].fn(); }
  });

  input.addEventListener('input', () => render(input.value));
  $('.palette-backdrop').addEventListener('click', close);
  $('#palette-btn').addEventListener('click', open);
}

/* ============ LANCEMENT ============ */
function boot() {
  const inits = [
    initTheme, initCursor, initHeroParticles, initStory, initMarquee,
    initVelocityEffects, initTitleReveal, initSectionTitles, initCodeWindow,
    initRotator, initBlobParallax, initMagnetic, initTilt, initScrollEffects,
    initReveals, initCounters, initCopyEmail, initPalette,
  ];
  for (const fn of inits) {
    try { fn(); } catch (e) { console.error('[portfolio] ' + fn.name + ' a échoué :', e); }
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
