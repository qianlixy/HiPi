import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron shell
vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined)
  },
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

import { shell } from 'electron'
import { safeOpenExternal } from '../register-handlers'

describe('safeOpenExternal protocol whitelist and behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow http and https protocols and call shell.openExternal', async () => {
    const httpResult = await safeOpenExternal('http://example.com/test')
    expect(httpResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('http://example.com/test')

    const httpsResult = await safeOpenExternal('https://github.com/qianlixy/hipi')
    expect(httpsResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/qianlixy/hipi')
  })

  it('should allow mailto protocol and call shell.openExternal', async () => {
    const mailtoResult = await safeOpenExternal('mailto:developer@example.com')
    expect(mailtoResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('mailto:developer@example.com')
  })

  it('should block disallowed protocols like javascript: and file:', async () => {
    const jsResult = await safeOpenExternal('javascript:alert(1)')
    expect(jsResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()

    const fileResult = await safeOpenExternal('file:///etc/passwd')
    expect(fileResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()

    const dataResult = await safeOpenExternal('data:text/html,<script>alert(1)</script>')
    expect(dataResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('should safely handle empty, invalid or non-string inputs', async () => {
    expect(await safeOpenExternal('')).toBe(false)
    expect(await safeOpenExternal('not-a-valid-url')).toBe(false)
    expect(await safeOpenExternal(null as any)).toBe(false)
    expect(await safeOpenExternal(undefined as any)).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })
})
