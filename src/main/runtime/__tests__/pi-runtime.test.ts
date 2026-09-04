import { describe, it, expect } from 'vitest'
import { PiRuntimeManager } from '../pi-runtime'
import { VERSION } from '@earendil-works/pi-coding-agent'

describe('PiRuntimeManager', () => {
  it('should report installed as true with SDK version', async () => {
    const manager = new PiRuntimeManager()
    expect(manager.isInstalled()).toBe(true)
    expect(manager.getInstalledVersion()).toBe(VERSION)
    expect(manager.getRuntimeDir()).toContain('Built-in')
    expect(manager.getExecutablePath()).toBe('built-in')

    const status = await manager.getStatus()
    expect(status.installed).toBe(true)
    expect(status.version).toBe(VERSION)
    expect(status.error).toBeNull()
  })

  it('ensureRuntime should resolve successfully without error', async () => {
    const manager = new PiRuntimeManager()
    const status = await manager.ensureRuntime()
    expect(status.installed).toBe(true)
    expect(status.version).toBe(VERSION)
  })

  it('installOrUpdate should return success with built-in version', async () => {
    const manager = new PiRuntimeManager()
    const res = await manager.installOrUpdate()
    expect(res.success).toBe(true)
    expect(res.version).toBe(VERSION)
  })
})
