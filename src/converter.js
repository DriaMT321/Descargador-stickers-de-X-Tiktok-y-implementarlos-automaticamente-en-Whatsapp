const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Sticker, StickerTypes, Exif } = require('wa-sticker-formatter');
const { getPaths } = require('./paths');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const OUTPUT_DIR = path.join(__dirname, '..', 'stickers');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function runProcess(cmd, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed [code ${code}]: ${stderr || stdout}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Detect the type of input URL
 * @returns {'x' | 'tiktok' | 'sticker' | 'unknown'}
 */
function detectUrlType(url) {
    if (!url || typeof url !== 'string') return 'unknown';
    const clean = url.trim();
    if (/https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+/i.test(clean)) {
        return 'x';
    }
    if (/https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:tiktokcdn\.com|ibyteimg\.com)/i.test(clean)) {
        return 'sticker';
    }
    if (/\.(webp|gif|png|jpe?g)(?:\?.*)?$/i.test(clean)) {
        return 'sticker';
    }
    if (/https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i.test(clean)) {
        return 'tiktok';
    }
    return 'unknown';
}

/**
 * Extract video or sticker info from URL
 */
async function getVideoInfo(targetUrl) {
    const type = detectUrlType(targetUrl);

    if (type === 'sticker') {
        const baseName = `sticker_${Date.now()}`;
        return {
            id: baseName,
            title: 'Sticker de TikTok / Imagen Web',
            duration: 3,
            thumbnail: targetUrl,
            uploader: 'TikTok Sticker',
            url: targetUrl,
            platform: 'sticker',
            isDirectSticker: true
        };
    }

    const { ytdlpPath } = getPaths();
    
    // Quick metadata dump with yt-dlp (works for both X and TikTok)
    const args = [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        targetUrl
    ];
    const { stdout } = await runProcess(ytdlpPath, args);
    const info = JSON.parse(stdout);
    
    const platform = type === 'tiktok' ? 'tiktok' : 'x';
    const videoId = info.id || `${platform}_${Date.now()}`;
    const directStreamUrl = info.url || (info.formats && info.formats.find(f => f.ext === 'mp4' || f.vcodec !== 'none')?.url) || null;

    return {
        id: videoId,
        title: info.title || (platform === 'tiktok' ? 'Video de TikTok' : 'Video de X'),
        duration: info.duration || 5,
        thumbnail: info.thumbnail || '',
        uploader: info.uploader || info.channel || (platform === 'tiktok' ? 'tiktok_user' : 'usuario'),
        url: targetUrl,
        videoUrl: directStreamUrl,
        platform,
        isDirectSticker: false
    };
}

/**
 * Download video from X or TikTok to local MP4
 */
async function downloadVideo(videoUrl, outputId) {
    const rawVideoPath = path.join(TEMP_DIR, `${outputId}_raw.mp4`);
    if (fs.existsSync(rawVideoPath)) {
        return rawVideoPath;
    }

    const { ytdlpPath } = getPaths();
    const args = [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--no-warnings',
        '-o', rawVideoPath,
        videoUrl
    ];

    await runProcess(ytdlpPath, args);

    if (!fs.existsSync(rawVideoPath)) {
        const matches = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(`${outputId}_raw`));
        if (matches.length > 0) {
            return path.join(TEMP_DIR, matches[0]);
        }
        throw new Error('No se pudo descargar el video.');
    }

    return rawVideoPath;
}

/**
 * Download direct sticker / image from URL
 */
