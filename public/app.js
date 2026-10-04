document.addEventListener('DOMContentLoaded', () => {
    // Mode Navigation Tabs
    const navTabVideo = document.getElementById('nav-tab-video');
    const navTabStickers = document.getElementById('nav-tab-stickers');
    const sectionVideoMode = document.getElementById('section-video-mode');
    const sectionStickersMode = document.getElementById('section-stickers-mode');

    // DOM Elements - Video Mode
    const inputXUrl = document.getElementById('input-x-url');
    const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
    const btnFetchPreview = document.getElementById('btn-fetch-preview');
    const platformBadge = document.getElementById('platform-badge');
    
    const previewBox = document.getElementById('preview-box');
    const previewThumbnail = document.getElementById('preview-thumbnail');
    const previewDurationBadge = document.getElementById('preview-duration-badge');
    const previewTitle = document.getElementById('preview-title');
    const previewAuthor = document.getElementById('preview-author');

    const selectCrop = document.getElementById('select-crop');
    const selectQuality = document.getElementById('select-quality');
    const inputPackName = document.getElementById('input-pack-name');
    const inputAuthorName = document.getElementById('input-author-name');

    const btnConvertAndSend = document.getElementById('btn-convert-and-send');
    const btnConvertOnly = document.getElementById('btn-convert-only');

    // DOM Elements - TikTok Extractor Mode
    const inputTiktokStickersUrl = document.getElementById('input-tiktok-stickers-url');
    const btnPasteStickersUrl = document.getElementById('btn-paste-stickers-url');
    const btnExtractStickers = document.getElementById('btn-extract-stickers');
    const stickersExtractResults = document.getElementById('stickers-extract-results');
    const extractCountTitle = document.getElementById('extract-count-title');
    const extractDetailsText = document.getElementById('extract-details-text');
    const btnDownloadAllZip = document.getElementById('btn-download-all-zip');
    const extractedStickersGrid = document.getElementById('extracted-stickers-grid');
    let currentExtractedStickers = [];

    // WhatsApp Elements
    const waStatusBadge = document.getElementById('wa-status-badge');
    const waStatusText = document.getElementById('wa-status-text');
    const btnToggleConnection = document.getElementById('btn-toggle-connection');
    const connectionBtnLabel = document.getElementById('connection-btn-label');

    const waConnectedView = document.getElementById('wa-connected-view');
    const waQrView = document.getElementById('wa-qr-view');
    const qrImage = document.getElementById('qr-image');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const userDisplayName = document.getElementById('user-display-name');
    const userDisplayPhone = document.getElementById('user-display-phone');
    const btnDisconnect = document.getElementById('btn-disconnect');

    // Pairing tabs
    const tabQr = document.getElementById('tab-qr');
    const tabCode = document.getElementById('tab-code');
    const methodQrBox = document.getElementById('method-qr-box');
    const methodCodeBox = document.getElementById('method-code-box');
    const inputPhonePair = document.getElementById('input-phone-pair');
    const btnGetPairingCode = document.getElementById('btn-get-pairing-code');
    const pairingCodeResult = document.getElementById('pairing-code-result');
    const pairingCodeDigits = document.getElementById('pairing-code-digits');

    // Timeline and Video Elements
    const timelineCard = document.getElementById('timeline-card');
    const previewPlayer = document.getElementById('preview-player');
    const playerTimeDisplay = document.getElementById('player-time-display');
    const calculatedDurationBadge = document.getElementById('calculated-duration-badge');
    const timelineSelectedRange = document.getElementById('timeline-selected-range');
    const timelinePlayhead = document.getElementById('timeline-playhead');

    const sliderStartTime = document.getElementById('slider-start-time');
    const inputStartTime = document.getElementById('input-start-time');
    const startTimeVal = document.getElementById('start-time-val');
    const btnSetStartCurrent = document.getElementById('btn-set-start-current');

    const sliderEndTime = document.getElementById('slider-end-time');
    const inputEndTime = document.getElementById('input-end-time');
    const endTimeVal = document.getElementById('end-time-val');
    const btnSetEndCurrent = document.getElementById('btn-set-end-current');

    const btnPreviewLoop = document.getElementById('btn-preview-loop');
    const durationWarningText = document.getElementById('duration-warning-text');

    const progressCard = document.getElementById('progress-card');
    const progressStageTitle = document.getElementById('progress-stage-title');
    const progressBar = document.getElementById('progress-bar');
    const progressDetail = document.getElementById('progress-detail');
    const logTerminal = document.getElementById('log-terminal');

    const stickersGrid = document.getElementById('stickers-grid');
    const stickersCount = document.getElementById('stickers-count');

    let currentStatus = 'disconnected';
    let isLoopingSnippet = false;
    let videoTotalDuration = 5.0;

    // Helper: Format seconds to M:SS.S
    function formatTimePrecise(seconds) {
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(1);
        return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
    }

    // Helper: Add log line
    function addLog(text) {
        if (!logTerminal) return;
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        logTerminal.appendChild(line);
        logTerminal.scrollTop = logTerminal.scrollHeight;
    }

    // Helper: Toast Notifications
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '💡';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 350);
        }, duration);
    }

    // Tab Navigation Logic
    if (navTabVideo && navTabStickers) {
        navTabVideo.addEventListener('click', () => {
            navTabVideo.classList.add('active');
            navTabStickers.classList.remove('active');
            sectionVideoMode.classList.remove('hidden');
            sectionStickersMode.classList.add('hidden');
        });

        navTabStickers.addEventListener('click', () => {
            navTabStickers.classList.add('active');
            navTabVideo.classList.remove('active');
            sectionStickersMode.classList.remove('hidden');
            sectionVideoMode.classList.add('hidden');
        });
    }

    // Quick Demo Buttons
    const btnDemoDirectSticker = document.getElementById('btn-demo-direct-sticker');
    const btnDemoVideo = document.getElementById('btn-demo-video');
    const btnDemoTiktokStickers = document.getElementById('btn-demo-tiktok-stickers');

    if (btnDemoDirectSticker) {
        btnDemoDirectSticker.addEventListener('click', () => {
            const demoStickerUrl = 'https://p16-tiktok-dm-sticker-sign-sg.ibyteimg.com/tos-alisg-i-dhq7zx4c1p-sg/a08ba8ad87c54bd9a40f89a433075bf8~tplv-dhq7zx4c1p-full.awebp?rk3s=00edd399&x-expires=1793733828&x-signature=uthrvu5UXUgcDc22CEYVSOxw%2FAo%3D';
            inputXUrl.value = demoStickerUrl;
            updatePlatformBadge(demoStickerUrl);
            triggerPreview(demoStickerUrl);
            showToast('🎭 Cargado sticker animado de TikTok', 'info');
        });
    }

    if (btnDemoVideo) {
        btnDemoVideo.addEventListener('click', () => {
            const demoVideoUrl = 'https://x.com/SpaceX/status/1802074351659856170';
            inputXUrl.value = demoVideoUrl;
            updatePlatformBadge(demoVideoUrl);
            triggerPreview(demoVideoUrl);
            showToast('🎬 Cargado video de ejemplo', 'info');
        });
    }

    if (btnDemoTiktokStickers) {
        btnDemoTiktokStickers.addEventListener('click', () => {
            const demoPostUrl = 'https://www.tiktok.com/@underpaidscalie/photo/7691687350249819422?_r=1';
            inputTiktokStickersUrl.value = demoPostUrl;
            showToast('🔍 Escaneando comentarios del TikTok con stickers...', 'info');
            btnExtractStickers.click();
        });
    }

    // Detect Platform in Input
    function updatePlatformBadge(url) {
        if (!platformBadge) return;
        const clean = url.trim().toLowerCase();
        if (clean.includes('tiktokcdn.com') || clean.includes('ibyteimg.com') || clean.includes('.webp') || clean.includes('.awebp') || clean.includes('.gif') || clean.includes('.png')) {
            platformBadge.textContent = '🎭 Sticker Directo';
            platformBadge.className = 'platform-indicator platform-sticker';
            platformBadge.classList.remove('hidden');
        } else if (clean.includes('tiktok.com')) {
            platformBadge.textContent = '🎵 TikTok Video / Foto';
            platformBadge.className = 'platform-indicator platform-tiktok';
            platformBadge.classList.remove('hidden');
        } else if (clean.includes('x.com') || clean.includes('twitter.com')) {
            platformBadge.textContent = '𝕏 Video';
            platformBadge.className = 'platform-indicator platform-x';
            platformBadge.classList.remove('hidden');
        } else {
            platformBadge.classList.add('hidden');
        }
    }

    inputXUrl.addEventListener('input', (e) => {
        updatePlatformBadge(e.target.value);
    });

    // Pairing tabs toggle
    if (tabQr && tabCode) {
        tabQr.addEventListener('click', () => {
            tabQr.classList.add('active');
            tabCode.classList.remove('active');
            methodQrBox.classList.remove('hidden');
            methodCodeBox.classList.add('hidden');
        });

        tabCode.addEventListener('click', () => {
            tabCode.classList.add('active');
            tabQr.classList.remove('active');
            methodCodeBox.classList.remove('hidden');
            methodQrBox.classList.add('hidden');
        });
    }

    // Request Pairing Code
    if (btnGetPairingCode) {
        btnGetPairingCode.addEventListener('click', async () => {
            const phone = inputPhonePair.value.trim();
            if (!phone) {
                alert('Por favor introduce tu número con código de país (ej: 54911XXXXXXXX o 346XXXXXXXX).');
                inputPhonePair.focus();
                return;
            }

            btnGetPairingCode.disabled = true;
            btnGetPairingCode.textContent = '⏳ Generando...';
            pairingCodeResult.classList.add('hidden');

            try {
                const res = await fetch('/api/pairing-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'No se pudo generar el código');
                }

                pairingCodeDigits.textContent = data.code;
                pairingCodeResult.classList.remove('hidden');
            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                btnGetPairingCode.disabled = false;
                btnGetPairingCode.textContent = 'Obtener Código';
            }
        });
    }

    // Timeline Visual UI Update
    function updateTimelineUI() {
        const start = Math.max(0, parseFloat(inputStartTime.value) || 0);
        const end = Math.min(videoTotalDuration, parseFloat(inputEndTime.value) || videoTotalDuration);
        
        const duration = Math.max(0.1, end - start);
        calculatedDurationBadge.textContent = `${duration.toFixed(1)}s de sticker`;

        if (duration <= 6.0) {
            calculatedDurationBadge.className = 'badge-ideal';
            durationWarningText.textContent = '✓ Duración perfecta para sticker animado (< 500 KB)';
            durationWarningText.className = 'helper-text-ok';
        } else {
            calculatedDurationBadge.className = 'badge-warning';
            durationWarningText.textContent = '⚠️ Más de 6s puede hacer el sticker muy pesado para WhatsApp (te recomendamos 3-5s)';
            durationWarningText.className = 'helper-text-warn';
        }

        // Visual track update
        if (videoTotalDuration > 0) {
            const leftPct = (start / videoTotalDuration) * 100;
            const widthPct = Math.max(1, (duration / videoTotalDuration) * 100);
            timelineSelectedRange.style.left = `${Math.min(100, Math.max(0, leftPct))}%`;
            timelineSelectedRange.style.width = `${Math.min(100 - leftPct, Math.max(1, widthPct))}%`;
        }
    }

    // Synchronize Start Time
    function setStartTime(val) {
        val = Math.max(0, Math.min(parseFloat(val) || 0, videoTotalDuration - 0.5));
        val = parseFloat(val.toFixed(1));
        sliderStartTime.value = val;
        inputStartTime.value = val;
        startTimeVal.textContent = `${val.toFixed(1)}s`;

        const currentEnd = parseFloat(inputEndTime.value) || videoTotalDuration;
        if (currentEnd <= val) {
            setEndTime(Math.min(videoTotalDuration, val + 4.0));
        }

        updateTimelineUI();
    }

    // Synchronize End Time
    function setEndTime(val) {
        val = Math.min(videoTotalDuration, Math.max(0.5, parseFloat(val) || videoTotalDuration));
        val = parseFloat(val.toFixed(1));
        sliderEndTime.value = val;
        inputEndTime.value = val;
        endTimeVal.textContent = `${val.toFixed(1)}s`;

        const currentStart = parseFloat(inputStartTime.value) || 0;
        if (currentStart >= val) {
            setStartTime(Math.max(0, val - 4.0));
        }

        updateTimelineUI();
    }

    sliderStartTime.addEventListener('input', (e) => setStartTime(e.target.value));
    inputStartTime.addEventListener('change', (e) => setStartTime(e.target.value));

    sliderEndTime.addEventListener('input', (e) => setEndTime(e.target.value));
    inputEndTime.addEventListener('change', (e) => setEndTime(e.target.value));

    btnSetStartCurrent.addEventListener('click', () => {
        setStartTime(previewPlayer.currentTime);
    });

    btnSetEndCurrent.addEventListener('click', () => {
        setEndTime(previewPlayer.currentTime);
    });

    // Video Player events: timeupdate
    previewPlayer.addEventListener('timeupdate', () => {
        const cur = previewPlayer.currentTime;
        playerTimeDisplay.textContent = `${formatTimePrecise(cur)} / ${formatTimePrecise(videoTotalDuration)}`;

        if (videoTotalDuration > 0) {
            timelinePlayhead.style.left = `${(cur / videoTotalDuration) * 100}%`;
        }

        if (isLoopingSnippet) {
            const start = parseFloat(inputStartTime.value) || 0;
            const end = parseFloat(inputEndTime.value) || videoTotalDuration;
            if (cur >= end || cur < start) {
                previewPlayer.currentTime = start;
                previewPlayer.play();
            }
        }
    });

    // Loop Preview button
    btnPreviewLoop.addEventListener('click', () => {
        const start = parseFloat(inputStartTime.value) || 0;
        previewPlayer.currentTime = start;
        isLoopingSnippet = true;
        previewPlayer.play();
        btnPreviewLoop.textContent = '⏸️ Pausar Fragmento';
    });

    previewPlayer.addEventListener('pause', () => {
        isLoopingSnippet = false;
        btnPreviewLoop.textContent = '🔁 Reproducir Solo Fragmento Seleccionado';
    });

    // Paste from Clipboard - Video Mode
    btnPasteClipboard.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                inputXUrl.value = text.trim();
                updatePlatformBadge(text.trim());
                triggerPreview(text.trim());
            }
        } catch (err) {
            console.warn('Clipboard access denied:', err);
        }
    });

    // Fetch Preview on button click
    btnFetchPreview.addEventListener('click', () => {
        const url = inputXUrl.value.trim();
        if (url) {
            triggerPreview(url);
        } else {
            alert('Por favor introduce un enlace de video de TikTok, X o sticker.');
            inputXUrl.focus();
        }
    });

    inputXUrl.addEventListener('change', () => {
        const url = inputXUrl.value.trim();
        if (url) {
            updatePlatformBadge(url);
            triggerPreview(url);
        }
    });

    async function triggerPreview(url) {
        btnFetchPreview.disabled = true;
        btnFetchPreview.textContent = '⏳ Analizando...';

        try {
            const res = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            
            if (data.success && data.info) {
                const info = data.info;
                videoTotalDuration = info.duration || 5.0;

                // Handle direct sticker vs video
                if (info.isDirectSticker) {
                    timelineCard.classList.add('hidden');
                    previewBox.classList.remove('hidden');
                    previewThumbnail.src = info.thumbnail;
                    previewTitle.textContent = info.title;
                    previewAuthor.textContent = info.uploader;
                    previewDurationBadge.textContent = 'Sticker';
                    inputPackName.value = 'TikTok Stickers';
                    return;
                }

                // Load video stream into player
                if (info.videoUrl) {
                    previewPlayer.src = info.videoUrl;
                    timelineCard.classList.remove('hidden');
                } else {
                    timelineCard.classList.remove('hidden');
                }

                // Adjust sliders max
                sliderStartTime.max = videoTotalDuration;
                inputStartTime.max = videoTotalDuration;
                sliderEndTime.max = videoTotalDuration;
                inputEndTime.max = videoTotalDuration;

                // Defaults: start at 0s, end at min(4.5s, duration)
                setStartTime(0.0);
                setEndTime(Math.min(videoTotalDuration, 4.0));

                previewTitle.textContent = info.title || 'Video';
                previewAuthor.textContent = `@${info.uploader || 'usuario'}`;
                if (info.thumbnail) {
                    previewThumbnail.src = info.thumbnail;
                }
                previewDurationBadge.textContent = formatTimePrecise(videoTotalDuration);
                previewBox.classList.remove('hidden');

                if (info.uploader) {
                    inputAuthorName.value = `@${info.uploader}`;
                }
                if (info.platform === 'tiktok') {
                    inputPackName.value = 'TikTok Stickers';
                }
            } else {
                alert(data.error || 'No se pudo obtener información del contenido. Comprueba el enlace.');
            }
        } catch (err) {
            console.error('Error fetching preview:', err);
            alert('Error al analizar el contenido: ' + err.message);
        } finally {
            btnFetchPreview.disabled = false;
            btnFetchPreview.textContent = '🔍 Analizar Video';
        }
    }

    // Convert Video or Direct Sticker Handler
    async function startConversion(sendToWhatsApp = true) {
        const url = inputXUrl.value.trim();
        if (!url) {
            alert('Por favor introduce un enlace de video de TikTok, X o sticker.');
            inputXUrl.focus();
            return;
        }

        const start = parseFloat(inputStartTime.value) || 0;
        const end = parseFloat(inputEndTime.value) || (start + 4.0);
        const duration = Math.max(0.2, end - start);

        // Show progress card
        progressCard.classList.remove('hidden');
        progressBar.style.width = '10%';
        progressBar.style.backgroundColor = '';
        progressStageTitle.textContent = 'Iniciando proceso...';
        progressDetail.textContent = 'Contactando servidor...';
        logTerminal.innerHTML = '';
        addLog(`Iniciando creación de sticker...`);

        btnConvertAndSend.disabled = true;
        btnConvertOnly.disabled = true;

        try {
            const payload = {
                url,
                startTime: start,
                endTime: end,
                duration: duration,
                crop: selectCrop.value,
                quality: Number(selectQuality.value),
                pack: inputPackName.value.trim() || 'Stickers Animados',
                author: inputAuthorName.value.trim() || 'Mi Bot Personal',
                sendToWhatsApp
            };

            const res = await fetch('/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error en la conversión');
            }

            progressBar.style.width = '100%';
            progressStageTitle.textContent = '¡Completado con éxito!';
            progressDetail.textContent = sendToWhatsApp 
                ? (data.sticker.sentToWhatsApp 
                    ? '🎉 ¡Sticker entregado directamente a tu WhatsApp personal!' 
                    : `Guardado localmente (${data.sticker.sendError || 'Sin enviar'})`)
                : '💾 Sticker creado y guardado en tu computadora.';
            
            addLog(`Sticker listo: ${data.sticker.fileName} (${data.sticker.fileSizeKb} KB)`);
            showToast(sendToWhatsApp ? '🚀 ¡Sticker entregado a tu WhatsApp!' : '💾 Sticker guardado en tu equipo', 'success');
            loadStickers();
        } catch (err) {
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#ef4444';
            progressStageTitle.textContent = '❌ Error';
            progressDetail.textContent = err.message;
            addLog(`Error: ${err.message}`);
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            btnConvertAndSend.disabled = false;
            btnConvertOnly.disabled = false;
        }
    }

    btnConvertAndSend.addEventListener('click', () => startConversion(true));
    btnConvertOnly.addEventListener('click', () => startConversion(false));

    // ==========================================
    // TIKTOK COMMENT STICKERS EXTRACTOR LOGIC
    // ==========================================
    btnPasteStickersUrl.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                inputTiktokStickersUrl.value = text.trim();
            }
        } catch (err) {
            console.warn('Clipboard access denied:', err);
        }
    });

    btnExtractStickers.addEventListener('click', async () => {
        const url = inputTiktokStickersUrl.value.trim();
        if (!url) {
            alert('Por favor introduce el enlace del video de TikTok.');
            inputTiktokStickersUrl.focus();
            return;
        }

        btnExtractStickers.disabled = true;
        btnExtractStickers.textContent = '⏳ Escaneando...';
        stickersExtractResults.classList.add('hidden');
        extractedStickersGrid.innerHTML = '';
        currentExtractedStickers = [];

        progressCard.classList.remove('hidden');
        progressBar.style.width = '20%';
        progressBar.style.backgroundColor = '';
        progressStageTitle.textContent = 'Escaneando comentarios de TikTok...';
        progressDetail.textContent = 'Conectando con la API de comentarios de TikTok...';
        logTerminal.innerHTML = '';
        addLog(`Analizando publicación de TikTok: ${url}`);

        try {
            const res = await fetch('/api/tiktok/extract-stickers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al extraer stickers');
            }

            progressBar.style.width = '100%';
            progressStageTitle.textContent = '¡Escaneo finalizado!';
            progressDetail.textContent = `Se encontraron ${data.stickersCount} stickers/imágenes en ${data.totalCommentsScanned} comentarios.`;
            addLog(`Encontrados ${data.stickersCount} stickers.`);

            currentExtractedStickers = data.stickers || [];
            extractCountTitle.textContent = `Stickers Encontrados (${currentExtractedStickers.length})`;
            extractDetailsText.textContent = `De ${data.totalCommentsScanned} comentarios analizados en tiempo real.`;

            if (currentExtractedStickers.length === 0) {
                extractedStickersGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <p>ℹ️ No se detectaron stickers ni imágenes en los comentarios de este video. Prueba con otro video que tenga comentarios con stickers activos.</p>
                    </div>
                `;
            } else {
                applyStickerFilter();
                showToast(`✨ ¡Se extrajeron ${data.stickersCount} stickers de comentarios!`, 'success');
            }

            stickersExtractResults.classList.remove('hidden');
        } catch (err) {
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#ef4444';
            progressStageTitle.textContent = '❌ Error';
            progressDetail.textContent = err.message;
            addLog(`Error: ${err.message}`);
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            btnExtractStickers.disabled = false;
            btnExtractStickers.textContent = '🔍 Extraer Stickers';
        }
    });

    // Filter Chips for Extracted Stickers
    let currentFilter = 'all';
    const filterChips = document.querySelectorAll('.filter-chip');

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter') || 'all';
            applyStickerFilter();
        });
    });

    function applyStickerFilter() {
        if (!currentExtractedStickers) return;
        let filtered = currentExtractedStickers;
        if (currentFilter === 'animated') {
            filtered = currentExtractedStickers.filter(s => s.isAnimated);
        } else if (currentFilter === 'static') {
            filtered = currentExtractedStickers.filter(s => !s.isAnimated);
        }

        extractCountTitle.textContent = `Stickers Encontrados (${filtered.length}${currentFilter !== 'all' ? ` de ${currentExtractedStickers.length}` : ''})`;
        renderExtractedStickers(filtered);
    }

    function renderExtractedStickers(stickers) {
        extractedStickersGrid.innerHTML = '';
        if (stickers.length === 0) {
            extractedStickersGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>No hay stickers con el filtro seleccionado (${currentFilter === 'animated' ? 'Animados' : 'Estáticos'}).</p>
                </div>
            `;
            return;
        }

        stickers.forEach((st, idx) => {
            const card = document.createElement('div');
            card.className = 'sticker-card';

            const animBadge = st.isAnimated ? '<span class="sticker-anim-badge">⚡ ANIMADO</span>' : '';

            card.innerHTML = `
                <div class="sticker-preview-wrapper checkerboard-bg">
                    <img src="${st.previewUrl || st.stickerUrl}" alt="Sticker ${idx + 1}" loading="lazy">
                    ${animBadge}
                </div>
                <div class="sticker-card-info">
                    <div class="sticker-card-author">@${st.author || 'Usuario'}</div>
                    <div class="sticker-card-comment" title="${st.commentText || ''}">${st.commentText ? `"${st.commentText}"` : 'Sticker de comentario'}</div>
                </div>
                <div class="sticker-btn-group">
                    <button class="btn-send-wa" data-url="${st.stickerUrl}" title="Enviar como sticker a tu WhatsApp">
                        📲 WhatsApp
                    </button>
                    <a href="${st.stickerUrl}" target="_blank" download="sticker_${st.id}.webp" class="btn-quick-download" title="Descargar archivo original">
                        ⬇️
                    </a>
                </div>
            `;

            const btnSendWa = card.querySelector('.btn-send-wa');
            btnSendWa.addEventListener('click', async () => {
                btnSendWa.disabled = true;
                btnSendWa.textContent = '⏳';
                showToast(`Convirtiendo sticker de @${st.author}...`, 'info', 2000);
                try {
                    const res = await fetch('/api/convert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: st.stickerUrl,
                            pack: 'TikTok Stickers',
                            author: `@${st.author}`,
                            sendToWhatsApp: true
                        })
                    });
                    const d = await res.json();
                    if (res.ok) {
                        btnSendWa.textContent = '✅ ¡Enviado!';
                        showToast(`📲 ¡Sticker de @${st.author} enviado a tu WhatsApp!`, 'success');
                        loadStickers();
                        setTimeout(() => {
                            btnSendWa.textContent = '📲 WhatsApp';
                            btnSendWa.disabled = false;
                        }, 2500);
                    } else {
                        showToast(d.error || 'Error al enviar sticker', 'error');
                        btnSendWa.textContent = '📲 WhatsApp';
                        btnSendWa.disabled = false;
                    }
                } catch (e) {
                    showToast('Error: ' + e.message, 'error');
                    btnSendWa.textContent = '📲 WhatsApp';
                    btnSendWa.disabled = false;
                }
            });

            extractedStickersGrid.appendChild(card);
        });
    }

    // Download All Stickers as ZIP
    btnDownloadAllZip.addEventListener('click', async () => {
        if (!currentExtractedStickers || currentExtractedStickers.length === 0) {
            showToast('No hay stickers para descargar.', 'error');
            return;
        }

        btnDownloadAllZip.disabled = true;
        btnDownloadAllZip.textContent = '⏳ Creando ZIP...';
        showToast('Empaquetando stickers en archivo .ZIP...', 'info');

        try {
            const res = await fetch('/api/tiktok/download-pack-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stickers: currentExtractedStickers,
                    packName: `tiktok_stickers_${Date.now()}`
                })
            });

            if (!res.ok) throw new Error('Error generando el archivo ZIP');

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `tiktok_stickers_pack.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            showToast('📦 ¡Pack completo descargado en .ZIP!', 'success');
        } catch (err) {
            showToast('Error descargando el pack: ' + err.message, 'error');
        } finally {
            btnDownloadAllZip.disabled = false;
            btnDownloadAllZip.textContent = '📦 Descargar Pack Completo (.ZIP)';
        }
    });

    // WhatsApp Disconnect
    btnDisconnect.addEventListener('click', async () => {
        if (confirm('¿Deseas desconectar tu sesión de WhatsApp?')) {
            await fetch('/api/logout', { method: 'POST' });
            fetchStatus();
        }
    });

    btnToggleConnection.addEventListener('click', () => {
        const card = document.getElementById('wa-connection-card');
        card.scrollIntoView({ behavior: 'smooth' });
    });

    // Render Stickers Gallery
    async function loadStickers() {
        try {
            const res = await fetch('/api/stickers');
            const data = await res.json();
            const list = data.stickers || [];

            stickersCount.textContent = `${list.length} sticker${list.length === 1 ? '' : 's'}`;

            if (list.length === 0) {
                stickersGrid.innerHTML = `
                    <div class="empty-state">
                        <p>Aún no has generado ningún sticker. ¡Pega un enlace de TikTok o X para comenzar!</p>
                    </div>
                `;
                return;
            }

            stickersGrid.innerHTML = '';
            list.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'sticker-card';
                card.innerHTML = `
                    <div class="sticker-img-wrap">
                        <img src="${item.url}" alt="${item.pack}" loading="lazy">
                    </div>
                    <div class="sticker-meta">
                        <span><b>${item.fileSizeKb} KB</b></span>
                        <span>${item.duration ? item.duration.toFixed(1) + 's' : ''}</span>
                    </div>
                    <button class="btn-send-again" data-filename="${item.fileName}">
                        📲 Enviar a WhatsApp
                    </button>
                `;

                card.querySelector('.btn-send-again').addEventListener('click', async () => {
                    const btn = card.querySelector('.btn-send-again');
                    btn.disabled = true;
                    btn.textContent = '⏳ Enviando...';
                    try {
                        const sendRes = await fetch('/api/send-sticker', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileName: item.fileName })
                        });
                        const sendData = await sendRes.json();
                        if (sendRes.ok) {
                            btn.textContent = '✅ ¡Enviado!';
                            setTimeout(() => {
                                btn.textContent = '📲 Enviar a WhatsApp';
                                btn.disabled = false;
                            }, 2500);
                        } else {
                            alert(sendData.error || 'Error al enviar');
                            btn.textContent = '📲 Enviar a WhatsApp';
                            btn.disabled = false;
                        }
                    } catch (e) {
                        alert('Error al enviar: ' + e.message);
                        btn.textContent = '📲 Enviar a WhatsApp';
                        btn.disabled = false;
                    }
                });

                stickersGrid.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading stickers:', err);
        }
    }

    // Status UI updater
    function updateStatusUI(status, user, qrCodeDataUrl) {
        currentStatus = status;

        if (status === 'connected') {
            waStatusBadge.className = 'status-badge connected';
            const phone = (user && user.phone) ? user.phone : '';
            const name = (user && user.name) ? user.name : 'Usuario';

            waStatusText.textContent = phone ? `Conectado (+${phone})` : 'Conectado';
            connectionBtnLabel.textContent = 'En línea';

            waConnectedView.classList.remove('hidden');
            waQrView.classList.add('hidden');

            userDisplayName.textContent = name;
            userDisplayPhone.textContent = phone ? `+${phone}` : 'Dispositivo Vinculado';
            return;
        }

        if (status === 'waiting_qr') {
            waStatusBadge.className = 'status-badge waiting_qr';
            waStatusText.textContent = 'Esperando QR';
            connectionBtnLabel.textContent = 'Escanear QR';

            waConnectedView.classList.add('hidden');
            waQrView.classList.remove('hidden');

            if (qrCodeDataUrl) {
                qrImage.src = qrCodeDataUrl;
                qrImage.classList.remove('hidden');
                qrPlaceholder.classList.add('hidden');
            } else {
                qrImage.classList.add('hidden');
                qrPlaceholder.classList.remove('hidden');
            }
            return;
        }

        // Disconnected or connecting
        waStatusBadge.className = `status-badge ${status}`;
        waStatusText.textContent = status === 'connecting' ? 'Conectando...' : 'Desconectado';
        connectionBtnLabel.textContent = 'Conectar';

        waConnectedView.classList.add('hidden');
        waQrView.classList.remove('hidden');
        qrImage.classList.add('hidden');
        qrPlaceholder.classList.remove('hidden');
    }

    // Periodic HTTP status fetcher
    async function fetchStatus() {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                updateStatusUI(data.status, data.user, data.qrCodeDataUrl);
            }
        } catch (e) {
            // Ignored if offline
        }
    }

    // WebSocket Handling
    function setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket conectado');
            fetchStatus();
        };

        ws.onmessage = (event) => {
            try {
                const { type, data } = JSON.parse(event.data);

                if (type === 'STATUS_UPDATE') {
                    updateStatusUI(data.status, data.user, data.qrCodeDataUrl);
                } else if (type === 'QR_UPDATE') {
                    if (data.qrCodeDataUrl) {
                        qrImage.src = data.qrCodeDataUrl;
                        qrImage.classList.remove('hidden');
                        qrPlaceholder.classList.add('hidden');
                    }
                } else if (type === 'PROGRESS_UPDATE') {
                    progressCard.classList.remove('hidden');
                    addLog(data.message);
                    progressDetail.textContent = data.message;

                    if (data.stage === 'EXTRACTING_INFO' || data.stage === 'SCANNING') progressBar.style.width = '25%';
                    if (data.stage === 'DOWNLOADING') progressBar.style.width = '50%';
                    if (data.stage === 'CONVERTING') progressBar.style.width = '75%';
                    if (data.stage === 'SENDING') progressBar.style.width = '90%';
                } else if (type === 'AUTO_MEDIA_DETECTED' || type === 'AUTO_X_DETECTED') {
                    addLog(`⚡ Enlace recibido desde tu WhatsApp: ${data.url}`);
                    progressCard.classList.remove('hidden');
                } else if (type === 'CONVERSION_SUCCESS') {
                    loadStickers();
                }
            } catch (err) {
                console.error('Error parsing WS message:', err);
            }
        };

        ws.onclose = () => {
            setTimeout(setupWebSocket, 3000);
        };
    }

    // Initialize immediately
    fetchStatus();
    setInterval(fetchStatus, 2500);
    setupWebSocket();
    loadStickers();
});
