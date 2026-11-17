const STORAGE_KEY = "dailyTodoState";
const CATEGORIES = ["office", "course", "learning", "others"];
const PRIORITY_CATEGORY = "office";

const $ = (id) => document.getElementById(id);

const categoryLabels = {
  office: "Office Work",
  course: "Course",
  learning: "Learning",
  others: "Others",
};

let activeCategory = "office";
let activeFilter = "all";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

function validCategory(category) {
  return CATEGORIES.includes(category) ? category : "course";
}

function normalize(state) {
  return {
    lastDay: state && state.lastDay ? state.lastDay : getTodayKey(),
    manualOrder: !!(state && state.manualOrder),
    items: (state && Array.isArray(state.items) ? state.items : []).map((item) => ({
      id: item && item.id ? item.id : "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      text: item && typeof item.text === "string" ? item.text : "",
      category: validCategory(item && item.category),
      done: !!(item && item.done),
      link: item && typeof item.link === "string" ? item.link.trim() : "",
    })),
  };
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const state = normalize(result[STORAGE_KEY]);
  // Keep the old pinned order the first time, then leave the array as the user arranged it.
  if (!state.manualOrder) {
    state.items = sortItems(state.items);
    state.manualOrder = true;
    await saveState(state);
  }
  return state;
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function ensureToday(state) {
  const today = getTodayKey();
  if (state.lastDay === today) return state;
  state.lastDay = today;
  state.items = state.items.map((item) => ({ ...item, done: false }));
  await saveState(state);
  return state;
}

function sortItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ad = a.item.done ? 1 : 0;
      const bd = b.item.done ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const ap = a.item.category === PRIORITY_CATEGORY ? 0 : 1;
      const bp = b.item.category === PRIORITY_CATEGORY ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function visibleItems(items) {
  if (activeFilter === "all") return items;
  return items.filter((item) => item.category === activeFilter);
}

function reorderVisibleItems(items, visibleIds) {
  const visibleSet = new Set(visibleIds);
  if (visibleSet.size !== visibleIds.length) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const queue = [];
  for (const id of visibleIds) {
    const item = byId.get(id);
    if (!item) return items;
    queue.push(item);
  }
  let changed = false;
  const next = items.map((item) => {
    if (!visibleSet.has(item.id)) return item;
    const replacement = queue.shift();
    if (replacement !== item) changed = true;
    return replacement;
  });
  return changed ? next : items;
}

function indexForNewItem(items) {
  let lastOpen = -1;
  items.forEach((item, index) => {
    if (!item.done) lastOpen = index;
  });
  return lastOpen + 1;
}

function render(state) {
  const items = state.items || [];
  const visible = visibleItems(items);
  const doneCount = items.filter((item) => item.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  $("dateLabel").textContent = formatDate(new Date());
  $("stats").textContent = `${doneCount} / ${total} done`;
  $("progressBar").style.width = `${pct}%`;

  const progress = $("progressWrap");
  progress.setAttribute("aria-valuenow", String(pct));
  progress.setAttribute("aria-label", `${doneCount} of ${total} done`);

  const list = $("todoList");
  list.innerHTML = "";

  const empty = $("emptyState");
  const emptyText = $("emptyText");
  if (visible.length === 0) {
    empty.hidden = false;
    if (items.length === 0) {
      emptyText.innerHTML = "No todos yet.<br />Add one above to get started.";
    } else {
      emptyText.textContent = "Nothing in this filter.";
    }
    return;
  }

  empty.hidden = true;

function normalizeLinkUrl(link) {
  const value = (link || "").trim();
  if (!value) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    if (/^[a-zA-Z]:[\\/]/.test(value)) {
      return "file:///" + value.replace(/\\/g, "/").replace(/ /g, "%20");
    }
    return value;
  }
  if (/^\\\\/.test(value)) {
    return "file:" + value.replace(/\\/g, "/").replace(/ /g, "%20");
  }
  if (/^[\\/]/.test(value)) {
    return "file://" + value.replace(/\\/g, "/").replace(/ /g, "%20");
  }
  return value;
}

async function openLink(link) {
  const url = normalizeLinkUrl(link);
  if (!url) return;
  try {
    if (chrome.tabs && chrome.tabs.create) {
      await chrome.tabs.create({ url });
      return;
    }
  } catch (error) {
    console.error("Failed to open link in tab", error);
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

  visible.forEach((item) => {
    const li = document.createElement("li");
    const category = validCategory(item.category);
    if (item.done) li.classList.add("done");
    if (category === PRIORITY_CATEGORY) li.classList.add("priority");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!item.done;
    checkbox.setAttribute("aria-label", "Mark done");
    checkbox.addEventListener("change", () => toggleDone(item.id));

    const content = document.createElement("div");
    content.className = "todo-content";

    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "todo-text-btn";
    nameBtn.textContent = item.text;

    const linkValue = typeof item.link === "string" ? item.link.trim() : "";
    const linkRow = document.createElement("div");
    linkRow.className = "todo-link-row";
    linkRow.hidden = true;
    if (linkValue) {
      const linkBtn = document.createElement("button");
      linkBtn.type = "button";
      linkBtn.className = "todo-link";
      linkBtn.textContent = linkValue;
      linkBtn.title = "Open link";
      linkBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openLink(linkValue);
      });
      linkRow.appendChild(linkBtn);
      nameBtn.addEventListener("click", () => {
        linkRow.hidden = !linkRow.hidden;
      });
    } else {
      nameBtn.classList.add("no-link");
    }

    content.appendChild(nameBtn);
    content.appendChild(linkRow);

    const main = document.createElement("div");
    main.className = "todo-main";
    main.appendChild(checkbox);
    main.appendChild(content);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.dataset.cat = category;
    badge.textContent = categoryLabels[category] || category;

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.type = "button";
    del.textContent = "×";
    del.title = "Delete";
    del.setAttribute("aria-label", "Delete");
    del.addEventListener("click", () => deleteItem(item.id));

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "✎";
    editBtn.title = "Edit";
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", () => startEdit(item, li));

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.appendChild(editBtn);
    actions.appendChild(del);

    const editRow = document.createElement("div");
    editRow.className = "edit-row";
    editRow.hidden = true;
    editRow.setAttribute("role", "form");
    editRow.setAttribute("aria-label", "Edit task");
    editRow.innerHTML = `
      <input class="edit-text" type="text" placeholder="Task text" autocomplete="off" />
      <input class="edit-link" type="text" placeholder="Link or folder path (optional)" autocomplete="off" />
      <div class="chips edit-chips">
        <button class="chip" type="button" data-cat="office" aria-pressed="false">Office Work</button>
        <button class="chip" type="button" data-cat="course" aria-pressed="false">Course</button>
        <button class="chip" type="button" data-cat="learning" aria-pressed="false">Learning</button>
        <button class="chip" type="button" data-cat="others" aria-pressed="false">Others</button>
      </div>
      <div class="add-actions">
        <button class="add-btn edit-save" type="button">Save</button>
        <button class="cancel-btn edit-cancel" type="button">Cancel</button>
      </div>
    `;

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = "Drag to reorder";
    handle.setAttribute("role", "button");
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.tabIndex = -1;

    li.dataset.id = item.id;
    li.appendChild(handle);
    li.appendChild(main);
    li.appendChild(badge);
    li.appendChild(actions);
    li.appendChild(editRow);
    list.appendChild(li);
  });
}

async function refresh() {
  render(await ensureToday(await loadState()));
}

async function toggleDone(id) {
  const state = await ensureToday(await loadState());
  const item = state.items.find((entry) => entry.id === id);
  if (item) item.done = !item.done;
  await saveState(state);
  render(state);
}

async function deleteItem(id) {
  const state = await ensureToday(await loadState());
  state.items = state.items.filter((item) => item.id !== id);
  await saveState(state);
  render(state);
}

async function addItem(text, category, link) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const state = await ensureToday(await loadState());
  const item = {
    id: "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    text: trimmed,
    category: validCategory(category),
    done: false,
    link: (link || "").trim(),
  };
  state.items.splice(indexForNewItem(state.items), 0, item);
  await saveState(state);
  render(state);
  const row = [...$("todoList").children].find((entry) => entry.dataset.id === item.id);
  if (row) row.scrollIntoView({ block: "nearest" });
}

