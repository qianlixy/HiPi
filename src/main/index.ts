import { app, shell, BrowserWindow, Menu, MenuItem, clipboard } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { PiRuntimeManager } from './runtime/pi-runtime'
import { AgentSessionManager } from './sdk/agent-session-manager'
import { SessionScanner } from './session/session-scanner'
import { SettingsStore } from './store'
import { registerIpcHandlers, safeOpenExternal } from './ipc/register-handlers'

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

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL()
    if (url !== currentUrl) {
      event.preventDefault()
      safeOpenExternal(url).catch((err) => {
        console.error('Failed to open external link on will-navigate:', err)
      })
    }
  })

  // Setup context menu for text selection, links, and input elements
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo', label: '撤销' }))
      menu.append(new MenuItem({ role: 'redo', label: '重做' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'cut', label: '剪切' }))
      menu.append(new MenuItem({ role: 'copy', label: '复制' }))
      menu.append(new MenuItem({ role: 'paste', label: '粘贴' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'selectAll', label: '全选' }))
      menu.popup()
      return
    }

    const hasSelection = Boolean(params.selectionText && params.selectionText.trim().length > 0)

    if (hasSelection) {
      menu.append(new MenuItem({ role: 'copy', label: '复制' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'selectAll', label: '全选' }))
    }

    if (params.linkURL) {
      if (hasSelection) menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: '复制链接地址',
          click: () => clipboard.writeText(params.linkURL)
        })
      )
    }

    if (menu.items.length > 0) {
      menu.popup()
    }
  })

  // Load URL
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            role: 'appMenu' as const,
            label: app.name
          }
        ]
      : []),
    {
      role: 'fileMenu',
      label: '文件'
    },
    {
      role: 'editMenu',
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      role: 'viewMenu',
      label: '视图'
    },
    {
      role: 'windowMenu',
      label: '窗口'
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(async () => {
  setupApplicationMenu()

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
