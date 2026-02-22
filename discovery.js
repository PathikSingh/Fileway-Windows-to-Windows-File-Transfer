/**
 * discovery.js - LAN Device Discovery using UDP Broadcast
 * Broadcasts presence and listens for other Fileway devices
 */

const dgram = require('dgram');
const os = require('os');
const EventEmitter = require('events');

const DISCOVERY_PORT = 41234;
const BROADCAST_INTERVAL = 3000; // 3 seconds
const DEVICE_TIMEOUT = 10000; // 10 seconds

class DeviceDiscovery extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.broadcastInterval = null;
        this.devices = new Map(); // deviceId -> deviceInfo
        this.myDeviceId = null;
        this.myDeviceName = null;
        this.myEmail = null;
        this.isRunning = false;
    }

    /**
     * Start discovery service
     */
    start(deviceId, deviceName, email) {
        if (this.isRunning) return;

        this.myDeviceId = deviceId;
        this.myDeviceName = deviceName;
        this.myEmail = email;

        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
            console.error('Discovery socket error:', err);
            this.socket.close();
        });

        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });

        this.socket.on('listening', () => {
            this.socket.setBroadcast(true);
            console.log('Discovery service listening on port', DISCOVERY_PORT);
            this.startBroadcasting();
        });

        this.socket.bind(DISCOVERY_PORT);
        this.isRunning = true;

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleDevices();
        }, 5000);
    }

    /**
     * Stop discovery service
     */
    stop() {
        if (!this.isRunning) return;

        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.devices.clear();
        this.isRunning = false;
    }

    /**
     * Update email (after login)
     */
    updateEmail(email) {
        this.myEmail = email;
    }

    /**
     * Update device name
     */
    updateDeviceName(name) {
        this.myDeviceName = name;
    }

    /**
     * Start broadcasting presence
     */
    startBroadcasting() {
        const broadcast = () => {
            if (!this.socket || !this.myEmail) return;

            const message = JSON.stringify({
                type: 'presence',
                deviceId: this.myDeviceId,
                deviceName: this.myDeviceName,
                email: this.myEmail,
                timestamp: Date.now()
            });

            const broadcastAddresses = this.getBroadcastAddresses();
            
            broadcastAddresses.forEach(addr => {
                this.socket.send(message, DISCOVERY_PORT, addr, (err) => {
                    if (err) console.error('Broadcast error:', err);
                });
            });
        };

        // Broadcast immediately
        broadcast();

        // Then broadcast periodically
        this.broadcastInterval = setInterval(broadcast, BROADCAST_INTERVAL);
    }

    /**
     * Get all broadcast addresses for local networks
     */
    getBroadcastAddresses() {
        const addresses = [];
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                // Skip internal and non-IPv4 addresses
                if (iface.internal || iface.family !== 'IPv4') continue;

                // Calculate broadcast address
                const ip = iface.address.split('.').map(Number);
                const mask = iface.netmask.split('.').map(Number);
                const broadcast = ip.map((octet, i) => (octet | (~mask[i] & 255)));
                addresses.push(broadcast.join('.'));
            }
        }

        // Fallback to default broadcast
        if (addresses.length === 0) {
            addresses.push('255.255.255.255');
        }

        return addresses;
    }

    /**
     * Handle incoming discovery message
     */
    handleMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());

            if (data.type !== 'presence') return;
            if (data.deviceId === this.myDeviceId) return; // Ignore own messages

            const deviceInfo = {
                deviceId: data.deviceId,
                deviceName: data.deviceName,
                email: data.email,
                ip: rinfo.address,
                lastSeen: Date.now()
            };

            const isNew = !this.devices.has(data.deviceId);
            this.devices.set(data.deviceId, deviceInfo);

            if (isNew) {
                this.emit('deviceFound', deviceInfo);
            }

            this.emit('devicesUpdated', this.getDeviceList());
        } catch (err) {
            // Ignore malformed messages
        }
    }

    /**
     * Remove devices that haven't been seen recently
     */
    cleanupStaleDevices() {
        const now = Date.now();
        let changed = false;

        for (const [deviceId, info] of this.devices) {
            if (now - info.lastSeen > DEVICE_TIMEOUT) {
                this.devices.delete(deviceId);
                this.emit('deviceLost', info);
                changed = true;
            }
        }

        if (changed) {
            this.emit('devicesUpdated', this.getDeviceList());
        }
    }

    /**
     * Get list of all discovered devices
     */
    getDeviceList() {
        return Array.from(this.devices.values());
    }

    /**
     * Find device by email
     */
    findDeviceByEmail(email) {
        for (const device of this.devices.values()) {
            if (device.email === email) {
                return device;
            }
        }
        return null;
    }

    /**
     * Find device by ID
     */
    findDeviceById(deviceId) {
        return this.devices.get(deviceId) || null;
    }
}

module.exports = DeviceDiscovery;
