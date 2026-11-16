const STORAGE_KEY = "dailyTodoState";
const CATEGORIES = ["course", "learning", "problem"];

const $ = (id) => document.getElementById(id);

const categoryLabels = {
  course: "Course",
  learning: "Learning",
  problem: "Problem",
};

let activeCategory = "course";
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
    items: state && Array.isArray(state.items) ? state.items : [],
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

function visibleItems(items) {
  if (activeFilter === "all") return items;
  return items.filter((item) => item.category === activeFilter);
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

  visible.forEach((item) => {
    const li = document.createElement("li");
    if (item.done) li.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!item.done;
    checkbox.addEventListener("change", () => toggleDone(item.id));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = item.text;

    const main = document.createElement("label");
    main.className = "todo-main";
    main.appendChild(checkbox);
    main.appendChild(text);

    const category = validCategory(item.category);
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.dataset.cat = item.category || category;
    badge.textContent = categoryLabels[item.category] || item.category || categoryLabels[category];

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

async function addItem(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const state = await ensureToday(await loadState());
  state.items.push({
    id: "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    text: trimmed,
    category: validCategory(category),
    done: false,
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
  const text = input.value;
  if (!text.trim()) return;
  await addItem(text, activeCategory);
  input.value = "";
  input.focus();
}

async function init() {
  setupToggle();

  const initialChip = document.querySelector("#categoryChips .chip.active");
  const initialFilter = document.querySelector("#filterTabs .filter.active");
  setCategory(initialChip ? initialChip.dataset.cat : "course");
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
