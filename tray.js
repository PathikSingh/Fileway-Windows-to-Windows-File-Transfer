/**
 * tray.js - System Tray functionality for Fileway
 * Keeps app running in background when window is closed
 */

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTray(mainWindow, iconPath) {
    // Create tray icon
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    tray.setToolTip('Fileway - LAN File Sharing');

    // Context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Fileway',
            click: () => {
                mainWindow.show();
                mainWindow.focus();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                // Set flag to indicate intentional quit
                global.isQuitting = true;
                require('electron').app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Click on tray icon shows/hides window
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Double-click shows window
    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    return tray;
}

function showTrayNotification(title, body) {
    if (tray) {
        tray.displayBalloon({
            title: title,
            content: body,
            icon: null,
            respectQuietTime: false
        });
    }
}

function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

module.exports = {
    createTray,
    showTrayNotification,
    destroyTray
};
