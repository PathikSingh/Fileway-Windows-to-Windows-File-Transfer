/**
 * fileTransfer.js - TCP-based file transfer for LAN sharing
 * Handles both sending and receiving files with progress tracking
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

const TRANSFER_PORT = 41235;
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

class FileTransfer extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.myEmail = null;
        this.pendingTransfer = null;
        this.activeTransfers = new Map();
        this.receivePath = path.join(os.homedir(), 'Downloads', 'Fileway');
    }

    /**
     * Start the file transfer server
     */
    startServer(email) {
        if (this.server) return;

        this.myEmail = email;

        // Ensure receive directory exists
        if (!fs.existsSync(this.receivePath)) {
            fs.mkdirSync(this.receivePath, { recursive: true });
        }

        this.server = net.createServer((socket) => {
            this.handleIncomingConnection(socket);
        });

        this.server.on('error', (err) => {
            console.error('Transfer server error:', err);
        });

        this.server.listen(TRANSFER_PORT, () => {
            console.log('File transfer server listening on port', TRANSFER_PORT);
        });
    }

    /**
     * Stop the file transfer server
     */
    stopServer() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }

    /**
     * Handle incoming connection from sender
     */
    handleIncomingConnection(socket) {
        let buffer = Buffer.alloc(0);
        let transferInfo = null;
        let fileStream = null;
        let receivedBytes = 0;
        let headerReceived = false;

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);

            // First, wait for the header (JSON with file info)
            if (!headerReceived) {
                const nullIndex = buffer.indexOf(0);
                if (nullIndex !== -1) {
                    const headerStr = buffer.slice(0, nullIndex).toString();
                    buffer = buffer.slice(nullIndex + 1);
                    
                    try {
                        transferInfo = JSON.parse(headerStr);
                        headerReceived = true;

                        // Emit transfer request for user approval
                        this.pendingTransfer = {
                            socket,
                            transferInfo,
                            buffer
                        };

                        this.emit('transferRequest', {
                            senderEmail: transferInfo.senderEmail,
                            fileName: transferInfo.fileName,
                            fileSize: transferInfo.fileSize,
                            transferId: transferInfo.transferId
                        });

                        // Pause socket until user accepts/rejects
                        socket.pause();
                    } catch (err) {
                        console.error('Invalid transfer header:', err);
                        socket.end();
                    }
                }
            }
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
            if (fileStream) fileStream.close();
        });

        socket.on('close', () => {
            if (fileStream) fileStream.close();
        });
    }

    /**
     * Accept pending transfer
     */
    acceptTransfer(transferId) {
        if (!this.pendingTransfer) return false;

        const { socket, transferInfo, buffer } = this.pendingTransfer;
        
        if (transferInfo.transferId !== transferId) return false;

        // Send acceptance response
        socket.write(JSON.stringify({ accepted: true }) + '\0');

        // Create file write stream
        const filePath = path.join(this.receivePath, transferInfo.fileName);
        const fileStream = fs.createWriteStream(filePath);
        let receivedBytes = 0;

        this.activeTransfers.set(transferId, {
            fileStream,
            filePath,
            totalSize: transferInfo.fileSize,
            receivedBytes: 0
        });

        // Process any buffered data
        if (buffer.length > 0) {
            fileStream.write(buffer);
            receivedBytes += buffer.length;
            this.emitProgress(transferId, receivedBytes, transferInfo.fileSize);
        }

        socket.on('data', (chunk) => {
            fileStream.write(chunk);
            receivedBytes += chunk.length;
            this.emitProgress(transferId, receivedBytes, transferInfo.fileSize);

            if (receivedBytes >= transferInfo.fileSize) {
                fileStream.end();
                this.activeTransfers.delete(transferId);
                this.emit('transferComplete', {
                    transferId,
                    filePath,
                    fileName: transferInfo.fileName
                });
            }
        });

        socket.on('close', () => {
            fileStream.end();
            if (receivedBytes >= transferInfo.fileSize) {
                this.emit('transferComplete', {
                    transferId,
                    filePath,
                    fileName: transferInfo.fileName
                });
            }
        });

        // Resume socket
        socket.resume();
        this.pendingTransfer = null;

        return true;
    }

    /**
     * Reject pending transfer
     */
    rejectTransfer(transferId) {
        if (!this.pendingTransfer) return false;

        const { socket, transferInfo } = this.pendingTransfer;
        
        if (transferInfo.transferId !== transferId) return false;

        // Send rejection response
        socket.write(JSON.stringify({ accepted: false }) + '\0');
        socket.end();

        this.pendingTransfer = null;
        return true;
    }

    /**
     * Send a file to a device
     */
    sendFile(deviceIp, filePath, senderEmail) {
        return new Promise((resolve, reject) => {
            const fileName = path.basename(filePath);
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const transferId = Date.now().toString();

            const socket = net.createConnection(TRANSFER_PORT, deviceIp);
            let responseReceived = false;
            let responseBuffer = '';

            socket.on('connect', () => {
                // Send header with file info
                const header = JSON.stringify({
                    transferId,
                    fileName,
                    fileSize,
                    senderEmail
                });

                socket.write(header + '\0');
            });

            socket.on('data', (data) => {
                if (!responseReceived) {
                    responseBuffer += data.toString();
                    const nullIndex = responseBuffer.indexOf('\0');
                    
                    if (nullIndex !== -1) {
                        const responseStr = responseBuffer.slice(0, nullIndex);
                        try {
                            const response = JSON.parse(responseStr);
                            responseReceived = true;

                            if (response.accepted) {
                                this.emit('transferAccepted', { transferId, fileName });
                                this.streamFile(socket, filePath, fileSize, transferId);
                            } else {
                                this.emit('transferRejected', { transferId, fileName });
                                socket.end();
                                resolve({ accepted: false, transferId });
                            }
                        } catch (err) {
                            reject(err);
                        }
                    }
                }
            });

            socket.on('error', (err) => {
                reject(err);
            });

            socket.on('close', () => {
                if (responseReceived) {
                    resolve({ accepted: true, transferId });
                }
            });
        });
    }

    /**
     * Stream file contents to socket
     */
    streamFile(socket, filePath, totalSize, transferId) {
        const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
        let sentBytes = 0;

        fileStream.on('data', (chunk) => {
            socket.write(chunk);
            sentBytes += chunk.length;
            this.emitProgress(transferId, sentBytes, totalSize, 'sending');
        });

        fileStream.on('end', () => {
            this.emit('sendComplete', { transferId, filePath });
            socket.end();
        });

        fileStream.on('error', (err) => {
            console.error('File read error:', err);
            socket.end();
        });
    }

    /**
     * Emit progress event
     */
    emitProgress(transferId, bytes, total, type = 'receiving') {
        const progress = Math.round((bytes / total) * 100);
        this.emit('transferProgress', {
            transferId,
            bytes,
            total,
            progress,
            type
        });
    }

    /**
     * Cancel active transfer
     */
    cancelTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
            transfer.fileStream.close();
            // Delete partial file
            try {
                fs.unlinkSync(transfer.filePath);
            } catch (err) {
                // Ignore if file doesn't exist
            }
            this.activeTransfers.delete(transferId);
            this.emit('transferCancelled', { transferId });
            return true;
        }
        return false;
    }

    /**
     * Get receive path
     */
    getReceivePath() {
        return this.receivePath;
    }
}

module.exports = FileTransfer;