function startEdit(item, li) {
  const editRow = li.querySelector(".edit-row");
  const textInput = li.querySelector(".edit-text");
  const linkInput = li.querySelector(".edit-link");
  const chips = li.querySelector(".edit-chips");
  if (!editRow || !textInput || !linkInput || !chips) return;

  const nameBtn = li.querySelector(".todo-text-btn");
  const badge = li.querySelector(".badge");
  const actions = li.querySelector(".item-actions");
  const main = li.querySelector(".todo-main");

  textInput.value = item.text;
  linkInput.value = item.link || "";
  setEditChips(chips, item.category);

  editRow.hidden = false;
  actions.hidden = true;
  main.hidden = true;
  badge.hidden = true;
  nameBtn.hidden = true;
  li.classList.add("editing");

  const save = async () => {
    const text = textInput.value.trim();
    const link = linkInput.value.trim();
    if (!text) {
      cancelEdit();
      return;
    }
    const selectedChip = chips.querySelector(".chip.active");
    const category = selectedChip ? selectedChip.dataset.cat : item.category;
    await updateItem(item.id, text, category, link);
  };

  const cancelEdit = () => {
    editRow.hidden = true;
    actions.hidden = false;
    main.hidden = false;
    badge.hidden = false;
    nameBtn.hidden = false;
    li.classList.remove("editing");
  };

  li.querySelector(".edit-save").addEventListener("click", save);
  li.querySelector(".edit-cancel").addEventListener("click", cancelEdit);
  const onKey = (event) => {
    if (event.key === "Escape") {
      cancelEdit();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  };
  textInput.addEventListener("keydown", onKey);
  linkInput.addEventListener("keydown", onKey);
  textInput.focus();
}

function setEditChips(chips, category) {
  chips.querySelectorAll(".chip").forEach((chip) => {
    const on = chip.dataset.cat === validCategory(category);
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

async function updateItem(id, text, category, link) {
  const state = await ensureToday(await loadState());
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  item.text = text;
  item.category = validCategory(category);
  item.link = (link || "").trim();
  await saveState(state);
  render(state);
}

async function clearChecked() {
  const state = await ensureToday(await loadState());
  state.items = state.items.filter((item) => !item.done);
  await saveState(state);
  render(state);
}

async function resetAll() {
  const state = await ensureToday(await loadState());
  state.items = state.items.map((item) => ({ ...item, done: false }));
  await saveState(state);
  render(state);
}

function setPressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((btn) => {
    const on = btn.dataset[attr] === value;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function setCategory(category) {
  activeCategory = validCategory(category);
  setPressed("#categoryChips .chip", "cat", activeCategory);
}

function setFilter(filter) {
  activeFilter = filter === "all" || CATEGORIES.includes(filter) ? filter : "all";
  setPressed("#filterTabs .filter", "filter", activeFilter);
}

function reorderDuration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
}

function layoutTop(el) {
  const transform = getComputedStyle(el).transform;
  const shift = !transform || transform === "none" ? 0 : new DOMMatrix(transform).m42;
  return el.getBoundingClientRect().top - shift;
}

function getDragAfterElement(list, y) {
  const rows = [...list.querySelectorAll("li:not(.dragging):not(.drag-gap)")];
  const gap = list.querySelector(".drag-gap");
  const gapSpan = gap ? gap.offsetHeight + 6 : 0;
  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    let top = layoutTop(row);
    if (gap && (gap.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)) top -= gapSpan;
    const offset = y - (top + row.offsetHeight / 2);
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = row;
    }
  }
  return closest;
}

function slideSiblings(list, mutate) {
  const siblings = [...list.querySelectorAll("li:not(.dragging)")];
  const before = new Map(siblings.map((el) => [el, el.getBoundingClientRect().top]));
  mutate();
  siblings.forEach((el) => {
    el.getAnimations().forEach((animation) => animation.cancel());
    const dy = before.get(el) - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: reorderDuration(), easing: "cubic-bezier(0.2, 0, 0, 1)" }
    );
  });
}

async function persistVisibleOrder() {
  const list = $("todoList");
  const scrollTop = list.scrollTop;
  const visibleIds = [...list.querySelectorAll("li")].map((li) => li.dataset.id);
  const loaded = await loadState();
  const dayChanged = loaded.lastDay !== getTodayKey();
  const state = await ensureToday(loaded);
  const currentIds = visibleItems(state.items).map((item) => item.id);
  const sameLength = visibleIds.length === currentIds.length;
  const sameIds = sameLength && currentIds.every((id) => visibleIds.includes(id));
  const sameOrder = sameLength && visibleIds.every((id, index) => id === currentIds[index]);
  if (!sameIds) {
    render(state);
    list.scrollTop = scrollTop;
    return;
  }
  if (!sameOrder) {
    state.items = reorderVisibleItems(state.items, visibleIds);
    await saveState(state);
  }
  if (dayChanged) {
    render(state);
    $("todoList").scrollTop = scrollTop;
  }
}

function setupReordering() {
  const list = $("todoList");
  let drag = null;

  const placeDragged = (y) => {
    if (!drag) return;
    if (!drag.moved) {
      const rect = drag.li.getBoundingClientRect();
      const next = drag.li.nextElementSibling;
      drag.moved = true;
      drag.grabOffset = y - rect.top;
      drag.height = rect.height;
      drag.li.classList.add("dragging");
      drag.li.style.width = `${rect.width}px`;
      drag.li.style.left = `${rect.left}px`;
      drag.li.style.top = `${rect.top}px`;
      const gap = document.createElement("li");
      gap.className = "drag-gap";
      gap.setAttribute("aria-hidden", "true");
      gap.style.height = `${rect.height}px`;
      if (next) list.insertBefore(gap, next);
      else list.appendChild(gap);
      drag.gap = gap;
      document.body.classList.add("dragging-todo");
    }
    const bounds = list.getBoundingClientRect();
    if (y < bounds.top + 24) list.scrollTop -= 14;
    else if (y > bounds.bottom - 24) list.scrollTop += 14;
    const cardTop = y - drag.grabOffset;
    drag.li.style.top = `${Math.round(cardTop)}px`;
    const after = getDragAfterElement(list, cardTop + drag.height / 2);
    const gap = drag.gap;
    const slotChanged = after ? gap.nextElementSibling !== after : list.lastElementChild !== gap;
    if (slotChanged) {
      slideSiblings(list, () => {
        if (after) list.insertBefore(gap, after);
        else list.appendChild(gap);
      });
    }
  };

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".drag-handle");
    if (!handle || event.button !== 0) return;
    const li = handle.closest("li");
    if (!li || li.classList.contains("editing") || list.querySelector("li.editing")) return;
    event.preventDefault();
    try {
      list.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is optional. Move and release are handled on document.
    }
    drag = {
      pointerId: event.pointerId,
      li,
      startY: event.clientY,
      moved: false,
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (Math.abs(event.clientY - drag.startY) < 4) return;
    placeDragged(event.clientY);
  });

  const endDrag = async (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.abs(event.clientY - drag.startY);
    if (distance >= 4) placeDragged(event.clientY);
    const current = drag;
    drag = null;
    document.body.classList.remove("dragging-todo");
    if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    const li = current.li;
    const visualTop = li.getBoundingClientRect().top;
    if (current.gap && current.gap.isConnected) {
      list.insertBefore(li, current.gap);
      current.gap.remove();
    }
    li.classList.remove("dragging");
    li.style.width = "";
    li.style.left = "";
    li.style.top = "";
    li.style.transform = "";
    const dy = visualTop - li.getBoundingClientRect().top;
    if (Math.abs(dy) > 1 && reorderDuration() > 0) {
      li.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: reorderDuration(), easing: "cubic-bezier(0.2, 0, 0, 1)" }
      );
    }
    await persistVisibleOrder();
  };

  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", async (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.gap) drag.gap.remove();
    drag.li.style.width = "";
    drag.li.style.left = "";
    drag.li.style.top = "";
    drag.li.style.transform = "";
    drag.li.classList.remove("dragging");
    document.body.classList.remove("dragging-todo");
    drag = null;
    await refresh();
  });
}

