const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const fs = require('fs-extra');
const { NodeSSH } = require('node-ssh');
const chokidar = require('chokidar');
const crypto = require('crypto');

// Electron store
const store = new Store();

let mainWindow;
let fileWatcher;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        titleBarStyle: 'default',
        show: false
    });

    const startUrl = isDev 
        ? 'http://localhost:3000' 
        : `file://${path.join(__dirname, '../build/index.html')}`;
    
    mainWindow.loadURL(startUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (fileWatcher) {
            fileWatcher.close();
        }
    });

    // Menü oluştur
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: 'Dosya',
            submenu: [
                {
                    label: 'Bot Klasörü Seç',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        selectBotDirectory();
                    }
                },
                {
                    label: 'Ayarlar',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('open-settings');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Botlar',
            submenu: [
                {
                    label: 'Yenile',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.webContents.send('refresh-bots');
                    }
                },
                {
                    label: 'Tümünü Tara',
                    click: () => {
                        scanAllBots();
                    }
                }
            ]
        },
        {
            label: 'Araçlar',
            submenu: [
                {
                    label: 'Raspberry Pi Bağlantısı',
                    click: () => {
                        mainWindow.webContents.send('open-raspberry-connection');
                    }
                },
                {
                    label: 'Dosya Senkronizasyonu',
                    click: () => {
                        syncFilesToRaspberry();
                    }
                }
            ]
        },
        {
            label: 'Yardım',
            submenu: [
                {
                    label: 'Hakkında',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Bot Management System',
                            message: 'Bot Management System v1.0.0',
                            detail: 'Gelişmiş bot yönetim ve monitoring sistemi'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Bot klasörü seçme
async function selectBotDirectory() {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Bot Klasörünü Seçin'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        store.set('botDirectory', selectedPath);
        
        // Dosya izleyiciyi başlat
        startFileWatcher(selectedPath);
        
        // Ana pencereye bildir
        mainWindow.webContents.send('bot-directory-selected', selectedPath);
        
        // Botları tara
        await scanBotsInDirectory(selectedPath);
    }
}

// Dosya izleyici
function startFileWatcher(directory) {
    if (fileWatcher) {
        fileWatcher.close();
    }

    fileWatcher = chokidar.watch(directory, {
        ignored: /node_modules|\.git/,
        persistent: true,
        ignoreInitial: true
    });

    fileWatcher.on('change', (filePath) => {
        console.log('Dosya değişti:', filePath);
        mainWindow.webContents.send('file-changed', filePath);
    });

    fileWatcher.on('add', (filePath) => {
        console.log('Dosya eklendi:', filePath);
        mainWindow.webContents.send('file-added', filePath);
    });

    fileWatcher.on('unlink', (filePath) => {
        console.log('Dosya silindi:', filePath);
        mainWindow.webContents.send('file-removed', filePath);
    });
}

// Bot klasöründeki botları tara
async function scanBotsInDirectory(directory) {
    try {
        const botFolders = await fs.readdir(directory);
        const bots = [];

        for (const folder of botFolders) {
            const folderPath = path.join(directory, folder);
            const stats = await fs.stat(folderPath);

            if (stats.isDirectory()) {
                const files = await fs.readdir(folderPath);
                const jsFiles = files.filter(file => file.endsWith('.js'));
                
                if (jsFiles.length > 0) {
                    const botData = {
                        name: folder,
                        path: folderPath,
                        mainFile: jsFiles.find(file => 
                            file.includes('index') || 
                            file.includes('main') || 
                            file.includes('bot') ||
                            file === `${folder}.js`
                        ) || jsFiles[0],
                        files: []
                    };

                    // Tüm dosyaları tara
                    for (const file of files) {
                        const filePath = path.join(folderPath, file);
                        const fileStats = await fs.stat(filePath);
                        
                        if (fileStats.isFile()) {
                            const content = await fs.readFile(filePath, 'utf8');
                            const hash = crypto.createHash('sha256').update(content).digest('hex');
                            
                            botData.files.push({
                                name: file,
                                path: filePath,
                                relativePath: file,
                                content: content,
                                hash: hash,
                                size: fileStats.size,
                                lastModified: fileStats.mtime
                            });
                        }
                    }

                    bots.push(botData);
                }
            }
        }

        mainWindow.webContents.send('bots-scanned', bots);
        return bots;

    } catch (error) {
        console.error('Bot tarama hatası:', error);
        mainWindow.webContents.send('scan-error', error.message);
    }
}

// Raspberry Pi'ye dosya senkronizasyonu
async function syncFilesToRaspberry() {
    try {
        const raspberryConfig = store.get('raspberryConfig');
        
        if (!raspberryConfig) {
            dialog.showErrorBox('Hata', 'Raspberry Pi bağlantı bilgileri bulunamadı');
            return;
        }

        const ssh = new NodeSSH();
        
        await ssh.connect({
            host: raspberryConfig.host,
            username: raspberryConfig.username,
            password: raspberryConfig.password,
            port: raspberryConfig.port || 22
        });

        const botDirectory = store.get('botDirectory');
        if (!botDirectory) {
            dialog.showErrorBox('Hata', 'Bot klasörü seçilmemiş');
            return;
        }

        // Senkronizasyon işlemi
        mainWindow.webContents.send('sync-started');

        await ssh.putDirectory(botDirectory, '/home/pi/bots', {
            recursive: true,
            concurrency: 3,
            validate: (itemPath) => {
                return !itemPath.includes('node_modules') && !itemPath.includes('.git');
            }
        });

        ssh.dispose();
        
        mainWindow.webContents.send('sync-completed');
        
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Başarılı',
            message: 'Dosyalar Raspberry Pi\'ye başarıyla senkronize edildi'
        });

    } catch (error) {
        console.error('Senkronizasyon hatası:', error);
        mainWindow.webContents.send('sync-error', error.message);
        
        dialog.showErrorBox('Senkronizasyon Hatası', error.message);
    }
}

// IPC Event Handlers
ipcMain.handle('get-store-value', (event, key) => {
    return store.get(key);
});

ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    if (!result.canceled) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('scan-bots', async () => {
    const botDirectory = store.get('botDirectory');
    if (botDirectory) {
        return await scanBotsInDirectory(botDirectory);
    }
    return [];
});

ipcMain.handle('sync-to-raspberry', async () => {
    await syncFilesToRaspberry();
});

ipcMain.handle('test-raspberry-connection', async (event, config) => {
    try {
        const ssh = new NodeSSH();
        
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            port: config.port || 22
        });

        const result = await ssh.execCommand('echo "Bağlantı başarılı"');
        ssh.dispose();
        
        return { success: true, message: result.stdout };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});