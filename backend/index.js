const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch').default; // Import node-fetch correctly
const app = express();
const port = process.env.PORT || 3000; // Render gibi platformlar PORT ortam değişkenini kullanır


app.use(express.json()); // JSON body parser
app.use(cors()); // Enable CORS for all routes

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend çalışıyor' });
});

app.post('/download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Download request received for URL: ${url}`);
    try {
        const tikwmApiUrl = 'https://www.tikwm.com/api/';
        console.log(`Sending request to tikwm.com API: ${tikwmApiUrl} with URL: ${url}`);
        const response = await fetch(tikwmApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(url)}&count=12&cursor=0&web=1&hd=1`,
        });

        console.log(`Received response status from tikwm.com API: ${response.status}`);
        const data = await response.json();
        console.log('Full response data from tikwm.com API:', data);

        if (data && data.code === 0 && data.data) {
            // Tüm kalite seçeneklerini topla
            const qualityOptions = {};
            
            // Filigransız seçenekler (öncelikli)
            if (data.data.nwmplay) {
                let url = data.data.nwmplay;
                if (url.startsWith('//')) url = 'https:' + url;
                else if (url.startsWith('/')) url = 'https://tikwm.com' + url;
                qualityOptions.nwmplay = { url, label: 'Filigransız (Standart Kalite)', quality: 'standart' };
            }
            
            if (data.data.hdplay) {
                let url = data.data.hdplay;
                if (url.startsWith('//')) url = 'https:' + url;
                else if (url.startsWith('/')) url = 'https://tikwm.com' + url;
                qualityOptions.hdplay = { url, label: 'HD Kalite (Filigransız)', quality: 'hd' };
            }
            
            if (data.data.play) {
                let url = data.data.play;
                if (url.startsWith('//')) url = 'https:' + url;
                else if (url.startsWith('/')) url = 'https://tikwm.com' + url;
                qualityOptions.play = { url, label: 'Standart Kalite (Filigransız)', quality: 'standart' };
            }
            
            // Varsayılan olarak filigransız seçeneği kullan
            const defaultQuality = data.data.nwmplay ? 'nwmplay' : (data.data.hdplay ? 'hdplay' : 'play');
            
            if (Object.keys(qualityOptions).length > 0) {
                    const selectedUrl = qualityOptions[defaultQuality].url;
                    const filename = `${encodeURIComponent(data.data.title || 'tiktok-video')}.mp4`;
                    // Frontend'e doğrudan indirme URL'si yerine proxy URL'si gönderiyoruz
                    const proxyDownloadUrl = `/proxy-video?videoUrl=${encodeURIComponent(selectedUrl)}&filename=${encodeURIComponent(filename)}`;
                    res.json({ 
                        downloadUrl: selectedUrl, // Bu hala frontend'de gösterilebilir veya kullanılabilir
                        proxyDownloadUrl: proxyDownloadUrl, // Yeni proxy indirme URL'si
                        defaultQuality: defaultQuality,
                        qualities: qualityOptions,
                        title: data.data.title || 'TikTok Video',
                        author: data.data.author || '',
                        cover: data.data.cover || ''
                    });
            } else {
                console.error('No video URL found in API response. Full result:', data);
                res.status(500).json({ error: 'Video URL bulunamadı.', details: data.msg || 'Unknown error' });
            }
        } else {
            console.error('tikwm.com API returned an error. Full result:', data);
            res.status(500).json({ error: 'TikTok videosu indirilemedi.', details: data?.msg || 'Bilinmeyen hata' });
        }
    } catch (error) {
        console.error('Error downloading TikTok video:', error, error.stack);
        res.status(500).json({ error: 'Failed to download TikTok video.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});

// Yeni proxy indirme endpoint'i
app.get('/proxy-video', async (req, res) => {
    const { videoUrl, filename } = req.query;

    if (!videoUrl) {
        return res.status(400).send('Video URL is required.');
    }

    try {
        const response = await fetch(videoUrl);

        if (!response.ok) {
            console.error(`Failed to fetch video from ${videoUrl}: ${response.statusText}`);
            return res.status(response.status).send('Failed to fetch video.');
        }

        // Content-Type başlığını orijinal yanıttan al
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }

        // İndirme başlığını ayarla
        res.setHeader('Content-Disposition', `attachment; filename="${decodeURIComponent(filename || 'tiktok-video.mp4')}"`);

        // Video akışını istemciye yönlendir
        response.body.pipe(res);

    } catch (error) {
        console.error('Error proxying video:', error);
        res.status(500).send('Error proxying video.');
    }
});