function setupToggle() {
  const btn = $("toggleBtn");
  let minimized = false;
  btn.addEventListener("click", () => {
    minimized = !minimized;
    document.body.classList.toggle("minimized", minimized);
    btn.textContent = minimized ? "+" : "–";
    const label = minimized ? "Show list" : "Collapse list";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-expanded", minimized ? "false" : "true");
  });
}

function msUntilNextMidnight() {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - Date.now() + 1000);
}

function scheduleMidnightReset() {
  setTimeout(async () => {
    await refresh();
    scheduleMidnightReset();
  }, msUntilNextMidnight());
}

async function submitTodo() {
  const input = $("todoInput");
  const linkInput = $("linkInput");
  const text = input.value;
  const link = linkInput ? linkInput.value : "";
  if (!text.trim()) return;
  await addItem(text, activeCategory, link);
  input.value = "";
  if (linkInput) linkInput.value = "";
  input.focus();
}

function openAddForm() {
  const form = $("addForm");
  const btn = $("newTaskBtn");
  if (!form) return;
  form.hidden = false;
  if (btn) btn.hidden = true;
  $("todoInput").focus();
}

function closeAddForm() {
  const form = $("addForm");
  const btn = $("newTaskBtn");
  if (!form) return;
  form.hidden = true;
  if (btn) btn.hidden = false;
  $("todoInput").value = "";
  const linkInput = $("linkInput");
  if (linkInput) linkInput.value = "";
}

