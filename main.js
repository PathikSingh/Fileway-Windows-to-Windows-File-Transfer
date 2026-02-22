/**
 * main.js - Main process entry point for Fileway
 * Handles app lifecycle, window management, and IPC
 */

const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron');
const path = require('path');
const store = require('./store');
const DeviceDiscovery = require('./discovery');
const FileTransfer = require('./fileTransfer');
const { createTray, destroyTray } = require('./tray');

// Prevent garbage collection
let mainWindow = null;
let discovery = null;
let fileTransfer = null;
let tray = null;

// Quitting flag
global.isQuitting = false;

// ==================== HARDCODED TEST CREDENTIALS ====================
const VALID_OTP = '123456';
const VALID_EMAIL_DOMAIN = '@fileway.local';

function isValidTestCredentials(email, otp) {
    // Accept any email ending with @fileway.local
    const isValidEmail = email.toLowerCase().endsWith(VALID_EMAIL_DOMAIN);
    const isValidOtp = otp === VALID_OTP;
    return isValidEmail && isValidOtp;
}

// ==================== WINDOW CREATION ====================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 920,
        height: 620,
        minWidth: 800,
        minHeight: 500,
        frame: false,
        transparent: false,
        backgroundColor: '#0d0d0d',
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    // Determine which page to load
    const profile = store.getProfile();
    let startPage = 'login.html';
    
    if (profile.isLoggedIn && profile.firstName) {
        startPage = 'home.html';
    }

    mainWindow.loadFile(path.join(__dirname, 'renderer', startPage));

    // Hide to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!global.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Create system tray
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    tray = createTray(mainWindow, iconPath);
}

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
    // Initialize device ID
    store.initializeDevice();

    // Create main window
    createWindow();

    // Initialize discovery and file transfer if logged in
    const profile = store.getProfile();
    if (profile.isLoggedIn) {
        startServices(profile.email);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // On Windows, keep app running
    // Only quit if isQuitting is true
});

app.on('before-quit', () => {
    global.isQuitting = true;
    stopServices();
    destroyTray();
});

// ==================== SERVICES ====================

function startServices(email) {
    // Start discovery
    discovery = new DeviceDiscovery();
    discovery.start(
        store.getDeviceId(),
        store.getDeviceName(),
        email
    );

    discovery.on('devicesUpdated', (devices) => {
        if (mainWindow) {
            mainWindow.webContents.send('discovery:devices-updated', devices);
        }
    });

    // Start file transfer server
    fileTransfer = new FileTransfer();
    fileTransfer.startServer(email);

    fileTransfer.on('transferRequest', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('transfer:request', data);
            mainWindow.show();
            mainWindow.focus();
        }

        // Show Windows notification
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'Fileway - Incoming File',
                body: `${data.senderEmail} wants to send you "${data.fileName}"`,
                icon: path.join(__dirname, 'assets', 'icon.png')
            });

            notification.on('click', () => {
                mainWindow.show();
                mainWindow.focus();
            });

            notification.show();
        }
    });

    fileTransfer.on('transferProgress', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('transfer:progress', data);
        }
    });

    fileTransfer.on('transferComplete', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('transfer:complete', data);
        }

        if (Notification.isSupported()) {
            new Notification({
                title: 'Fileway - Transfer Complete',
                body: `"${data.fileName}" has been received!`,
                icon: path.join(__dirname, 'assets', 'icon.png')
            }).show();
        }
    });

    fileTransfer.on('transferAccepted', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('transfer:accepted', data);
        }
    });

    fileTransfer.on('transferRejected', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('transfer:rejected', data);
        }

        if (Notification.isSupported()) {
            new Notification({
                title: 'Fileway - Transfer Rejected',
                body: `"${data.fileName}" was rejected by recipient.`,
                icon: path.join(__dirname, 'assets', 'icon.png')
            }).show();
        }
    });

    fileTransfer.on('sendComplete', (data) => {
        if (Notification.isSupported()) {
            new Notification({
                title: 'Fileway - File Sent',
                body: `File has been sent successfully!`,
                icon: path.join(__dirname, 'assets', 'icon.png')
            }).show();
        }
    });
}