async function downloadDirectSticker(stickerUrl, outputId) {
    const res = await fetch(stickerUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.tiktok.com/'
        }
    });

    if (!res.ok) {
        throw new Error(`Error descargando el sticker [${res.status}]: ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    let ext = '.webp';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('gif') || stickerUrl.toLowerCase().includes('.gif')) {
        ext = '.gif';
    } else if (contentType.includes('png') || stickerUrl.toLowerCase().includes('.png')) {
        ext = '.png';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        ext = '.jpg';
    }

    const filePath = path.join(TEMP_DIR, `${outputId}_direct${ext}`);
    fs.writeFileSync(filePath, buffer);

    return { filePath, buffer, ext };
}

/**
 * Trim, resize and optimize video with ffmpeg for sticker conversion
 * FIX: Guarantees width and height are strictly divisible by 2 to prevent encoder crashes
 */
async function prepareTrimmedVideo(inputPath, outputTrimPath, startTime = 0, duration = 4, fps = 15, cropType = 'full') {
    const { ffmpegPath } = getPaths();

    let filter = '';
    if (cropType === 'crop') {
        filter = `fps=${fps},scale=512:512:force_original_aspect_ratio=increase,crop=512:512,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
    } else {
        filter = `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
    }

    const args = [
        '-y',
        '-ss', String(startTime || 0),
        '-t', String(duration || 4),
        '-i', inputPath,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-an',
        outputTrimPath
    ];

    await runProcess(ffmpegPath, args);
    return outputTrimPath;
}

/**
 * Convert an image or animated sticker (WebP, GIF, PNG) directly to WhatsApp Sticker format
 */
async function createWhatsAppStickerFromImage(imageInput, options = {}) {
    const {
        pack = 'TikTok Stickers',
        author = 'TikTok Bot',
        crop = 'full'
    } = options;

    const baseId = `sticker_${Date.now()}`;
    const { ffmpegPath } = getPaths();

    let inputPath = imageInput;
    let tempInputCreated = false;

    if (Buffer.isBuffer(imageInput)) {
        inputPath = path.join(TEMP_DIR, `${baseId}_input.webp`);
        fs.writeFileSync(inputPath, imageInput);
        tempInputCreated = true;
    }

    let inputStats = fs.statSync(inputPath);
    let currentBuf = fs.readFileSync(inputPath);

    // If file is > 480 KB or animated (.awebp, .gif, or large WebP), optimize with ffmpeg first
    if (inputStats.size > 480 * 1024 || inputPath.toLowerCase().includes('.awebp') || inputPath.toLowerCase().includes('.gif')) {
        const tempOpt = path.join(TEMP_DIR, `${baseId}_opt.webp`);
        let currentScale = 340;
        let currentFps = 12;
        let currentQ = 25;
        let attempts = 0;

        while (attempts < 4) {
            attempts++;
            await runProcess(ffmpegPath, [
                '-y',
                '-i', inputPath,
                '-vf', `fps=${currentFps},scale=${currentScale}:${currentScale}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
                '-c:v', 'libwebp',
                '-lossless', '0',
                '-compression_level', '4',
                '-q:v', String(currentQ),
                '-loop', '0',
                tempOpt
            ]);

            currentBuf = fs.readFileSync(tempOpt);
            if (currentBuf.length < 480 * 1024) {
                break;
            }

            console.log(`[Sticker Image] Optimización intento ${attempts}: ${Math.round(currentBuf.length / 1024)} KB (> 480 KB). Ajustando escala y fps...`);
            currentScale = Math.max(260, currentScale - 50);
            currentFps = Math.max(10, currentFps - 2);
            currentQ = Math.max(15, currentQ - 6);
        }

        try { if (fs.existsSync(tempOpt)) fs.unlinkSync(tempOpt); } catch (_) {}
    }

    // Direct WhatsApp Exif injection into the optimized WebP container
    const exif = new Exif({
        pack,
        author,
        type: crop === 'crop' ? StickerTypes.CROPPED : StickerTypes.FULL
    });

    let stickerBuffer = await exif.add(currentBuf);

    // Clean up temporary input file if created
    if (tempInputCreated) {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
    }

    const finalPath = path.join(OUTPUT_DIR, `${baseId}.webp`);
    fs.writeFileSync(finalPath, stickerBuffer);

    return {
        buffer: stickerBuffer,
        filePath: finalPath,
        fileSizeKb: Math.round(stickerBuffer.length / 1024),
        pack,
        author,
        duration: 0
    };
}

/**
 * Convert video to WhatsApp animated sticker (.webp) with WhatsApp Exif metadata (< 500 KB)
 */
