# Contributing

Contributions are welcome.

## Local development

1. Clone or download the repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.
5. After editing extension files, click **Reload** on the extension card and refresh affected YouTube/Gemini tabs.

## Areas likely to need maintenance

Gemini's composer and YouTube response-card markup are not public extension APIs. If Google changes its DOM, `gemini.js` may need selector updates. YouTube navigation behavior can likewise require updates in `youtube.js`.

## Pull requests

Keep permissions minimal. Avoid adding remote executable code, analytics, or backend dependencies unless there is a strong reason and the privacy implications are documented.
