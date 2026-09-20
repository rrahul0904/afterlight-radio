
(function () {
  'use strict';

  var STORE = 'afterlight-radio:focus-room:v1';
  var ACTIVE = 'afterlight-radio:focus-active:v1';
  var IDLE_MS = 120000;
  var state = load(STORE, { sessions: [], ambient: { rain: 0, brown: 0, fan: 0 } });
  var active = load(ACTIVE, null);
  var lastTick = Date.now();
  var lastActivity = Date.now();
  var audioContext = null;
  var ambientMaster = null;
  var ambientChannels = {};

  if (!Array.isArray(state.sessions)) state.sessions = [];
  state.ambient = Object.assign({ rain: 0, brown: 0, fan: 0 }, state.ambient || {});
  if (active && (!active.id || !active.startedAt)) active = null;

  function byId(id) { return document.getElementById(id); }
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }
  function persist() {
    localStorage.setItem(STORE, JSON.stringify(state));
    if (active) localStorage.setItem(ACTIVE, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function formatSeconds(seconds) {
    var total = Math.max(0, Math.round(seconds || 0));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    return hours ? hours + 'h ' + String(minutes).padStart(2, '0') + 'm' : minutes + 'm';
  }
  function dayKey(ts) { return new Date(ts).toLocaleDateString('en-CA'); }
  function todaySeconds() {
    var key = dayKey(Date.now());
    var total = state.sessions.filter(function (s) { return dayKey(s.startedAt) === key; })
      .reduce(function (n, s) { return n + (s.focusedSeconds || 0); }, 0);
    if (active && dayKey(active.startedAt) === key) total += active.focusedSeconds || 0;
    return total;
  }
  function markActivity() { lastActivity = Date.now(); }
  function accountDelta() {
    if (!active) { lastTick = Date.now(); return; }
    var now = Date.now();
    var rawDelta = Math.max(0, now - lastTick);
    var away = document.hidden || (now - lastActivity) > IDLE_MS;
    var deltaSeconds = (away ? rawDelta : Math.min(rawDelta, 5000)) / 1000;
    if (away) active.idleSeconds = (active.idleSeconds || 0) + deltaSeconds;
    else active.focusedSeconds = (active.focusedSeconds || 0) + deltaSeconds;
    lastTick = now;
  }
  function currentRoomSlug() {
    try { return typeof R !== 'undefined' && Number.isInteger(i) && R[i] ? R[i].slug : null; } catch (_) { return null; }
  }
  function startSession(minutes) {
    if (active) return;
    var input = byId('focusTask');
    var task = input ? input.value.trim() : '';
    active = {
      id: (crypto.randomUUID && crypto.randomUUID()) || ('focus-' + Date.now()),
      startedAt: Date.now(),
      focusedSeconds: 0,
      idleSeconds: 0,
      task: task,
      room: currentRoomSlug(),
      plannedMinutes: minutes || null
    };
    lastTick = Date.now();
    lastActivity = Date.now();
    if (minutes && typeof setTimer === 'function') setTimer(minutes);
    persist();
    render();
    if (typeof trackEvent === 'function') trackEvent('focus_session_started', { planned_minutes: minutes || null, task_labeled: !!task });
  }
  function finishSession(reason) {
    reason = reason || 'completed';
    if (!active) return;
    accountDelta();
    var finished = Object.assign({}, active, { endedAt: Date.now(), reason: reason });
    state.sessions.unshift(finished);
    state.sessions = state.sessions.slice(0, 250);
    active = null;
    persist();
    render();
    if (typeof trackEvent === 'function') {
      trackEvent('focus_session_finished', {
        reason: reason,
        focused_seconds: Math.round(finished.focusedSeconds || 0),
        idle_seconds: Math.round(finished.idleSeconds || 0),
        task_labeled: !!finished.task
      });
    }
  }
  function roomName(slug) {
    try {
      var match = typeof R !== 'undefined' ? R.find(function (r) { return r.slug === slug; }) : null;
      return match ? match.name : 'Afterlight';
    } catch (_) { return 'Afterlight'; }
  }
  function renderLive() {
    if (!byId('focusLive')) return;
    byId('focusLive').textContent = formatSeconds(active && active.focusedSeconds);
    byId('focusAway').textContent = formatSeconds(active && active.idleSeconds);
    byId('focusToday').textContent = formatSeconds(todaySeconds());
    var trigger = byId('focusModeBtn');
    if (trigger) trigger.classList.toggle('active', !!active);
  }
  function render() {
    install();
    renderLive();
    if (!byId('focusHistoryList')) return;
    var running = !!active;
    byId('focusStart25').hidden = running;
    byId('focusStartOpen').hidden = running;
    byId('focusFinish').hidden = !running;
    byId('focusTask').disabled = running;
    if (running && active.task && !byId('focusTask').value) byId('focusTask').value = active.task;

    var rows = state.sessions.slice(0, 10).map(function (s) {
      var when = new Date(s.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      var away = (s.idleSeconds || 0) >= 60 ? ' · ' + formatSeconds(s.idleSeconds) + ' away' : '';
      return '<div class="focus-history-row"><div><strong>' + escapeHtml(s.task || 'Unlabelled session') +
        '</strong><small>' + escapeHtml(roomName(s.room)) + ' · ' + escapeHtml(when) +
        '</small></div><span>' + formatSeconds(s.focusedSeconds || 0) + away + '</span></div>';
    }).join('');
    byId('focusHistoryList').innerHTML = rows || '<div class="focus-empty">No focus sessions yet.</div>';
  }

  function makeNoiseBuffer(kind) {
    var length = audioContext.sampleRate * 4;
    var buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    var samples = buffer.getChannelData(0);
    if (kind === 'brown') {
      var last = 0;
      for (var n = 0; n < length; n++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        samples[n] = last * 3.5;
      }
    } else {
      for (var i2 = 0; i2 < length; i2++) samples[i2] = Math.random() * 2 - 1;
    }
    return buffer;
  }
  function initAmbient() {
    if (audioContext) return audioContext;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    ambientMaster = audioContext.createGain();
    ambientMaster.gain.value = 0.32;
    ambientMaster.connect(audioContext.destination);

    ['rain', 'brown', 'fan'].forEach(function (kind) {
      var source = audioContext.createBufferSource();
      var gain = audioContext.createGain();
      var filter = audioContext.createBiquadFilter();
      source.buffer = makeNoiseBuffer(kind);
      source.loop = true;
      gain.gain.value = 0;
      filter.type = kind === 'rain' ? 'highpass' : 'lowpass';
      filter.frequency.value = kind === 'rain' ? 1300 : (kind === 'fan' ? 650 : 1500);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ambientMaster);
      source.start();
      ambientChannels[kind] = { source: source, gain: gain };
    });
    return audioContext;
  }
  function setAmbient(kind, value) {
    var ctx = initAmbient();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (ambientChannels[kind]) {
      ambientChannels[kind].gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), ctx.currentTime, 0.05);
    }
  }

  function install() {
    if (byId('focusModeBtn') || !byId('timerBtn')) return;

    var trigger = document.createElement('button');
    trigger.id = 'focusModeBtn';
    trigger.className = 'pill';
    trigger.type = 'button';
    trigger.textContent = 'Focus';
    byId('timerBtn').insertAdjacentElement('afterend', trigger);

    var dialog = document.createElement('dialog');
    dialog.id = 'focusRoomDialog';
    dialog.className = 'focus-room-dialog';
    dialog.innerHTML =
      '<div class="focus-room-head"><div><span class="kicker">Optional focus mode</span><h2>Stay with one thing.</h2></div>' +
      '<button id="focusRoomClose" class="round focus-room-close" aria-label="Close focus mode">×</button></div>' +
      '<p class="focus-room-intro">Task labels, session history and away-time accounting stay in this browser. Listening still works normally without Focus Mode.</p>' +
      '<label class="focus-label" for="focusTask">What are you doing?</label>' +
      '<input id="focusTask" class="focus-task" maxlength="120" placeholder="Write, read, code, revise…">' +
      '<div class="focus-actions"><button id="focusStart25" class="focus-primary" type="button">Start 25m</button>' +
      '<button id="focusStartOpen" class="focus-secondary" type="button">Start open session</button>' +
      '<button id="focusFinish" class="focus-secondary" type="button" hidden>Finish session</button></div>' +
      '<div class="focus-stats" aria-live="polite"><div><strong id="focusLive">0m</strong><span>this session</span></div>' +
      '<div><strong id="focusToday">0m</strong><span>today</span></div><div><strong id="focusAway">0m</strong><span>away</span></div></div>' +
      '<section class="focus-ambient"><div class="focus-section-title"><span>Room mix</span><small>Generated locally</small></div>' +
      '<label>Rain <input id="ambientRain" type="range" min="0" max="100" value="0"></label>' +
      '<label>Brown noise <input id="ambientBrown" type="range" min="0" max="100" value="0"></label>' +
      '<label>Fan <input id="ambientFan" type="range" min="0" max="100" value="0"></label></section>' +
      '<section class="focus-history"><div class="focus-section-title"><span>Recent sessions</span><button id="focusClearHistory" type="button">Clear</button></div>' +
      '<div id="focusHistoryList"></div></section>';
    document.body.appendChild(dialog);

    var style = document.createElement('style');
    style.id = 'focusRoomStyles';
    style.textContent =
      '.focus-room-dialog{width:min(620px,calc(100vw - 28px));max-height:88vh;overflow:auto;border:0;border-radius:20px;padding:28px;background:#eee6d8;color:#201c17}' +
      '.focus-room-dialog::backdrop{background:rgba(8,7,6,.72);backdrop-filter:blur(7px)}' +
      '.focus-room-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.focus-room-head h2{font:400 clamp(34px,5vw,54px)/.95 Georgia,serif;letter-spacing:-.04em;margin:8px 0 0}' +
      '.focus-room-close{color:#201c17;border-color:rgba(32,28,23,.2);background:transparent;flex:0 0 auto}.focus-room-intro{color:#665d52;line-height:1.55;font-size:12px;max-width:520px;margin:18px 0 22px}' +
      '.focus-label{display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#74695d;margin-bottom:7px}.focus-task{width:100%;border:1px solid #cfc4b4;background:#faf5ec;color:#201c17;padding:14px 15px}' +
      '.focus-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 20px}.focus-actions button{min-height:42px;padding:0 15px;border:1px solid #201c17;cursor:pointer}.focus-primary{background:#201c17;color:#f5eee2}.focus-secondary{background:transparent;color:#201c17}' +
      '.focus-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 24px}.focus-stats>div{border:1px solid #d5cabb;background:#f8f2e7;padding:14px}.focus-stats strong{display:block;font:400 25px Georgia,serif}.focus-stats span{display:block;margin-top:4px;font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:#756b60}' +
      '.focus-ambient,.focus-history{border-top:1px solid #d5cabb;padding-top:18px;margin-top:18px}.focus-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:10px;letter-spacing:.11em;text-transform:uppercase}.focus-section-title small{font-size:8px;color:#776d61}.focus-section-title button{border:0;background:transparent;color:#6c6257;cursor:pointer;font-size:9px;text-transform:uppercase}' +
      '.focus-ambient label{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:12px;margin:11px 0;font-size:11px}.focus-ambient input{width:100%;accent-color:#201c17}' +
      '.focus-history-row{display:grid;grid-template-columns:1fr auto;gap:12px;border-top:1px solid rgba(32,28,23,.09);padding:11px 0}.focus-history-row:first-child{border-top:0}.focus-history-row strong{font:400 15px Georgia,serif}.focus-history-row small{display:block;color:#756b60;margin-top:3px;font-size:9px}.focus-history-row span{font-size:10px;color:#5f574f;white-space:nowrap}.focus-empty{font-size:11px;color:#756b60;padding:6px 0 2px}' +
      '#focusModeBtn.active{background:var(--cream);color:var(--black)}@media(max-width:520px){.focus-stats{grid-template-columns:1fr}.focus-ambient label{grid-template-columns:90px 1fr}.focus-room-dialog{padding:20px}}';
    document.head.appendChild(style);

    trigger.onclick = function () { dialog.showModal(); render(); };
    byId('focusRoomClose').onclick = function () { dialog.close(); };
    byId('focusStart25').onclick = function () { startSession(25); };
    byId('focusStartOpen').onclick = function () { startSession(0); };
    byId('focusFinish').onclick = finishSession;
    byId('focusClearHistory').onclick = function () {
      if (!window.confirm('Clear locally stored focus-session history?')) return;
      state.sessions = [];
      persist();
      render();
    };

    [['rain', 'ambientRain'], ['brown', 'ambientBrown'], ['fan', 'ambientFan']].forEach(function (pair) {
      var kind = pair[0], id = pair[1], input = byId(id);
      input.value = Math.round((state.ambient[kind] || 0) * 100);
      input.oninput = function () {
        state.ambient[kind] = Number(input.value) / 100;
        persist();
        setAmbient(kind, state.ambient[kind]);
      };
    });
  }

  install();
  render();
  setInterval(function () {
    if (active) {
      accountDelta();
      if (active.plannedMinutes && Date.now() >= active.startedAt + active.plannedMinutes * 60000) {
        finishSession('timer-complete');
        return;
      }
      persist();
    }
    renderLive();
  }, 1000);
})();
