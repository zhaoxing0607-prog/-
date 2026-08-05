window.MoldCloud = (() => {
  const $ = selector => document.querySelector(selector);
  const config = window.MOLDFLOW_CONFIG || {};
  const enabled = Boolean(config.supabaseUrl && config.supabaseKey);
  const sessionKey = 'moldflowSession';
  const modifiedKey = 'mouldOpsDataFrModifiedAt';
  let session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
  let pushTimer = null;

  const auth = $('#authBackdrop');
  const error = $('#authError');
  const status = $('#syncStatus');
  const setStatus = (text, state = '') => {
    status.textContent = text;
    status.className = `sync-status ${state}`;
  };
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    apikey: config.supabaseKey,
    Authorization: `Bearer ${session?.access_token || config.supabaseKey}`
  });

  async function rawRequest(path, options = {}) {
    const response = await fetch(config.supabaseUrl + path, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      const requestError = new Error(body?.msg || body?.message || body?.error_description || 'Erreur réseau');
      requestError.status = response.status;
      throw requestError;
    }
    return body;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    try {
      const refreshed = await rawRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      session = refreshed;
      localStorage.setItem(sessionKey, JSON.stringify(session));
      return true;
    } catch {
      session = null;
      localStorage.removeItem(sessionKey);
      return false;
    }
  }

  async function request(path, options = {}, retry = true) {
    try {
      return await rawRequest(path, options);
    } catch (requestError) {
      if (retry && requestError.status === 401 && await refreshSession()) {
        return request(path, options, false);
      }
      throw requestError;
    }
  }

  async function pullRecord() {
    if (!enabled || !session) return null;
    const rows = await request('/rest/v1/moldflow_state?select=data,updated_at&limit=1');
    return rows?.[0] || null;
  }

  async function pushNow(payload, modifiedAt = new Date().toISOString()) {
    if (!enabled || !session) return false;
    setStatus('Synchronisation…');
    await request('/rest/v1/moldflow_state', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: session.user.id, data: payload, updated_at: modifiedAt })
    });
    localStorage.setItem(modifiedKey, modifiedAt);
    setStatus('Synchronisé', 'online');
    return true;
  }

  async function chooseLatest(localData) {
    try {
      const remote = await pullRecord();
      const localModified = localStorage.getItem(modifiedKey);
      if (!remote) {
        await pushNow(localData, localModified || new Date().toISOString());
        return localData;
      }
      if (localModified && new Date(localModified) > new Date(remote.updated_at)) {
        await pushNow(localData, localModified);
        return localData;
      }
      localStorage.setItem(modifiedKey, remote.updated_at);
      setStatus('Synchronisé', 'online');
      return remote.data;
    } catch {
      if (!session) {
        setStatus('Session expirée · reconnectez-vous', 'error');
        showLogin();
      } else {
        setStatus('Hors connexion · sauvegarde locale', 'error');
      }
      return localData;
    }
  }

  async function login(email, password, signup = false) {
    error.textContent = '';
    try {
      const path = signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
      session = await rawRequest(path, { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!session.access_token && signup) {
        error.textContent = 'Consultez votre e-mail pour confirmer le compte.';
        return;
      }
      localStorage.setItem(sessionKey, JSON.stringify(session));
      auth.classList.remove('open');
      const localData = JSON.parse(localStorage.getItem('mouldOpsDataFr') || 'null');
      const latest = await chooseLatest(localData);
      window.dispatchEvent(new CustomEvent('moldflow-cloud-ready', { detail: latest }));
    } catch (loginError) {
      error.textContent = loginError.message;
    }
  }

  function push(payload) {
    if (!enabled || !session) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        const modifiedAt = localStorage.getItem(modifiedKey) || new Date().toISOString();
        await pushNow(payload, modifiedAt);
      } catch {
        setStatus('Hors connexion · sauvegarde locale', 'error');
      }
    }, 500);
  }

  function showLogin() { auth.classList.add('open'); }

  async function start(localData) {
    if (!enabled) {
      setStatus('Mode local · cloud non configuré');
      return localData;
    }
    if (!session) {
      showLogin();
      return localData;
    }
    return chooseLatest(localData);
  }

  $('#authForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    login(form.get('email'), form.get('password'));
  };
  $('#signupBtn').onclick = () => {
    const form = new FormData($('#authForm'));
    login(form.get('email'), form.get('password'), true);
  };
  $('#localModeBtn').onclick = () => auth.classList.remove('open');
  status.onclick = () => { if (enabled && !session) showLogin(); };

  return { start, push, showLogin, enabled };
})();
