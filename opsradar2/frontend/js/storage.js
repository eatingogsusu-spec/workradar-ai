(function () {
  const keys = Object.freeze({
    accessToken: 'access_token',
    legacyToken: 'token',
    role: 'role',
    user: 'user',
    theme: 'theme',
    skin: 'opsradar-skin',
    reports: 'opsradar_reports_v1',
    chatSessions: 'opsradar_chat_sessions_v1',
    currentChatSession: 'opsradar_current_chat_session_v1',
    todoFallback: 'opsradar_todos_v1',
    issueFallback: 'opsradar_issues_v1',
    calendarFallback: 'opsradar_calendar_v1',
  });

  function get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getJson(key, fallback = null) {
    const raw = get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearSession() {
    [keys.accessToken, keys.legacyToken, keys.role, keys.user].forEach(remove);
  }

  window.opsRadarStorage = {
    keys,
    get,
    set,
    remove,
    getJson,
    setJson,
    clearSession,
  };

  window.OpsRadarFrontend?.registerModule('storage', {
    file: 'js/storage.js',
    owns: ['localStorage keys', 'JSON fallback helpers', 'session storage cleanup'],
  });
})();
