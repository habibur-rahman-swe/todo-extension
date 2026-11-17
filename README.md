# Daily Todo

A Chrome extension that opens a daily todo list when the browser starts. Item text stays in the list. Checkmarks reset when the local calendar day changes.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.

The toolbar icon is **Daily Todo**. On install and on each browser startup, the extension opens `popup.html` in its own window (420×600). If that window is already open, including minimized, it is focused instead of duplicated. Closing the window leaves it closed until the next startup.

The same page is the toolbar popup (360px wide). A wider standalone window fills the page.

## Using the list

- Click **+ New task** to open the add form. Enter a task, optionally add a link or local folder path, pick **Office Work**, **Course**, **Learning**, or **Problem**, then press **Add** or Enter. Use **Cancel** or `Esc` to close the form.
- Each task shows its name. Click the task name to reveal its link (if present); click the link to open it in a browser tab (web URLs, `file://` URLs, and local paths are supported).
- Click the **✎** button on a task to edit its text, link, and category in place. Press **Save** or Enter to apply, or **Cancel** / `Esc` to discard. The edit form opens inside the task row; clicking elsewhere on the row while editing is ignored.
- Drag the grip on the left of a task to move it. The list stays in that order. A category filter reorders only the tasks you can see.
- Filter the list with **All**, **Office Work**, **Course**, **Learning**, or **Problem**. The progress bar and the `done / total` count always cover every item.
- **Office Work** tasks are marked in red. Checking a task leaves it where it is. New tasks are inserted after the last incomplete task.
- Check an item to mark it done. Delete it with **×**. **Reset ticks** unchecks everything. **Clear done** removes finished items.
- The header button collapses the list inside the page. It does not minimize the browser window.

Todos are stored only in `chrome.storage.local` on this device. The extension has no host permissions and does not send data anywhere.

## Storage

Key: `dailyTodoState`.

```json
{
  "lastDay": "2026-11-16",
  "manualOrder": true,
  "items": [
    {
      "id": "id-1731740000000-42",
      "text": "Follow up with team",
      "category": "office",
      "done": false,
      "link": "https://example.com"
    }
  ]
}
```

`lastDay` is the local date `YYYY-MM-DD`. On startup, on install, when the popup loads, when it becomes visible, and at local midnight, a new day sets every `done` flag to `false` and updates `lastDay`. Text, id, category, link, and order stay.

`manualOrder` is set the first time the list loads. That first load keeps the previous arrangement (incomplete tasks, with Office Work above other categories, then completed tasks) and saves it. After that, the `items` array is the on-screen order.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3. Permissions: `storage`, `windows`. |
| `background.js` | Daily reset and popup-window lifecycle. |
| `popup.html` | List markup. |
| `popup.css` | List styles. |
| `popup.js` | Render, add, edit, reorder, filter, toggle, delete, reset, and clear. |
| `icon16.png`, `icon48.png`, `icon128.png` | Toolbar and extension icons. |

Category values are `office`, `course`, `learning`, and `problem`. Legacy items with unknown categories fall back to `course`.
