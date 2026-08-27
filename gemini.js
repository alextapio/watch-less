(() => {
  const DEFAULT_SETTINGS = {
    hideYoutubeEmbeds: true
  };

  const STYLE_ID = "watch-less-style";
  const HIDDEN_ATTR = "data-watch-less-hidden";
  const BANNER_ID = "watch-less-banner";
  const ROOT_HIDE_CLASS = "watch-less-hide-youtube";

  let hideEmbedsEnabled = true;
  let scanScheduled = false;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${ROOT_HIDE_CLASS} youtube-block { display: none !important; }
      [${HIDDEN_ATTR}="true"] { display: none !important; }
      #${BANNER_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        max-width: 360px;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(30, 30, 30, 0.96);
        color: white;
        font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,.28);
      }
      #${BANNER_ID} button {
        margin-top: 10px;
        padding: 7px 10px;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function hideNode(node) {
    if (!(node instanceof HTMLElement)) return;
    node.setAttribute(HIDDEN_ATTR, "true");
  }

  function showAllHiddenNodes() {
    document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`).forEach((node) => {
      node.removeAttribute(HIDDEN_ATTR);
    });
  }

  function chooseEmbedContainer(node) {
    // Gemini currently wraps its YouTube result/player in a custom <youtube-block>.
    // Prefer hiding that whole component so the thumbnail, play overlay, attribution,
    // and iframe all disappear together.
    return (
      node.closest("youtube-block") ||
      node.closest('[class*="card" i], [class*="video" i], [class*="media" i]') ||
      node
    );
  }

  function scanForYoutubeEmbeds() {
    scanScheduled = false;
    if (!hideEmbedsEnabled) return;

    // Gemini's primary <youtube-block> component is hidden by CSS whenever the
    // root class is enabled. The scans below are fallbacks for other embed shapes.

    document
      .querySelectorAll('iframe[src*="youtube.com" i], iframe[src*="youtube-nocookie.com" i]')
      .forEach((iframe) => hideNode(chooseEmbedContainer(iframe)));

    document.querySelectorAll('a[href*="youtube.com/watch" i], a[href*="youtu.be/" i]').forEach((link) => {
      const hasThumbnail = !!link.querySelector('img[src*="ytimg.com" i]');
      if (hasThumbnail) hideNode(chooseEmbedContainer(link));
    });

    document.querySelectorAll('img[src*="ytimg.com" i]').forEach((img) => {
      const link = img.closest('a[href*="youtube.com" i], a[href*="youtu.be" i]');
      if (link) hideNode(chooseEmbedContainer(link));
    });
  }

  function scheduleEmbedScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(scanForYoutubeEmbeds, 80);
  }

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function findComposer() {
    const selectors = [
      'textarea[placeholder*="prompt" i]',
      'textarea[aria-label*="prompt" i]',
      '[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-placeholder]',
      'rich-textarea [contenteditable="true"]',
      'div[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)].filter(visible);
      if (candidates.length) return candidates[candidates.length - 1];
    }
    return null;
  }

  function setTextareaValue(element, text) {
    const proto = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setComposerText(composer, text) {
    composer.focus();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      setTextareaValue(composer, text);
      return composer.value.trim().length > 0;
    }

    // execCommand is deprecated as a web API but remains useful here because it triggers
    // editor input plumbing more reliably than assigning textContent in many rich editors.
    let inserted = false;
    try {
      composer.textContent = "";
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }

    if (!inserted) {
      composer.textContent = text;
      composer.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text
        })
      );
    }

    return (composer.innerText || composer.textContent || "").trim().length > 0;
  }

  function findSendButton() {
    const buttons = [...document.querySelectorAll("button")].filter(visible);

    const labelled = buttons.find((button) => {
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return /(^|\s)send(\s|$)|send message|submit/.test(label) && !button.disabled;
    });

    if (labelled) return labelled;

    return buttons.find((button) => {
      if (button.disabled) return false;
      const iconText = button.querySelector("mat-icon")?.textContent?.trim().toLowerCase();
      return iconText === "send";
    }) || null;
  }

  function showBanner(message, promptToCopy = "") {
    document.getElementById(BANNER_ID)?.remove();

    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    const text = document.createElement("div");
    text.textContent = message;
    banner.appendChild(text);

    if (promptToCopy) {
      const button = document.createElement("button");
      button.textContent = "Copy prompt";
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(promptToCopy);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Copy failed — select the prompt in settings";
        }
      });
      banner.appendChild(button);
    }

    document.body.appendChild(banner);
  }

  async function waitForComposer(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const composer = findComposer();
      if (composer) return composer;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  async function fillAndSendPendingPrompt() {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "GET_PENDING_PROMPT" });
    } catch (error) {
      console.warn("Watch Less could not read pending prompt:", error);
      return;
    }

    const pending = response?.pending;
    if (!pending?.prompt) return;

    const composer = await waitForComposer();
    if (!composer) {
      showBanner("Watch Less couldn't find Gemini's prompt box. The prompt is ready to copy.", pending.prompt);
      return;
    }

    const inserted = setComposerText(composer, pending.prompt);
    if (!inserted) {
      showBanner("Watch Less couldn't insert the prompt. You can copy it instead.", pending.prompt);
      return;
    }

    await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PROMPT" });

    // Give Gemini's UI a moment to react to the input event before looking for Send.
    await new Promise((resolve) => setTimeout(resolve, 650));
    const sendButton = findSendButton();

    if (sendButton) {
      sendButton.click();
    } else {
      showBanner("Watch Less inserted the summary prompt. Press Gemini's Send button to continue.");
    }
  }

  async function init() {
    ensureStyle();
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    hideEmbedsEnabled = settings.hideYoutubeEmbeds !== false;
    document.documentElement.classList.toggle(ROOT_HIDE_CLASS, hideEmbedsEnabled);

    if (hideEmbedsEnabled) scanForYoutubeEmbeds();

    const observer = new MutationObserver(scheduleEmbedScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes.hideYoutubeEmbeds) return;
      hideEmbedsEnabled = changes.hideYoutubeEmbeds.newValue !== false;
      document.documentElement.classList.toggle(ROOT_HIDE_CLASS, hideEmbedsEnabled);
      if (hideEmbedsEnabled) {
        scanForYoutubeEmbeds();
      } else {
        showAllHiddenNodes();
      }
    });

    await fillAndSendPendingPrompt();
  }

  init().catch((error) => console.error("Watch Less Gemini error:", error));
})();
