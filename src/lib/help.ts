/**
 * In-app Help (product documentation).
 * MAINTENANCE RULE: whenever a user-visible feature is added, changed or removed,
 * update the matching section here (and GUIDE in guide.ts if a new service/resource appears).
 * Keep the text accurate to what the app really does; list unsupported things under "Limitations".
 */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; head: [string, string]; rows: [string, string][] }

export interface HelpSection {
  id: string
  title: string
  blocks: Block[]
}

export const HELP_UPDATED = 'Stage 2 (local notes, installable, works offline)'

export const help: HelpSection[] = [
  {
    id: 'about',
    title: 'About cloudtxt',
    blocks: [
      {
        type: 'p',
        text: 'cloudtxt is a personal note app that aims to be as fast as Notepad. You write plain text in a code-style editor, organised in folders. A line starting with # becomes a heading. Everything you type is saved on your own device first.',
      },
      {
        type: 'p',
        text: 'Current version: Stage 2. Notes live in your browser on this device. The app can be installed on your phone or computer and works without a network. There is no account, no Google sign-in, no sync between devices and no images yet. Those come in later stages (see "Roadmap").',
      },
      {
        type: 'ul',
        items: [
          'No server: the app is purely static files; nothing you write is sent anywhere.',
          'Fast start: only a small set of libraries is used (Svelte, CodeMirror 6, idb).',
          'Dark theme by default; designed mobile-first with touch targets of at least 44px.',
        ],
      },
    ],
  },
  {
    id: 'quick-start',
    title: 'Quick start',
    blocks: [
      {
        type: 'ul',
        items: [
          'Tap "＋ Note" in the sidebar to create a note, then just start typing. It is saved automatically.',
          'Tap "＋ Folder" to create a folder. Tap a folder to open or close it.',
          'Tap a note to open it in the editor on the right.',
          'Tap "⋯" at the end of any row for rename, move and delete.',
          'On a phone, tap "☰" at the top left to open the sidebar. To jump between headings, use the outline button in the top bar.',
        ],
      },
    ],
  },
  {
    id: 'install',
    title: 'Install and offline use',
    blocks: [
      {
        type: 'p',
        text: 'cloudtxt is a web app that can be installed like a normal app and keeps working without a network. It lives at https://kunlalala.github.io/cloudtxt/.',
      },
      {
        type: 'table',
        head: ['Device', 'How to install'],
        rows: [
          ['Android (Chrome)', 'Open the site, open the Chrome menu (three dots) and choose "Add to Home screen" or "Install app". Choose "Install" if it is offered, so it opens in its own window.'],
          ['iPhone / iPad (Safari)', 'Open the site, tap Share and choose "Add to Home Screen".'],
          ['Computer (Chrome or Edge)', 'Click the install icon at the right end of the address bar, or open the menu and choose "Install cloudtxt".'],
        ],
      },
      {
        type: 'ul',
        items: [
          'Installing is optional. You can also just use the site in the browser.',
          'Offline: after the first visit with a network, the whole app is saved on the device. Later you can open it and write with no network at all (for example in flight mode). A short "Ready to work offline" message appears the first time.',
          'Your notes are saved on the device whether or not you are online. Nothing is uploaded.',
          'A plain browser shortcut (a bookmark or a "shortcut" made from the browser menu) is not the same as installing: it may open the page but cannot guarantee that everything loads without a network. Use "Install app" or "Add to Home screen".',
          'Updates are automatic. The app looks for a new version when it opens, when you come back to it and once an hour (this needs a network). The new version downloads in the background and waits.',
          'When the app is in the background (you switched to another app or locked the screen), a waiting update is applied by itself, so most of the time you simply come back to the new version. Your text is saved before it switches.',
          'When you are inside the app, nothing is interrupted: a banner "A new version is ready" appears with an Update button. Tap it and the app saves, swaps and reloads. If you ignore it, the old version keeps working and the update is applied the next time you leave the app.',
          'Offline, you simply keep the version you have.',
          'The home-screen icon, name and colours are fixed when you install. If a later version changes them, remove the home-screen icon and add it again; your notes are not affected.',
          'A white frame around the home-screen icon means that item is an old plain shortcut (made before the app could be installed properly). The launcher draws its own background behind a shortcut, and no image can cover that. Delete the item and install again from the browser menu ("Install app"); an installed app icon is drawn edge to edge, in whatever shape your launcher uses.',
          'To get a fresh copy by hand: close the app completely and open it again twice (the first open downloads the update, the second uses it), or tap Update on the banner.',
          'Removing the app does not delete your notes by itself, because they belong to the site data of the browser. See the "Delete app guide" button for how to clear everything.',
        ],
      },
    ],
  },
  {
    id: 'layout',
    title: 'Screen layout (desktop and phone)',
    blocks: [
      {
        type: 'p',
        text: 'Desktop and tablet (window at least 768px wide): the sidebar is fixed on the left (280px) and the editor fills the rest. The ☰ button is hidden.',
      },
      {
        type: 'p',
        text: 'Phone (narrower than 768px): the sidebar becomes a drawer that slides in from the left. Open it with ☰. It closes when you tap a note, tap the dark area outside it, or create a new note.',
      },
      {
        type: 'ul',
        items: [
          'The top bar shows the title of the open note, the Indent menu and the outline button. On desktop the outline panel sits on the right of the editor.',
          'The sidebar shows the current folder path above the tree ("Root" if none).',
          'Dialogs (rename, move, delete) appear as a bottom sheet on phones and a centred box on desktop. Press Esc or tap outside to close.',
        ],
      },
    ],
  },
  {
    id: 'notes-folders',
    title: 'Notes and folders',
    blocks: [
      {
        type: 'p',
        text: 'The sidebar shows a tree. Folders can be nested as deep as you like. Inside any folder, subfolders are listed first (A–Z), then notes (newest created first).',
      },
      {
        type: 'table',
        head: ['Action', 'How'],
        rows: [
          ['New note', '"＋ Note" at the top, or "⋯" on a folder → New note.'],
          ['New folder', '"＋ Folder" at the top, or "⋯" on a folder → New subfolder.'],
          ['Open a folder', 'Tap it. It also becomes the "active" folder (highlighted, shown in the path line).'],
          ['Rename', '"⋯" → Rename.'],
          ['Move', '"⋯" → Move to… then choose the target folder (or Root). A folder cannot be moved into itself or its own subfolders.'],
          ['Delete', '"⋯" → Delete, then confirm. Deleting a folder also deletes everything inside it.'],
        ],
      },
      {
        type: 'p',
        text: 'Active folder: new notes and new folders are created inside the active folder. Tap a folder to make it active; opening a note makes that note\'s folder active. If the active folder is deleted, new items go to Root.',
      },
      {
        type: 'p',
        text: 'Moving uses a menu instead of drag and drop because that works on touch screens. Names: folder names up to 120 characters; empty folder name becomes "New folder".',
      },
    ],
  },
  {
    id: 'titles',
    title: 'Note titles',
    blocks: [
      {
        type: 'p',
        text: 'You never have to name a note. The title is taken automatically from the first non-empty line of the note (any leading "#" characters are removed, and it is cut at 80 characters). An empty note is shown as "Untitled". The title updates as you type.',
      },
      {
        type: 'p',
        text: 'If you rename a note ("⋯" → Rename), your name is kept and the title stops following the first line. To go back to automatic titles, rename the note and leave the name empty.',
      },
    ],
  },
  {
    id: 'saving',
    title: 'Saving and data storage',
    blocks: [
      {
        type: 'ul',
        items: [
          'Autosave: about 0.4 seconds after you stop typing, the note is written to the browser database (IndexedDB). There is no Save button.',
          'It is also saved immediately when you switch notes, switch to another tab/app, or close the page.',
          'Refreshing or reopening the page restores your notes, the note you had open and which folders were expanded.',
          'The editor never waits for storage; typing is not blocked by saving.',
        ],
      },
      {
        type: 'p',
        text: 'Where the data is: an IndexedDB database named "cloudtxt" with three stores: folders, notes and meta (UI state such as the last opened note, the indent width, the folded lines of each note and the delete-guide checklist).',
      },
      {
        type: 'code',
        text: 'folder: { id, name, parentId, updatedAt, deleted? }\nnote:   { id, title, content, folderId, updatedAt, deleted?, customTitle? }',
      },
      {
        type: 'ul',
        items: [
          'Notes are stored as plain text in the content field. Headings are just lines that start with #; the text is never converted.',
          'Deleting is a "soft delete": the item is only marked deleted: true and hidden. This is what later lets sync work correctly. There is no trash screen yet, so deleted items cannot be restored from the UI.',
          'Data belongs to one browser profile on one device at one address (origin). A different browser, a private window, a different device or a different address (for example localhost vs. a LAN IP) shows separate, empty data.',
          'Clearing "site data" / "cookies and site data" for this site deletes all notes. Copy anything important elsewhere until export is available.',
        ],
      },
    ],
  },
  {
    id: 'editor-basics',
    title: 'Editor basics',
    blocks: [
      {
        type: 'p',
        text: 'The editor is CodeMirror 6, the same kind of editor used in code tools, tuned for notes: monospace font, line numbers, soft line wrapping (long lines wrap instead of scrolling sideways) and a highlighted current line.',
      },
      {
        type: 'ul',
        items: [
          'Line numbers on the left. The current line and its number are highlighted.',
          'Matching brackets are highlighted when the cursor is next to one.',
          'Wrapped lines keep their indentation: when a long line wraps, the continuation rows start under the first character of the text, not at the left edge. A very long word without spaces is broken at the end of the row instead of jumping to a new row and leaving an empty row behind the indentation.',
          'Undo / redo history is kept per note while it is open. It resets when you switch to another note.',
          'Scroll position returns to the top when you open a note.',
          'The "Indent" menu in the top bar sets how wide indentation looks (see "Indentation").',
        ],
      },
    ],
  },
  {
    id: 'indent',
    title: 'Indentation (Tab / Shift+Tab)',
    blocks: [
      {
        type: 'p',
        text: 'Indentation is how you build structure in cloudtxt: indent a line to make it a child of the line above. Indentation drives folding. Together with headings (see "Headings") it gives a note an outline.',
      },
      {
        type: 'table',
        head: ['Key', 'What it does'],
        rows: [
          ['Tab', 'Indent the current line (or all selected lines) by one level.'],
          ['Shift+Tab', 'Remove one level of indentation from the current line / selected lines.'],
          ['Ctrl+] / Ctrl+[', 'Indent more / less (alternative to Tab).'],
        ],
      },
      {
        type: 'ul',
        items: [
          'One indent level is a real Tab character. Its display width is set with the "Indent" menu in the top bar (2, 4, 6 or 8; default 4).',
          'The "Indent" setting is one global display choice for all notes. It only changes how wide a Tab looks; the text in your notes is not changed, and the choice is remembered on this device.',
          'Spaces also count: for folding, indentation is measured in columns and every "Indent" columns is one level (with the default 4, 2 spaces already counts as level 1; with 2, two spaces is level 1 and four is level 2). Tabs and spaces can be mixed.',
          'Phones: soft keyboards have no Tab key, so a small toolbar at the bottom of the screen has Undo, Redo, Unindent and Indent buttons (see "Using it on a phone").',
        ],
      },
      {
        type: 'code',
        text: 'Project\n\tTask A\n\t\tdetail 1\n\t\tdetail 2\n\tTask B',
      },
    ],
  },
  {
    id: 'headings',
    title: 'Headings (# syntax)',
    blocks: [
      {
        type: 'p',
        text: 'cloudtxt has two formatting features: headings (this section) and strong text (next section). A heading starts with 1 to 6 "#" characters followed by a space. The line is shown bigger and in its own colour, and the "#" marks are hidden. Everything else you type is plain text.',
      },
      {
        type: 'table',
        head: ['You type', 'What you see'],
        rows: [
          ['# Title', 'Heading 1: largest, amber'],
          ['## Title', 'Heading 2: sky blue'],
          ['### Title', 'Heading 3: green'],
          ['#### Title', 'Heading 4: lavender'],
          ['##### Title', 'Heading 5: soft orange'],
          ['###### Title', 'Heading 6: smallest heading (normal text size, bold), grey-blue'],
        ],
      },
      {
        type: 'ul',
        items: [
          'The "#" marks must be followed by a space or Tab. "#tag" (no space) or 7 or more "#" characters are not headings and stay plain text.',
          'A heading can be indented: put Tabs or spaces in front of the # marks and it is a heading at that indent level. The indentation keeps the same width as on normal lines, so an indented heading lines up with its siblings.',
          'Headings are bold. On a computer the sizes step down from about 1.9 times the normal size (heading 1) to the normal size (heading 6). On a phone the note text is smaller (75% of the computer size, 12px) and the headings are closer to it: 1.4 times for heading 1, then 1.3, 1.2, 1.1, 1.05 and 1 times.',
          'Hidden marks: the "#" marks are hidden while the cursor is elsewhere. When the cursor (or a selection) is on the heading line, the marks are shown again so you can change the level or remove the heading: edit the # characters, then move away and they hide again.',
          'To turn a heading back into normal text, put the cursor on the line and delete the # characters and the space after them.',
          'Heading lines work with the rest of the app: the note title in the sidebar and top bar uses the first line without its # marks, and a heading followed by more deeply indented lines can be folded like any other line.',
          'Apart from headings and strong text, all text has one colour. There is no italic, link, list or code formatting; characters like * or - are just text.',
          'Colours and sizes are fixed for now (no settings screen).',
        ],
      },
      {
        type: 'code',
        text: '# Trip plan\n\t## Day 1\n\t\tmorning: airport\n\t\tevening: hotel\n\t## Day 2\n\t\tmuseum',
      },
    ],
  },
  {
    id: 'strong',
    title: 'Strong text (!!text!!)',
    blocks: [
      {
        type: 'p',
        text: 'Wrap words in two exclamation marks on each side to make them stand out: they are shown in red and bold, and the "!!" marks are hidden.',
      },
      {
        type: 'code',
        text: 'Pay the rent !!before Friday!! or the fee doubles.',
      },
      {
        type: 'ul',
        items: [
          'It works on any part of a line: one word, several words, or the whole line. You can use it several times on the same line, and inside a heading.',
          'The text between the marks must start and end with a letter or other visible character, not a space. "!! text !!" with spaces inside is not strong text, and neither is an empty "!!!!". A single "!" is just a normal character.',
          'It must be closed on the same line. Strong text never continues onto the next line.',
          'Hidden marks: like heading "#" marks, the "!!" are hidden while the cursor is elsewhere and shown again when the cursor (or a selection) is on that line, so you can edit or remove them. To remove the effect, delete the "!!" at both ends.',
          'The cursor skips over a hidden "!!" as one step, but can move freely through the text between them.',
          'Strong text is only a look. The note keeps the "!!" characters as plain text. Headings listed in the outline show their text without the "!!".',
          'The colour (red) is fixed for now. Phones have no special key for "!": type it on the keyboard as usual.',
        ],
      },
    ],
  },
  {
    id: 'outline',
    title: 'Outline (jump to a heading)',
    blocks: [
      {
        type: 'p',
        text: 'The outline lists every heading in the open note, like the navigation pane in Word. Click a heading and the editor jumps to that line and puts it at the top.',
      },
      {
        type: 'ul',
        items: [
          'Open or close it with the outline button (three lines) in the top bar, next to the Indent menu.',
          'Desktop and tablet: the outline is a panel on the right side of the editor. It is open by default and your choice (open or closed) is remembered on this device.',
          'Phone: the outline is hidden. Tap the outline button and it slides in from the right; tap a heading to jump, and it closes by itself. Tap outside it or the ✕ to close without jumping.',
          'Each entry has a dot in the heading colour. Level 1 headings are bold; deeper headings are indented. Indent is relative to the shallowest heading in the note, so a note that only uses ## still starts flush left.',
          'The heading that contains the cursor is highlighted, and the list scrolls to keep it in view as you move through the note.',
          'The list updates as you type: add, change or delete a # line and the outline follows.',
          'If the heading is inside a folded block, the block is unfolded so you can see where you landed.',
          'On a phone the keyboard does not pop up after a jump; on desktop the editor gets the focus so you can keep typing.',
          'Only lines that are headings with some text appear. An empty "# " line is skipped.',
          'The outline is only a navigation list. It does not change your note, and it is not synced or exported.',
        ],
      },
    ],
  },
  {
    id: 'folding',
    title: 'Folding (collapse / expand)',
    blocks: [
      {
        type: 'p',
        text: 'Hide the children of a line to focus on the big picture. A line can be folded when the lines directly below it (ignoring blank lines) are indented deeper than it.',
      },
      {
        type: 'ul',
        items: [
          'Click the ▾ arrow in the gutter next to the line number to fold. It changes to ▸ when folded. Click ▸ to expand again.',
          'A folded block shows a "…" placeholder at the end of the line; clicking it also expands the block.',
          'Folding works at every level, so you can fold a sub-branch without folding its parent. Headings do not fold by themselves; a heading folds when the lines under it are indented deeper.',
          'Fold state is saved per note on this device. Close the app and reopen it (or switch to another note and back) and the same blocks are still folded. It is saved like autosave, within about half a second of folding or unfolding.',
          'Folds are remembered by line number, so if the lines above a folded block change a lot (for example you edited the note somewhere else), a remembered fold may land on a different line or be dropped. Nothing in the text is ever changed.',
          'Folding only hides text. Nothing is deleted or changed.',
        ],
      },
      {
        type: 'table',
        head: ['Key', 'What it does'],
        rows: [
          ['Ctrl+Shift+[', 'Fold the block at the cursor.'],
          ['Ctrl+Shift+]', 'Unfold the block at the cursor.'],
          ['Ctrl+Alt+[', 'Fold all.'],
          ['Ctrl+Alt+]', 'Unfold all.'],
        ],
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    blocks: [
      {
        type: 'p',
        text: 'On macOS use Cmd instead of Ctrl, and Option instead of Alt.',
      },
      {
        type: 'table',
        head: ['Shortcut', 'Action'],
        rows: [
          ['Tab / Shift+Tab', 'Indent / unindent line or selection'],
          ['Ctrl+Z', 'Undo'],
          ['Ctrl+Y or Ctrl+Shift+Z', 'Redo'],
          ['Ctrl+A', 'Select all'],
          ['Alt+L (Ctrl+L on Mac)', 'Select the current line'],
          ['Alt+↑ / Alt+↓', 'Move the line (or selected lines) up / down'],
          ['Shift+Alt+↑ / Shift+Alt+↓', 'Duplicate the line up / down'],
          ['Ctrl+Shift+K', 'Delete the current line'],
          ['Ctrl+Enter', 'Insert an empty line below'],
          ['Ctrl+← / Ctrl+→', 'Move by word'],
          ['Home / End', 'Start / end of the line'],
          ['Ctrl+Home / Ctrl+End', 'Start / end of the note'],
          ['Ctrl+Shift+[ / ]', 'Fold / unfold at the cursor'],
          ['Ctrl+Alt+[ / ]', 'Fold all / unfold all'],
          ['Esc', 'Close a dialog or this help'],
        ],
      },
      {
        type: 'p',
        text: 'The editor uses the standard CodeMirror key bindings, so other common editing keys (copy, cut, paste, shift-selection, double-click to select a word) work as in any editor.',
      },
    ],
  },
  {
    id: 'mobile',
    title: 'Using it on a phone',
    blocks: [
      {
        type: 'ul',
        items: [
          'All buttons are at least 44px wide so they are easy to tap.',
          'Open the sidebar with ☰; tap a note to open it and the drawer closes. The outline (headings) is a second hidden drawer on the right, opened with the outline button.',
          'Input fields use a 16px font, which stops iOS from zooming in when you tap them.',
          'The note text is smaller on a phone (12px instead of 16px) to fit more on the screen. Line numbers follow the same size. The sizes are the --ed-size and --h1-size…--h6-size variables in app.css.',
          'The page follows the visible area above the on-screen keyboard, so the editor and the bottom toolbar are never hidden behind the keyboard.',
          'Editing toolbar: a bar at the bottom of the editor with four buttons: Undo, Redo, Unindent (Shift+Tab) and Indent (Tab). It sits right above the keyboard when the keyboard is open. Indent and Unindent work on the current line or on all selected lines. Tapping a button does not close the keyboard.',
          'The toolbar is shown on phones and touch tablets. It is hidden on a computer with a mouse, where the keyboard shortcuts do the same.',
          'Phone and computer do not share notes yet; sync arrives in a later stage.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and safety of your data',
    blocks: [
      {
        type: 'ul',
        items: [
          'Stage 1 sends nothing over the network. Notes stay in this browser only.',
          'Because data is only in the browser, it can be lost if site data is cleared, the browser profile is deleted, or the browser removes storage of sites it considers unused (some mobile browsers do this after a period of inactivity).',
          'Deleted notes remain in the browser database (soft delete) until site data is cleared.',
          'When Google sync is added, it will use only the app-private Drive "appdata" area (scope drive.appdata), which cannot see your other Drive files.',
        ],
      },
    ],
  },
  {
    id: 'limitations',
    title: 'Limitations in this version',
    blocks: [
      {
        type: 'ul',
        items: [
          'No search yet.',
          'No export or import of notes.',
          'No trash / restore screen for deleted items.',
          'No drag and drop (use Move to…).',
          'Only headings and strong text are formatted; no italic, links, lists or code blocks, and no Markdown preview.',
          'On a phone there are no keyboard shortcuts for moving or duplicating lines, or for fold all / unfold all.',
          'No images, no Google sign-in, no sync.',
          'Undo history is not kept after switching notes or reloading.',
          'Heading colours and sizes and the theme cannot be changed in settings (only the indent width can).',
        ],
      },
    ],
  },
  {
    id: 'roadmap',
    title: 'Roadmap',
    blocks: [
      {
        type: 'ul',
        items: [
          'Stage 1: local notes, folders, editor, IndexedDB, dark theme (done).',
          'Stage 2 (now): installable app (PWA) with offline support, published on GitHub Pages.',
          'Later: Google sign-in and background sync through Drive appdata (last write wins, with a backup before overwriting).',
          'Later: images, compressed and stored separately and referenced from notes.',
        ],
      },
      {
        type: 'p',
        text: 'Synchronisation will never block typing: notes are always read and written locally first, and the cloud is updated in the background.',
      },
    ],
  },
  {
    id: 'tech',
    title: 'Technical details',
    blocks: [
      {
        type: 'ul',
        items: [
          'Stack: TypeScript, Svelte 5, Vite, CodeMirror 6, IndexedDB via the idb library. No backend.',
          'Editor modules: @codemirror/state, view, commands and language (language is used only for folding and bracket matching). There is no Markdown parser.',
          'Storage: IndexedDB database "cloudtxt", version 1, object stores folders, notes, meta. Items are written inside a transaction; the in-memory state updates first and the write follows.',
          'Autosave: debounced 400ms; flushes on note switch, visibilitychange (hidden) and pagehide.',
          'Fold persistence: the editor reports the line numbers of folded lines (CodeMirror foldedRanges) after every fold, unfold or edit; the store keeps a map noteId → line numbers in the meta store key "folds" (debounced like autosave, entries for deleted notes are pruned on startup). When a note opens, each saved line is turned back into a fold range with foldable() and applied with foldEffect.',
          'IDs: base-36 timestamp plus random suffix, so ids are roughly sortable by creation time.',
          'Indent folding: a custom CodeMirror fold service that folds from the end of a line to the last following non-blank line that is indented deeper than it. Indent columns are measured with the editor tab size, which is the global "Indent" setting (2, 4, 6 or 8; default 4) stored in the meta store under tabSize and applied through a CodeMirror compartment, so changing it updates the open note instantly.',
          'Strong text: a second CodeMirror view plugin finds /!!(?=\\S)([^\\n]*?\\S)!!/g on visible lines, marks the text between the "!!" with the class cm-strong (red, bold) and hides the two "!!" marks with replace decorations, except on lines that touch the selection. Only the hidden marks are atomic, so the cursor skips the marks but can enter the text. The outline removes the marks from heading text.',
          'Outline: the editor scans the lines of the note for the heading pattern after every change and reports the list only when it differs from the last one. The outline panel highlights the last heading at or above the cursor line. Jumping dispatches a selection plus EditorView.scrollIntoView(y: start), and unfolds any folded range that contains the target line. The desktop open/closed choice is stored in the meta store key "outlineOpen"; the phone drawer always starts closed.',
          'Headings: a CodeMirror view plugin matches /^([ \t]*)(#{1,6})[ \t]+/ on visible lines, adds a line decoration (cm-h1…cm-h6, which set size, colour and bold) and hides the marks with a replace decoration, except on lines that touch the selection. The hidden range is registered as an atomic range so the cursor skips over it. Leading indentation is wrapped in a mark that keeps the normal font size, is never broken across rows and uses a tab width of N "ch", so indented headings stay aligned with normal lines. A second plugin gives every indented line padding-left equal to its indentation (columns times --cw, one "ch" of the normal editor font, a registered CSS length) with a matching negative text-indent, which is what makes wrapped rows hang under the text. The width comes from CSS, not from a measurement in JavaScript, so it cannot go out of date while you type. Heading sizes are CSS variables (--h1-size…--h6-size in app.css) with smaller values under 768px.',
          'Run locally: npm install, then npm run dev (add -- --host to open it from a phone on the same Wi-Fi). Build with npm run build. In dev mode the app is served from /cloudtxt/ (for example http://localhost:5173/cloudtxt/).',
          'PWA: vite-plugin-pwa generates a web app manifest and a service worker (Workbox) at build time. Every built file is precached when the service worker installs (about 17 files, 0.4 MB), and page navigations fall back to the cached index.html, so the app opens with no network. The service worker only caches the app files; your notes are in IndexedDB, which it does not touch.',
          'PWA updates: the service worker is registered in "prompt" mode, so a new version downloads in the background and waits instead of reloading under your fingers. The app checks on start, on visibilitychange (visible) and every hour. When the page becomes hidden, a waiting update is applied immediately after flushing pending edits, which makes normal use feel auto-updating; when the page is visible the "A new version is ready" banner is used instead. Tapping Update flushes, activates the new worker and reloads (controllerchange).',
          'Icons: public/icons/icon-192.png, icon-512.png and icon-maskable-512.png use the same artwork (the Vite logo on a white #ffffff background, logo inside the 80% maskable safe zone) and are declared "any maskable" / "maskable", so Android uses the whole picture as the adaptive icon instead of padding it onto a white tile. The white background is deliberate: launchers that draw their own white tile behind a legacy shortcut no longer show a visible frame. apple-touch-icon.png (180x180) is used by iOS. Installed icons are baked in at install time, so a changed icon only shows after the app is re-added.',
          'Deployment: GitHub Actions (.github/workflows/static.yml) builds on every push to master and publishes dist to GitHub Pages. The site is served from the /cloudtxt/ path, which is the Vite base in vite.config.ts.',
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    blocks: [
      {
        type: 'table',
        head: ['Problem', 'What to check'],
        rows: [
          ['My notes are gone', 'Are you in the same browser, profile and address as before? Was site data cleared? Private windows start empty every time.'],
          ['Phone shows no notes', 'Expected: phone and computer have separate storage until sync exists.'],
          ['No fold arrow on a line', 'A line only folds if the lines below it are indented deeper. Indent the children with Tab.'],
          ['Heading looks like plain text', 'The # marks must be followed by a space, with 1 to 6 # characters. No space, or 7+ #, means it is plain text.'],
          ['I cannot see the # marks', 'They are hidden when the cursor is on another line. Click on the heading line to show them.'],
          ['Cannot indent on phone', 'Soft keyboards often lack Tab. Paste a Tab character or use a hardware keyboard.'],
          ['Changes are not saved', 'Wait half a second after typing. If the browser blocks storage (some private modes), saving may fail; check the browser console for "IndexedDB write failed".'],
        ],
      },
    ],
  },
  {
    id: 'deleting',
    title: 'Removing cloudtxt completely',
    blocks: [
      {
        type: 'p',
        text: 'The sidebar has a "Delete app guide" button with a checklist of everything to remove (hosting, Google data, local data, and so on). It is written for the developer and is updated whenever a new service is added.',
      },
    ],
  },
]
