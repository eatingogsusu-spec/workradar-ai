// Copy this file pattern when creating a new feature module.
(function () {
  const featureName = "feature-name";

  window.OpsRadarFrontend?.registerModule(featureName, {
    file: "js/feature-name.js",
    screen: "matching-screen-name",
    owns: [
      "what this module renders",
      "what user actions this module handles",
      "what data shape this module owns",
    ],
    legacyGlobals: [
      "globalFunctionKeptForExistingInlineHandlers",
    ],
  });

  function initFeatureName() {
    // Bind event listeners here after moving inline onclick handlers.
  }

  // Keep legacy global names until index.html inline handlers are removed.
  window.initFeatureName = initFeatureName;
})();