async function createWhatsAppSticker(videoPath, options = {}) {
    const {
        pack = 'Stickers',
        author = 'StickerBot',
        crop = 'full', // 'full' or 'crop'
        startTime = 0,
        duration = 4,
        quality = 50
    } = options;

    const baseId = `sticker_${Date.now()}`;
    const trimPath = path.join(TEMP_DIR, `${baseId}_trim.mp4`);

    let currentQuality = quality;
    let currentFps = 15;
    let currentDuration = Math.min(Number(duration) || 4, 8); // Max 8s

    // Trim video first with even dimensions
    await prepareTrimmedVideo(
        videoPath,
        trimPath,
        startTime,
        currentDuration,
        currentFps,
        crop === 'crop' ? 'crop' : 'full'
    );

    let stickerBuffer = null;
    let attempts = 0;

    // Retry loop to ensure size is < 490 KB (strict WhatsApp sticker constraint)
    while (attempts < 5) {
        attempts++;
        const sticker = new Sticker(trimPath, {
            pack,
            author,
            type: crop === 'crop' ? StickerTypes.CROPPED : StickerTypes.FULL,
            quality: currentQuality
        });

        stickerBuffer = await sticker.toBuffer();

        // If < 490 KB, it's perfect!
        if (stickerBuffer.length < 490 * 1024) {
            break;
        }

        console.log(`[Sticker Size] Intento ${attempts}: ${Math.round(stickerBuffer.length / 1024)} KB (> 490KB). Optimizando compresión...`);
        
        currentQuality = Math.max(15, currentQuality - 12);
        currentFps = Math.max(10, currentFps - 2);
        currentDuration = Math.max(2, currentDuration - 0.7);

        // Re-trim with reduced parameters
        await prepareTrimmedVideo(
            videoPath,
            trimPath,
            startTime,
            currentDuration,
            currentFps,
            crop === 'crop' ? 'crop' : 'full'
        );
    }

    // Clean up temporary trimmed video
    try {
        if (fs.existsSync(trimPath)) fs.unlinkSync(trimPath);
    } catch (_) {}

    const finalPath = path.join(OUTPUT_DIR, `${baseId}.webp`);
    fs.writeFileSync(finalPath, stickerBuffer);

    return {
        buffer: stickerBuffer,
        filePath: finalPath,
        fileSizeKb: Math.round(stickerBuffer.length / 1024),
        pack,
        author,
        duration: currentDuration
    };
}

/**
 * Universal media pipeline: URL (X, TikTok or Direct Sticker) -> Download -> WhatsApp Sticker
 */
async function processMediaToSticker(targetUrl, options = {}, onProgress = () => {}) {
    const urlType = detectUrlType(targetUrl);
    const platformLabel = urlType === 'tiktok' ? 'TikTok' : (urlType === 'x' ? 'X (Twitter)' : 'Sticker');

    // Case 1: Direct Sticker or Image URL
    if (urlType === 'sticker') {
        onProgress('DOWNLOADING', 'Descargando sticker/imagen directa...');
        const outputId = `sticker_${Date.now()}`;
        const { filePath } = await downloadDirectSticker(targetUrl, outputId);

        onProgress('CONVERTING', 'Convirtiendo imagen a formato oficial de WhatsApp Sticker...');
        const stickerResult = await createWhatsAppStickerFromImage(filePath, {
            pack: options.pack || 'TikTok Stickers',
            author: options.author || 'TikTok Bot',
            crop: options.crop || 'full',
            quality: options.quality || 65
        });

        onProgress('COMPLETED', '¡Sticker creado con éxito!');
        return {
            ...stickerResult,
            platform: 'sticker',
            videoInfo: {
                id: outputId,
                title: 'Sticker de TikTok',
                uploader: 'TikTok',
                url: targetUrl
            }
        };
    }

    // Case 2: Video from X or TikTok
    onProgress('EXTRACTING_INFO', `Obteniendo información del video de ${platformLabel}...`);
    let videoInfo = null;

    try {
        videoInfo = await getVideoInfo(targetUrl);
    } catch (e) {
        console.warn('Extrayendo info básica:', e.message);
    }

    onProgress('DOWNLOADING', `Descargando video de ${platformLabel}...`);
    const outputId = videoInfo?.id || `${urlType}_${Date.now()}`;
    const rawVideoPath = await downloadVideo(targetUrl, outputId);

    // Calculate duration from startTime and endTime if provided
    let startTime = Number(options.startTime) || 0;
    let duration = Number(options.duration);

    if (options.endTime !== undefined && options.endTime !== null && Number(options.endTime) > startTime) {
        duration = Number(options.endTime) - startTime;
    }

    if (!duration || duration <= 0) {
        duration = videoInfo ? Math.min(videoInfo.duration, 4.5) : 4;
    }

    onProgress('CONVERTING', `Convirtiendo a sticker animado (inicio: ${startTime.toFixed(1)}s, duración: ${duration.toFixed(1)}s)...`);
    
    const defaultPack = urlType === 'tiktok' ? 'TikTok Stickers' : 'X Stickers';
    const defaultAuthor = videoInfo ? `@${videoInfo.uploader}` : `${platformLabel} Bot`;

    const stickerResult = await createWhatsAppSticker(rawVideoPath, {
        pack: options.pack || defaultPack,
        author: options.author || defaultAuthor,
        crop: options.crop || 'full',
        startTime,
        duration,
        quality: options.quality || 50
    });

    onProgress('COMPLETED', '¡Sticker animado creado con éxito!');

    return {
        ...stickerResult,
        platform: urlType,
        videoInfo
    };
}

