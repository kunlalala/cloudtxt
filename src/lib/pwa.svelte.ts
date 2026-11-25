import { registerSW } from 'virtual:pwa-register'
import { store } from './store.svelte'

/** State of the service worker, shown as a small banner in App.svelte. */
class Pwa {
  /** a new version is downloaded and waiting for the user */
  updateReady = $state(false)
  /** shown once, right after the first install, then hidden again */
  offlineReady = $state(false)

  private updateSW: ((reload?: boolean) => Promise<void>) | undefined
  private applying = false

  init() {
    this.updateSW = registerSW({
      onNeedRefresh: () => {
        this.updateReady = true
        // nobody is typing while the app is in the background: take the update right away
        if (document.visibilityState === 'hidden') void this.update()
      },
      onOfflineReady: () => {
        this.offlineReady = true
        setTimeout(() => (this.offlineReady = false), 6000)
      },
      onRegisteredSW: (_url, reg) => {
        if (!reg) return
        // look for a new version when the app comes back to the front and once an hour
        const check = () => navigator.onLine && void reg.update().catch(() => {})
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
        setInterval(check, 60 * 60 * 1000)
      },
    })
    // leaving the app with an update still waiting: apply it while it cannot disturb anything
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.updateReady) void this.update()
    })
  }

  /** Save any pending edit first, then swap to the new version and reload. */
  async update() {
    if (this.applying) return
    this.applying = true
    await store.flush()
    // the plugin only reloads tabs that already had a service worker when they opened, so also
    // reload on our own once the new worker takes over
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    await this.updateSW?.(true)
    // if the new worker never took over, allow another attempt later
    setTimeout(() => (this.applying = false), 5000)
  }
}

export const pwa = new Pwa()
