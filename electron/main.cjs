const path = require('node:path')
const { app, BrowserWindow, ipcMain, session, shell } = require('electron')

const PRODUCTION_URL = 'https://dentia-app.me'
const developmentUrl = process.env.ELECTRON_START_URL
const applicationUrl = developmentUrl || PRODUCTION_URL
const allowedOrigin = new URL(applicationUrl).origin

let mainWindow = null

function isExternalUrl(targetUrl) {
  try {
    return new URL(targetUrl).origin !== allowedOrigin
  } catch {
    return true
  }
}

async function openExternalUrl(targetUrl) {
  if (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')) {
    await shell.openExternal(targetUrl)
  }
}

async function loadApplication(window) {
  try {
    await window.loadURL(applicationUrl)
  } catch {
    if (!window.isDestroyed()) {
      await window.loadFile(path.join(__dirname, 'offline.html'))
    }
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    title: 'Dentia',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault()
      void openExternalUrl(url)
    }
  })

  void loadApplication(window)

  return window
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.setAppUserModelId('com.dentia.desktop')

  app.on('second-instance', () => {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler(() => false)
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => {
        callback(false)
      },
    )

    ipcMain.on('dentia:retry', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)

      if (window) {
        void loadApplication(window)
      }
    })

    mainWindow = createMainWindow()

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
