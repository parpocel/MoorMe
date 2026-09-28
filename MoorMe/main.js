// MoorMe – proces główny Electron
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Awaryjny renderer programowy WebGL (komputery bez sterowników GPU, maszyny wirtualne)
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1a2a',
    title: 'MoorMe – symulator cumowania',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Test dymny (CI): MOORME_SMOKE_OUT=plik.png – zrzut ekranu po starcie i zamknięcie
  const smokeOut = process.env.MOORME_SMOKE_OUT;
  if (smokeOut) {
    const errors = [];
    win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errors.push(msg); });
    win.webContents.once('did-finish-load', async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      // przejście kreatora: tytuł -> 4 kroki -> symulacja
      for (let i = 0; i < 5; i++) {
        await win.webContents.executeJavaScript(`document.querySelector('.btn.primary').click()`);
        await wait(400);
      }
      await wait(3000);
      const ok = await win.webContents.executeJavaScript(`!!document.querySelector('#view canvas')`);
      if (!ok) errors.push('Brak widoku 3D');
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(smokeOut, img.toPNG());
      console.log(errors.length ? 'SMOKE ERRORS:\n' + errors.join('\n') : 'SMOKE OK');
      app.exit(errors.length ? 1 : 0);
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
