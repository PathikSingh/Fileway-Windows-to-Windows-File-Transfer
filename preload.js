/**
 * preload.js - Secure bridge between main and renderer processes
 * Exposes safe IPC methods via contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileway', {
    // ==================== AUTH ====================
    
    /**
     * Verify OTP for email
     */
    verifyOtp: (email, otp) => ipcRenderer.invoke('auth:verify-otp', email, otp),
    
    /**
     * Save user name
     */
    saveName: (firstName, lastName) => ipcRenderer.invoke('auth:save-name', firstName, lastName),
    
    /**
     * Get user profile
     */
    getProfile: () => ipcRenderer.invoke('auth:get-profile'),
    
    /**
     * Check if name exists for email
     */
    checkNameExists: (email) => ipcRenderer.invoke('auth:check-name-exists', email),
    
    /**
     * Logout user
     */
    logout: () => ipcRenderer.invoke('auth:logout'),

    // ==================== NAVIGATION ====================
    
    /**
     * Navigate to a page
     */
    navigateTo: (page) => ipcRenderer.send('nav:goto', page),

    // ==================== DISCOVERY ====================
    
    /**
     * Get list of discovered devices
     */
    getDevices: () => ipcRenderer.invoke('discovery:get-devices'),
    
    /**
     * Listen for device list updates
     */
    onDevicesUpdated: (callback) => {
        ipcRenderer.on('discovery:devices-updated', (event, devices) => callback(devices));
    },
    
    /**
     * Find device by email
     */
    findDeviceByEmail: (email) => ipcRenderer.invoke('discovery:find-by-email', email),

    // ==================== FILE TRANSFER ====================
    
    /**
     * Select a file to send
     */
    selectFile: () => ipcRenderer.invoke('transfer:select-file'),
    
    /**
     * Send file to device
     */
    sendFile: (deviceId, filePath) => ipcRenderer.invoke('transfer:send-file', deviceId, filePath),
    
    /**
     * Accept incoming transfer
     */
    acceptTransfer: (transferId) => ipcRenderer.invoke('transfer:accept', transferId),
    
    /**
     * Reject incoming transfer
     */
    rejectTransfer: (transferId) => ipcRenderer.invoke('transfer:reject', transferId),
    
    /**
     * Cancel ongoing transfer
     */
    cancelTransfer: (transferId) => ipcRenderer.invoke('transfer:cancel', transferId),
    
    /**
     * Listen for incoming transfer requests
     */
    onTransferRequest: (callback) => {
        ipcRenderer.on('transfer:request', (event, data) => callback(data));
    },
    
    /**
     * Listen for transfer progress
     */
    onTransferProgress: (callback) => {
        ipcRenderer.on('transfer:progress', (event, data) => callback(data));
    },
    
    /**
     * Listen for transfer completion
     */
    onTransferComplete: (callback) => {
        ipcRenderer.on('transfer:complete', (event, data) => callback(data));
    },
    
    /**
     * Listen for transfer accepted/rejected
     */
    onTransferAccepted: (callback) => {
        ipcRenderer.on('transfer:accepted', (event, data) => callback(data));
    },
    
    onTransferRejected: (callback) => {
        ipcRenderer.on('transfer:rejected', (event, data) => callback(data));
    },
    
    /**
     * Open receive folder in explorer
     */
    openReceiveFolder: () => ipcRenderer.invoke('transfer:open-folder'),

    // ==================== SETTINGS ====================
    
    /**
     * Get all settings
     */
    getSettings: () => ipcRenderer.invoke('settings:get-all'),
    
    /**
     * Update a setting
     */
    setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    
    /**
     * Select folder for download location
     */
    selectFolder: () => ipcRenderer.invoke('settings:select-folder'),
    
    /**
     * Open OS startup settings
     */
    openStartupSettings: () => ipcRenderer.invoke('settings:open-startup'),
    
    /**
     * Get current device name
     */
    getDeviceName: () => ipcRenderer.invoke('settings:get-device-name'),
    
    /**
     * Rename current device
     */
    renameDevice: (name) => ipcRenderer.invoke('settings:rename-device', name),

    // ==================== WINDOW ====================
    
    /**
     * Minimize window
     */
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    
    /**
     * Close window (hide to tray)
     */
    closeWindow: () => ipcRenderer.send('window:close')
});
