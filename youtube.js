(() => {
  const DEFAULT_SETTINGS = {
    interceptEnabled: true,
    summaryPrompt: `Analyse this video:

{{VIDEO_URL}}

Provide a clear, concise summary of the video. Cover:
- The main points, arguments, explanations, and conclusions
- Important context, examples, evidence, or nuances needed to understand them
- Any notable claims or details that materially affect the video's message

Prioritise accurately capturing what the video says. Do not include timestamps. Keep the response well-structured and substantially shorter than watching the video.`
  };

  let lastInterceptedUrl = "";
  let interceptInFlight = false;
  let interceptEnabled = true;
  let summaryPrompt = DEFAULT_SETTINGS.summaryPrompt;

  function applyTemplate(template, data) {
    return template
      .replaceAll("{{VIDEO_URL}}", data.videoUrl || "")
      .replaceAll("{{VIDEO_TITLE}}", data.videoTitle || "")
      .replaceAll("{{CHANNEL_NAME}}", data.channelName || "");
  }

  function normaliseVideoUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl, location.href);
    } catch {
      return null;
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;

    if (url.pathname === "/watch" && url.searchParams.has("v")) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(url.searchParams.get("v"))}`;
    }

    const shortMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shortMatch) {
      return `https://www.youtube.com/shorts/${encodeURIComponent(shortMatch[1])}`;
    }

    return null;
  }

  function getCurrentVideoInfo() {
    const videoUrl = normaliseVideoUrl(location.href);
    if (!videoUrl) return null;

    const titleFromMeta = document.querySelector('meta[name="title"]')?.content;
    const titleFromPage = document.title?.replace(/\s*-\s*YouTube\s*$/i, "");
    const videoTitle = titleFromMeta || titleFromPage || "";

    const channelName =
      document.querySelector('link[itemprop="name"]')?.getAttribute("content") ||
      document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
      "";

    return { videoUrl, videoTitle, channelName };
  }

  function getClickedVideoInfo(link) {
    const videoUrl = normaliseVideoUrl(link.href);
    if (!videoUrl) return null;

    const card = link.closest([
      "ytd-rich-item-renderer",
      "ytd-rich-grid-media",
      "ytd-video-renderer",
      "ytd-grid-video-renderer",
      "ytd-compact-video-renderer",
      "ytd-playlist-video-renderer",
      "ytd-reel-item-renderer",
      "yt-lockup-view-model",
      "ytd-item-section-renderer"
    ].join(","));

    const titleNode =
      card?.querySelector('#video-title, #video-title-link, a[title][href*="/watch"], a[title][href*="/shorts/"]') ||
      (link.matches('#video-title, #video-title-link, a[title]') ? link : null);

    const channelNode = card?.querySelector(
      'ytd-channel-name a, #channel-name a, a[href^="/@"], a[href*="/channel/"], a[href*="/c/"]'
    );

    const videoTitle =
      titleNode?.getAttribute?.("title")?.trim() ||
      titleNode?.textContent?.trim() ||
      link.getAttribute("title")?.trim() ||
      "";

    const channelName = channelNode?.textContent?.trim() || "";

    return { videoUrl, videoTitle, channelName };
  }

  function stopPlaybackImmediately() {
    for (const media of document.querySelectorAll("video, audio")) {
      try {
        media.pause();
        media.muted = true;
      } catch {
        // Best-effort only.
      }
    }
  }

  function dispatchIntercept(info) {
    if (!interceptEnabled || !info || interceptInFlight) return false;

    stopPlaybackImmediately();
    interceptInFlight = true;
    lastInterceptedUrl = info.videoUrl;

    const prompt = applyTemplate(summaryPrompt, info);

    // Do not await this in the click handler. The event has already been cancelled,
    // and the background worker can replace the tab as soon as it receives the message.
    chrome.runtime.sendMessage({
      type: "INTERCEPT_YOUTUBE_FAST",
      prompt,
      videoUrl: info.videoUrl
    }).then((response) => {
      if (!response?.ok) {
        interceptInFlight = false;
        if (response?.reason === "Interception disabled.") lastInterceptedUrl = "";
      }
    }).catch((error) => {
      console.warn("Watch Less could not intercept this video:", error);
      interceptInFlight = false;
      lastInterceptedUrl = "";
    });

    return true;
  }

  function onDocumentClick(event) {
    if (!interceptEnabled || event.defaultPrevented) return;
    if (event.button !== 0) return;

    const target = event.target instanceof Element ? event.target : null;
    const link =
      event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.href) ||
      target?.closest("a[href]");
    if (!link) return;

    const info = getClickedVideoInfo(link);
    if (!info) return;

    // Capture-phase cancellation prevents YouTube's SPA router from loading the
    // video page first. This is the main perceived-latency improvement.
    event.preventDefault();
    event.stopImmediatePropagation();

    dispatchIntercept(info);
  }

  function maybeInterceptCurrentPage() {
    if (!interceptEnabled) return;

    const info = getCurrentVideoInfo();
    if (!info || interceptInFlight || info.videoUrl === lastInterceptedUrl) return;
    dispatchIntercept(info);
  }

  async function init() {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    interceptEnabled = settings.interceptEnabled !== false;
    summaryPrompt = settings.summaryPrompt || DEFAULT_SETTINGS.summaryPrompt;

    // Register in capture phase so Watch Less runs before YouTube's own SPA click handlers.
    document.addEventListener("click", onDocumentClick, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;

      if (changes.interceptEnabled) {
        interceptEnabled = changes.interceptEnabled.newValue !== false;
        interceptInFlight = false;
        lastInterceptedUrl = "";
        if (interceptEnabled) maybeInterceptCurrentPage();
      }

      if (changes.summaryPrompt) {
        summaryPrompt = changes.summaryPrompt.newValue || DEFAULT_SETTINGS.summaryPrompt;
      }
    });

    // Fallbacks for direct URLs, bookmarks, keyboard navigation, and any YouTube
    // interactions that do not originate from a normal anchor click.
    window.addEventListener("yt-navigate-finish", maybeInterceptCurrentPage, true);
    document.addEventListener("DOMContentLoaded", maybeInterceptCurrentPage, { once: true });

    let previousUrl = location.href;
    setInterval(() => {
      if (location.href !== previousUrl) {
        previousUrl = location.href;
        interceptInFlight = false;
        maybeInterceptCurrentPage();
      }
    }, 300);

    maybeInterceptCurrentPage();
  }

  init().catch((error) => console.warn("Watch Less YouTube init error:", error));
})();
