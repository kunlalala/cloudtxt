# cloudtxt description

## Objective
A Personal Online Note PWA, Fast like Notepad，can sync with different device with Google Drive.

## Tech
TypeScript + Svelte + Vite、CodeMirror 6、IndexedDB（idb module）、
Google Identity Services、Drive API v3、vite-plugin-pwa。

## Rule
- Local Priority: All reads and writes go through IndexedDB first. Cloud synchronization runs in the background and should not block input.

- Drive permissions are only used at https://www.googleapis.com/auth/drive.appdata

- No backend server is needed; the entire project is purely static files.

- Notes are stored as plain text. No Markdown: the only formatting is the custom heading syntax (a line starting, after optional indentation, with 1-6 `#` followed by a space), shown bigger/coloured with the `#` hidden off the cursor line, and the strong syntax `!!text!!` (red, bold, marks hidden off the cursor line). Do not add Markdown libraries.

- Images are compressed and stored separately; the main JSON only stores references to `img:id`.

- Synchronization uses `last-write-wins` (press `updatedAt`), and a backup is made before overwriting.

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
Stage 2 (local-only notes + PWA, deployed to https://kunlalala.github.io/cloudtxt/ via GitHub Actions; no Google/images/sync yet)