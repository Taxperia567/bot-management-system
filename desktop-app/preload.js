const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Store operations
    getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
    
    // File operations
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    
    // Bot operations
    scanBots: () => ipcRenderer.invoke('scan-bots'),
    syncToRaspberry: () => ipcRenderer.invoke('sync-to-raspberry'),
    testRaspberryConnection: (config) => ipcRenderer.invoke('test-raspberry-connection', config),
    
    // Event listeners
    onBotDirectorySelected: (callback) => ipcRenderer.on('bot-directory-selected', callback),
    onFileChanged: (callback) => ipcRenderer.on('file-changed', callback),
    onFileAdded: (callback) => ipcRenderer.on('file-added', callback),
    onFileRemoved: (callback) => ipcRenderer.on('file-removed', callback),
    onBotsScanned: (callback) => ipcRenderer.on('bots-scanned', callback),
    onScanError: (callback) => ipcRenderer.on('scan-error', callback),
    onSyncStarted: (callback) => ipcRenderer.on('sync-started', callback),
    onSyncCompleted: (callback) => ipcRenderer.on('sync-completed', callback),
    onSyncError: (callback) => ipcRenderer.on('sync-error', callback),
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
    onRefreshBots: (callback) => ipcRenderer.on('refresh-bots', callback),
    onOpenRaspberryConnection: (callback) => ipcRenderer.on('open-raspberry-connection', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});