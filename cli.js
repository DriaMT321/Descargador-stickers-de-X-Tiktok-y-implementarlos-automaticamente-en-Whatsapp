#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const whatsappService = require('./src/whatsapp');
const {
    detectUrlType,
    processMediaToSticker,
    extractTikTokCommentStickers
} = require('./src/converter');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function main() {
    console.log('\n===============================================================');
    console.log('  🎬 X & TikTok to WhatsApp Animated Sticker Studio (CLI)');
    console.log('===============================================================\n');

    let url = process.argv[2];

    if (!url) {
        console.log('Introduce cualquiera de las siguientes opciones:');
        console.log(' 1. Enlace de video de TikTok (ej: https://www.tiktok.com/@.../video/... o https://vm.tiktok.com/...)');
        console.log(' 2. Enlace de video de X / Twitter (ej: https://x.com/.../status/...)');
        console.log(' 3. Enlace directo de sticker o imagen de TikTok (ej: https://p16-sign-va.tiktokcdn.com/...)\n');
        url = await askQuestion('🔗 Introduce el enlace: ');
    }

    const urlType = detectUrlType(url);

    if (urlType === 'unknown') {
        console.error('\n❌ Enlace no reconocido. Por favor introduce un enlace válido de TikTok, X (Twitter) o CDN de stickers.');
        process.exit(1);
    }

    const platformName = urlType === 'tiktok' ? 'TikTok' : (urlType === 'sticker' ? 'Sticker' : 'X (Twitter)');
    console.log(`\n✓ Tipo de enlace detectado: ${platformName}`);

    // If it's a TikTok video, ask if they want to convert the video or extract comment stickers
    if (urlType === 'tiktok') {
        console.log('\nElige una opción:');
        console.log('  [1] Convertir video de TikTok en Sticker Animado para WhatsApp (Recomendado)');
        console.log('  [2] Extraer y descargar todos los stickers usados en los comentarios del video');
        const choice = await askQuestion('\nSelecciona una opción (1 o 2) [Default 1]: ');

        if (choice === '2') {
            console.log('\n[1/2] Escaneando comentarios de TikTok en busca de stickers y fotos...');
            try {
                const res = await extractTikTokCommentStickers(url);
                console.log(`\n🎉 Escaneo completado: Se encontraron ${res.stickersCount} stickers/imágenes en ${res.totalCommentsScanned} comentarios analizados.`);

                if (res.stickersCount === 0) {
                    console.log('ℹ️ Los comentarios analizados de este video no contienen stickers o imágenes adjuntas.');
                    process.exit(0);
                }

                const outFolder = path.join(__dirname, 'stickers', `tiktok_${res.awemeId}`);
                if (!fs.existsSync(outFolder)) fs.mkdirSync(outFolder, { recursive: true });

                console.log(`\n[2/2] Descargando ${res.stickersCount} stickers a la carpeta local:`);
                console.log(`📁 ${outFolder}\n`);

                for (let i = 0; i < res.stickers.length; i++) {
                    const st = res.stickers[i];
                    try {
                        const imgRes = await fetch(st.stickerUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' }
                        });
                        if (imgRes.ok) {
                            const buf = Buffer.from(await imgRes.arrayBuffer());
                            const ext = st.stickerUrl.includes('.gif') ? '.gif' : (st.stickerUrl.includes('.png') ? '.png' : '.webp');
                            const fileName = `sticker_${i + 1}_${st.id}${ext}`;
                            fs.writeFileSync(path.join(outFolder, fileName), buf);
                            console.log(`  ✓ Guardado: ${fileName} (${st.author}: "${st.commentText.slice(0, 30)}")`);
                        }
                    } catch (e) {
                        console.warn(`  ⚠️ Error descargando sticker ${i + 1}:`, e.message);
                    }
                }

                console.log(`\n✅ ¡Todos los stickers han sido guardados en ${outFolder}!`);
                process.exit(0);
            } catch (err) {
                console.error('\n❌ Error escaneando stickers de TikTok:', err.message);
                process.exit(1);
            }
        }
    }

    console.log('\n[1/3] Conectando con WhatsApp...');
    whatsappService.init();

    // Wait for connection
    await new Promise((resolve) => {
        if (whatsappService.status === 'connected') return resolve();
        whatsappService.on('status', (info) => {
            if (info.status === 'connected') {
                resolve();
            }
        });
    });

    console.log(`[2/3] Procesando contenido desde ${platformName}...`);
    try {
        const defaultPack = urlType === 'tiktok' ? 'TikTok Stickers' : 'X Stickers';
        const result = await processMediaToSticker(url, {
            pack: defaultPack,
            author: 'Mi Bot Personal',
            quality: 50
        }, (stage, msg) => {
            console.log(`  -> ${msg}`);
        });

        console.log(`\n[3/3] Enviando sticker a tu chat personal (+${whatsappService.user?.phone || 'tú'})...`);
        await whatsappService.sendSticker(result.buffer);

        console.log('\n🎉 ¡LISTO! El sticker animado ha sido entregado a tu WhatsApp personal.');
        console.log(`📁 Guardado localmente en: ${result.filePath} (${result.fileSizeKb} KB)`);
        console.log('\nTip: Puedes dejar este programa corriendo y cada vez que te envíes un link de X o TikTok a tu chat de WhatsApp, se convertirá automáticamente.\n');
        
        const keepRunning = await askQuestion('¿Deseas mantener el bot activo para responder automáticamente en WhatsApp? (S/N): ');
        if (keepRunning.toLowerCase() !== 's' && keepRunning.toLowerCase() !== 'si' && keepRunning.toLowerCase() !== 'y') {
            process.exit(0);
        } else {
            console.log('🟢 Bot activo en segundo plano. Presiona Ctrl+C para salir cuando desees.');
        }
    } catch (err) {
        console.error('\n❌ Ocurrió un error:', err.message);
        process.exit(1);
    }
}

main().catch(console.error);
