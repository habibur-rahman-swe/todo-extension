const STORAGE_KEY = "dailyTodoState";
const CATEGORIES = ["office", "course", "learning", "problem"];
const PRIORITY_CATEGORY = "office";

const $ = (id) => document.getElementById(id);

const categoryLabels = {
  office: "Office Work",
  course: "Course",
  learning: "Learning",
  problem: "Problem",
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
  return normalize(result[STORAGE_KEY]);
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
  const sorted = sortItems(items);
  if (activeFilter === "all") return sorted;
  return sorted.filter((item) => item.category === activeFilter);
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

    li.appendChild(main);
    li.appendChild(badge);
    li.appendChild(del);
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
  state.items.push({
    id: "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    text: trimmed,
    category: validCategory(category),
    done: false,
    link: (link || "").trim(),
  });
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
