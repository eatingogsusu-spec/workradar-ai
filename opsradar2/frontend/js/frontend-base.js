// Frontend base registry for the HTML-based OpsRadar app.
(function () {
  const existing = window.OpsRadarFrontend || {};
  const modules = existing.modules || {};
  const contracts = existing.contracts || {};

  const featureOwners = Object.freeze({
    dashboard: "js/dashboard.js",
    todo: "js/todo.js",
    issue: "js/issue.js",
    calendar: "js/calendar.js",
    handoff: "js/handoff.js",
    report: "js/report.js",
    assistant: "js/assistant.js",
    settings: "js/settings.js",
  });

  const screens = Object.freeze({
    dashboard: "s-dashboard",
    analysis: "s-analysis",
    todo: "s-todo",
    issues: "s-issues",
    calendar: "s-calendar",
    knowledge: "s-knowledge",
    reports: "s-reports",
    chat: "s-chat",
    settings: "s-settings",
  });

  function registerModule(name, module) {
    if (!name) return null;
    modules[name] = {
      name,
      file: featureOwners[name] || module?.file || null,
      loadedAt: new Date().toISOString(),
      ...(module || {}),
    };
    return modules[name];
  }

  function registerContract(name, contract) {
    if (!name) return null;
    contracts[name] = Object.freeze({ ...(contract || {}) });
    return contracts[name];
  }

  function expose(name, api) {
    if (!name || !api) return api;
    window[name] = Object.assign(window[name] || {}, api);
    return window[name];
  }

  function getState() {
    return window.G || null;
  }

  window.OpsRadarFrontend = {
    ...existing,
    modules,
    contracts,
    featureOwners,
    screens,
    registerModule,
    registerContract,
    expose,
    getState,
  };

  registerContract("todo", {
    fields: [
      "id",
      "title",
      "description",
      "assignees",
      "priority",
      "status",
      "dueDate",
      "relatedIssue",
      "source",
      "sourceType",
      "tags",
      "createdAt",
      "updatedAt",
    ],
    statuses: ["pending", "approved", "done", "rejected"],
    priorities: ["high", "medium", "low"],
  });
})();
