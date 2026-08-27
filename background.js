const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  hideYoutubeEmbeds: true,
  summaryPrompt: `Summarise this video:

{{VIDEO_URL}}

Provide a clear, concise summary of the video. Cover:
- The main points, arguments, explanations, and conclusions
- Important context, examples, evidence, or nuances needed to understand them
- Any notable claims or details that materially affect the video's message

Prioritise accurately capturing what the video says. Do not include timestamps. Keep the response well-structured and substantially shorter than watching the video.`
};

const PENDING_TTL_MS = 10 * 60 * 1000;

const LEGACY_DEFAULT_PROMPT = `@YouTube Analyse this video instead of me watching it:

{{VIDEO_URL}}

Give me:
- A concise TL;DR
- The main ideas and arguments
- Any genuinely useful or actionable information
- What parts are repetitive, filler, or low-information
- Whether watching the full video is actually worthwhile
- If only certain parts are worth watching, give me those timestamps

Keep the response substantially shorter than the time it would take to watch the video.`;

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get([
    "interceptEnabled",
    "hideYoutubeEmbeds",
    "summaryPrompt"
  ]);

  const updates = {};

  if (typeof existing.interceptEnabled !== "boolean") {
    updates.interceptEnabled = DEFAULT_SETTINGS.interceptEnabled;
  }

  if (typeof existing.hideYoutubeEmbeds !== "boolean") {
    updates.hideYoutubeEmbeds = DEFAULT_SETTINGS.hideYoutubeEmbeds;
  }

  // Migrate only the previous built-in prompt. Preserve anything the user edited.
  if (!existing.summaryPrompt || existing.summaryPrompt === LEGACY_DEFAULT_PROMPT) {
    updates.summaryPrompt = DEFAULT_SETTINGS.summaryPrompt;
  }

  if (Object.keys(updates).length) {
    await chrome.storage.sync.set(updates);
  }
});

function applyTemplate(template, data) {
  return template
    .replaceAll("{{VIDEO_URL}}", data.videoUrl || "")
    .replaceAll("{{VIDEO_TITLE}}", data.videoTitle || "")
    .replaceAll("{{CHANNEL_NAME}}", data.channelName || "");
}

function pendingKey(tabId) {
  return `watchLessPending:${tabId}`;
}

async function handleMessage(message, sender) {

  if (message?.type === "INTERCEPT_YOUTUBE_FAST") {
    const tabId = sender.tab?.id;
    if (tabId == null) return { ok: false, reason: "No tab id." };

    // The YouTube content script already has the synced settings cached, so this
    // path avoids an extra chrome.storage.sync read on every click.
    if (!message.prompt || !message.videoUrl) {
      return { ok: false, reason: "Missing prompt or video URL." };
    }

    const pendingWrite = chrome.storage.local.set({
      [pendingKey(tabId)]: {
        prompt: message.prompt,
        videoUrl: message.videoUrl,
        createdAt: Date.now()
      }
    });

    // Start navigation immediately instead of waiting for the local-storage write.
    // Gemini takes much longer to load than this tiny write, so both can safely run
    // concurrently while preserving the pending prompt for the destination tab.
    const navigation = chrome.tabs.update(tabId, { url: "https://gemini.google.com/app" });
    await Promise.all([pendingWrite, navigation]);
    return { ok: true };
  }
  if (message?.type === "INTERCEPT_YOUTUBE") {
    const tabId = sender.tab?.id;
    if (tabId == null) return { ok: false, reason: "No tab id." };

    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    if (!settings.interceptEnabled) {
      return { ok: false, reason: "Interception disabled." };
    }

    const prompt = applyTemplate(settings.summaryPrompt, {
      videoUrl: message.videoUrl,
      videoTitle: message.videoTitle,
      channelName: message.channelName
    });

    await chrome.storage.local.set({
      [pendingKey(tabId)]: {
        prompt,
        videoUrl: message.videoUrl,
        createdAt: Date.now()
      }
    });

    await chrome.tabs.update(tabId, { url: "https://gemini.google.com/app" });
    return { ok: true };
  }

  if (message?.type === "GET_PENDING_PROMPT") {
    const tabId = sender.tab?.id;
    if (tabId == null) return { ok: false, pending: null };

    const key = pendingKey(tabId);
    const result = await chrome.storage.local.get(key);
    const pending = result[key] || null;

    if (pending && Date.now() - pending.createdAt > PENDING_TTL_MS) {
      await chrome.storage.local.remove(key);
      return { ok: true, pending: null };
    }

    return { ok: true, pending };
  }

  if (message?.type === "CLEAR_PENDING_PROMPT") {
    const tabId = sender.tab?.id;
    if (tabId == null) return { ok: false };
    await chrome.storage.local.remove(pendingKey(tabId));
    return { ok: true };
  }

  return { ok: false, reason: "Unknown message." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("Watch Less background error:", error);
      sendResponse({ ok: false, reason: String(error) });
    });

  return true;
});
