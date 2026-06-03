# OpsRadar Frontend Base

This folder keeps the existing HTML frontend behavior while reducing merge conflicts.

## File roles

- index.html: app shell and asset imports only
- css/theme.css: colors, fonts, shared variables
- css/layout.css: sidebar, header, page layout
- css/components.css: cards, modals, buttons, badges, feature styles
- js/app.js: existing app initialization and screen behavior
- js/api-integration.js: backend API calls
- js/storage.js: localStorage keys and fallback logic
- js/dashboard.js: Dashboard feature area
- js/todo.js: Todo feature area
- js/issue.js: Issue feature area
- js/calendar.js: Calendar feature area
- js/handoff.js: Handoff feature area
- js/report.js: Report feature area
- js/assistant.js: AI Assistant feature area
- js/settings.js: Settings and theme area

## Team rules

1. Keep direct edits to index.html minimal.
2. Put feature logic in js/<feature>.js.
3. Put shared component styles in css/components.css.
4. Put colors and theme tokens in css/theme.css.
5. Manage API calls in js/api-integration.js.
6. Manage localStorage keys in js/storage.js.
