/* =========================================================
   Code:Villain — interactions
   ========================================================= */
(() => {
  'use strict';

  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* =======================================================
     0. 文字化け（グリッチ）ユーティリティ
     ======================================================= */
  // 全角/半角で幅が暴れないよう、化け文字は元の文字と同じ字幅の中から選ぶ
  const GLYPH_WIDE   = '囗回田由甲申罒卍鬼霊呪咒禍厄闇冥獄縛贄贖魂魄骸屍髑髏黯翳歪虚零壱弐参肆伍陸漆捌玖拾■□▓▒░◆◇◈▲▼◤◥※〓';
  const GLYPH_NARROW = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ#$%&@?!<>/\\|=+*^~_0123456789ÆØÞßЖДЦЩЯλψξΣΩ';
  // 全角判定（CJK記号・かな・漢字・全角英数）
  const isWide = (c) => {
    const n = c.codePointAt(0);
    return (n >= 0x3000 && n <= 0x30ff)
        || (n >= 0x3400 && n <= 0x9fff)
        || (n >= 0xf900 && n <= 0xfaff)
        || (n >= 0xff01 && n <= 0xff60);
  };

  const glyphFor = (c) => {
    const pool = isWide(c) ? GLYPH_WIDE : GLYPH_NARROW;
    return pool.charAt((Math.random() * pool.length) | 0);
  };

  // テキストを1文字ずつ span に分解する（2度目以降は既存の span を返す）
  function splitChars(el, addSplitClass) {
    if (el.dataset.chars) return $$('.ch', el);
    const text = el.textContent.trim();
    el.textContent = '';
    el.dataset.chars = '1';
    if (addSplitClass) el.classList.add('split');
    return [...text].map((c, i) => {
      const ch = c === ' ' ? ' ' : c;
      const span = document.createElement('span');
      span.className = 'ch';
      span.dataset.char = ch;
      span.textContent = ch;
      span.style.transitionDelay = `${(i * 0.014).toFixed(3)}s`;
      el.appendChild(span);
      return span;
    });
  }

  // 化け文字 → 正しい文字へ。左から順に確定していく
  function decodeChars(spans, opt) {
    if (reduced || !spans.length) return;
    const o       = opt || {};
    const step    = o.step    || 46;   // 化け文字を差し替える間隔(ms)
    const hold    = o.hold    || 7;    // 先頭文字が化けたままの歩数
    const stagger = o.stagger || 1.6;  // 1文字ごとの確定ずれ（歩）

    // 経過時間で駆動する（タブが非アクティブでもタイミングが崩れない）
    const items = spans.map((span, i) => {
      const real = span.dataset.char || span.textContent;
      return {
        span, real,
        at: (hold + i * stagger + Math.random() * 3) * step,  // 確定する時刻(ms)
        done: !real.trim(),                                   // 空白・nbsp は化けさせない
      };
    });
    const settle = (it) => {
      it.span.textContent = it.real;
      it.span.classList.remove('is-glitch');
      it.done = true;
    };

    const end = items.reduce((m, it) => Math.max(m, it.at), 0) + step;
    const t0 = performance.now();
    let nextSwap = 0;

    const loop = (now) => {
      const elapsed = now - t0;
      const swap = elapsed >= nextSwap;              // 化け文字を差し替えるタイミング
      if (swap) nextSwap = elapsed + step;

      items.forEach((it) => {
        if (it.done) return;
        if (elapsed >= it.at) { settle(it); return; }
        if (!swap) return;
        it.span.classList.add('is-glitch');
        it.span.textContent = glyphFor(it.real);
      });

      if (elapsed < end) requestAnimationFrame(loop);
      else items.forEach(settle);
    };
    requestAnimationFrame(loop);
  }

  // 要素まるごと「文字化け → 復号」を1度だけ走らせる
  function glitchIn(el, opt) {
    if (!el || el.dataset.decoded) return;
    el.dataset.decoded = '1';
    decodeChars(splitChars(el, false), opt);
  }

  // 確定させず、化けさせ続ける（文字を崩壊させたいとき）
  function corruptChars(spans, dur) {
    if (reduced || !spans.length) return;
    const t0 = performance.now();
    let next = 0;
    const loop = (now) => {
      const elapsed = now - t0;
      if (elapsed >= next) {
        next = elapsed + 58;
        spans.forEach((s) => {
          const real = s.dataset.char || s.textContent;
          if (!real.trim()) return;
          s.classList.add('is-glitch');
          s.textContent = glyphFor(real);
        });
      }
      if (elapsed < dur) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 中身が差し替わる要素（モーダルなど）用：毎回やり直す
  function reglitch(el, opt) {
    if (!el) return;
    delete el.dataset.chars;
    delete el.dataset.decoded;
    glitchIn(el, opt);
  }

  /* =======================================================
     1. 招待の儀（ゲート）
     ======================================================= */
  const gate       = $('#gate');
  const sealBtn    = $('#break-seal');
  const takeHand   = $('#take-hand');
  let gateStep = 1;

  // 破片の飛散方向をランダム化
  $$('.seal__shards i').forEach((shard, i, arr) => {
    const angle = (Math.PI * 2 * i) / arr.length + Math.random() * 0.4;
    const dist  = 90 + Math.random() * 130;
    shard.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    shard.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    shard.style.setProperty('--rot', `${(Math.random() * 900 - 450).toFixed(0)}deg`);
    shard.style.animationDelay = `${(Math.random() * 0.12).toFixed(2)}s`;
  });

  function breakSeal() {
    if (gateStep !== 1) return;
    gateStep = 2;
    gate.classList.add('is-breaking');
    burstEmbers();
    setTimeout(() => {
      gate.dataset.step = '2';
      startTyping();
      setTimeout(() => takeHand?.focus({ preventScroll: true }), reduced ? 0 : 1200);
    }, reduced ? 60 : 620);
  }

  function enterSite() {
    if (!gate || gate.classList.contains('is-gone')) return;
    gateStep = 3;
    gate.classList.add('is-gone');
    body.classList.remove('is-gated');
    setTimeout(() => { gate.remove(); }, 1000);
    // ヒーロー要素を確実に出す（ここで初めて文字化けを解かせる）
    requestAnimationFrame(() => {
      $$('#top .reveal, #top .split').forEach(revealEl);
    });
  }

  sealBtn?.addEventListener('click', breakSeal);
  takeHand?.addEventListener('click', () => enterSite());
  $$('[data-skip]').forEach((b) => b.addEventListener('click', () => enterSite()));

  window.addEventListener('keydown', (e) => {
    if (gateStep >= 3) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      gateStep === 1 ? breakSeal() : enterSite();
    }
    if (e.key === 'Escape') enterSite();
  });

  /* ---- タイプライター ---- */
  function startTyping() {
    if (reduced) {
      $$('[data-type]').forEach((el) => { el.textContent = el.dataset.full || el.textContent; });
      return;
    }
    // 歓迎パネルの見出しも文字化けから立ち上げる
    glitchIn($('.gate__panel--welcome .gate__eyebrow'), { step: 40, stagger: 1.1 });
    glitchIn($('.welcome-copy__title'), { step: 44, hold: 9, stagger: 2 });

    $$('[data-type]').forEach((el) => {
      const full = el.dataset.full || el.textContent.trim();
      el.dataset.full = full;
      el.textContent = '';

      // 確定済みの文字と、いま化けている1文字を別々に持つ
      const fixed  = document.createElement('span');
      const glitch = document.createElement('span');
      glitch.className = 'tw-glitch';
      el.append(fixed, glitch);

      const delay = Number(el.dataset.delay || 300);
      setTimeout(() => {
        el.classList.add('is-typing');
        let i = 0;
        const tick = () => {
          if (i >= full.length) {
            glitch.textContent = '';
            setTimeout(() => el.classList.remove('is-typing'), 500);
            return;
          }
          const target = full[i];
          // 空白はそのまま送る
          if (!target.trim()) {
            fixed.textContent = full.slice(0, ++i);
            setTimeout(tick, 40);
            return;
          }
          let n = 0;
          const garble = () => {
            if (n < 3) {
              n++;
              glitch.textContent = glyphFor(target);
              setTimeout(garble, 28);
            } else {
              glitch.textContent = '';
              fixed.textContent = full.slice(0, ++i);
              setTimeout(tick, 34 + Math.random() * 40);
            }
          };
          garble();
        };
        tick();
      }, delay);
    });
  }

  /* =======================================================
     2. 塵と火の粉（canvas）
     ======================================================= */
  const canvas = $('#dust-canvas');
  const ctx = canvas?.getContext('2d');
  let particles = [];
  let W = 0, H = 0, dpr = 1;

  function sizeCanvas() {
    if (!canvas) return;
    // モバイルは解像度を抑える（塗る画素数が dpr の2乗で効くため）
    dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.5 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 火の粉のグラデーションは毎フレーム作らず、スプライトを1枚焼いて使い回す
  const EMBER_SPRITE = (() => {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,190,120,1)');
    grad.addColorStop(0.4, 'rgba(217,60,90,0.5)');
    grad.addColorStop(1, 'rgba(160,20,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  })();

  function makeParticle(burst) {
    const ember = Math.random() < 0.22 || burst;
    return {
      x: burst ? W / 2 + (Math.random() - 0.5) * 90 : Math.random() * W,
      y: burst ? H / 2 + (Math.random() - 0.5) * 90 : Math.random() * H,
      r: ember ? 0.9 + Math.random() * 1.5 : 0.5 + Math.random() * 1.1,
      vx: (Math.random() - 0.5) * (burst ? 2.6 : 0.16),
      vy: burst ? (Math.random() - 0.5) * 2.6 : -(0.08 + Math.random() * (ember ? 0.42 : 0.16)),
      life: 1,
      decay: burst ? 0.006 + Math.random() * 0.008 : 0,
      ember,
      phase: Math.random() * Math.PI * 2,
      drift: 0.16 + Math.random() * 0.4,
    };
  }

  function initParticles() {
    const base = window.innerWidth < 720 ? 46 : 96;
    particles = Array.from({ length: base }, () => makeParticle(false));
  }

  function burstEmbers() {
    if (reduced || !ctx) return;
    for (let i = 0; i < 70; i++) particles.push(makeParticle(true));
  }

  let t = 0;
  const embers = [];          // 1フレーム内の使い回しバッファ
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    t += 0.01;

    // 塵は不透明度が一定なので、1つのパスにまとめて1回で塗る
    ctx.fillStyle = 'rgba(214,222,255,0.34)';
    ctx.beginPath();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx + Math.sin(t + p.phase) * p.drift * 0.34;
      p.y += p.vy;
      if (p.decay) {
        p.life -= p.decay;
        p.vy += 0.006;      // 落下
        p.vx *= 0.985;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
      } else {
        if (p.y < -12) { p.y = H + 8; p.x = Math.random() * W; }
        if (p.x < -12) p.x = W + 8;
        if (p.x > W + 12) p.x = -8;
      }

      if (p.ember) {
        embers.push(p);
      } else {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // 火の粉は焼いておいたスプライトを貼るだけ
    for (let i = 0; i < embers.length; i++) {
      const p = embers[i];
      const d = p.r * 12;                       // 直径 = 半径(p.r*6) × 2
      ctx.globalAlpha = 0.62 * p.life;
      ctx.drawImage(EMBER_SPRITE, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    embers.length = 0;

    requestAnimationFrame(draw);
  }

  if (ctx && !reduced) {
    sizeCanvas();
    initParticles();
    draw();
    window.addEventListener('resize', () => { sizeCanvas(); initParticles(); });
  } else if (canvas) {
    canvas.style.display = 'none';
  }

  /* =======================================================
     3. 蝋燭カーソル
     ======================================================= */
  const cursor = $('.candle-cursor');
  if (cursor && matchMedia('(pointer:fine)').matches && !reduced) {
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      body.classList.add('has-pointer');
    });
    (function follow() {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    })();
  }

  /* =======================================================
     4. テキスト分割（見出し）
     ======================================================= */
  // 見出し（data-split）と英字ラベルを 1 文字ずつ span 化しておく
  $$('[data-split], [data-scramble], .s-en, .hero__eyebrow').forEach((el) => {
    splitChars(el, true);
  });

  /* =======================================================
     5. スクロールリビール
     ======================================================= */
  let pending = $$('.reveal, .split');

  // 画面に入った瞬間に、文字化け → 復号 を走らせる
  const revealEl = (el) => {
    // ゲート表示中のヒーローは、扉が開いてから（enterSite から）出す
    if (body.classList.contains('is-gated') && el.closest('#top')) return;
    el.classList.add('is-in');
    if (!el.dataset.chars || el.dataset.decoded) return;
    el.dataset.decoded = '1';
    const label = el.classList.contains('s-en') || el.classList.contains('hero__eyebrow');
    decodeChars($$('.ch', el), label ? { step: 40, hold: 5, stagger: 1 } : { step: 46, hold: 7, stagger: 1.6 });
  };

  const showAll = () => {
    pending.forEach(revealEl);
    pending = [];
  };

  if (!('IntersectionObserver' in window)) {
    showAll();
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealEl(entry.target);
        if (entry.target.classList.contains('is-in')) io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

    pending.forEach((el) => io.observe(el));
  }

  // 保険：何らかの理由で監視が働かなくても、画面に入った要素は必ず出す
  const sweepReveals = () => {
    if (!pending.length) return;
    const limit = window.innerHeight * 0.94;
    pending = pending.filter((el) => {
      if (el.classList.contains('is-in')) return false;
      if (el.getBoundingClientRect().top > limit) return true;
      revealEl(el);
      return !el.classList.contains('is-in');
    });
  };

  /* =======================================================
     6. ヘッダー / 進捗 / 現在地
     ======================================================= */
  const header   = $('.header');
  const progress = $('#scroll-progress');
  const navLinks = $$('.nav__link');
  const sections = navLinks
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean);

  const schedLine = $('#sched-progress');
  const schedList = $('#sched');

  // スクロールのたびに DOM を検索し直さないよう、起動時に取っておく
  const parallaxItems = $$('[data-parallax]').map((el) => ({
    el, speed: parseFloat(el.dataset.parallax),
  }));
  const navHrefs = navLinks.map((a) => a.getAttribute('href'));

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header?.classList.toggle('is-stuck', y > 24);
      sweepReveals();

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;

      // 現在地
      let current = sections[0];
      const mark = window.innerHeight * 0.4;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= mark) current = sections[i];
      }
      const currentHref = current ? `#${current.id}` : '';
      navLinks.forEach((a, i) => a.classList.toggle('is-current', navHrefs[i] === currentHref));

      // タイムスケジュール：線が伸びる
      if (schedLine && schedList) {
        const r = schedList.getBoundingClientRect();
        const p = (window.innerHeight * 0.68 - r.top) / r.height;
        schedLine.style.height = `${Math.max(0, Math.min(1, p)) * 100}%`;
      }

      // パララックス
      parallaxItems.forEach((p) => {
        p.el.style.transform = `translate3d(0, ${y * p.speed}px, 0)`;
      });

      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =======================================================
     7. モバイルメニュー
     ======================================================= */
  const menuBtn = $('.menu-btn');
  const nav = $('#nav');
  function closeMenu() {
    menuBtn?.setAttribute('aria-expanded', 'false');
    nav?.classList.remove('is-open');
    body.classList.remove('no-scroll');
  }
  menuBtn?.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('is-open', !open);
    body.classList.toggle('no-scroll', !open);
  });
  navLinks.forEach((a) => a.addEventListener('click', closeMenu));

  /* =======================================================
     8. 問いのローテーション
     ======================================================= */
  const qItems = $$('#q-list li');
  if (qItems.length) {
    let qi = 0;
    setInterval(() => {
      qItems[qi].classList.remove('is-active');
      qi = (qi + 1) % qItems.length;
      qItems[qi].classList.add('is-active');
    }, 3800);
  }

  /* =======================================================
     9. ジキル / ハイド 切替
     ======================================================= */
  const duality = $('#duality');

  function setDualitySide(side) {
    if (!duality) return;
    duality.dataset.side = side;
    $$('.duality__btn', duality).forEach((b) => b.classList.toggle('is-on', b.dataset.side === side));
  }

  $$('.duality__btn').forEach((btn) => {
    btn.addEventListener('click', () => setDualitySide(btn.dataset.side));
  });

  /* =======================================================
     10. キャスト詳細モーダル
     ======================================================= */
  const CAST = {
    jekyllhyde: {
      idx: 'HOST / 01',
      name: 'JEKYLL & HYDE',
      ja: 'ジキル と ハイド',
      role: '診る者と、その影 ／ ひとつの器のふたり',
      quote: '「診察を始めましょう。……ご安心を、これは治療のためです。」',
      body: [
        '善と悪を分離しようとした医師と、彼が切り離そうとした欲望そのもの。ジキルとハイドは<b>同一人物</b>です。',
        'ひとつの器に、理性と欲望が同居しています。どちらが現れるかは、客人の言葉次第かもしれません。',
        'ハイドはジキルのことを<b>「先生」</b>と呼びます。からかうように、じゃれつくように——けれどその声には、隠しきれない親しみが混じっています。',
      ],
      duality: true,
    },
  };

  const castModal = $('#cast-modal');
  const fields = {
    idx: $('#cast-modal-idx'),
    name: $('#cast-modal-name'),
    ja: $('#cast-modal-ja'),
    role: $('#cast-modal-role'),
    quote: $('#cast-modal-quote'),
    bodyEl: $('#cast-modal-body'),
  };
  let lastFocused = null;

  function openModal(modal) {
    lastFocused = document.activeElement;
    modal.hidden = false;
    body.classList.add('no-scroll');
    void modal.offsetWidth;              // 初期状態を確定させてから遷移
    modal.classList.add('is-open');
    modal.querySelector('.modal__close')?.focus();
  }
  function closeModal(modal) {
    modal.classList.remove('is-open');
    body.classList.remove('no-scroll');
    setTimeout(() => { modal.hidden = true; lastFocused?.focus?.(); }, 500);
  }

  $$('[data-cast]').forEach((card) => {
    const open = () => {
      const data = CAST[card.dataset.cast];
      if (!data || !castModal) return;
      fields.idx.textContent = data.idx;
      fields.name.textContent = data.name;
      fields.ja.textContent = data.ja;
      fields.role.textContent = data.role;
      fields.quote.textContent = data.quote;
      fields.bodyEl.innerHTML = data.body.map((p) => `<p>${p}</p>`).join('');
      if (duality) {
        duality.hidden = !data.duality;
        if (data.duality) setDualitySide('jekyll');   // 開くたびジキルから
      }
      openModal(castModal);
      // 名前は開くたびに文字化けから浮かび上がらせる
      reglitch(fields.idx,  { step: 38, hold: 4, stagger: .8 });
      reglitch(fields.name, { step: 44, hold: 8, stagger: 1.8 });
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  /* =======================================================
     11. 問いかけモーダル
     ======================================================= */
  const confessModal = $('#confess-modal');
  $('#open-confess')?.addEventListener('click', () => {
    $('#sealed-msg').hidden = true;
    openModal(confessModal);
  });

  $('#seal-answer')?.addEventListener('click', () => {
    const ta = $('#confess-text');
    const msg = $('#sealed-msg');
    const answer = ta.value.trim();
    if (!answer) { ta.focus(); return; }
    msg.hidden = false;
    ta.disabled = true;
    setTimeout(() => {
      closeModal(confessModal);
      ta.value = '';
      ta.disabled = false;
      startRitual(answer);
    }, 900);
  });

  /* =======================================================
     11-b. 封印の儀（答えたあとの演出）
     ======================================================= */
  const ritual     = $('#ritual');
  const ritualBurn = $('#ritual-burn');
  const ritualRep  = $('#ritual-reply');
  let ritualTimers = [];

  // 客人の答えに対する、館からの返し
  const VOICES = [
    (clip) => `HYDE　「${clip}」——だってさ、先生。ねえ、この人おもしろいよ！`,
    (clip) => `JEKYLL　「${clip}」……なるほど。では、そこから診てさしあげましょう。`,
    (clip) => `HYDE　「${clip}」——ねえ先生、これ、壊したらどんな音がすると思う？`,
    (clip) => `???　「${clip}」——その一言、確かに聞き届けた。`,
  ];
  const OMENS = [
    '——その答えは、蝋の底で固まった。もう戻せない。',
    '——館は、あなたが何を惜しむのかを覚えた。',
    '——覚えておこう。奪うとき、いちばん効くのはそこだ。',
    '——よい答えだ。だからこそ、試してみたくなる。',
    '——守るものがある者ほど、こちら側は近い。',
  ];
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function startRitual(answer) {
    if (!ritual) return;
    const clip = answer.length > 22 ? `${answer.slice(0, 22)}…` : answer;

    ritualTimers.forEach(clearTimeout);
    ritualTimers = [];
    delete ritualBurn.dataset.chars;
    ritualBurn.textContent = answer;
    ritualRep.textContent = '';
    ritual.classList.remove('is-burning', 'is-replying', 'is-done');
    ritual.classList.add('is-on');
    ritual.setAttribute('aria-hidden', 'false');
    body.classList.add('no-scroll');

    // 1文字ずつ分解し、燃え上がるタイミングをばらけさせる
    const spans = splitChars(ritualBurn, false);
    spans.forEach((s) => { s.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`; });

    const at = (ms, fn) => ritualTimers.push(setTimeout(fn, reduced ? Math.min(ms, 150) : ms));

    at(420,  () => corruptChars(spans, 900));                       // 答えが崩れはじめ
    at(1400, () => { ritual.classList.add('is-burning'); burstEmbers(); });  // 燃えて散る
    at(2250, () => {
      ritual.classList.add('is-replying');
      const lines = [pick(VOICES)(clip), pick(OMENS), '——あなたの席は、すでに用意されている。'];
      lines.forEach((text, i) => {
        const p = document.createElement('p');
        p.className = 'ritual__line';
        p.textContent = text;
        ritualRep.appendChild(p);
        at(i * 950, () => {
          p.classList.add('is-in');
          glitchIn(p, { step: 34, hold: 4, stagger: 0.5 });
        });
      });
    });
    at(5600, () => ritual.classList.add('is-done'));
  }

  function endRitual() {
    if (!ritual || !ritual.classList.contains('is-on')) return;
    ritualTimers.forEach(clearTimeout);
    ritualTimers = [];
    ritual.classList.remove('is-on', 'is-burning', 'is-replying', 'is-done');
    ritual.setAttribute('aria-hidden', 'true');
    body.classList.remove('no-scroll');
    setTimeout(() => {
      delete ritualBurn.dataset.chars;
      ritualBurn.textContent = '';
      ritualRep.textContent = '';
    }, 700);
    $('#open-confess')?.focus({ preventScroll: true });
  }

  ritual?.addEventListener('click', endRitual);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') endRitual(); });

  // 共通クローズ
  $$('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.closest('.modal')));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.modal.is-open').forEach(closeModal);
  });

  /* =======================================================
     12. 招待状の 3D チルト
     ======================================================= */
  const invite = $('#invite-card');
  if (invite && matchMedia('(pointer:fine)').matches && !reduced) {
    invite.addEventListener('pointermove', (e) => {
      const r = invite.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      invite.style.transform =
        `perspective(1000px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-4px)`;
    });
    invite.addEventListener('pointerleave', () => { invite.style.transform = ''; });
  }
})();
