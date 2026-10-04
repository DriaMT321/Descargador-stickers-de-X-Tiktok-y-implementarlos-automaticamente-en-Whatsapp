const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'whatsapp_session');

class WhatsAppService extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'
        this.qrCodeDataUrl = null;
        this.qrRaw = null;
        this.user = null;
        this.reconnectAttempts = 0;
        this.autoProcessEnabled = true;
        this.isConnecting = false;
    }

    async init() {
        if (this.isConnecting || (this.sock && this.status === 'connected')) return;
        this.isConnecting = true;

        this.status = 'connecting';
        this.emit('status', { status: this.status });

        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        
        let version = [2, 3000, 1043857760];
        try {
            const vData = await fetchLatestBaileysVersion();
            version = vData.version;
        } catch (e) {
            console.log('[WhatsApp] Usando versión fallback:', version.join('.'));
        }

        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            // Browsers.ubuntu('Chrome') is the most compatible with WhatsApp Web servers
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        this.isConnecting = false;

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.qrRaw = qr;
                this.status = 'waiting_qr';
                try {
                    // Generate clean, high-contrast QR code
                    this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
                        width: 320,
                        margin: 2,
                        errorCorrectionLevel: 'M',
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        }
                    });
                } catch (e) {
                    console.error('Error creating QR data URL:', e);
                }
                
                console.log('\n=============================================');
                console.log('  NUEVO CÓDIGO QR GENERADO:');
                console.log('  (WhatsApp > Dispositivos Vinculados > Vincular)');
                console.log('=============================================\n');
                qrcodeTerminal.generate(qr, { small: true });

                this.emit('qr', { qrRaw: this.qrRaw, qrDataUrl: this.qrCodeDataUrl });
                this.emit('status', { status: this.status });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                this.status = 'disconnected';
                this.qrCodeDataUrl = null;
                this.qrRaw = null;
                this.user = null;
                this.emit('status', { status: this.status, reason: statusCode });

                console.log(`[WhatsApp] Conexión cerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);

                if (shouldReconnect) {
                    this.reconnectAttempts++;
                    const delay = Math.min(this.reconnectAttempts * 2000, 8000);
                    setTimeout(() => this.init(), delay);
                }
            } else if (connection === 'open') {
                this.reconnectAttempts = 0;
                this.status = 'connected';
                this.qrCodeDataUrl = null;
                this.qrRaw = null;

                const rawId = this.sock.user?.id || '';
                const myJid = jidNormalizedUser(rawId);
                const phone = myJid.split('@')[0];
                const name = this.sock.user?.name || 'Mi WhatsApp';

                this.user = { jid: myJid, phone, name };
                console.log(`\n======================================================`);
                console.log(`✅ ¡Conectado con éxito a WhatsApp como: +${phone} (${name})!`);
                console.log(`======================================================\n`);

                this.emit('status', { status: this.status, user: this.user });
            }
        });

        // Listen for incoming messages from the user to auto-convert links
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' || !this.autoProcessEnabled) return;

            for (const msg of messages) {
                if (!msg.message) continue;

                const text = msg.message.conversation ||
                             msg.message.extendedTextMessage?.text ||
                             '';

                const xRegex = /(https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+[^\s]*)/i;
                const tiktokRegex = /(https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+)/i;
                const stickerCdnRegex = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:tiktokcdn\.com|ibyteimg\.com)[^\s]+)/i;
                const directStickerRegex = /(https?:\/\/[^\s]+\.(?:webp|gif|png|jpe?g)(?:\?[^\s]*)?)/i;

                let detectedUrl = null;
                let platform = null;

                if (text.match(xRegex)) {
                    detectedUrl = text.match(xRegex)[1];
                    platform = 'x';
                } else if (text.match(tiktokRegex)) {
                    detectedUrl = text.match(tiktokRegex)[1];
                    platform = 'tiktok';
                } else if (text.match(stickerCdnRegex)) {
                    detectedUrl = text.match(stickerCdnRegex)[1];
                    platform = 'sticker';
                } else if (text.match(directStickerRegex)) {
                    detectedUrl = text.match(directStickerRegex)[1];
                    platform = 'sticker';
                }

                if (detectedUrl) {
                    const fromJid = msg.key.remoteJid;
                    const isFromMe = msg.key.fromMe;
                    const myJid = this.user ? this.user.jid : null;

                    if (isFromMe || fromJid === myJid) {
                        console.log(`\n[Auto-Bot] Detectado enlace de ${platform.toUpperCase()} en tu WhatsApp: ${detectedUrl}`);
                        this.emit('auto_media_link', { url: detectedUrl, platform, chatJid: fromJid });
                        if (platform === 'x') {
                            this.emit('auto_x_link', { url: detectedUrl, chatJid: fromJid });
                        }
                    }
                }
            }
        });
    }

    /**
     * Request pairing code with phone number (No camera / QR scanning required)
     */
    async requestPairing(phoneNumber) {
        if (!this.sock) {
            await this.init();
        }

        const cleanNumber = String(phoneNumber).replace(/[^0-9]/g, '');
        if (!cleanNumber || cleanNumber.length < 8) {
            throw new Error('Por favor introduce tu número con código de país (ej: 54911XXXXXXXX, 34XXXXXXXXX, 1XXXXXXXXXX)');
        }

        console.log(`[WhatsApp] Solicitando código de vinculación para el número: +${cleanNumber}...`);
        
        // Wait a short moment if socket is still establishing
        if (this.status === 'disconnected') {
            await new Promise((res) => setTimeout(res, 2000));
        }

        const code = await this.sock.requestPairingCode(cleanNumber);
        console.log(`[WhatsApp] Código de vinculación generado: ${code}`);
        return code;
    }

    /**
     * Send animated sticker to user's personal chat or specific JID
     */
    async sendSticker(stickerBuffer, targetJid = null) {
        if (!this.sock || this.status !== 'connected') {
            throw new Error('WhatsApp no está conectado. Por favor vincula tu WhatsApp primero.');
        }

        const destination = targetJid || (this.user ? this.user.jid : null);
        if (!destination) {
            throw new Error('No se pudo determinar tu chat de WhatsApp.');
        }

        console.log(`[WhatsApp] Entregando sticker animado a: ${destination}...`);
        
        const response = await this.sock.sendMessage(destination, {
            sticker: stickerBuffer
        });

        console.log(`[WhatsApp] ¡Sticker entregado con éxito! ID: ${response.key.id}`);
        return response;
    }

    /**
     * Send text message to chat
     */
    async sendMessage(text, targetJid = null) {
        if (!this.sock || this.status !== 'connected') return;
        const destination = targetJid || (this.user ? this.user.jid : null);
        if (!destination) return;
        return this.sock.sendMessage(destination, { text });
    }

    /**
     * Disconnect and clear session
     */
    async logout() {
        if (this.sock) {
            try {
                await this.sock.logout();
            } catch (_) {}
            this.status = 'disconnected';
            this.user = null;
            this.qrCodeDataUrl = null;
            this.qrRaw = null;
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
            this.emit('status', { status: 'disconnected' });
            setTimeout(() => this.init(), 1000);
        }
    }
}

const whatsappService = new WhatsAppService();

module.exports = whatsappService;
