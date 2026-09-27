(function () {
  'use strict';

  const themes = Object.freeze([
    { id: 'stars', name: '星星岛', emoji: '⭐', color: '#ffe69a', note: '铅笔是你的魔法棒，一起点亮数字小星星！' },
    { id: 'dinosaurs', name: '恐龙谷', emoji: '🦕', color: '#b4efd2', note: '咚咚咚！带着认真，跟小恐龙一起跨过数字山。' },
    { id: 'rainbow', name: '彩虹湾', emoji: '🌈', color: '#ffbfd9', note: '每想明白一道题，彩虹就悄悄多亮一点！' },
    { id: 'space', name: '太空站', emoji: '🚀', color: '#b8ceff', note: '小宇航员准备好啦，带着好奇心探索数字星球！' },
    { id: 'candy', name: '糖果屋', emoji: '🍭', color: '#ffd0ac', note: '开动小脑袋，发现比糖果还甜的进步！' },
    { id: 'ocean', name: '海底城', emoji: '🐳', color: '#a4e7f4', note: '咕噜咕噜！和小鲸鱼一起找出藏在题目里的宝藏。' },
    { id: 'forest', name: '魔法林', emoji: '🍄', color: '#dbc5fa', note: '认真想、仔细算，你也有让难题变小的魔法！' },
    { id: 'cloud', name: '云朵堡', emoji: '☁️', color: '#fff0ba', note: '踩着软绵绵的云朵，一小步一小步走向新本领！' }
  ].map(theme => Object.freeze(theme)));
  const spinDuration = 5100;
  let drawNumber = 0;

  function draw() {
    const values = new Uint32Array(3);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values);
    else for (let i = 0; i < values.length; i++) values[i] = Math.floor(Math.random() * 4294967296);
    drawNumber++;
    return { index: values[0] % themes.length, seed: Array.from(values, value => value.toString(36)).join('-') + '-' + drawNumber.toString(36) };
  }

  // Sector zero is centered at twelve o'clock; the pointer does not rotate.
  function landingRotation(index) { return 7 * 360 + (360 - index * 45) % 360; }

  function create({ prepare, onAccept }) {
    if (typeof prepare !== 'function' || typeof onAccept !== 'function') throw new TypeError('转盘需要题目生成与确认回调。');
    const ids = ['luckyDialog', 'wheelRotor', 'wheelLabels', 'wheelLights', 'wheelTitle', 'wheelSubtitle', 'wheelStatus', 'wheelAction', 'wheelHub', 'wheelSkip', 'wheelClose', 'wheelSound', 'wheelResultIcon', 'wheelResultName', 'wheelResultNote', 'wheelConfetti'];
    const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    if (Object.values(nodes).some(node => !node)) throw new Error('转盘界面尚未准备好。');
    const dialog = nodes.luckyDialog;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set();
    const voices = new Set();
    let active = false, selected = null, payload = null, accepted = false, phase = 'ready';
    let animation = null, audioContext = null, soundEnabled = false, previousFocus = null;
    let run = 0, spinStartedAt = 0;

    nodes.wheelRotor.style.background = `conic-gradient(from -22.5deg, ${themes.map((theme, i) => `${theme.color} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ')})`;
    nodes.wheelLabels.replaceChildren(...themes.map((theme, index) => {
      const label = document.createElement('div');
      label.className = 'wheel-segment';
      label.style.setProperty('--sector-angle', `${index * 45}deg`);
      const emoji = document.createElement('span');
      emoji.className = 'wheel-emoji'; emoji.textContent = theme.emoji;
      const name = document.createElement('span');
      name.className = 'wheel-sector-name'; name.textContent = theme.name;
      label.append(emoji, name);
      return label;
    }));
    nodes.wheelLights.replaceChildren(...Array.from({ length: 24 }, (_, index) => {
      const bulb = document.createElement('i');
      bulb.style.setProperty('--bulb-angle', `${index * 15}deg`);
      bulb.style.setProperty('--bulb-index', String(index));
      return bulb;
    }));

    function later(callback, delay) {
      const token = run;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active && token === run) callback();
      }, delay);
      timers.add(timer);
      return timer;
    }
    function clearTimers() { for (const timer of timers) window.clearTimeout(timer); timers.clear(); }
    function stopAnimation() {
      if (animation) { animation.cancel(); animation = null; }
    }
    function stopAudio() {
      for (const oscillator of voices) { try { oscillator.stop(); oscillator.disconnect(); } catch (_) { /* Already stopped. */ } }
      voices.clear();
      if (audioContext) { const oldContext = audioContext; audioContext = null; oldContext.close().catch(() => {}); }
    }
    function ensureAudio() {
      if (!soundEnabled || !active) return;
      try {
        if (!audioContext) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return;
          audioContext = new Audio();
        }
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      } catch (_) { audioContext = null; }
    }
    function tone(frequency, delay, duration, volume) {
      if (!soundEnabled || !audioContext || audioContext.state !== 'running' || document.hidden) return;
      try {
        const context = audioContext, start = context.currentTime + delay;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + duration + 0.02);
      } catch (_) { /* Audio support is optional. */ }
    }
    function tick() {
      if (phase !== 'spinning' || reducedMotion.matches) return;
      const progress = Math.min(1, (Date.now() - spinStartedAt) / spinDuration);
      tone(880 + progress * 220, 0, 0.035, 0.035);
      if (progress < 0.97) later(tick, 65 + 460 * progress * progress * progress);
    }
    function setSound() {
      nodes.wheelSound.textContent = soundEnabled ? '音效：开' : '音效：关';
      nodes.wheelSound.setAttribute('aria-pressed', String(soundEnabled));
      nodes.wheelSound.setAttribute('aria-label', soundEnabled ? '关闭转盘音效' : '打开转盘音效');
    }
    function setPhase(next) {
      phase = next;
      dialog.dataset.phase = next;
      nodes.wheelAction.disabled = next === 'spinning';
      nodes.wheelHub.disabled = next !== 'ready' && next !== 'error';
      nodes.wheelHub.setAttribute('aria-label', next === 'ready' ? '开始转动幸运转盘' : next === 'error' ? '重新抽取练习' : '幸运转盘');
      nodes.wheelSkip.hidden = next === 'revealed' || next === 'error';
      nodes.wheelRotor.setAttribute('aria-busy', String(next === 'spinning'));
      nodes.wheelAction.textContent = next === 'revealed' ? '带着新题出发' : next === 'spinning' ? '好运转呀转…' : next === 'error' ? '再试一次' : '转起来';
    }
    function confetti() {
      if (reducedMotion.matches) return;
      const colors = ['#ffd34e', '#ff679c', '#63dfcf', '#7d94ff', '#ffad68'];
      nodes.wheelConfetti.replaceChildren(...Array.from({ length: 44 }, (_, i) => {
        const piece = document.createElement('i'); piece.className = 'wheel-confetti-piece';
        piece.style.setProperty('--x', `${3 + Math.random() * 94}%`);
        piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 160)}px`);
        piece.style.setProperty('--delay', `${Math.round(Math.random() * 380)}ms`);
        piece.style.setProperty('--color', colors[i % colors.length]);
        piece.style.setProperty('--turn', `${Math.round((Math.random() - 0.5) * 1440)}deg`);
        return piece;
      }));
      later(() => nodes.wheelConfetti.replaceChildren(), 3500);
    }
    function showError() {
      clearTimers(); stopAnimation(); stopAudio();
      selected = null; payload = null;
      setPhase('error');
      nodes.wheelTitle.textContent = '小转盘打了个喷嚏';
      nodes.wheelSubtitle.textContent = '题目暂时没准备好，我们再试一次吧。';
      nodes.wheelStatus.textContent = '题目准备失败。原来的练习还在，可以重试或关闭。';
      nodes.wheelAction.focus({ preventScroll: true });
    }
    function finish() {
      if (!active || phase !== 'spinning' || !selected) return;
      clearTimers(); stopAnimation();
      nodes.wheelRotor.style.transform = `rotate(${landingRotation(selected.index)}deg)`;
      setPhase('revealed');
      const theme = themes[selected.index];
      nodes.wheelTitle.textContent = `下一站，${theme.name}！`;
      nodes.wheelSubtitle.textContent = '你的专属练习已就位，准备好出发了吗？';
      nodes.wheelResultIcon.textContent = theme.emoji;
      nodes.wheelResultName.textContent = theme.name;
      nodes.wheelResultNote.textContent = theme.note;
      nodes.wheelStatus.textContent = `抽到了${theme.name}！98 道新题已准备好，点击“带着新题出发”领取。`;
      confetti();
      tone(523.25, 0, 0.17, 0.06); tone(659.25, 0.13, 0.18, 0.06); tone(783.99, 0.27, 0.28, 0.06);
      nodes.wheelAction.focus({ preventScroll: true });
    }
    function start(skipAnimation) {
      if (!active || (phase !== 'ready' && phase !== 'error')) return;
      accepted = false; selected = draw();
      const token = run;
      setPhase('spinning');
      nodes.wheelTitle.textContent = '幸运正在赶来！';
      nodes.wheelSubtitle.textContent = '小小指针，这次会带我们去哪里？';
      nodes.wheelStatus.textContent = '转盘开始旋转，可以跳过动画直接查看结果。';
      ensureAudio();
      try { payload = prepare({ seed: selected.seed, theme: themes[selected.index] }); }
      catch (_) { if (active && token === run) showError(); return; }
      if (!active || token !== run) return;
      if (skipAnimation || reducedMotion.matches || typeof nodes.wheelRotor.animate !== 'function') { finish(); return; }
      spinStartedAt = Date.now();
      const target = landingRotation(selected.index);
      animation = nodes.wheelRotor.animate([
        { transform: 'rotate(0deg)' }, { transform: `rotate(${target}deg)` }
      ], { duration: spinDuration, easing: 'cubic-bezier(0.12, 0.76, 0.12, 1)', fill: 'forwards' });
      animation.finished.then(() => { if (active && token === run) finish(); }, () => {});
      later(finish, spinDuration + 200);
      tick();
    }
    function cleanup() {
      active = false; run++;
      clearTimers(); stopAnimation(); stopAudio();
      nodes.wheelConfetti.replaceChildren();
      selected = null; payload = null;
    }
    function restoreFocus() {
      const focusTarget = previousFocus && previousFocus.isConnected ? previousFocus : document.getElementById('shuffleButton');
      previousFocus = null;
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus({ preventScroll: true });
    }
    function cancel() {
      if (!active && !dialog.open) return;
      cleanup();
      if (dialog.open) dialog.close();
      restoreFocus();
    }
    function accept() {
      if (!active || phase !== 'revealed' || !selected || accepted) return;
      accepted = true;
      nodes.wheelAction.disabled = true;
      const result = payload, theme = themes[selected.index];
      try { onAccept(result, theme); }
      catch (_) { if (active) showError(); return; }
      cancel();
    }
    function open() {
      if (active || dialog.open) return;
      previousFocus = document.activeElement;
      active = true; run++; accepted = false; selected = null; payload = null;
      nodes.wheelRotor.style.transform = 'rotate(0deg)';
      nodes.wheelConfetti.replaceChildren();
      nodes.wheelResultIcon.textContent = '';
      nodes.wheelResultName.textContent = '';
      nodes.wheelResultNote.textContent = '';
      setPhase('ready'); setSound();
      nodes.wheelTitle.innerHTML = '转出今天的<span>奇妙冒险</span>';
      nodes.wheelSubtitle.textContent = '8 个奇妙目的地，藏着属于你的新练习。';
      nodes.wheelStatus.textContent = '点击“转起来”，抽取今天的冒险。';
      try { dialog.showModal(); }
      catch (error) { cleanup(); restoreFocus(); throw error; }
      nodes.wheelAction.focus({ preventScroll: true });
    }

    nodes.wheelAction.addEventListener('click', () => { if (phase === 'revealed') accept(); else start(false); });
    nodes.wheelHub.addEventListener('click', () => start(false));
    nodes.wheelSkip.addEventListener('click', () => { if (phase === 'spinning') finish(); else start(true); });
    nodes.wheelClose.addEventListener('click', cancel);
    nodes.wheelSound.addEventListener('click', () => { soundEnabled = !soundEnabled; setSound(); if (soundEnabled) ensureAudio(); else stopAudio(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.addEventListener('close', () => { if (!dialog.open && active) { cleanup(); restoreFocus(); } });
    dialog.addEventListener('click', event => { if (event.target === dialog) cancel(); });
    dialog.addEventListener('keydown', event => {
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll('button:not(:disabled)')).filter(button => !button.hidden && button.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
    const motionChanged = () => { if (reducedMotion.matches) { nodes.wheelConfetti.replaceChildren(); if (phase === 'spinning') finish(); } };
    if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', motionChanged);
    else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(motionChanged);
    document.addEventListener('visibilitychange', () => {
      if (!active) return;
      if (document.hidden) stopAudio();
      else {
        ensureAudio();
        if (phase === 'spinning' && Date.now() - spinStartedAt >= spinDuration) finish();
      }
    });
    setSound();
    return Object.freeze({ open, cancel });
  }

  window.MathIslandWheel = Object.freeze({ create });
})();
