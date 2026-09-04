import path from 'path'
import fs from 'fs'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { PiRuntimeStatus } from '../types'

const execAsync = promisify(exec)

export class PiRuntimeManager {
  private runtimeDir: string
  private isUpdating = false
  private cachedLatestVersion: string | null = null

  constructor() {
    this.runtimeDir = path.join(os.homedir(), '.hipi', 'pi-runtime')
  }

  getRuntimeDir(): string {
    return this.runtimeDir
  }

  getExecutablePath(): string {
    const binPath = path.join(this.runtimeDir, 'node_modules', '.bin', 'pi')
    if (fs.existsSync(binPath)) {
      return binPath
    }
    // Fallback: check if pi is in system PATH
    return 'pi'
  }

  async ensureRuntime(): Promise<PiRuntimeStatus> {
    try {
      if (!fs.existsSync(this.runtimeDir)) {
        fs.mkdirSync(this.runtimeDir, { recursive: true })
      }

      const pkgJsonPath = path.join(this.runtimeDir, 'package.json')
      if (!fs.existsSync(pkgJsonPath)) {
        fs.writeFileSync(
          pkgJsonPath,
          JSON.stringify(
            {
              name: 'hipi-pi-runtime',
              version: '1.0.0',
              private: true,
              description: 'Isolated runtime sandbox for PI Coding Agent'
            },
            null,
            2
          )
        )
      }

      const installed = this.isInstalled()
      if (!installed) {
        // Automatically install
        await this.installOrUpdate()
      }

      return await this.getStatus()
    } catch (err: any) {
      return {
        installed: false,
        version: null,
        latestVersion: null,
        runtimeDir: this.runtimeDir,
        isUpdating: false,
        error: err.message || String(err)
      }
    }
  }

  isInstalled(): boolean {
    const pkgPath = path.join(
      this.runtimeDir,
      'node_modules',
      '@earendil-works',
      'pi-coding-agent',
      'package.json'
    )
    return fs.existsSync(pkgPath)
  }

  getInstalledVersion(): string | null {
    try {
      const pkgPath = path.join(
        this.runtimeDir,
        'node_modules',
        '@earendil-works',
        'pi-coding-agent',
        'package.json'
      )
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        return pkg.version || null
      }
    } catch {}
    return null
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
    if (this.isUpdating) {
      return { success: false, error: 'Update already in progress' }
    }

    this.isUpdating = true
    try {
      if (!fs.existsSync(this.runtimeDir)) {
        fs.mkdirSync(this.runtimeDir, { recursive: true })
      }

      // Execute npm install @earendil-works/pi-coding-agent@latest
      const { stderr } = await execAsync('npm install @earendil-works/pi-coding-agent@latest --save', {
        cwd: this.runtimeDir,
        timeout: 180000
      })

      const version = this.getInstalledVersion()
      this.isUpdating = false
      return { success: true, version: version ?? undefined }
    } catch (err: any) {
      this.isUpdating = false
      return { success: false, error: err.message || String(err) }
    }
  }

  async getStatus(): Promise<PiRuntimeStatus> {
    const installed = this.isInstalled()
    const version = this.getInstalledVersion()
    let latestVersion = this.cachedLatestVersion
    if (!latestVersion) {
      // fetch in background if not cached
      this.getLatestOnlineVersion().catch(() => {})
    }

    return {
      installed,
      version,
      latestVersion,
      runtimeDir: this.runtimeDir,
      isUpdating: this.isUpdating,
      error: null
    }
  }
}
