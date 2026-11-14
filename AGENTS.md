# Web app implementation rules for this folder (must follow)

## 0. Always respond in Japanese

- All responses — explanations, error reasoning, next steps, code comments — must be in Japanese.
- Drifted to English? The participant can type "日本語で" to switch back.
- Exception: OpenCode's own tool messages (e.g. the English compaction notice) are not affected — that's tool output, not your response.

## 1. Implementation: don't read the CSV wholesale — header only, write your own conversion script (most important)

(This is the same approach the official course manual recommends for large files: show the header/structure, not the whole file, and have the AI generate a conversion script.)

- Never read the whole CSV yourself — a few hundred rows alone can exceed what you can process in one turn.
- Using only the header line as a guide, write and run your own conversion script (e.g. Node.js).
- How the converted data reaches the page (embedded inline, a separate file the page fetches, etc.) is your call — not mandated here.
- Never read a full intermediate/converted file back yourself to verify it — that hits the same limit as the raw CSV. Check row count or a few lines only.
- Don't read the generated HTML back wholesale either — check row count or first lines only.
- Confirm in an actual browser (see "Local server" below) that the app works.
- Editing the HTML afterward for spec.md needs (wording, styling) is fine — keep the error display (section 2).

## 2. Show errors on screen — a blank page must never be silent (required)

Required:

1. Catch JS/promise errors: `window.addEventListener('error', ...)`, `window.addEventListener('unhandledrejection', ...)`.
2. Show as a persistent on-screen red banner. Never `alert()`/`confirm()`.
3. Dedupe repeated error text (e.g. track shown messages in a Set, skip duplicates).
4. Goal: something always shows on screen — never a silent blank page.

## 3. Never guess

- Don't confidently invent a URL, library, or API you're unsure of. Say so, ask the human.

## 4. Local server

A static server is expected on port 8000, started by the human in their own terminal (not by you). Before loading any page, check:

    curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/

If it is not running (no 200), **do not start it yourself, in any form** — not detached, not in the background, not with `&`. Just tell the human: "port 8000 のローカルサーバーが起動していないようです。ターミナルでサーバーを起動してください" and wait for them to start it.

Always load pages via http://localhost:8000/, never via file://.

If the human says they had to use a different port (e.g. 8001) because 8000 was already taken, use that port for every check and URL from then on — don't keep insisting on 8000.

## 5. Browser debugging

Use only these exact tool names. Do not invent tool names such as
`open_console` or `open_devtools` — DevTools has no "open" concept here.

- `chrome-devtools_navigate_page` — load a URL
- `chrome-devtools_list_console_messages` — read console output
- `chrome-devtools_list_network_requests` — inspect requests, check 404s
- `chrome-devtools_take_screenshot` — visual confirmation
- `chrome-devtools_evaluate_script` — run JS in page context

Standard debug loop: navigate → list console → list network → screenshot.
Always use the same address as the local server (http://localhost:8000/, or the port the human gave you), never file://.
