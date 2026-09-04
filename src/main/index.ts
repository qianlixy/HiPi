import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { PiRuntimeManager } from './runtime/pi-runtime'
import { AgentSessionManager } from './sdk/agent-session-manager'
import { SessionScanner } from './session/session-scanner'
import { SettingsStore } from './store'
import { registerIpcHandlers } from './ipc/register-handlers'

let mainWindow: BrowserWindow | null = null

const settingsStore = new SettingsStore()
const runtimeManager = new PiRuntimeManager()
const sessionManager = new AgentSessionManager()
const sessionScanner = new SessionScanner()

// Sync initial settings to SDK session manager
sessionManager.syncSettings(settingsStore.getSettings()).catch((err) => {
  console.error('Failed to sync initial settings to SDK session manager:', err)
})

function createWindow(): void {
  const preloadPath = fs.existsSync(join(__dirname, '../preload/index.mjs'))
    ? join(__dirname, '../preload/index.mjs')
    : join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load URL
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Register all IPC handlers
  registerIpcHandlers(
    () => mainWindow,
    runtimeManager,
    sessionManager,
    sessionScanner,
    settingsStore
  )

  createWindow()

  // Ensure PI runtime is initialized in background
  runtimeManager.ensureRuntime().catch((err) => {
    console.error('Failed to initialize PI runtime in background:', err)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  sessionManager.stopAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  sessionManager.stopAll()
})
