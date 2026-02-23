const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = process.env.PORT || '3210';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

function waitForServer(url, timeoutMs = 12000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error('Server startup timeout'));
          return;
        }
        setTimeout(tryRequest, 250);
      });

      req.setTimeout(1200, () => {
        req.destroy();
      });
    };

    tryRequest();
  });
}

function startBackend() {
  const serverPath = path.join(__dirname, '..', 'src', 'server.js');

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      HOST: SERVER_HOST,
      PORT: SERVER_PORT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => {
    console.log(`[backend] ${chunk.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (chunk) => {
    console.error(`[backend:error] ${chunk.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Backend exited with code ${code}`);
    }
  });
}

function stopBackend() {
  if (!serverProcess || serverProcess.killed) return;

  serverProcess.kill('SIGTERM');
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }, 1500);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0b1220',
    title: 'CinemaFlow',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    startBackend();
    await waitForServer(SERVER_URL);
    await mainWindow.loadURL(`${SERVER_URL}/index.html`);
  } catch (error) {
    dialog.showErrorBox(
      'Ошибка запуска',
      `Не удалось запустить локальный сервер приложения.\n\n${error.message}`
    );
    app.quit();
  }
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
