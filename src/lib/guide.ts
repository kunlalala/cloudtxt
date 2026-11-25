/**
 * Teardown ("delete app") checklist for the developer.
 * MAINTENANCE RULE: whenever a new service/resource is added to cloudtxt
 * (hosting, domain, OAuth client, Drive data, PWA, ...), add or update the matching step here.
 * status 'planned' = not in use yet; flip it to 'active' and fill in `detail` once it exists.
 */
export interface GuideStep {
  id: string
  title: string
  detail: string
  status: 'active' | 'planned'
  /** where it becomes relevant, shown for planned steps */
  stage?: string
}

export interface GuideSection {
  title: string
  steps: GuideStep[]
}

export const GUIDE_UPDATED = 'Stage 2 (GitHub Pages + installable PWA)'

export const guide: GuideSection[] = [
  {
    title: '1. Back up (optional, but do it first)',
    steps: [
      {
        id: 'backup',
        title: 'Decide whether to keep your notes',
        detail:
          'Deletion cannot be undone. Copy out anything important first (the app has no export feature yet).',
        status: 'active',
      },
    ],
  },
  {
    title: '2. Hosting / server (take the site down)',
    steps: [
      {
        id: 'hosting',
        title: 'Take down the GitHub Pages site',
        detail:
          'The site is published at https://kunlalala.github.io/cloudtxt/ by the GitHub Actions workflow .github/workflows/static.yml (it runs on every push to master). To take it down: GitHub repo kunlalala/cloudtxt → Settings → Pages → "Unpublish site" (if you do not see it, deleting the repository always removes the site). Deleting only the workflow file does NOT unpublish the site that is already live.',
        status: 'active',
      },
      {
        id: 'domain',
        title: 'Remove the domain / DNS records (if any)',
        detail:
          'No custom domain is used (the address is the free github.io one). If you add one later, write here: registrar, DNS records, how to cancel renewal.',
        status: 'planned',
        stage: 'only if you add a custom domain',
      },
    ],
  },
  {
    title: '3. Google Drive data',
    steps: [
      {
        id: 'drive-data',
        title: 'Delete every file in Drive appdata',
        detail:
          'Includes cloudtxt.json, pre-overwrite backups and compressed images. Google Drive → Settings → Manage apps → cloudtxt → "Delete hidden app data".',
        status: 'planned',
        stage: 'Stage 4–6: Drive sync and images',
      },
      {
        id: 'drive-revoke',
        title: 'Revoke the app authorization',
        detail: 'Open myaccount.google.com/permissions, find cloudtxt and choose "Delete all connections".',
        status: 'planned',
        stage: 'Stage 4: Google sign-in',
      },
    ],
  },
  {
    title: '4. Google Cloud (OAuth / Drive API)',
    steps: [
      {
        id: 'gcp-client',
        title: 'Delete the OAuth Client ID',
        detail:
          'Google Cloud Console → APIs & Services → Credentials → delete the cloudtxt OAuth 2.0 Client ID.',
        status: 'planned',
        stage: 'Stage 3: Google Cloud setup',
      },
      {
        id: 'gcp-project',
        title: 'Shut down / delete the Google Cloud project',
        detail:
          'IAM & Admin → Settings → Shut down. The project is kept for about 30 days before permanent deletion. Only do this if the project contains nothing but cloudtxt.',
        status: 'planned',
        stage: 'Stage 3: Google Cloud setup',
      },
    ],
  },
  {
    title: '5. Local data on every device',
    steps: [
      {
        id: 'local-idb',
        title: 'Clear IndexedDB in the browser',
        detail:
          'Do this in every browser / device you used: browser settings → privacy → site data → find this site → delete; or DevTools → Application → Storage → Clear site data. The database name is cloudtxt.',
        status: 'active',
      },
      {
        id: 'local-pwa',
        title: 'Uninstall the installed app and remove the offline cache',
        detail:
          'On every phone / computer where you installed cloudtxt: remove the home-screen icon or uninstall it (Android: long-press the icon → Uninstall; iPhone: long-press → Remove App; Chrome / Edge on a computer: open the app → menu → "Uninstall cloudtxt"). Then clear the site data for kunlalala.github.io (browser settings → privacy → site data). This also deletes the service worker and its offline cache (named workbox-precache). A browser tab that is still open keeps running the old copy until it is closed.',
        status: 'active',
      },
    ],
  },
  {
    title: '6. Source code and wrap-up',
    steps: [
      {
        id: 'repo',
        title: 'Deal with the source repository',
        detail:
          'The source is the local cloudtxt folder and the GitHub repository https://github.com/kunlalala/cloudtxt (branch master). Delete the repository on GitHub (Settings → General → Danger Zone → Delete this repository), then delete the local folder. Deleting the repository also removes the GitHub Pages site and its Actions history.',
        status: 'active',
      },
      {
        id: 'final',
        title: 'Final check',
        detail:
          'Confirm: the site no longer loads, Drive has no cloudtxt data, cloudtxt is gone from the permissions list, every device is cleaned.',
        status: 'active',
      },
    ],
  },
]
