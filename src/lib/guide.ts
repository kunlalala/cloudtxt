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

export const GUIDE_UPDATED = 'Stage 1 (local-only version)'

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
        title: 'Take down the static site',
        detail:
          'Not deployed yet. Once deployed, write here: hosting platform, project name, console link, how to delete it.',
        status: 'planned',
        stage: 'fill in when deployed',
      },
      {
        id: 'domain',
        title: 'Remove the domain / DNS records (if any)',
        detail:
          'Not used yet. Once you have a custom domain, write here: registrar, DNS records, how to cancel renewal.',
        status: 'planned',
        stage: 'fill in when deployed',
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
        stage: 'Stage 2/3: sync and images',
      },
      {
        id: 'drive-revoke',
        title: 'Revoke the app authorization',
        detail: 'Open myaccount.google.com/permissions, find cloudtxt and choose "Delete all connections".',
        status: 'planned',
        stage: 'Stage 2: Google sign-in',
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
        stage: 'Stage 2: Google sign-in',
      },
      {
        id: 'gcp-project',
        title: 'Shut down / delete the Google Cloud project',
        detail:
          'IAM & Admin → Settings → Shut down. The project is kept for about 30 days before permanent deletion. Only do this if the project contains nothing but cloudtxt.',
        status: 'planned',
        stage: 'Stage 2: Google sign-in',
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
        title: 'Uninstall the installed PWA and unregister the service worker',
        detail:
          'Remove the cloudtxt icon from desktops / phone home screens, and clear site data to drop the offline cache.',
        status: 'planned',
        stage: 'Stage 4: PWA',
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
          'Currently only the local cloudtxt folder, with no remote recorded. If you later push to GitHub or similar, write the repo address here and delete it.',
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
