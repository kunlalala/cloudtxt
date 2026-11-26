# cloudtxt description

## Objective
A Personal Online Note PWA, Fast like Notepad，can sync with different device with Google Drive.

## Tech
TypeScript + Svelte + Vite、CodeMirror 6、IndexedDB（idb module）、
Google Identity Services、Drive API v3、vite-plugin-pwa。

## Rule
- Local Priority: All reads and writes go through IndexedDB first. Cloud synchronization runs in the background and should not block input.

- Drive permissions are only used at https://www.googleapis.com/auth/drive.appdata

- Google sign-in is optional and lazy: Google Identity Services (`accounts.google.com/gsi/client`) is
  loaded only when the Drive panel is used, and the app must stay fully usable while signed out or offline.

- No backend server is needed; the entire project is purely static files.

- Notes are stored as plain text. No Markdown: the only formatting is the custom heading syntax (a line starting, after optional indentation, with 1-6 `#` followed by a space), shown bigger/coloured with the `#` hidden off the cursor line, and the strong syntax `!!text!!` (red, bold, marks hidden off the cursor line). Do not add Markdown libraries.

- Images are compressed (canvas, max edge 1600, JPEG 0.8) and stored separately; the note text only
  stores the token `[[img:<id>]]` and Drive gets `img_<id>.jpg`.

- Synchronization uses `last-write-wins` (per item `updatedAt`), and the replaced remote copy is kept
  in `cloudtxt.backup.json` (three rotating slots) before overwriting.

- No heavy libraries are used to maintain fast startup.

- Mobile-first UI; touch buttons are at least 44px wide.

- Run `npm run build` after each change to confirm there are no errors.

- Teardown guide: whenever a new service/resource is added (hosting, domain, OAuth client, Drive data, PWA, etc.), update `src/lib/guide.ts` so the in-app "Delete app guide" lists how to fully remove it. Flip `planned` steps to `active` when they become real.

- Help (product docs): whenever a user-visible feature is added, changed or removed, update the matching section in `src/lib/help.ts` (shown by the sidebar "Help" button). Keep it accurate and detailed, technical and non-technical; one titled section per topic; keep "Limitations" and "Roadmap" current.

## Data Structure
cloudtxt.json：{ version, folders: [{id,name,parentId,updatedAt}],
notes: [{id,title,content,folderId,updatedAt,deleted?}] }
Delete via soft delete (deleted: true), otherwise it will "revive" during synchronization.

## Current Stage
Stage 6 (local notes + PWA on GitHub Pages + Google sign-in + automatic merge sync + images).
The OAuth Client ID lives in `src/lib/config.ts` (public value, empty until pasted).

Images: compressed with canvas (max edge 1600, JPEG 0.8), stored in the IndexedDB `images` store and
in Drive as `img_<id>.jpg`, referenced from note text with the custom token `[[img:<id>]]` (never
Markdown). Only referenced images are uploaded, only missing ones are downloaded, and pictures no
note mentions for 30 days are removed on both sides.

Sync rules in code: `src/lib/merge.ts` merges per item by `updatedAt` (equal timestamps keep the
local copy) and keeps soft deletes as tombstones for 30 days; `src/lib/sync.svelte.ts` downloads,
merges, applies and only then uploads, debounced 5 s, with retries and a dirty flag so a round never
interrupts typing. Automatic rounds must never open a Google window (allowRefresh = false).