# Changelog

## 0.3.2

- Fix open-source package layout so `manifest.json` is at the ZIP root.
- Fix thumbnail path to `assets/thumbnail.png`.
- Harden popup rendering and settings error handling.

## 0.3.2

- Prepare the project for open-source release.
- Add MIT license, privacy documentation, contributing guide, and repository metadata.
- Hide Gemini's primary `<youtube-block>` via CSS when enabled, reducing repeated DOM work while responses stream.

## 0.3.0

- Add editable Gemini instructions directly to the extension popup.
- Store the prompt with `chrome.storage.sync`.
- Remove the `@YouTube` tag and timestamp requests from the default prompt.
- Refocus the default prompt on faithful video summarisation.

## 0.2.0

- Intercept normal YouTube video clicks during capture phase before YouTube's SPA navigation.
- Hide Gemini's complete `<youtube-block>` component rather than only its iframe.
