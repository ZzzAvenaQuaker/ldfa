/* ==========================================================================
   🌻 GIRASOL — configuración
   Todo lo que quieras cambiar está en este bloque.
   Los colores están en style.css (variables de :root).
   ========================================================================== */
const CONFIG = {
  pageTitle: "Para ti",

  // Si lo llenas, la introducción queda: "Mi amor, hay algunas cosas que quiero decirte."
  recipientName: "Luna",
  // Firma pequeña al final (ej. "— Italo"). Vacío = sin firma.
  fromName: "La persona que mas te ama, Italo",

  intro: {
    text: "quiero decirte cosas lindas justo como te gusta",
    button: "Empezar",
  },
  hint: "Toca un pétalo",

  // Cantidad de pétalos interactivos (entre 10 y 15).
  petalCount: 13,

  // ------------------------------------------------------------------------
  // ✏️  TEXTOS DE EJEMPLO — reemplázalos por los tuyos.
  // Se muestran en orden, uno por pétalo. Cada elemento puede ser:
  //   "Un texto"
  //   { text: "Un texto", photo: "assets/foto1.jpg" }   ← con foto opcional
  // Se usan los primeros (petalCount - 2). Los dos últimos pétalos son especiales.
  // ------------------------------------------------------------------------
  messages: [
    "Me encanta como te ries y como tu brillo llena mi alma cuando me sonries",
    "Me encanta la forma en la que dices mi nombre en las llamadas",
    "Me encanta como te preocupas por todo el mundo a tu alrededor",
    "Me encanta no tener que ocultarte mi yo",
    "Me encantan esos pequeños detalles en tu personalidad que te hacen diferente al resto",
    "Me encanta como tus ojitos se iluminan cuando me cuentas sobre tu día",
    "Me encanta que contigo pueda quedarme callado sin miedo a que algo malo pase",
    "Me encanta tu forma de mirarme, estoy enamoradisimo de tus ojos",
    "Me encanta que siempre quieras hacer todo conmigo",
    "Me encanta como haces que me tranquilice cuando lo necesito",
    "Me encanta cuando nos reimos juntos en llamada",
  ],

  // Al retirar el penúltimo pétalo:
  penultimateMessage: "Y me encantaría decir más cosas lindas sobre ti",
  // Al retirar el último (opcional; vacío = pasa directo a la pantalla final):
  lastMessage: "Pero debo guardar mis palabras para nuestra boda",

  // ✏️  Textos de la pantalla final
  final: {
    line1: "Se que quizás no es lo que hubieras querido",
    line2: "pero aun así quise hacerlo especial",
    love: "Te amo<3",
    emoji: "🌻",
    date: "Feliz día de las flores amarillas mi querida",
    replay: "Volver a empezar",
    showReplay: true,
  },

  // 🎵 Música: reemplaza assets/music.mp3 por tu canción.
  // Si el archivo no existe, se usa un fondo ambiental suave generado por el navegador
  // (pon fallbackSynth en false si prefieres silencio).
  music: {
    src: "assets/music.mp3",
    volume: 0.5,
    fadeInMs: 4000,
    fallbackSynth: true,
  },

  // Ritmo de la experiencia (milisegundos)
  timing: {
    lockMs: 1700,          // espera mínima entre pétalos
    lockLateMs: 2800,      // ídem cuando quedan pocos
    messageBaseMs: 2600,   // duración del mensaje = base + caracteres × porChar
    messagePerCharMs: 55,
    restRatio: 0.45,       // proporción de pétalos que quedan un rato en la parte baja
  },
};


