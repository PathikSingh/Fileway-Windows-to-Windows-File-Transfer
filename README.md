# Fileway

**Windows-to-Windows LAN File Sharing Desktop App**

Fileway is a desktop application built with Electron that enables fast, peer-to-peer file sharing between Windows devices on the same local network. No internet required — files transfer directly between devices over LAN.

![Fileway](assets/icon.png)

## Features

- 🔍 **Auto Device Discovery** — Automatically detects other Fileway devices on the same network via UDP broadcast
- 📁 **Direct File Transfer** — Peer-to-peer TCP file transfer with real-time progress tracking
- 🔔 **Transfer Notifications** — Windows desktop notifications for incoming files, completions, and rejections
- 🖥️ **System Tray** — Runs silently in the background, always ready to receive files
- ⚙️ **Settings** — Customizable download location, device name, notification preferences, and more
- 🎨 **Premium Dark UI** — Modern, sleek dark theme with purple accents

## Tech Stack

| Component | Technology                 |
| --------- | -------------------------- |
| Framework | Electron                   |
| Discovery | UDP Broadcast (port 41234) |
| Transfer  | TCP Sockets (port 41235)   |
| Storage   | electron-store             |
| UI        | HTML, CSS, JavaScript      |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/fileway.git
cd fileway

# Install dependencies
npm install

# Run the app
npm start
```

### Build for Windows

```bash
npm run build
```

This will create an installable `.exe` in the `dist/` folder.

## How It Works

1. **Login** with a test email ending in `@fileway.local` and OTP `123456`
2. **Set your name** on first login
3. **Discover devices** — other Fileway instances on the same WiFi appear automatically
4. **Send files** — Select a device, pick a file, and send
5. **Receive files** — Accept or reject incoming file transfers with desktop notifications

## Project Structure

```
fileway/
├── main.js            # Main Electron process
├── preload.js         # Secure IPC bridge
├── discovery.js       # UDP device discovery
├── fileTransfer.js    # TCP file transfer
├── store.js           # Local data persistence
├── tray.js            # System tray integration
├── fileway.bat        # Quick-start script
├── package.json       # Dependencies & scripts
├── assets/
│   └── icon.png       # App icon
├── renderer/
│   ├── home.html      # Main dashboard
│   ├── login.html     # Login page
│   ├── otp.html       # OTP verification
│   ├── name.html      # Name setup
│   ├── send.html      # Send file UI
│   ├── receive.html   # Receive file UI
│   └── settings.html  # Settings page
└── styles/
    └── main.css       # Stylesheet
```

## Roadmap

- [x] **v1.0** — Windows ↔ Windows LAN file transfer
- [ ] Android ↔ Windows transfer
- [ ] Windows ↔ iOS transfer
- [ ] iOS ↔ Windows transfer
- [ ] Cross-network transfer (different WiFi / cities)

## License

MIT
