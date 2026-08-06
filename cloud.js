window.MoldCloud = (() => {
  const $ = selector => document.querySelector(selector);
  const config = window.MOLDFLOW_CONFIG || {};
  const enabled = Boolean(config.supabaseUrl && config.supabaseKey);
  const workspaceKey = config.workspaceKey || 'expedit';
  const sessionKey = 'toolmanagerSession';
  const legacySessionKey = 'moldflowSession';
  const modifiedKey = 'mouldOpsDataFrModifiedAt';
  let session = JSON.parse(localStorage.getItem(sessionKey) || localStorage.getItem(legacySessionKey) || 'null');
  let member = null;
  let pushTimer = null;

  const auth = $('#authBackdrop');
  const error = $('#authError');
  const status = $('#syncStatus');
  const signupButton = $('#signupBtn');
  const localButton = $('#localModeBtn');
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

  function storeSession(nextSession) {
    session = nextSession;
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.removeItem(legacySessionKey);
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    try {
      const refreshed = await rawRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      storeSession(refreshed);
      return true;
    } catch {
      session = null;
      member = null;
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

  async function loadMember() {
    if (!session?.user?.id) return null;
    const rows = await request(`/rest/v1/toolmanager_members?user_id=eq.${encodeURIComponent(session.user.id)}&select=role,display_name,email,active&limit=1`);
    member = rows?.[0] || null;
    if (!member?.active) throw new Error('Compte non autorisé. Contactez XING ZHAO.');
    window.dispatchEvent(new CustomEvent('toolmanager-role-ready', {
      detail: { role: member.role, user: session.user, member }
    }));
    return member;
  }

  async function pullRecord() {
    if (!enabled || !session || !member) return null;
    const rows = await request(`/rest/v1/toolmanager_state?workspace_key=eq.${encodeURIComponent(workspaceKey)}&select=data,updated_at&limit=1`);
    return rows?.[0] || null;
  }

  async function pushNow(payload, modifiedAt = new Date().toISOString()) {
    if (!enabled || !session || member?.role !== 'admin') return false;
    setStatus('Synchronisation…');
    await request('/rest/v1/toolmanager_state?on_conflict=workspace_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        workspace_key: workspaceKey,
        data: payload,
        updated_at: modifiedAt,
        updated_by: session.user.id
      })
    });
    localStorage.setItem(modifiedKey, modifiedAt);
    setStatus('Synchronisé · Administrateur', 'online');
    return true;
  }

  async function chooseLatest(localData) {
    try {
      const remote = await pullRecord();
      const localModified = localStorage.getItem(modifiedKey);
      if (!remote) {
        if (member?.role === 'admin') await pushNow(localData, localModified || new Date().toISOString());
        return localData;
      }
      const remoteIsEmpty = remote.data == null
        || (typeof remote.data === 'object' && !Array.isArray(remote.data) && Object.keys(remote.data).length === 0);
      const localHasData = localData != null
        && (typeof localData !== 'object' || Array.isArray(localData) || Object.keys(localData).length > 0);
      // A new workspace is created with an empty JSON object. On the first
      // administrator login, seed it with the existing local application data.
      if (member?.role === 'admin' && remoteIsEmpty && localHasData) {
        await pushNow(localData, localModified || new Date().toISOString());
        return localData;
      }
      if (member?.role === 'admin' && localModified && new Date(localModified) > new Date(remote.updated_at)) {
        await pushNow(localData, localModified);
        return localData;
      }
      localStorage.setItem(modifiedKey, remote.updated_at);
      setStatus(member?.role === 'admin' ? 'Synchronisé · Administrateur' : 'Mode lecture seule', member?.role === 'admin' ? 'online' : 'readonly');
      return remote.data;
    } catch (syncError) {
      if (!session) {
        setStatus('Session expirée · reconnectez-vous', 'error');
        showLogin();
      } else {
        setStatus(syncError.message || 'Accès refusé', 'error');
      }
      return localData;
    }
  }

  async function login(email, password) {
    error.textContent = '';
    try {
      const nextSession = await rawRequest('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      storeSession(nextSession);
      await loadMember();
      auth.classList.remove('open');
      const localData = JSON.parse(localStorage.getItem('mouldOpsDataFr') || 'null');
      const latest = await chooseLatest(localData);
      window.dispatchEvent(new CustomEvent('moldflow-cloud-ready', { detail: latest }));
    } catch (loginError) {
      error.textContent = loginError.message;
      setStatus('Accès non autorisé', 'error');
    }
  }

  async function logout() {
    if (pushTimer) await new Promise(resolve => setTimeout(resolve, 650));
    const accessToken = session?.access_token;
    try {
      if (enabled && accessToken) {
        await rawRequest('/auth/v1/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    } catch {
      // La session locale doit toujours être fermée, même hors connexion.
    }
    clearTimeout(pushTimer);
    pushTimer = null;
    session = null;
    member = null;
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(legacySessionKey);
    const authForm = $('#authForm');
    if (authForm) authForm.reset();
    error.textContent = '';
    setStatus('Déconnecté · connexion requise', 'error');
    showLogin();
    window.dispatchEvent(new CustomEvent('toolmanager-logged-out'));
  }

  function push(payload) {
    if (!enabled || !session || member?.role !== 'admin') return;
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
    signupButton.hidden = true;
    localButton.hidden = true;
    if (!session) {
      showLogin();
      return localData;
    }
    try {
      await loadMember();
      return chooseLatest(localData);
    } catch (accessError) {
      setStatus(accessError.message || 'Accès non autorisé', 'error');
      showLogin();
      return localData;
    }
  }

  $('#authForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    login(form.get('email'), form.get('password'));
  };
  signupButton.onclick = () => {
    error.textContent = 'Les comptes sont créés uniquement sur invitation.';
  };
  localButton.onclick = () => auth.classList.remove('open');
  status.onclick = () => { if (enabled && !session) showLogin(); };

  return {
    start,
    push,
    logout,
    showLogin,
    enabled,
    canWrite: () => !enabled || member?.role === 'admin',
    getRole: () => member?.role || (enabled ? null : 'admin')
  };
})();
