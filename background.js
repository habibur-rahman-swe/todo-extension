// Opens the todo list in a popup window on browser startup, and clears
// checkmarks when the local calendar day changes. Closing the window
// leaves it closed until the next startup.

const STORAGE_KEY = "dailyTodoState";
const POPUP_URL = chrome.runtime.getURL("popup.html");
const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 600;

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function resetIfNewDay() {
  const state = await loadState();
  if (!state) return;
  const today = getTodayKey();
  if (state.lastDay === today) return;
  state.lastDay = today;
  state.items = (state.items || []).map((item) => ({ ...item, done: false }));
  await saveState(state);
}

async function getPopupWindow() {
  const windows = await chrome.windows.getAll({ populate: true });
  return windows.find((win) =>
    win.type === "popup" &&
    Array.isArray(win.tabs) &&
    win.tabs.some((tab) => tab.url === POPUP_URL)
  );
}

async function openPopupAuto() {
  await resetIfNewDay();
  const existing = await getPopupWindow();
  if (existing) {
    try {
      await chrome.windows.update(existing.id, { focused: true, state: "normal" });
    } catch (error) {
      console.error("Failed to focus Daily Todo window", error);
    }
    return;
  }
  try {
    await chrome.windows.create({
      url: POPUP_URL,
      type: "popup",
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      focused: true,
    });
  } catch (error) {
    console.error("Failed to open Daily Todo window", error);
    try {
      await chrome.action.openPopup();
    } catch (popupError) {
      console.error("Failed to open toolbar popup", popupError);
    }
  }
}

chrome.runtime.onStartup.addListener(() => {
  openPopupAuto();
});

chrome.runtime.onInstalled.addListener(() => {
  openPopupAuto();
});
