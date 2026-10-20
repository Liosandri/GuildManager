/* Code commun à toutes les pages du site */
const G = (() => {
  const cfg = Object.assign({}, window.GUILD_CONFIG || {});
  // Mémorise les réglages valides : si le navigateur reçoit un jour une ancienne copie de config.js
  // (cache de GitHub Pages), le site continue de fonctionner avec les derniers bons réglages.
  try {
    if (cfg.API_URL && !/REMPLACER/.test(cfg.API_URL)) localStorage.setItem('gcfg', JSON.stringify(cfg));
    else { const old = JSON.parse(localStorage.getItem('gcfg') || 'null'); if (old && old.API_URL) Object.assign(cfg, old); }
  } catch (e) { /* pas de stockage : tant pis */ }
  const ROLE = {
    tank: { emoji: '🛡️', name: 'Tanks', one: 'Tank' },
    soigneur: { emoji: '💚', name: 'Soigneurs', one: 'Soigneur' },
    dps: { emoji: '⚔️', name: 'DPS', one: 'DPS' },
  };
  const CLASS_COLORS = {
    guerrier: '#C69B6D', paladin: '#F48CBA', chasseur: '#AAD372', voleur: '#FFF468', pretre: '#FFFFFF',
    chaman: '#2F8CFF', mage: '#3FC7EB', demoniste: '#8788EE', druide: '#FF7C0A',
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const classColor = c => CLASS_COLORS[norm(c)] || '#6b86b3';
  const pad = n => (n < 10 ? '0' : '') + n;
  const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayIso = () => isoDay(new Date());
  const fmtDay = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso)); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); };
  const fmtWhen = s => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(String(s)); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' à ' + m[4] : String(s || ''); };
  const errMsg = e => (e && e.message ? e.message : String(e));

  /* ---------- appels au serveur (Apps Script) ---------- */
  let busy = 0;
  function setBusy(d) { busy += d; document.body.classList.toggle('busy', busy > 0); }

  async function request(url, opts) {
    if (!cfg.API_URL || /REMPLACER/.test(cfg.API_URL)) throw new Error('Le site n\'est pas encore relié au serveur (voir config.js).');
    if (!getCode() && !(opts && opts.__login)) return new Promise(() => {}); // site verrouillé : rien ne part tant que le code n'est pas entré
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    setBusy(1);
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal, redirect: 'follow' }, opts));
      let j;
      try { j = await r.json(); } catch (e) { throw new Error('Réponse invalide du serveur (déploiement à vérifier).'); }
      if (!j.ok) {
        if (/Code incorrect/.test(j.error || '') && !(opts && opts.__login)) { try { sessionStorage.removeItem('gcode'); localStorage.removeItem('gcode'); } catch (e2) {} location.reload(); return new Promise(() => {}); }
        throw new Error(j.error || 'Erreur du serveur.');
      }
      return j.data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Le serveur met trop de temps à répondre.');
      if (e instanceof TypeError) throw new Error('Connexion impossible. Vérifie ta connexion internet.');
      throw e;
    } finally { clearTimeout(timer); setBusy(-1); }
  }
  const get = (action, params) => request(cfg.API_URL + '?' + new URLSearchParams(Object.assign({ action, code: getCode() }, params || {})));
  // POST en "text/plain" : évite la pré-vérification CORS que Google ne gère pas.
  const post = (action, payload) => request(cfg.API_URL, {
    method: 'POST', body: JSON.stringify(Object.assign({ action, code: getCode() }, payload || {})),
  });

  // Affiche tout de suite la dernière version connue, puis la remplace par la version fraîche.
  async function swr(key, fetcher, onData) {
    let had = false;
    try {
      const raw = localStorage.getItem('g:' + key);
      if (raw) { onData(JSON.parse(raw), true); had = true; }
    } catch (e) { /* pas de stockage : tant pis */ }
    try {
      const fresh = await fetcher();
      try { localStorage.setItem('g:' + key, JSON.stringify(fresh)); } catch (e) {}
      onData(fresh, false);
    } catch (e) {
      if (!had) throw e;
      toast('Hors ligne : dernières données connues affichées.', true);
    }
  }

  /* ---------- connexion officier ---------- */
  function getCode() {
    try { return sessionStorage.getItem('gcode') || localStorage.getItem('gcode') || ''; } catch (e) { return ''; }
  }
  function setCode(code, remember) {
    try {
      sessionStorage.setItem('gcode', code);
      if (remember) localStorage.setItem('gcode', code); else localStorage.removeItem('gcode');
    } catch (e) {}
  }
  function logout() { try { sessionStorage.removeItem('gcode'); localStorage.removeItem('gcode'); Object.keys(localStorage).filter(k => k.indexOf('g:') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {} location.reload(); }
  const isOfficer = () => !!getCode();

  // Ouvre la fenêtre de connexion ; résout quand le code est validé.
  function login(message, locked) {
    return new Promise((resolve, reject) => {
      const el = modal(
        '<h2 style="margin-top:0">🔒 Accès réservé GM &amp; officiers</h2><p class="muted small">' + esc(message || 'Entre le code d\'accès pour modifier les données.') + '</p>' +
        '<input id="lg-code" type="password" placeholder="Code d\'accès" autocomplete="current-password">' +
        '<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input id="lg-rem" type="checkbox" style="width:auto;min-height:0"> Rester connecté sur cet appareil</label>' +
        '<div class="err" id="lg-err"></div>' +
        '<div class="row" style="margin-top:8px">' + (locked ? '' : '<button class="btn grow" id="lg-no">Annuler</button>') + '<button class="btn on grow" id="lg-ok">Entrer</button></div>');
      if (locked) document.getElementById('g-overlay').dataset.sticky = '1';
      const input = el.querySelector('#lg-code');
      input.focus();
      const cancel = () => { closeModal(); reject(new Error('Connexion annulée.')); };
      const go = async () => {
        const code = input.value;
        if (!code) return;
        el.querySelector('#lg-ok').disabled = true;
        try {
          await request(cfg.API_URL, { method: 'POST', __login: true, body: JSON.stringify({ action: 'login', code }) });
          setCode(code, el.querySelector('#lg-rem').checked);
          closeModal(); resolve(true);
        } catch (e) {
          el.querySelector('#lg-err').textContent = errMsg(e);
          el.querySelector('#lg-ok').disabled = false;
        }
      };
      el.querySelector('#lg-ok').onclick = go;
      if (!locked) el.querySelector('#lg-no').onclick = cancel;
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
    });
  }
  // Verrou général : sans code valide, seule la fenêtre de connexion s'affiche.
  if (!getCode()) {
    const lock = () => { document.body.classList.add('locked'); login('Ce site est réservé au GM et aux officiers. Les membres suivent le classement SR et l\'historique sur Discord.', true).then(() => location.reload()); };
    if (document.body) lock(); else document.addEventListener('DOMContentLoaded', lock);
  }
  const ensureOfficer = message => (isOfficer() ? Promise.resolve(true) : login(message));

  /* ---------- fenêtres et messages ---------- */
  function modal(html, cls) {
    closeModal();
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = 'g-overlay';
    o.innerHTML = '<div class="modal ' + (cls || '') + '">' + html + '</div>';
    o.addEventListener('mousedown', ev => { if (ev.target === o && !o.dataset.sticky) closeModal(); });
    document.body.appendChild(o);
    return o.firstChild;
  }
  function closeModal() { const o = document.getElementById('g-overlay'); if (o) o.remove(); }
  function toast(msg, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), bad ? 5000 : 2800);
  }

  /* ---------- navigation ---------- */
  const PAGES = [
    ['index.html', '🏰', 'Accueil'], ['roster.html', '👥', 'Roster'], ['events.html', '⚔️', 'Événements'],
    ['ranking.html', '🎯', 'Classement'], ['history.html', '📜', 'Historique'], ['seasons.html', '🗂️', 'Saisons'],
  ];
  function nav(active) {
    const el = document.getElementById('nav');
    if (!el) return;
    el.className = 'nav';
    el.innerHTML = '<div class="nav-in"><a class="brand" href="index.html"><img class="crest-img" src="assets/lion.png?v=2" alt="" width="34" height="34">' + esc(cfg.NAME || 'Guilde') + '</a>' +
      '<nav class="links">' + PAGES.map(p => '<a href="' + p[0] + '" class="' + (p[0] === active ? 'on' : '') + '"><span class="ic">' + p[1] + '</span> ' + p[2] + '</a>').join('') + '</nav>' +
      '<div class="me">' + (isOfficer() ? '<button class="btn small" id="me-out" title="Se déconnecter">🔓 Quitter</button>' : '') + '</div></div>';
    const out = el.querySelector('#me-out'), inn = el.querySelector('#me-in');
    if (out) out.onclick = logout;
    if (inn) inn.onclick = () => login().then(() => location.reload()).catch(() => {});
    document.documentElement.style.setProperty('--navh', el.offsetHeight + 'px');
    window.addEventListener('resize', () => document.documentElement.style.setProperty('--navh', el.offsetHeight + 'px'));
    if (!document.getElementById('busybar')) { const bar = document.createElement('div'); bar.id = 'busybar'; document.body.appendChild(bar); }
  }

  /* ---------- prochain raid (d'après le planning) ---------- */
  function nextRaid(now) {
    now = now || new Date();
    let best = null;
    (cfg.SCHEDULE || []).forEach(s => {
      const [h, m] = String(s.time).split(':').map(Number);
      for (let add = 0; add < 8; add++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, h, m || 0);
        if (d.getDay() !== s.day) continue;
        const [eh, em] = String(s.end || '23:59').split(':').map(Number);
        let end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em || 0);
        if (end <= d) end = new Date(end.getTime() + 86400000);
        if (end < now) continue; // déjà fini
        if (!best || d < best.start) best = { start: d, end, label: s.label, time: s.time, name: s.name, today: add === 0 || d.toDateString() === now.toDateString(), live: d <= now && now <= end };
        break;
      }
    });
    return best;
  }

  /* ---------- règles de points (même calcul que le serveur, pour l'aperçu) ---------- */
  function outcome(rules, pt, p) {
    const notes = [];
    let points = pt.points, hr = pt.hr, hors = pt.hors, attended = false;
    if (p.status === 'noshow') {
      const np = rules.noshowPenalty || rules.penalty;
      points = Math.max(0, points - np);
      notes.push('No-show : -' + np);
    } else {
      attended = true;
      hors += p.loot;
      if (p.loot) notes.push('Loot hors SR : +' + p.loot);
      if (p.sr) { points = 0; notes.push('SR obtenu : points à 0'); }
      else if (p.hr) { if (rules.hrResetsPoints) { points = 0; notes.push('HR obtenue : points à 0'); } else notes.push('HR obtenue : points conservés'); }
      else { points += rules.bonus; notes.push('+' + rules.bonus + ' points'); }
      if (p.hr) { if (hr > 0) { hr -= 1; notes.push('HR utilisée'); } else notes.push('HR obtenue sans HR en attente'); }
      if (p.status === 'retard') { points = Math.max(0, points - rules.penalty); notes.push('Retard : -' + rules.penalty); }
    }
    if (points >= rules.threshold) { hr += 1; points = 0; notes.push(rules.threshold + ' points : HR gagnée, compteur à 0'); }
    return { points, hr, hors, attended, notes };
  }

  /* ---------- historique : affichage d'un raid ---------- */
  const G_LINES = [
    { k: 'sr', emoji: '🎯', label: 'SR obtenu' }, { k: 'hr', emoji: '✨', label: 'HR obtenue' },
    { k: 'hrEarned', emoji: '🌟', label: 'HR gagnée' }, { k: 'bonus', emoji: '📈', label: '' },
    { k: 'retard', emoji: '⏰', label: 'Retard' }, { k: 'noshow', emoji: '❌', label: 'No-show' },
  ];
  const pills = list => '<div class="pills">' + list.map(n => '<span class="pill">' + esc(n) + '</span>').join('') + '</div>';
  function groupHtml(g, i, open) {
    if (g.kind === 'correction') {
      return '<div class="card corr"><div class="row"><b class="grow">🔧 Correction · ' + esc(g.key) + (g.season ? ' <span class="tag season">' + esc(g.season) + '</span>' : '') + '</b><span class="muted small">' + esc(fmtWhen(g.when)) + '</span></div>' +
        '<div class="muted small">' + esc(g.before) + ' → ' + esc(g.after) + '</div></div>';
    }
    let lines = '';
    G_LINES.forEach(d => {
      const list = g[d.k];
      if (!list || !list.length) return;
      const label = d.k === 'bonus' ? '+' + (g.bonusValue || 10) + ' points' : d.label;
      lines += '<div class="gl"><span class="gl-h">' + d.emoji + ' ' + esc(label) + ' <span class="muted">(' + list.length + ')</span></span>' + pills(list) + '</div>';
    });
    if (g.loot.length) lines += '<div class="gl"><span class="gl-h">🎁 Loot hors SR</span>' + pills(g.loot.map(l => l.key + ' ×' + l.n)) + '</div>';
    const details = open ? '<div class="hist">' + g.entries.map(e =>
      '<div class="entry"><div class="row"><b class="grow">' + esc(e.key) + ' · ' + esc(e.action) + '</b><span class="muted small">' + esc(fmtWhen(e.when)) + '</span></div>' +
      '<div class="muted small">' + esc(e.before) + ' → ' + esc(e.after) + '</div></div>').join('') + '</div>' : '';
    return '<div class="card gcard"><div class="row"><b class="grow">📅 ' + esc(g.name) + (g.season ? ' <span class="tag season">' + esc(g.season) + '</span>' : '') + '</b><span class="muted small">' + esc(fmtDay(g.date)) + '</span></div>' +
      '<div class="muted small">' + g.count + ' joueur' + (g.count > 1 ? 's' : '') + ' · clôturé le ' + esc(fmtWhen(g.when)) + '</div>' + lines +
      '<div class="row" style="margin-top:10px"><span class="grow"></span><button class="btn small" data-g="' + i + '">' + (open ? 'Masquer les détails' : 'Détails') + '</button></div>' + details + '</div>';
  }

  /* ---------- roster : formulaire membre (partagé) ---------- */
  function suggestRole(classe, spe) {
    const c = norm(classe), s = norm(spe);
    if (s === 'protection') return 'tank';
    if (s === 'discipline' || s === 'restauration') return 'soigneur';
    if (s === 'sacre') return (c === 'paladin' || c === 'pretre') ? 'soigneur' : 'dps';
    return 'dps';
  }
  const statutNorm = m => { const s = norm(m.statut); return s === 'essai' ? 'essai' : s.indexOf('remplac') === 0 ? 'remplacant' : 'titulaire'; };

  return { cfg, ROLE, esc, norm, classColor, pad, isoDay, todayIso, fmtDay, fmtWhen, errMsg, get, post, swr, getCode, isOfficer, login, ensureOfficer,
    logout, modal, closeModal, toast, nav, nextRaid, outcome, groupHtml, suggestRole, statutNorm };
})();