/**
 * Extract aweme (video) ID from any TikTok URL
 */
async function extractTikTokVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    let cleanUrl = url.trim();

    // 1. Direct regex for /video/<id>, /photo/<id>, /v/<id>
    let match = cleanUrl.match(/\/(?:video|photo|v)\/(\d+)/i);
    if (match) return match[1];

    // 2. Query parameters like aweme_id, item_id, share_item_id
    match = cleanUrl.match(/[?&](?:aweme_id|item_id|share_item_id)=(\d+)/i);
    if (match) return match[1];

    // 3. If the input contains a standalone 15-22 digit sequence (not a shortlink code)
    if (!cleanUrl.includes('vm.tiktok.com') && !cleanUrl.includes('vt.tiktok.com') && !cleanUrl.includes('/t/')) {
        match = cleanUrl.match(/\b(\d{15,22})\b/);
        if (match) return match[1];
    }

    // 4. Try manual redirect check (inspecting Location header from 301/302)
    try {
        const manualRes = await fetch(cleanUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const location = manualRes.headers.get('location');
        if (location) {
            match = location.match(/\/(?:video|photo|v)\/(\d+)/i) 
                 || location.match(/[?&](?:aweme_id|item_id|share_item_id)=(\d+)/i)
                 || location.match(/\b(\d{15,22})\b/);
            if (match) return match[1];
            cleanUrl = location;
        }
    } catch (_) {}

    // 5. Try following redirect via standard HTTP fetch
    try {
        const res = await fetch(cleanUrl, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const finalUrl = res.url;
        match = finalUrl.match(/\/(?:video|photo|v)\/(\d+)/i)
             || finalUrl.match(/[?&](?:aweme_id|item_id|share_item_id)=(\d+)/i)
             || finalUrl.match(/\b(\d{15,22})\b/);
        if (match) return match[1];

        // Search in response HTML
        const html = await res.text();
        const htmlMatch = html.match(/"(?:itemInfo|itemStruct)":\{[^}]*"id":"(\d+)"/i) 
                       || html.match(/\/(?:video|photo)\/(\d+)/i)
                       || html.match(/"aweme_id":"(\d+)"/i)
                       || html.match(/\b(\d{18,20})\b/);
        if (htmlMatch) return htmlMatch[1];
    } catch (e) {
        console.warn('Fetch redirect failed:', e.message);
    }

    // 6. Bulletproof fallback: yt-dlp --get-id
    try {
        const { ytdlpPath } = getPaths();
        const id = await new Promise((resolve) => {
            const proc = spawn(ytdlpPath, ['--get-id', '--no-playlist', '--no-warnings', cleanUrl], { windowsHide: true });
            let stdout = '';
            proc.stdout.on('data', d => stdout += d.toString());
            proc.on('close', code => {
                if (code === 0 && stdout.trim()) {
                    const firstLine = stdout.trim().split('\n')[0].trim();
                    const digitMatch = firstLine.match(/\b(\d{15,22})\b/);
                    resolve(digitMatch ? digitMatch[1] : firstLine);
                } else {
                    resolve(null);
                }
            });
            proc.on('error', () => resolve(null));
        });
        if (id) return id;
    } catch (_) {}

    return null;
}

/**
 * Extract comment stickers and images from a TikTok video
 */
async function extractTikTokCommentStickers(tiktokUrl, maxComments = 80) {
    // If user passed a direct sticker or CDN URL, handle it immediately
    if (detectUrlType(tiktokUrl) === 'sticker') {
        return {
            awemeId: 'direct_sticker',
            totalCommentsScanned: 1,
            stickersCount: 1,
            stickers: [{
                id: `direct_${Date.now()}`,
                cid: '0',
                author: 'Sticker Directo',
                avatar: '',
                commentText: 'Sticker de TikTok',
                stickerUrl: tiktokUrl,
                previewUrl: tiktokUrl,
                isAnimated: tiktokUrl.includes('.gif') || tiktokUrl.includes('.awebp') || tiktokUrl.includes('animate'),
                type: 'sticker'
            }]
        };
    }

    const awemeId = await extractTikTokVideoId(tiktokUrl);
    if (!awemeId) {
        throw new Error('No se pudo identificar el ID del video de TikTok a partir del enlace proporcionado. Asegúrate de que el enlace sea de TikTok (ej: https://www.tiktok.com/@.../video/... o https://vm.tiktok.com/...).');
    }

    const apiUrl = `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${awemeId}&count=50&cursor=0`;
    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.tiktok.com/'
        }
    });

    if (!res.ok) {
        throw new Error(`Error en la API de comentarios de TikTok [${res.status}]: ${res.statusText}`);
    }

    const data = await res.json();
    const stickersFound = [];
    const comments = data.comments || [];

    const seenUrls = new Set();

    function processCommentItem(c) {
        if (!c) return;
        const author = c.user?.nickname || c.user?.unique_id || 'Usuario TikTok';
        const avatar = c.user?.avatar_thumb?.url_list?.[0] || '';

        // 1. TikTok cmt_sticker_struct (Current TikTok stickers & animated WebP)
        if (c.cmt_sticker_struct) {
            const st = c.cmt_sticker_struct;
            const animObj = st.animated_url?.high_resolution_url || st.animated_url?.mid_resolution_url || st.animated_url?.low_resolution_url;
            const staticObj = st.static_url?.high_resolution_url || st.static_url?.mid_resolution_url || st.static_url?.low_resolution_url;
            const animateUrl = animObj?.url_list?.[0] || null;
            const staticUrl = staticObj?.url_list?.[0] || null;
            const chosenUrl = animateUrl || staticUrl;

            if (chosenUrl && !seenUrls.has(chosenUrl)) {
                seenUrls.add(chosenUrl);
                stickersFound.push({
                    id: st.id || `stk_${c.cid}`,
                    cid: c.cid,
                    author,
                    avatar,
                    commentText: c.text || '',
                    stickerUrl: chosenUrl,
                    previewUrl: staticUrl || chosenUrl,
                    isAnimated: Boolean(animateUrl),
                    type: 'sticker'
                });
            }
        }

        // 2. Legacy / alternative sticker field
        if (c.sticker) {
            const st = c.sticker;
            const animObj = st.animate_url || st.animated_url;
            const staticObj = st.static_url;
            const animateUrl = animObj?.url_list?.[0] || null;
            const staticUrl = staticObj?.url_list?.[0] || st.url_list?.[0] || null;
            const chosenUrl = animateUrl || staticUrl;

            if (chosenUrl && !seenUrls.has(chosenUrl)) {
                seenUrls.add(chosenUrl);
                stickersFound.push({
                    id: st.id || `stk_${c.cid}`,
                    cid: c.cid,
                    author,
                    avatar,
                    commentText: c.text || '',
                    stickerUrl: chosenUrl,
                    previewUrl: staticUrl || chosenUrl,
                    isAnimated: Boolean(animateUrl),
                    type: 'sticker'
                });
            }
        }

        // 3. Image List (Pictures posted in comments)
        if (c.image_list && Array.isArray(c.image_list)) {
            for (let idx = 0; idx < c.image_list.length; idx++) {
                const img = c.image_list[idx];
                const imgUrl = img.origin_url?.url_list?.[0] || img.crop_url?.url_list?.[0] || img.url_list?.[0] || img.uri || null;
                const prevUrl = img.crop_url?.url_list?.[0] || imgUrl;
                if (imgUrl && !seenUrls.has(imgUrl)) {
                    seenUrls.add(imgUrl);
                    stickersFound.push({
                        id: `img_${c.cid}_${idx}`,
                        cid: c.cid,
                        author,
                        avatar,
                        commentText: c.text || '',
                        stickerUrl: imgUrl,
                        previewUrl: prevUrl,
                        isAnimated: false,
                        type: 'image'
                    });
                }
            }
        }

        // 4. Replies if present
        if (c.reply_comment && Array.isArray(c.reply_comment)) {
            for (const rep of c.reply_comment) {
                processCommentItem(rep);
            }
        }
    }

    for (const c of comments) {
        processCommentItem(c);
    }

    return {
        awemeId,
        totalCommentsScanned: comments.length,
        stickersCount: stickersFound.length,
        stickers: stickersFound
    };
}

module.exports = {
    detectUrlType,
    getVideoInfo,
    downloadVideo,
    downloadDirectSticker,
    prepareTrimmedVideo,
    createWhatsAppSticker,
    createWhatsAppStickerFromImage,
    processMediaToSticker,
    processXVideoToSticker: processMediaToSticker, // Aliased for full backwards compatibility
    extractTikTokVideoId,
    extractTikTokCommentStickers
};
