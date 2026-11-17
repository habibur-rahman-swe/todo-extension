---
name: daily-todo
description: >-
  Maintain the Daily Todo Chrome extension (Manifest V3, popup UI, service
  worker, chrome.storage.local). Use when editing this repository or
  popup.html, popup.css, popup.js, background.js, or manifest.json, and when
  the user mentions daily todos, category chips, filters, the progress bar,
  day reset, or the startup popup window.
---

# Daily Todo

Manifest V3 Chrome extension. A standalone popup window opens when the browser starts. Todo text persists. Checkmarks reset when the local calendar day changes.

Read the file you are changing before editing. Keep `popup.html`, `popup.css`, and `popup.js` on the same element ids and class names.

## Layout

- `manifest.json` — MV3. Permissions: `storage`, `windows`. Action popup: `popup.html`. Service worker: `background.js`. Icons: `icon16.png`, `icon48.png`, `icon128.png`.
- `background.js` — day reset and popup window lifecycle. No DOM access.
- `popup.html`, `popup.css`, `popup.js` — the list. This page is both the toolbar popup and the standalone window.

## Storage

Key: `dailyTodoState` in `chrome.storage.local`.

```js
{
  lastDay: "YYYY-MM-DD", // local calendar date
  manualOrder: true, // array order is the list order
  items: [
    {
      id: "id-<Date.now()>-<0-999>",
      text: string,
      category: "office" | "course" | "learning" | "problem",
      done: boolean
    }
  ]
}
```

## Order

The `items` array is the on-screen order. When `manualOrder` is missing, sort once (incomplete before done, Office Work before other categories, then the existing order), set `manualOrder` to true, and save. Later renders use the stored array.

Each row has a `.drag-handle`. Dragging it lifts that row and slides the others into the new order, then writes that order back into `items`. Rows hidden by the filter keep their places. New items are inserted after the last incomplete item, or at the start when every item is done.

Office Work rows still use the priority style. Checking an item does not move it.

`STORAGE_KEY` and `getTodayKey()` are duplicated in `popup.js` and `background.js`. Change both together.

Chip, filter, and badge text is Office Work, Course, Learning, and Problem. Stored values stay `office`, `course`, `learning`, and `problem`. Unknown categories save as `course`.

New items use `done: false`. Skip blank text.

## Day reset

`resetIfNewDay()` in `background.js` runs from `openPopupAuto()`. `ensureToday()` in `popup.js` runs on load, when the page becomes visible, at local midnight, and before each edit.

When `lastDay` is not today:

1. Set `lastDay` to today (`YYYY-MM-DD`, local timezone).
2. Set every `item.done` to `false`.
3. Leave `id`, `text`, `category`, `link`, and order as they are.

Update `lastDay` only on that reset path. Guard a missing `items` array before mapping.

## Popup window

Constants in `background.js`: URL `chrome.runtime.getURL("popup.html")`, 420×600, type `popup`, focused.

- `chrome.runtime.onStartup` and `onInstalled` call `openPopupAuto()`.
- Any popup window with that URL counts, including a minimized one. Focus it and set `state` to `normal`. Leave it as the only popup.
- Closing the window leaves it closed until the next browser startup.
- If `chrome.windows.create` throws, log the error and call `chrome.action.openPopup()`. Log that failure too. `action.openPopup` only succeeds from a user gesture, so startup depends on `windows.create`.

`#toggleBtn` toggles the class `body.minimized`. That collapse is in-page only. It must not call `chrome.windows.update`. Collapsed mode hides `.progress-wrap`, `.add-row`, `.filters`, `.todo-list`, `.empty-state`, and `.footer`.

## UI contract

| id | Role |
| --- | --- |
| `dateLabel` | Local date, `Sun Nov 16` |
| `toggleBtn` | Collapse to the top bar. `aria-expanded` matches the open list |
| `progressWrap` | Progressbar for done / total, `aria-valuenow` 0–100 |
| `progressBar` | Width percent of done / total |
| `todoInput` | New item text |
| `categoryChips` | Buttons with `data-cat`: `course`, `learning`, `problem` |
| `addBtn` | Add the trimmed input and the active chip |
| `filterTabs` | Buttons with `data-filter`: `all`, `course`, `learning`, `problem` |
| `todoList` | Rendered rows |
| `emptyState` | Shown when the visible list is empty. `#emptyText` explains an empty list or an empty filter |
| `stats` | `N / M done` for every stored item |
| `resetBtn` | Set every `done` to `false` |
| `clearCheckedBtn` | Remove items with `done: true` |

The active category is `.chip.active` (`aria-pressed`). Add and Enter use its `data-cat`. Default `course`.

The active filter is `.filter.active`. `render()` applies it before deciding the list is empty. Progress and stats ignore the filter and still update when every item is filtered out or the stored list is empty (`0 / 0 done`, 0% bar).

Each row is a `label.todo-main` (checkbox + `.todo-text`), a `.badge` with `data-cat`, and `.delete-btn` with `aria-label="Delete"`. Badge colors follow `data-cat`: course, learning, problem.

## Editing rules

- Stay on Manifest V3 and `chrome.storage.local`. Add a host permission only when a feature needs the network.
- Keep day-reset and window logic in `background.js`. Keep list editing in `popup.js`.
- After popup changes, load the unpacked extension and check add, chip selection, each filter, toggle, delete, reset ticks, clear done, collapse, an empty list, and a stored `lastDay` from a previous date.
