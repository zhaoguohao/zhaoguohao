(function loopPress() {
  const voices = ['底鼓', '木击', '铃音'];
  const radii = [42.5, 32.5, 22.5];
  const steps = 16;
  const mask = notes => notes.reduce((bits, step) => bits | (1 << step), 0);
  const presets = [
    {tempo:104, tracks:[[0,6,8,14],[4,12],[0,3,7,10,14]]},
    {tempo:126, tracks:[[0,3,8,11],[4,7,12,15],[2,6,9,13]]},
    {tempo:78, tracks:[[0,8,10],[4,12],[2,5,9,14]]}
  ].map(preset => ({tempo:preset.tempo, score:preset.tracks.map(mask)}));
  const params = new URLSearchParams(location.search);
  const encoded = params.get('score') || '';
  let score = /^[a-f0-9]{12}$/i.test(encoded)
    ? encoded.match(/.{4}/g).map(bits => parseInt(bits,16)) : [...presets[0].score];
  const speed = Number(params.get('bpm'));
  let tempo = Number.isInteger(speed) && speed >= 60 && speed <= 160 ? speed : presets[0].tempo;
  const rings = [...document.querySelectorAll('.ring')];
  const choices = [...document.querySelectorAll('[data-preset]')];
  const tempoInput = document.getElementById('tempo');
  const play = document.getElementById('play');
  const message = document.getElementById('message');
  const needle = document.querySelector('.needle');
  const position = document.getElementById('position');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  let audio, session;
  const buttons = [];

  function updateScore() {
    buttons.forEach((row, voice) => row.forEach((button, step) => {
      button.setAttribute('aria-pressed', String(Boolean(score[voice] & (1 << step))));
    }));
    choices.forEach((button, index) => {
      const preset = presets[index];
      const same = preset.tempo === tempo && preset.score.every((value, i) => value === score[i]);
      button.setAttribute('aria-pressed', String(same));
    });
    tempoInput.value = tempo;
    document.getElementById('bpm').textContent = tempo;
    tempoInput.setAttribute('aria-valuetext', tempo + ' BPM');
  }
  function saveScore() {
    const url = new URL(location.href);
    url.searchParams.set('score', score.map(value => value.toString(16).padStart(4, '0')).join(''));
    url.searchParams.set('bpm', tempo);
    history.replaceState(null, '', url);
  }

  rings.forEach((ring, voice) => {
    const row = [];
    for (let step = 0; step < steps; step++) {
      const angle = step * 2 * Math.PI / steps;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step';
      button.tabIndex = step === 0 ? 0 : -1;
      if (step % 4 === 0) button.dataset.downbeat = '';
      button.style.setProperty('--x', (50 + radii[voice]*Math.sin(angle))+'%');
      button.style.setProperty('--y', (50 - radii[voice]*Math.cos(angle))+'%');
      button.setAttribute('aria-label', voices[voice] + '，第 ' + (step+1) + ' 步');
      button.addEventListener('click', () => {
        score[voice] ^= 1 << step;
        updateScore();
        saveScore();
      });
      button.addEventListener('focus', () => {
        row.forEach(item => { item.tabIndex = item === button ? 0 : -1; });
      });
      button.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        let nextStep = step, nextVoice = voice;
        switch (event.key) {
          case 'ArrowLeft': nextStep = (step+steps-1) % steps; break;
          case 'ArrowRight': nextStep = (step+1) % steps; break;
          case 'ArrowUp': nextVoice = (voice+voices.length-1) % voices.length; break;
          case 'ArrowDown': nextVoice = (voice+1) % voices.length; break;
          case 'Home': nextStep=0; break;
          case 'End': nextStep=steps-1; break;
        }
        buttons[nextVoice][nextStep].focus();
      });
      row.push(button);
      ring.append(button);
    }
    buttons.push(row);
  });
  choices.forEach((button, index) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      score = [...presets[index].score];
      tempo = presets[index].tempo;
      updateScore();
      saveScore();
    });
  });
  tempoInput.disabled = false;
  tempoInput.addEventListener('input', () => { tempo = Number(tempoInput.value); updateScore(); });
  tempoInput.addEventListener('change', saveScore);

  // Each voice decays into the session's gain, so stopping also silences queued notes.
  function tone(output, at, type, from, to, amplitude, duration) {
    const osc = audio.createOscillator(), envelope = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration * .8);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(amplitude, at + .004);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(envelope).connect(output);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
    osc.start(at);
    osc.stop(at + duration + .01);
  }
  function soundStep(output, step, at) {
    const bit = 1 << step;
    if (score[0] & bit) tone(output, at, 'sine', 138, 43, .73, .26);
    if (score[1] & bit) {
      tone(output, at, 'triangle', 590, 360, .32, .095);
      tone(output, at, 'sine', 910, 760, .10, .055);
    }
    if (score[2] & bit) {
      const note = step < 8 ? 1175 : 1397;
      tone(output, at, 'sine', note, note * .996, .17, .17);
      tone(output, at, 'sine', note * 2.71, note * 2.68, .07, .09);
    }
  }
  function schedule(run) {
    const now = audio.currentTime;
    const interval = 60 / tempo / 4;
    // When the main thread stalls, skip expired notes instead of clustering them.
    if (run.time < now) {
      const missed = Math.ceil((now - run.time) / interval);
      run.step = (run.step + missed) % steps;
      run.time += missed * interval;
    }
    while (run.time < now + .11) {
      soundStep(run.output, run.step, run.time);
      run.upcoming.push({step:run.step, time:run.time});
      run.step = (run.step + 1) % steps;
      run.time += interval;
    }
  }
  function showPlayhead(run) {
    let current;
    while (run.upcoming.length && run.upcoming[0].time <= audio.currentTime) current = run.upcoming.shift();
    if (current) {
      needle.style.transform = 'rotate(' + current.step * 360 / steps + 'deg)';
      needle.hidden = false;
      position.textContent = String(current.step+1).padStart(2, '0') + ' / 16';
    }
    run.frame = requestAnimationFrame(() => showPlayhead(run));
  }
  function setTransport(active) {
    play.setAttribute('aria-pressed', String(active));
    play.querySelector('span').textContent = active ? '停止播放' : '播放节奏';
  }
  function suspendIfIdle() {
    if (!session && audio?.state === 'running') audio.suspend().catch(() => {});
  }
  function stop() {
    const run = session;
    if (!run) return;
    session = null;
    clearInterval(run.timer);
    cancelAnimationFrame(run.frame);
    if (run.output && audio.state === 'running') {
      const now = audio.currentTime;
      run.output.gain.setTargetAtTime(.0001, now, .002);
      setTimeout(() => {
        run.output.disconnect();
        suspendIfIdle();
      }, 35);
    } else {
      run.output?.disconnect();
      suspendIfIdle();
    }
    needle.hidden = true;
    position.textContent = '16 STEPS';
    setTransport(false);
  }
  function onAudioState(event) {
    const context = event.currentTarget;
    if (context !== audio) return;
    if (context.state === 'running') {
      suspendIfIdle();
    } else if (session && (session.output || context.state === 'interrupted' || context.state === 'closed')) {
      stopForInterruption();
    }
  }
  function stopForInterruption() {
    stop();
    message.textContent = '声音已中断，点按“播放节奏”可重新播放当前谱面。';
  }
  async function start() {
    const run = {upcoming:[], step:0};
    session = run;
    play.querySelector('span').textContent = '取消启动';
    message.textContent = '';
    try {
      if (!audio || audio.state === 'closed') {
        audio = new AudioEngine();
        audio.addEventListener('statechange', onAudioState);
      }
      await audio.resume();
      if (session !== run) { suspendIfIdle(); return; }
      if (document.hidden) { stop(); return; }
      if (audio.state !== 'running') { stopForInterruption(); return; }
      run.output = audio.createGain();
      run.output.gain.value = .57;
      run.output.connect(audio.destination);
      run.time = audio.currentTime + .035;
      setTransport(true);
      schedule(run);
      run.timer = setInterval(() => schedule(run), 25);
      showPlayhead(run);
    } catch {
      if (session !== run) return;
      stop();
      message.textContent = '声音暂时未能启动。可以再次播放，也可以继续编谱。';
    }
  }
  play.disabled = !AudioEngine;
  if (!AudioEngine) message.textContent = '当前浏览器可编辑谱面，播放需要 Web Audio。';
  play.addEventListener('click', () => { if (session) stop(); else start(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  setTransport(false);
  updateScore();
  document.getElementById('score-preview').hidden = true;
  document.querySelector('.studio').hidden = false;
})();