async function init() {
  setupToggle();
  setupReordering();

  const newTaskBtn = $("newTaskBtn");
  const cancelAddBtn = $("cancelAddBtn");
  if (newTaskBtn) newTaskBtn.addEventListener("click", openAddForm);
  if (cancelAddBtn) cancelAddBtn.addEventListener("click", closeAddForm);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const form = $("addForm");
      if (form && !form.hidden) closeAddForm();
    }
  });

  const initialChip = document.querySelector("#categoryChips .chip.active");
  const initialFilter = document.querySelector("#filterTabs .filter.active");
  setCategory(initialChip ? initialChip.dataset.cat : "office");
  setFilter(initialFilter ? initialFilter.dataset.filter : "all");

  $("categoryChips").addEventListener("click", (event) => {
    const btn = event.target.closest(".chip");
    if (!btn) return;
    setCategory(btn.dataset.cat);
  });

  $("todoList").addEventListener("click", (event) => {
    const chip = event.target.closest(".edit-chips .chip");
    if (!chip) return;
    const row = chip.closest(".edit-row");
    if (!row) return;
    setEditChips(chip.closest(".edit-chips"), chip.dataset.cat);
  });

  $("filterTabs").addEventListener("click", async (event) => {
    const btn = event.target.closest(".filter");
    if (!btn) return;
    setFilter(btn.dataset.filter);
    await refresh();
  });

  $("addBtn").addEventListener("click", submitTodo);
  $("todoInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitTodo();
  });
  $("linkInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitTodo();
  });
  $("clearCheckedBtn").addEventListener("click", clearChecked);
  $("resetBtn").addEventListener("click", resetAll);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  scheduleMidnightReset();

  await refresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
