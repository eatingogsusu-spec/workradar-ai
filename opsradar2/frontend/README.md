# OpsRadar Frontend Base

This folder keeps the current HTML frontend running while reducing merge
conflicts. The first rule is simple: do not keep adding feature logic to
`index.html`.

## File Roles

- `index.html`: app shell, static screen markup, modal roots, CSS/JS imports
- `css/theme.css`: colors, fonts, shared variables
- `css/layout.css`: sidebar, header, page layout
- `css/components.css`: cards, modals, buttons, badges, feature styles
- `js/app.js`: legacy bootstrap, navigation, shared globals still being split
- `js/api-integration.js`: backend API calls and API-to-UI normalization
- `js/storage.js`: localStorage keys, JSON helpers, auth/session cleanup
- `js/dashboard.js`: Dashboard feature ownership
- `js/todo.js`: Todo feature ownership and Todo data contract
- `js/issue.js`: Issue feature ownership
- `js/calendar.js`: Calendar feature ownership
- `js/handoff.js`: Handoff/knowledge feature ownership
- `js/report.js`: Report feature ownership
- `js/assistant.js`: AI Assistant feature ownership
- `js/settings.js`: Settings, profile, theme ownership

## Loading Order

Scripts are loaded in this order:

1. `js/app.js`
2. `js/api-integration.js`
3. `js/storage.js`
4. feature modules

`app.js` still contains legacy functions, but every feature module is loaded and
registered through `window.OpsRadarFrontend.modules`. When moving logic out of
`app.js`, move one feature at a time and keep the existing global function name
until the inline HTML handlers are removed.

## Team Rules

1. Keep direct edits to `index.html` minimal.
2. Do not add new feature logic to `js/app.js`; move or add it in the matching
   `js/<feature>.js` file.
3. Put shared component styles in `css/components.css`.
4. Put colors and theme tokens in `css/theme.css`.
5. Manage API calls only in `js/api-integration.js`.
6. Manage localStorage keys only in `js/storage.js`.
7. If a feature needs a new shared data field, document it in the owning module
   before using it in another screen.

## Shared Todo Shape

Todo-facing screens should converge on this shape:

```js
{
  id,
  title,
  description,
  assignees,
  priority,
  status,
  dueDate,
  relatedIssue,
  source,
  sourceType,
  tags,
  createdAt,
  updatedAt
}
```

## Next Split Targets

- Move Todo functions listed in `js/todo.js` out of `js/app.js`.
- Move Calendar functions listed in `js/calendar.js` out of `js/app.js`.
- Replace inline `onclick` handlers in `index.html` with event binding in the
  owning module.
