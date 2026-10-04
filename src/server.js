const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const whatsappService = require('./whatsapp');
const {
    getVideoInfo,
    processMediaToSticker,
    extractTikTokCommentStickers
} = require('./converter');

const PORT = process.env.PORT || 3000;
const STICKERS_DIR = path.join(__dirname, '..', 'stickers');

// Liberar puerto automáticamente si un proceso zombie anterior lo estaba reteniendo
function ensurePortFree(portToFree) {
    try {
        if (process.platform === 'win32') {
            const cmd = 'netstat -ano | findstr :' + portToFree + ' | findstr LISTENING';
            const output = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            const lines = output.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== String(process.pid) && pid !== '0') {
                    console.log(`[Puerto] Cerrando proceso previo en el puerto ${portToFree} (PID ${pid})...`);
                    try {
                        execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' });
                    } catch (_) {}
                }
            }
        }
    } catch (_) {
        // Puerto libre
    }
}

ensurePortFree(PORT);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/stickers', express.static(STICKERS_DIR));

// Track recent stickers
let recentStickers = [];

// Helper to broadcast WS messages
function broadcast(type, data) {
    const payload = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// WebSocket connections
wss.on('connection', (ws) => {
    // Send current status immediately
    ws.send(JSON.stringify({
        type: 'STATUS_UPDATE',
        data: {
            status: whatsappService.status,
            user: whatsappService.user,
            qrCodeDataUrl: whatsappService.qrCodeDataUrl
        }
    }));
});

// Forward WhatsApp events to WebSockets
whatsappService.on('status', (data) => {
    broadcast('STATUS_UPDATE', {
        status: data.status,
        user: whatsappService.user,
        qrCodeDataUrl: whatsappService.qrCodeDataUrl
    });
});

whatsappService.on('qr', (data) => {
    broadcast('QR_UPDATE', {
        qrCodeDataUrl: data.qrCodeDataUrl
    });
});

// Auto-process when user sends X, TikTok, or direct sticker link in their personal WhatsApp
whatsappService.on('auto_media_link', async ({ url, platform, chatJid }) => {
    broadcast('AUTO_MEDIA_DETECTED', { url, platform, chatJid });
    const platformLabel = platform === 'tiktok' ? 'TikTok' : (platform === 'sticker' ? 'Sticker TikTok' : 'X (Twitter)');
    
    try {
        await whatsappService.sendMessage(`⏳ He detectado tu enlace de ${platformLabel}. Descargando y convirtiendo a sticker animado...`, chatJid);
        
        const defaultPack = platform === 'tiktok' ? 'TikTok Auto-Stickers' : 'Auto-Stickers';
        const result = await processMediaToSticker(url, {
            pack: defaultPack,
            author: 'Mi Bot Personal'
        }, (stage, message) => {
            broadcast('PROGRESS_UPDATE', { stage, message, url });
        });

        await whatsappService.sendSticker(result.buffer, chatJid);
        console.log(`[Auto-Bot] Sticker enviado exitosamente para el enlace de ${platformLabel}: ${url}`);
        
        const fileName = path.basename(result.filePath);
        const item = {
            id: fileName,
            fileName,
            url: `/stickers/${fileName}`,
            fileSizeKb: result.fileSizeKb,
            duration: result.duration,
            pack: result.pack,
            author: result.author,
            videoTitle: result.videoInfo?.title || `Sticker de ${platformLabel}`,
            sentToWhatsApp: true,
            createdAt: new Date().toISOString()
        };

        recentStickers.unshift(item);
        if (recentStickers.length > 20) recentStickers.pop();

        broadcast('CONVERSION_SUCCESS', item);
    } catch (err) {
        console.error(`[Auto-Bot] Error al procesar link de ${platformLabel}:`, err);
        await whatsappService.sendMessage(`❌ Error al convertir el contenido de ${platformLabel} en sticker: ${err.message}`, chatJid);
    }
});

// REST API
app.get('/api/status', (req, res) => {
    res.json({
        status: whatsappService.status,
        user: whatsappService.user,
        qrCodeDataUrl: whatsappService.qrCodeDataUrl
    });
});

app.post('/api/pairing-code', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Número de teléfono requerido' });
    }
    try {
        const code = await whatsappService.requestPairing(phoneNumber);
        res.json({ success: true, code });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/preview', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL requerida' });
    }
    try {
        const info = await getVideoInfo(url);
        res.json({ success: true, info });
    } catch (err) {
        res.status(500).json({ error: 'No se pudo obtener información: ' + err.message });
    }
});

app.get('/api/temp-video/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, '..', 'temp', filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Video no encontrado');
    }
    res.sendFile(filePath);
});