/* ==========================================================================
   Código
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const EASE = 'cubic-bezier(.45,.05,.2,1)';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('#stage'), flower = $('#flower'), disc = $('#disc');
  const layerPetals = $('#layerPetals'), layerFall = $('#layerFall');
  const veil = $('#veil'), msgBox = $('#message'), msgText = $('#messageText'), msgPhoto = $('#messagePhoto');
  const hint = $('#hint'), intro = $('#intro'), startBtn = $('#startBtn');
  const soundBtn = $('#soundBtn'), nextBtn = $('#nextBtn'), finalEl = $('#final');

  const state = {
    phase: 'intro',            // intro → opening → play → ending → final
    petals: [], attached: [],
    total: 0, removed: 0,
    busyUntil: 0, W: 0, H: 0, geo: null, nF: 0,
    msgTimer: 0, msgToken: 0, msgVisible: false,
  };

  /* ---------------------------------------------------------------- textos */
  document.title = CONFIG.pageTitle;
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const name = (CONFIG.recipientName || '').trim();
  $('#introText').textContent = name ? `${name}, ${lowerFirst(CONFIG.intro.text)}` : CONFIG.intro.text;
  startBtn.textContent = CONFIG.intro.button;
  hint.textContent = CONFIG.hint;
  $('#finalLine1').textContent = CONFIG.final.line1;
  $('#finalLine2').textContent = CONFIG.final.line2;
  $('#finalLove').textContent = CONFIG.final.love;
  $('#finalEmoji').textContent = CONFIG.final.emoji;
  $('#finalDate').textContent = CONFIG.final.date;
  $('#finalFrom').textContent = CONFIG.fromName || '';
  $('#replayBtn').textContent = CONFIG.final.replay;

  /* -------------------------------------------------------------- geometría
     El centro de la flor queda DEBAJO del borde inferior. Los pétalos nacen
     cerca de ese borde y se abren en abanico hacia arriba; el ángulo máximo
     se calcula para que los pétalos de los extremos entren justo por los lados. */
  function measure() { state.W = stage.clientWidth; state.H = stage.clientHeight; }

  function computeGeometry() {
    const { W, H } = state;
    const c = { x: W / 2, y: H * 1.16 };
    const r0 = H * 0.27;
    const L = H * 0.81;
    const rMid = r0 + L / 2;
    const thetaMax = Math.min((72 * Math.PI) / 180, Math.asin(Math.min(1, (0.53 * W) / rMid)));
    const dTheta = state.nF > 1 ? (2 * thetaMax) / (state.nF - 1) : thetaMax;
    const w = clamp(1.9 * rMid * dTheta, 0.22 * L, 0.34 * L);
    return { c, r0, L, rMid, thetaMax, w };
  }

  function petalPath(tip) {
    const tx = 60 + tip;
    return `M60 398 C38 342 4 252 12 152 C18 86 44 36 ${tx} 4 C${(76 + tip * 0.55).toFixed(1)} 36 102 86 108 152 C116 252 82 342 60 398 Z`;
  }

  function petalSVG(tip) {
    const d = petalPath(tip);
    return `<svg viewBox="0 0 120 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="hit" d="${d}" fill="url(#gPetal)"/>
      <path d="${d}" fill="url(#gSide)"/>
      <path d="${d}" fill="url(#gBase)"/>
      <g fill="none" stroke="var(--vein)" stroke-linecap="round">
        <path d="M60 388 C58 300 61 160 ${(60 + tip * 0.9).toFixed(1)} 36" stroke-width="1.6"/>
        <path d="M60 372 C46 300 34 210 32 130" stroke-width="1.1"/>
        <path d="M60 372 C74 300 86 210 88 130" stroke-width="1.1"/>
      </g>
      <path d="${d}" fill="none" stroke="rgba(120,64,0,.30)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  /* ------------------------------------------------------------- construir */
  function buildFlower() {
    const N = clamp(Math.round(CONFIG.petalCount), 10, 15);
    const nF = Math.ceil((N + 1) / 2), nB = N - nF;
    state.nF = nF; state.total = N;
    measure(); state.geo = computeGeometry();

    const fronts = [];
    for (let j = 0; j < nF; j++) fronts.push(nF === 1 ? 0 : (2 * j) / (nF - 1) - 1);
    const mids = [];
    for (let j = 0; j < nF - 1; j++) mids.push((fronts[j] + fronts[j + 1]) / 2);
    const backs = [];
    if (nB >= mids.length) backs.push(...mids);
    else for (let i = 0; i < nB; i++) backs.push(mids[Math.round((i * (mids.length - 1)) / (nB - 1))]);

    const specs = [
      ...fronts.map((t) => ({ row: 'front', t })),
      ...backs.map((t) => ({ row: 'back', t })),
    ];

    specs.forEach((s) => {
      const back = s.row === 'back';
      const p = {
        ...s,
        jit: (Math.random() - 0.5) * 0.028,
        lenK: back ? rand(1.04, 1.09) : rand(0.93, 1.0),
        widthK: rand(0.92, 1.08),
        scaleK: 1, scaleW: 1, special: false,
        theta: 0, cx: 0, cy: 0, lenPx: 0,
        tip: rand(-8, 8),
        alive: true,
      };
      const el = document.createElement('div');
      el.className = 'petal';
      el.innerHTML = `<div class="motion"><div class="sway"><div class="shape">${petalSVG(p.tip)}</div></div></div>`;
      const bright = (back ? 0.80 : 0.98) + rand(-0.04, 0.05);
      const sat = (back ? 1.18 : 1.04) + rand(-0.03, 0.05);
      el.style.setProperty('--filt', `brightness(${bright.toFixed(3)}) saturate(${sat.toFixed(3)}) drop-shadow(0 12px 18px rgba(20,8,0,.45))`);
      el.style.setProperty('--par', back ? 5 : 11);
      el.style.setProperty('--s', rand(0.5, 1.2).toFixed(2));
      el.style.setProperty('--d', rand(7, 12).toFixed(1) + 's');
      el.style.setProperty('--dl', (-rand(0, 10)).toFixed(1) + 's');
      el.style.zIndex = back ? 10 : 100 + Math.round((1 - Math.abs(p.t)) * 40);
      p.el = el;
      p.motion = el.querySelector('.motion');
      layerPetals.appendChild(el);
      state.petals.push(p);
    });
    state.attached = [...state.petals];
    applyLayout();
  }

  function place(p) {
    const g = state.geo, back = p.row === 'back';
    const r0 = g.r0 * (back ? 0.97 : 1);
    const Lp = g.L * p.lenK * p.scaleK;
    const wp = g.w * p.widthK * (back ? 1.06 : 1) * p.scaleW;
    const rc = r0 + Lp / 2;
    const th = p.theta;
    p.lenPx = Lp;
    p.cx = g.c.x + rc * Math.sin(th);
    p.cy = g.c.y - rc * Math.cos(th);
    const st = p.el.style;
    st.left = p.cx.toFixed(1) + 'px';
    st.top = p.cy.toFixed(1) + 'px';
    st.setProperty('--w', wp.toFixed(1) + 'px');
    st.setProperty('--l', Lp.toFixed(1) + 'px');
    st.setProperty('--rot', ((th * 180) / Math.PI).toFixed(2) + 'deg');
  }

  function applyLayout() {
    const g = state.geo;
    state.attached.forEach((p) => {
      if (!p.special) p.theta = p.t * g.thetaMax + p.jit;
      place(p);
    });
    const Rd = g.r0 * 0.58;
    disc.style.width = disc.style.height = Rd * 2 + 'px';
    disc.style.left = g.c.x - Rd + 'px';
    disc.style.top = g.c.y - Rd + 'px';
  }

  /* --------------------------------------------------------------- entrada */
  function enterPetals() {
    const order = [...state.attached].sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
    order.forEach((p, i) => {
      p.motion.animate(
        [
          { opacity: 0, transform: 'translate3d(0,90px,0) scale(1.14)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: REDUCED ? 600 : 2300, delay: (REDUCED ? 0 : 350) + i * (REDUCED ? 30 : 115), easing: EASE, fill: 'backwards' }
      );
    });
    if (!REDUCED) {
      flower.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 5600, easing: EASE });
    }
  }

  /* --------------------------------------------------------------- mensajes */
  async function showMessage(item, { slow = false } = {}) {
    const token = ++state.msgToken;
    clearTimeout(state.msgTimer);
    const text = typeof item === 'string' ? item : item.text;
    const photo = typeof item === 'string' ? null : item.photo;

    if (state.msgVisible) {
      msgBox.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
      await sleep(400);
      if (token !== state.msgToken) return 0;
    }
    msgText.textContent = text;
    if (photo) { msgPhoto.src = photo; msgPhoto.hidden = false; }
    else { msgPhoto.hidden = true; msgPhoto.removeAttribute('src'); }

    veil.classList.add('is-on');
    state.msgVisible = true;
    msgBox.animate(
      [
        { opacity: 0, transform: 'translate(-50%,-46%)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'translate(-50%,-50%)', filter: 'blur(0px)' },
      ],
      { duration: slow ? 1900 : 1400, easing: EASE, fill: 'forwards' }
    );
    const t = CONFIG.timing;
    const dur = clamp(t.messageBaseMs + text.length * t.messagePerCharMs, 3600, 7600) * (slow ? 1.3 : 1);
    state.msgTimer = setTimeout(hideMessage, dur);
    return dur;
  }

  function hideMessage() {
    if (!state.msgVisible) return;
    state.msgVisible = false;
    veil.classList.remove('is-on');
    msgBox.animate(
      [
        { opacity: 1, filter: 'blur(0px)' },
        { opacity: 0, filter: 'blur(5px)' },
      ],
      { duration: 1100, easing: EASE, fill: 'forwards' }
    );
  }

  /* ---------------------------------------------------------- quitar pétalo */
  function tug(p) {
    p.motion.animate(
      [
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-1.2deg)' },
        { transform: 'rotate(1deg)' }, { transform: 'rotate(0deg)' },
      ],
      { duration: 460, easing: 'ease-in-out' }
    );
  }

  function detach(p, { last = false } = {}) {
    p.alive = false;
    state.attached = state.attached.filter((x) => x !== p);
    layerFall.appendChild(p.el);
    p.el.classList.remove('is-last');
    p.el.style.pointerEvents = 'none';

    const { W, H } = state;
    const slow = last ? 1.6 : state.attached.length <= 3 ? 1.35 : 1;
    const rest = !last && Math.random() < CONFIG.timing.restRatio;
    const dir = Math.abs(p.theta) > 0.08 ? Math.sign(p.theta) * (Math.random() < 0.75 ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
    const thDeg = (p.theta * 180) / Math.PI;

    let dx = dir * rand(0.05, 0.2) * W;
    let dy, spin, endScale;
    if (rest) {
      const finalX = clamp(p.cx + dx, W * 0.1, W * 0.9);
      dx = finalX - p.cx;
      dy = H - rand(30, 74) - p.cy;
      spin = dir * rand(72, 104) - thDeg;
      endScale = rand(0.5, 0.62);
    } else {
      dy = H + p.lenPx * 0.6 - p.cy + 40;
      spin = dir * rand(130, 260);
      endScale = rand(0.7, 0.9);
    }
    const sway = dir * rand(14, 34) * (W < 600 ? 0.7 : 1);
    const dur = (rest ? rand(4200, 5200) : rand(5200, 6600)) * slow * (REDUCED ? 0.6 : 1);
    const mid = 1 + (endScale - 1) * 0.5;
    const f = (x, y, r, s, o, b) => ({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${s.toFixed(3)})`, opacity: o, filter: `blur(${b}px)` });

    const kf = [
      { offset: 0, ...f(0, 0, 0, 1, 1, 0) },
      { offset: 0.14, ...f(dx * 0.04, -rand(8, 16), spin * 0.05, 1.07, 1, 0), easing: 'cubic-bezier(.3,0,.2,1)' },
      { offset: 0.5, ...f(dx * 0.5 + sway, dy * 0.42, spin * 0.5, mid, 1, 0) },
      { offset: 0.8, ...f(dx * 0.88 - sway * 0.5, dy * 0.88, spin * 0.86, endScale + (mid - endScale) * 0.2, rest ? 1 : 0.55, 0) },
      { offset: 1, ...f(dx, dy, spin, endScale, rest ? 1 : 0, rest ? 0 : 2.5) },
    ];
    const anim = p.motion.animate(kf, { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
    anim.finished
      .then(async () => {
        if (rest) {
          await sleep(rand(3200, 6500));
          const fo = p.motion.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2600, easing: 'ease-in-out', fill: 'forwards' });
          await fo.finished;
        }
        p.el.remove();
      })
      .catch(() => p.el.remove());
  }

  function updateAtmosphere() {
    const prog = state.removed / state.total;
    stage.style.setProperty('--p', prog.toFixed(3));
    disc.style.setProperty('--lift', (prog * state.H * 0.07).toFixed(1));
  }

  function activate(p) {
    if (state.phase !== 'play' || !p || !p.alive) return;
    const now = performance.now();
    if (now < state.busyUntil) { tug(p); return; }

    hint.classList.remove('is-on');
    const lastOne = state.attached.length === 1;
    detach(p, { last: lastOne });
    state.removed++;
    updateAtmosphere();

    const remaining = state.attached.length;
    const late = remaining <= 3;
    state.busyUntil = now + (late ? CONFIG.timing.lockLateMs : CONFIG.timing.lockMs);

    if (remaining === 0) { finish(); return; }

    if (remaining === 1) {
      state.busyUntil = now + 60000; // se libera al terminar el foco sobre el último pétalo
      showMessage(CONFIG.penultimateMessage, { slow: true }).then((dur) => {
        if (dur) spotlightLast(Math.max(dur - 700, 1200));
      });
      return;
    }
    const msgs = CONFIG.messages;
    const idx = state.removed - 1;
    const item = msgs.length ? msgs[idx % msgs.length] : '';
    if (item) showMessage(item, { slow: late });
  }

  /* -------------------------------------------------- el último pétalo */
  function glide(p, toTheta, toScaleK, toScaleW, ms) {
    const from = p.theta, k0 = p.scaleK, w0 = p.scaleW, t0 = performance.now();
    return new Promise((res) => {
      const step = (t) => {
        const k = clamp((t - t0) / ms, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        p.theta = from + (toTheta - from) * e;
        p.scaleK = k0 + (toScaleK - k0) * e;
        p.scaleW = w0 + (toScaleW - w0) * e;
        place(p);
        k < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }

  async function spotlightLast(delay) {
    await sleep(delay);
    const p = state.attached[0];
    if (!p || state.phase !== 'play') return;
    p.special = true;
    p.el.style.zIndex = 300;
    p.el.classList.add('is-last');
    await glide(p, 0, 1.06 / p.lenK, 1.3, REDUCED ? 600 : 2800);
    state.busyUntil = performance.now() + 400;
  }

  /* --------------------------------------------------------------- final */
  const fadeIn = (el, ms = 1700) =>
    el.animate(
      [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: ms, easing: EASE, fill: 'forwards' }
    ).finished;
  const fadeOut = (el, ms = 1200) =>
    el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: ms, easing: EASE, fill: 'forwards' }).finished;

  async function finish() {
    state.phase = 'ending';
    if (CONFIG.lastMessage) {
      const dur = await showMessage(CONFIG.lastMessage, { slow: true });
      await sleep(dur || 4000);
    }
    await sleep(CONFIG.lastMessage ? 400 : 2600);
    hideMessage();
    stage.classList.add('is-final');
    flower.classList.add('is-done');
    await sleep(1800);

    state.phase = 'final';
    finalEl.hidden = false;
    const l1 = $('#finalLine1'), l2 = $('#finalLine2');
    await fadeIn(l1, 1900); await sleep(3200); await fadeOut(l1); await sleep(500);
    await fadeIn(l2, 1900); await sleep(2800); await fadeOut(l2); await sleep(700);

    await fadeIn($('#finalLove'), 2600);
    await sleep(900);
    const em = $('#finalEmoji');
    em.animate(
      [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 1800, easing: EASE, fill: 'forwards' }
    );
    await sleep(1900);
    await fadeIn($('#finalDate'), 1900);
    if (CONFIG.fromName) { await sleep(900); await fadeIn($('#finalFrom'), 1800); }
    if (CONFIG.final.showReplay) {
      await sleep(4500);
      const rb = $('#replayBtn');
      rb.classList.add('is-on');
      rb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'forwards' });
      rb.addEventListener('click', () => location.reload());
    }
  }

  /* --------------------------------------------------------------- música */
  const Synth = (() => {
    let ctx, master, bus, timer = 0, step = 0, running = false;
    const chords = [
      [130.81, 196.0, 246.94, 329.63],   // Cmaj7
      [110.0, 164.81, 196.0, 261.63],    // Am7
      [87.31, 174.61, 220.0, 329.63],    // Fmaj7
      [98.0, 196.0, 246.94, 293.66],     // G6
    ];
    function init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.3;
      const delay = ctx.createDelay(2); delay.delayTime.value = 0.46;
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
      lp.connect(master); lp.connect(delay);
      delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(wet); wet.connect(master);
      master.connect(ctx.destination);
      bus = lp;
      return true;
    }
    function chord(freqs) {
      const now = ctx.currentTime, len = 9;
      freqs.forEach((f, i) => {
        [-4, 4].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = i % 2 ? 'sine' : 'triangle';
          o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now + i * 0.35);
          g.gain.linearRampToValueAtTime(0.035, now + 3 + i * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, now + len + 2);
          o.connect(g); g.connect(bus);
          o.start(now + i * 0.35); o.stop(now + len + 2.5);
        });
      });
    }
    return {
      start(vol, ms) {
        if (!ctx && !init()) return false;
        ctx.resume();
        running = true;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(vol, t + ms / 1000);
        if (!timer) { const tick = () => chord(chords[step++ % chords.length]); tick(); timer = setInterval(tick, 8000); }
        return true;
      },
      stop(ms = 900) {
        if (!ctx) return;
        running = false;
        clearInterval(timer); timer = 0;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + ms / 1000);
        setTimeout(() => { if (!running) ctx.suspend(); }, ms + 150);
      },
    };
  })();

  const Music = (() => {
    const cfg = CONFIG.music;
    const a = new Audio();
    a.loop = true; a.preload = 'auto'; a.volume = 0; a.src = cfg.src;
    let want = false, useSynth = false, raf = 0;

    const setUI = (on) => { soundBtn.classList.toggle('is-muted', !on); soundBtn.setAttribute('aria-pressed', String(on)); };
    a.addEventListener('error', () => {
      useSynth = !!cfg.fallbackSynth;
      if (want && useSynth) Synth.start(cfg.volume, cfg.fadeInMs);
    });
    function fade(to, ms) {
      cancelAnimationFrame(raf);
      const from = a.volume, t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / ms, 0, 1);
        a.volume = clamp(from + (to - from) * k, 0, 1);
        if (k < 1) raf = requestAnimationFrame(step); else if (to === 0) a.pause();
      };
      raf = requestAnimationFrame(step);
    }
    async function on() {
      want = true; setUI(true);
      if (!useSynth) {
        try { await a.play(); fade(cfg.volume, cfg.fadeInMs); return; }
        catch (e) { useSynth = !!cfg.fallbackSynth; }
      }
      if (useSynth) { if (!Synth.start(cfg.volume, cfg.fadeInMs)) { want = false; setUI(false); } }
      else { want = false; setUI(false); }
    }
    function off() {
      want = false; setUI(false);
      if (useSynth) Synth.stop(); else fade(0, 900);
    }
    return { on, off, get playing() { return want; } };
  })();

  soundBtn.addEventListener('click', () => (Music.playing ? Music.off() : Music.on()));

  /* --------------------------------------------------------------- eventos */
  async function start() {
    if (state.phase !== 'intro') return;
    state.phase = 'opening';
    intro.classList.add('is-leaving');
    Music.on();
    flower.classList.add('is-open');
    enterPetals();
    soundBtn.classList.add('is-visible');
    setTimeout(() => (intro.hidden = true), 2400);
    await sleep(REDUCED ? 900 : 3600);
    state.phase = 'play';
    hint.classList.add('is-on');
    nextBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener('click', start);

  layerPetals.addEventListener('click', (e) => {
    const el = e.target.closest('.petal');
    if (!el) return;
    activate(state.attached.find((p) => p.el === el));
  });

  function nextPetal() {
    return [...state.attached].sort((a, b) => Math.abs(a.t) - Math.abs(b.t))[0];
  }
  nextBtn.addEventListener('click', () => activate(nextPetal()));
  window.addEventListener('keydown', (e) => {
    if (state.phase === 'play' && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { e.preventDefault(); activate(nextPetal()); }
  });

  // Parallax ligero con el puntero (solo ratón / lápiz)
  let tx = 0, ty = 0, cx = 0, cy = 0, parallaxRaf = 0;
  function parallaxTick() {
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    flower.style.setProperty('--mx', cx.toFixed(3));
    flower.style.setProperty('--my', cy.toFixed(3));
    parallaxRaf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(parallaxTick) : 0;
  }
  if (!REDUCED) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      tx = (e.clientX / state.W - 0.5) * 2; ty = (e.clientY / state.H - 0.5) * 2;
      if (!parallaxRaf) parallaxRaf = requestAnimationFrame(parallaxTick);
    });
  }

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { measure(); state.geo = computeGeometry(); applyLayout(); }, 80);
  });

  buildFlower();
})();
