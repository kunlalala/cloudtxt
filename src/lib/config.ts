/**
 * Google OAuth settings.
 *
 * CLIENT_ID comes from Google Cloud Console → APIs & Services → Credentials →
 * OAuth 2.0 Client ID (type: Web application). A Client ID is not a secret, so it is
 * fine to ship it inside this static site. Leave it empty to keep the cloud features
 * hidden (that is also what a fresh clone gets).
 */
export const CLIENT_ID = '828784152890-ste8gs275k7esb6bc0h6s3g5ugfijlb2.apps.googleusercontent.com'

/** Only the app's own hidden Drive folder — cloudtxt can never see other Drive files. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

/** The single data file inside Drive appDataFolder. */
export const MAIN_FILE = 'cloudtxt.json'

/** Previous remote version, written before the main file is overwritten. */
export const BACKUP_FILE = 'cloudtxt.backup.json'

/** Older versions, rotated so the last three remote snapshots are kept. */
export const BACKUP_SLOTS = [BACKUP_FILE, 'cloudtxt.backup.1.json', 'cloudtxt.backup.2.json']

/** During automatic sync the slots are only shifted this often, to keep API traffic small. */
export const BACKUP_ROTATE_MS = 10 * 60 * 1000

/** Google access tokens live about 1 hour; refresh a little earlier. */
export const TOKEN_LIFETIME_MS = 55 * 60 * 1000
