require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db')
const userRoutes = require('./routes/userRoutes')
const uploadRoutes = require('./routes/uploadRoutes')
const fetchRoutes = require('./routes/fetchRoutes')
const searchRoutes = require('./routes/searchRoutes')

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json())

connectToDB();

app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/fetch', fetchRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/debug', async (req, res) => {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const debugInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        envPath: process.env.PATH,
        ytDlpPath: null,
        ffmpegPath: null,
        ytDlpVersion: null,
        testSearch: null,
        errors: []
    };

    try {
        const { stdout } = await execPromise('which yt-dlp');
        debugInfo.ytDlpPath = stdout.trim();
    } catch (e) {
        debugInfo.errors.push(`which yt-dlp failed: ${e.message}`);
    }

    try {
        const { stdout } = await execPromise('which ffmpeg');
        debugInfo.ffmpegPath = stdout.trim();
    } catch (e) {
        debugInfo.errors.push(`which ffmpeg failed: ${e.message}`);
    }

    if (!debugInfo.ytDlpPath) {
        const findPaths = [
            '/home/render/.local/bin/yt-dlp',
            '/opt/render/.local/bin/yt-dlp',
            '/root/.local/bin/yt-dlp',
            '/opt/render/project/src/.local/bin/yt-dlp',
            '~/.local/bin/yt-dlp'
        ];
        for (const p of findPaths) {
            try {
                const { stdout } = await execPromise(`test -f ${p} && echo "exists" || echo "no"`);
                if (stdout.trim() === 'exists') {
                    debugInfo.ytDlpPath = p;
                    break;
                }
            } catch (err) {}
        }
    }

    const ytDlpCmd = debugInfo.ytDlpPath || 'yt-dlp';
    try {
        const { stdout } = await execPromise(`${ytDlpCmd} --version`);
        debugInfo.ytDlpVersion = stdout.trim();
    } catch (e) {
        debugInfo.errors.push(`yt-dlp --version failed: ${e.message}`);
    }

    try {
        const { stdout } = await execPromise(`${ytDlpCmd} --print "%(title)s" "ytsearch1:adele hello"`);
        debugInfo.testSearch = stdout.trim();
    } catch (e) {
        debugInfo.errors.push(`test search failed: ${e.message}`);
    }

    res.json(debugInfo);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})