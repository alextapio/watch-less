# Privacy

Watch Less has no backend, analytics, telemetry, advertising, or API keys.

## Data stored by the extension

- Extension settings, including the editable Gemini prompt, are stored in `chrome.storage.sync`. Chrome may sync these settings across browsers signed into the same Chrome profile.
- A pending prompt and YouTube URL are temporarily stored in `chrome.storage.local` while the current tab is redirected from YouTube to Gemini. Pending entries expire after 10 minutes and are normally removed as soon as the prompt is inserted.

## Data sent to third parties

When interception is enabled, Watch Less navigates the current tab to Gemini and inserts the configured prompt, including the intercepted YouTube URL. Gemini and YouTube are third-party services governed by their own terms and privacy policies.

Watch Less itself does not transmit data to any developer-operated server.
