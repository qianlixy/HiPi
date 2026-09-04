import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { PiRuntimeManager } from './runtime/pi-runtime'
import { WorkspaceProcessPool } from './rpc/process-pool'
import { SessionScanner } from './session/session-scanner'
import { SettingsStore } from './store'
import { registerIpcHandlers } from './ipc/register-handlers'

let mainWindow: BrowserWindow | null = null

const settingsStore = new SettingsStore()
const runtimeManager = new PiRuntimeManager()
const processPool = new WorkspaceProcessPool(runtimeManager)
const sessionScanner = new SessionScanner()

// Apply environment variables from store
processPool.setEnv(settingsStore.getEnv())

function createWindow(): void {
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
      preload: join(__dirname, '../preload/index.js'),
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
    processPool,
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
  processPool.stopAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  processPool.stopAll()
})
