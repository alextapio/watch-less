const DEFAULT_PROMPT = `Analyse this video:

{{VIDEO_URL}}

Provide a clear, concise summary of the video. Cover:
- The main points, arguments, explanations, and conclusions
- Important context, examples, evidence, or nuances needed to understand them
- Any notable claims or details that materially affect the video's message

Prioritise accurately capturing what the video says. Do not include timestamps. Keep the response well-structured and substantially shorter than watching the video.`;

const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  hideYoutubeEmbeds: true,
  summaryPrompt: DEFAULT_PROMPT
};

const interceptEnabled = document.getElementById("interceptEnabled");
const hideYoutubeEmbeds = document.getElementById("hideYoutubeEmbeds");
const summaryPrompt = document.getElementById("summaryPrompt");
const savePromptButton = document.getElementById("savePrompt");
const resetPromptButton = document.getElementById("resetPrompt");
const promptStatus = document.getElementById("promptStatus");
const settingsButton = document.getElementById("settings");

function showStatus(message, isError = false) {
  promptStatus.textContent = message;
  promptStatus.dataset.error = isError ? "true" : "false";

  window.setTimeout(() => {
    if (promptStatus.textContent === message) {
      promptStatus.textContent = "";
      delete promptStatus.dataset.error;
    }
  }, 2200);
}

async function restore() {
  // Render useful defaults immediately, even if storage is unavailable.
  interceptEnabled.checked = DEFAULT_SETTINGS.interceptEnabled;
  hideYoutubeEmbeds.checked = DEFAULT_SETTINGS.hideYoutubeEmbeds;
  summaryPrompt.value = DEFAULT_PROMPT;

  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    interceptEnabled.checked = settings.interceptEnabled !== false;
    hideYoutubeEmbeds.checked = settings.hideYoutubeEmbeds !== false;
    summaryPrompt.value = settings.summaryPrompt || DEFAULT_PROMPT;
  } catch (error) {
    console.error("Watch Less: could not restore popup settings", error);
    showStatus("Could not load saved settings.", true);
  }
}

async function saveSetting(key, value) {
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (error) {
    console.error(`Watch Less: could not save ${key}`, error);
    showStatus("Could not save setting.", true);
  }
}

async function savePrompt() {
  const prompt = summaryPrompt.value.trim();

  if (!prompt.includes("{{VIDEO_URL}}")) {
    showStatus("Add {{VIDEO_URL}} first.", true);
    return;
  }

  try {
    await chrome.storage.sync.set({ summaryPrompt: prompt });
    showStatus("Saved.");
  } catch (error) {
    console.error("Watch Less: could not save prompt", error);
    showStatus("Could not save instructions.", true);
  }
}

interceptEnabled.addEventListener("change", () => {
  void saveSetting("interceptEnabled", interceptEnabled.checked);
});

hideYoutubeEmbeds.addEventListener("change", () => {
  void saveSetting("hideYoutubeEmbeds", hideYoutubeEmbeds.checked);
});

savePromptButton.addEventListener("click", () => void savePrompt());

resetPromptButton.addEventListener("click", async () => {
  summaryPrompt.value = DEFAULT_PROMPT;
  try {
    await chrome.storage.sync.set({ summaryPrompt: DEFAULT_PROMPT });
    showStatus("Reset and saved.");
  } catch (error) {
    console.error("Watch Less: could not reset prompt", error);
    showStatus("Could not reset instructions.", true);
  }
});

settingsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage().catch((error) => {
    console.error("Watch Less: could not open options page", error);
    showStatus("Could not open settings.", true);
  });
});

void restore();
