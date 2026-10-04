const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getPaths() {
    let ffmpegPath = 'ffmpeg';
    let ytdlpPath = 'yt-dlp';

    // Check winget package dirs specifically if not in default PATH
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\dagne', 'AppData', 'Local');
    const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    
    if (fs.existsSync(packagesDir)) {
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
    }

    // Ensure directory of ffmpeg is in PATH for child processes (and wa-sticker-formatter / fluent-ffmpeg)
    const ffmpegDir = path.dirname(ffmpegPath);
    if (!process.env.PATH.includes(ffmpegDir)) {
        process.env.PATH = `${ffmpegDir};${path.dirname(ytdlpPath)};${process.env.PATH}`;
    }

    return { ffmpegPath, ytdlpPath };
}

module.exports = { getPaths };

if (require.main === module) {
    const paths = getPaths();
    console.log('Resolved Paths:', paths);
    try {
        console.log('FFmpeg version:', execSync(`"${paths.ffmpegPath}" -version`).toString().split('\n')[0]);
        console.log('yt-dlp version:', execSync(`"${paths.ytdlpPath}" --version`).toString().trim());
    } catch (e) {
        console.error('Error executing binaries:', e.message);
    }
}