app.post('/api/convert', async (req, res) => {
    const {
        url,
        startTime = 0,
        endTime = null,
        duration = 4,
        crop = 'full',
        quality = 50,
        pack = 'Stickers',
        author = 'Mi Bot Personal',
        sendToWhatsApp = true
    } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Se requiere la URL del contenido' });
    }

    try {
        broadcast('PROGRESS_UPDATE', { stage: 'START', message: 'Iniciando proceso...', url });

        const result = await processMediaToSticker(url, {
            startTime: Number(startTime) || 0,
            endTime: endTime !== null ? Number(endTime) : null,
            duration: Number(duration) || 4,
            crop,
            quality: Number(quality) || 50,
            pack,
            author
        }, (stage, message) => {
            broadcast('PROGRESS_UPDATE', { stage, message, url });
        });

        let sentSuccess = false;
        let sendError = null;

        if (sendToWhatsApp) {
            if (whatsappService.status === 'connected') {
                try {
                    broadcast('PROGRESS_UPDATE', { stage: 'SENDING', message: 'Enviando sticker a tu chat de WhatsApp...' });
                    await whatsappService.sendSticker(result.buffer);
                    sentSuccess = true;
                } catch (e) {
                    console.error('Error enviando a WhatsApp:', e);
                    sendError = e.message;
                }
            } else {
                sendError = 'WhatsApp no está conectado. El sticker se guardó localmente.';
            }
        }

        const fileName = path.basename(result.filePath);
        const item = {
            id: fileName,
            fileName,
            url: `/stickers/${fileName}`,
            fileSizeKb: result.fileSizeKb,
            duration: result.duration,
            pack: result.pack,
            author: result.author,
            videoTitle: result.videoInfo?.title || 'Sticker',
            sentToWhatsApp: sentSuccess,
            sendError,
            createdAt: new Date().toISOString()
        };

        recentStickers.unshift(item);
        if (recentStickers.length > 20) recentStickers.pop();

        broadcast('CONVERSION_SUCCESS', item);
        res.json({ success: true, sticker: item });
    } catch (err) {
        console.error('Error durante la conversión:', err);
        broadcast('CONVERSION_ERROR', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// TikTok Specific: Extract comment stickers from a TikTok video
app.post('/api/tiktok/extract-stickers', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Se requiere la URL del video de TikTok' });
    }

    try {
        broadcast('PROGRESS_UPDATE', { stage: 'SCANNING', message: 'Escaneando comentarios de TikTok en busca de stickers...', url });
        const result = await extractTikTokCommentStickers(url);
        broadcast('PROGRESS_UPDATE', { stage: 'COMPLETED', message: `¡Escaneo completado! Encontrados ${result.stickersCount} stickers.` });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Error extrayendo stickers de comentarios de TikTok:', err);
        res.status(500).json({ error: err.message });
    }
});

// TikTok Specific: Download selected stickers pack as a ZIP file
app.post('/api/tiktok/download-pack-zip', async (req, res) => {
    const { stickers, packName = 'tiktok_stickers' } = req.body;
    if (!stickers || !Array.isArray(stickers) || stickers.length === 0) {
        return res.status(400).json({ error: 'No se enviaron stickers para empaquetar' });
    }

    try {
        const zip = new AdmZip();
        for (let i = 0; i < stickers.length; i++) {
            const st = stickers[i];
            const targetUrl = st.stickerUrl || st.url;
            if (!targetUrl) continue;

            try {
                const imgRes = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://www.tiktok.com/'
                    }
                });

                if (imgRes.ok) {
                    const buf = Buffer.from(await imgRes.arrayBuffer());
                    const ext = targetUrl.includes('.gif') ? '.gif' : (targetUrl.includes('.png') ? '.png' : '.webp');
                    const cleanName = `sticker_${i + 1}_${st.id || i}${ext}`;
                    zip.addFile(cleanName, buf);
                }
            } catch (e) {
                console.warn(`Error agregando sticker ${i} al ZIP:`, e.message);
            }
        }

        const zipBuffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${packName}.zip"`,
            'Content-Length': zipBuffer.length
        });
        res.send(zipBuffer);
    } catch (err) {
        console.error('Error generando archivo ZIP de stickers:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/send-sticker', async (req, res) => {
    const { fileName, targetJid } = req.body;
    if (!fileName) return res.status(400).json({ error: 'Nombre de archivo requerido' });

    const filePath = path.join(STICKERS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    try {
        const buffer = fs.readFileSync(filePath);
        await whatsappService.sendSticker(buffer, targetJid);
        res.json({ success: true, message: 'Sticker enviado a tu WhatsApp!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stickers', (req, res) => {
    res.json({ stickers: recentStickers });
});

app.post('/api/logout', async (req, res) => {
    try {
        await whatsappService.logout();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start WhatsApp service
whatsappService.init().catch((err) => {
    console.error('Error iniciando servicio de WhatsApp:', err);
});

// Handle port in use gracefully
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: El puerto ${PORT} ya está en uso por otra ventana del programa.`);
        console.error(`Cierra la otra ventana abierta de la consola o vuelve a hacer doble clic en Iniciar_Programa.bat.\n`);
        process.exit(1);
    } else {
        console.error('Error en el servidor:', e);
    }
});

// Start Express server
server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor listo y funcionando en: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});

module.exports = { app, server };
