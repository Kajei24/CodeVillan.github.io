/* =========================================================
   Code:Villan — interactions
   ========================================================= */
(() => {
  'use strict';

  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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
    // ヒーロー要素を確実に出す
    requestAnimationFrame(() => {
      $$('#top .reveal').forEach((el) => el.classList.add('is-in'));
      $$('#top .split').forEach((el) => el.classList.add('is-in'));
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
    $$('[data-type]').forEach((el) => {
      const full = el.dataset.full || el.textContent.trim();
      el.dataset.full = full;
      el.textContent = '';
      const delay = Number(el.dataset.delay || 300);
      setTimeout(() => {
        el.classList.add('is-typing');
        let i = 0;
        const tick = () => {
          el.textContent = full.slice(0, ++i);
          if (i < full.length) {
            setTimeout(tick, 46 + Math.random() * 44);
          } else {
            setTimeout(() => el.classList.remove('is-typing'), 500);
          }
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
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

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
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    t += 0.01;

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

      const a = (p.ember ? 0.62 : 0.34) * p.life;
      if (p.ember) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(255,190,120,${a})`);
        g.addColorStop(0.4, `rgba(217,60,90,${a * 0.5})`);
        g.addColorStop(1, 'rgba(160,20,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(214,222,255,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
  $$('[data-split]').forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    el.classList.add('split');
    [...text].forEach((c, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = c === ' ' ? ' ' : c;
      span.style.transitionDelay = `${i * 0.035}s`;
      el.appendChild(span);
    });
  });

  /* =======================================================
     5. スクロールリビール
     ======================================================= */
  let pending = $$('.reveal, .split');

  const showAll = () => {
    pending.forEach((el) => el.classList.add('is-in'));
    pending = [];
  };

  if (!('IntersectionObserver' in window)) {
    showAll();
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
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
      el.classList.add('is-in');
      return false;
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
      sections.forEach((sec) => {
        if (sec.getBoundingClientRect().top <= window.innerHeight * 0.4) current = sec;
      });
      navLinks.forEach((a) =>
        a.classList.toggle('is-current', current && a.getAttribute('href') === `#${current.id}`)
      );

      // タイムスケジュール：線が伸びる
      if (schedLine && schedList) {
        const r = schedList.getBoundingClientRect();
        const p = (window.innerHeight * 0.68 - r.top) / r.height;
        schedLine.style.height = `${Math.max(0, Math.min(1, p)) * 100}%`;
      }

      // パララックス
      $$('[data-parallax]').forEach((el) => {
        const speed = parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
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
    hades: {
      idx: 'HOST / 01',
      name: 'HADES',
      ja: 'ハデス',
      role: '冥界の主 ／ 晩餐会の主催者',
      quote: '「席は用意してある。まずは、名を聞かせてくれ。」',
      body: [
        '冥界の館の主であり、晩餐会の開催者。多くの悪役を館へ招き、客人と引き合わせる存在です。',
        '落ち着いた威厳を持ち、館全体を静かに見守ります。客人に対しては<b>礼儀正しく</b>接しますが——何を目的として晩餐会を開いているのかを、彼が明かすことはありません。',
        '彼が与えるのは、席と、時間と、そして問いだけ。何を持ち帰るかは、客人に委ねられています。',
      ],
    },
    jekyllhyde: {
      idx: 'HOST / 02',
      name: 'JEKYLL & HYDE',
      ja: 'ジキル と ハイド',
      role: '診る者と、その影 ／ ひとつの器のふたり',
      quote: '「診察を始めましょう。……ご安心を、これは治療のためです。」',
      body: [
        '善と悪を分離しようとした医師と、彼が切り離そうとした欲望そのもの。ジキルとハイドは<b>同一人物</b>です。',
        'ひとつの器に、理性と欲望が同居しています。どちらが現れるかは、客人の言葉次第かもしれません。',
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
    if (!ta.value.trim()) { ta.focus(); return; }
    msg.hidden = false;
    ta.disabled = true;
    setTimeout(() => {
      closeModal(confessModal);
      ta.value = '';
      ta.disabled = false;
    }, 1800);
  });

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
