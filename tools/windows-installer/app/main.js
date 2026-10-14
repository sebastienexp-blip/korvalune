// Korvalune — application PC (Electron) : ouvre le jeu en plein écran dans sa propre fenêtre.
const { app, BrowserWindow, Menu, shell } = require('electron');
const URL_JEU = process.env.KORVALUNE_URL || 'https://legends-of-aetheria-mxaq.onrender.com';

function creer() {
  const win = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#0b0a10', title: 'Korvalune', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null); win.removeMenu();   // pas de menu : Ctrl+W, Ctrl+R, F3, F5, Ctrl+F, Alt, etc. ne sont plus interceptés, ils arrivent au jeu
  win.webContents.on('context-menu', (e) => e.preventDefault());
  win.loadURL(URL_JEU);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });   // liens externes → navigateur
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (i.key === 'F10' && i.control) win.webContents.reload();   // seul raccourci d'appli : Ctrl+F10 recharge (aucun raccourci de navigateur n'est actif)
  });
  win.webContents.on('did-fail-load', () => { setTimeout(() => win.loadURL(URL_JEU), 4000); });   // serveur qui se réveille : on réessaie
}
app.whenReady().then(creer);
app.on('window-all-closed', () => app.quit());
