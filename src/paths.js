const fs = require('fs');
const path = require('path');
const os = require('os');

function getPaths() {
    let ffmpegPath = 'ffmpeg';
    let ytdlpPath = 'yt-dlp';

    const homeDir = process.env.USERPROFILE || os.homedir() || '';
    const localAppData = process.env.LOCALAPPDATA || (homeDir ? path.join(homeDir, 'AppData', 'Local') : '');
    const packagesDir = localAppData ? path.join(localAppData, 'Microsoft', 'WinGet', 'Packages') : '';
    
    if (packagesDir && fs.existsSync(packagesDir)) {
        try {
            const entries = fs.readdirSync(packagesDir);
            for (const entry of entries) {
                if (entry.includes('FFmpeg')) {
                    const subentries = fs.readdirSync(path.join(packagesDir, entry));
                    for (const sub of subentries) {
                        const candidate = path.join(packagesDir, entry, sub, 'bin', 'ffmpeg.exe');
                        if (fs.existsSync(candidate)) {
                            ffmpegPath = candidate;
                            break;
                        }
                    }
                }
                if (entry.includes('yt-dlp')) {
                    const candidate = path.join(packagesDir, entry, 'yt-dlp.exe');
                    if (fs.existsSync(candidate)) {
                        ytdlpPath = candidate;
                    }
                }
            }
        } catch (e) {
            // Ignore readdir errors on restricted systems
        }
    }

    // Set PATH for child processes if explicit binary paths were found
    if (ffmpegPath !== 'ffmpeg' && fs.existsSync(ffmpegPath)) {
        const ffmpegDir = path.dirname(ffmpegPath);
        if (process.env.PATH && !process.env.PATH.includes(ffmpegDir)) {
            process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
        }
    }
    if (ytdlpPath !== 'yt-dlp' && fs.existsSync(ytdlpPath)) {
        const ytdlpDir = path.dirname(ytdlpPath);
        if (process.env.PATH && !process.env.PATH.includes(ytdlpDir)) {
            process.env.PATH = `${ytdlpDir};${process.env.PATH}`;
        }
    }

    return { ffmpegPath, ytdlpPath };
}

module.exports = { getPaths };