function stopServices() {
    if (discovery) {
        discovery.stop();
        discovery = null;
    }
    if (fileTransfer) {
        fileTransfer.stopServer();
        fileTransfer = null;
    }
}

// ==================== IPC HANDLERS: AUTH ====================

ipcMain.handle('auth:verify-otp', async (event, email, otp) => {
    if (isValidTestCredentials(email, otp)) {
        store.setEmail(email);
        
        // Check if name already exists for this email
        const hasName = store.hasNameForEmail(email);
        
        // Start services
        startServices(email);
        
        return { success: true, hasName };
    }
    return { success: false, error: 'Invalid OTP' };
});

ipcMain.handle('auth:save-name', async (event, firstName, lastName) => {
    store.setName(firstName, lastName);
    
    // Update discovery with email
    if (discovery) {
        discovery.updateEmail(store.getEmail());
    }
    
    return { success: true };
});

ipcMain.handle('auth:get-profile', async () => {
    return store.getProfile();
});

ipcMain.handle('auth:check-name-exists', async (event, email) => {
    return store.hasNameForEmail(email);
});

ipcMain.handle('auth:logout', async () => {
    stopServices();
    store.logout();
    return { success: true };
});

// ==================== IPC HANDLERS: NAVIGATION ====================

ipcMain.on('nav:goto', (event, page) => {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'renderer', page));
    }
});

// ==================== IPC HANDLERS: DISCOVERY ====================

ipcMain.handle('discovery:get-devices', async () => {
    if (discovery) {
        return discovery.getDeviceList();
    }
    return [];
});

ipcMain.handle('discovery:find-by-email', async (event, email) => {
    if (discovery) {
        return discovery.findDeviceByEmail(email);
    }
    return null;
});

// ==================== IPC HANDLERS: FILE TRANSFER ====================

ipcMain.handle('transfer:select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select File to Send'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false };
});

ipcMain.handle('transfer:send-file', async (event, deviceId, filePath) => {
    if (!discovery || !fileTransfer) {
        return { success: false, error: 'Services not running' };
    }

    const device = discovery.findDeviceById(deviceId);
    if (!device) {
        return { success: false, error: 'Device not found' };
    }

    try {
        const result = await fileTransfer.sendFile(device.ip, filePath, store.getEmail());
        return { success: true, ...result };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('transfer:accept', async (event, transferId) => {
    if (fileTransfer) {
        return fileTransfer.acceptTransfer(transferId);
    }
    return false;
});

ipcMain.handle('transfer:reject', async (event, transferId) => {
    if (fileTransfer) {
        return fileTransfer.rejectTransfer(transferId);
    }
    return false;
});

ipcMain.handle('transfer:cancel', async (event, transferId) => {
    if (fileTransfer) {
        return fileTransfer.cancelTransfer(transferId);
    }
    return false;
});

ipcMain.handle('transfer:open-folder', async () => {
    if (fileTransfer) {
        const folderPath = fileTransfer.getReceivePath();
        shell.openPath(folderPath);
        return true;
    }
    return false;
});

// ==================== IPC HANDLERS: SETTINGS ====================

ipcMain.handle('settings:get-all', async () => {
    return store.getSettings();
});

ipcMain.handle('settings:set', async (event, key, value) => {
    store.setSetting(key, value);
    return { success: true };
});

ipcMain.handle('settings:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Download Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        store.setSetting('downloadLocation', folderPath);
        return { success: true, path: folderPath };
    }
    return { success: false };
});

ipcMain.handle('settings:open-startup', async () => {
    // Open Windows startup settings
    shell.openExternal('ms-settings:startupapps');
    return { success: true };
});

ipcMain.handle('settings:get-device-name', async () => {
    return store.getDeviceName();
});

ipcMain.handle('settings:rename-device', async (event, name) => {
    store.setDeviceName(name);
    // Update discovery if running
    if (discovery) {
        discovery.updateDeviceName(name);
    }
    return { success: true };
});

// ==================== IPC HANDLERS: WINDOW ====================

ipcMain.on('window:minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('window:close', () => {
    if (mainWindow) {
        mainWindow.hide();
    }
});
