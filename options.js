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
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("resetPrompt");
const status = document.getElementById("status");

async function restore() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  interceptEnabled.checked = settings.interceptEnabled;
  hideYoutubeEmbeds.checked = settings.hideYoutubeEmbeds;
  summaryPrompt.value = settings.summaryPrompt;
}

async function save() {
  const prompt = summaryPrompt.value.trim();
  if (!prompt.includes("{{VIDEO_URL}}")) {
    status.textContent = "Add {{VIDEO_URL}} so Gemini knows which video to summarize.";
    return;
  }

  await chrome.storage.sync.set({
    interceptEnabled: interceptEnabled.checked,
    hideYoutubeEmbeds: hideYoutubeEmbeds.checked,
    summaryPrompt: prompt
  });

  status.textContent = "Saved.";
  setTimeout(() => {
    if (status.textContent === "Saved.") status.textContent = "";
  }, 1800);
}

saveButton.addEventListener("click", save);
resetButton.addEventListener("click", () => {
  summaryPrompt.value = DEFAULT_PROMPT;
  status.textContent = "Default prompt restored. Click Save to apply it.";
});

document.addEventListener("DOMContentLoaded", restore);
