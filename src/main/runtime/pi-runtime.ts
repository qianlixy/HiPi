import { PiRuntimeStatus } from '../types'
import { getPiSdk } from '../sdk/pi-sdk'

export const SDK_VERSION = '0.84.4'

export class PiRuntimeManager {
  private runtimeDir: string
  private isUpdating = false
  private cachedLatestVersion: string | null = null
  private version: string = SDK_VERSION

  constructor() {
    this.runtimeDir = 'Built-in (@earendil-works/pi-coding-agent)'
    getPiSdk()
      .then((sdk) => {
        if (sdk.VERSION) {
          this.version = sdk.VERSION
        }
      })
      .catch(() => {})
  }

  getRuntimeDir(): string {
    return this.runtimeDir
  }

  getExecutablePath(): string {
    return 'built-in'
  }

  async ensureRuntime(): Promise<PiRuntimeStatus> {
    return await this.getStatus()
  }

  isInstalled(): boolean {
    return true
  }

  getInstalledVersion(): string {
    return this.version
  }

  async getLatestOnlineVersion(): Promise<string | null> {
    try {
      const res = await fetch('https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        const data = (await res.json()) as { version?: string }
        if (data.version) {
          this.cachedLatestVersion = data.version
          return data.version
        }
      }
    } catch {}
    return this.cachedLatestVersion
  }

  async installOrUpdate(): Promise<{ success: boolean; version?: string; error?: string }> {
    return { success: true, version: this.version }
  }

  async getStatus(): Promise<PiRuntimeStatus> {
    const version = this.getInstalledVersion()
    let latestVersion = this.cachedLatestVersion
    if (!latestVersion) {
      this.getLatestOnlineVersion().catch(() => {})
    }

    return {
      installed: true,
      version,
      latestVersion,
      runtimeDir: this.runtimeDir,
      isUpdating: false,
      error: null
    }
  }
}
