// Backend API URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://tiktok-downloader-backend-yk1f.onrender.com';

// Backend bağlantı kontrolü
async function checkBackendConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye timeout
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return true;
        }
    } catch (error) {
        console.error('Backend bağlantı hatası:', error);
        return false;
    }
    return false;
}

// Sayfa yüklendiğinde backend kontrolü
window.addEventListener('DOMContentLoaded', async () => {
    const resultDiv = document.getElementById('result');
    const isConnected = await checkBackendConnection();
    
    if (!isConnected) {
        resultDiv.innerHTML = `
            <div class="error">
                <p><strong>Backend sunucusu çalışmıyor!</strong></p>
                <p>Lütfen backend sunucusunu başlatın:</p>
                <ol style="text-align: left; display: inline-block; margin: 10px 0;">
                    <li>Terminal'de <code>cd backend</code> komutunu çalıştırın</li>
                    <li><code>npm install</code> komutunu çalıştırın (ilk kez çalıştırıyorsanız)</li>
                    <li><code>npm start</code> komutunu çalıştırın</li>
                </ol>
                <p><small>Backend http://localhost:3000 adresinde çalışmalıdır.</small></p>
            </div>
        `;
    }
});

document.getElementById('downloadButton').addEventListener('click', async () => {
    const tiktokUrl = document.getElementById('tiktokUrl').value;
    const resultDiv = document.getElementById('result');
    const downloadButton = document.getElementById('downloadButton');

    if (!tiktokUrl) {
        resultDiv.innerHTML = '<p class="error">Lütfen bir TikTok URL\'si girin.</p>';
        return;
    }

    // Validate TikTok URL
    if (!tiktokUrl.includes('tiktok.com')) {
        resultDiv.innerHTML = '<p class="error">Geçerli bir TikTok URL\'si girin.</p>';
        return;
    }

    // Backend bağlantı kontrolü
    const isConnected = await checkBackendConnection();
    if (!isConnected) {
        resultDiv.innerHTML = `
            <p class="error">
                <strong>Backend sunucusu çalışmıyor!</strong><br>
                Lütfen backend sunucusunu başlatın: <code>cd backend && npm start</code>
            </p>
        `;
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = 'İndiriliyor...';
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Video filigransız olarak indiriliyor...</p></div>';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 saniye timeout
        
        const response = await fetch(`${API_BASE_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: tiktokUrl }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.proxyDownloadUrl) {
                // Create download link with proper filename
                const filename = (data.title || 'tiktok-video').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp4';
                
                // Kalite seçeneklerini oluştur
                let qualityOptionsHtml = '';
                if (data.qualities && Object.keys(data.qualities).length > 1) {
                    qualityOptionsHtml = '<div class="quality-selector"><p class="quality-label">Kalite Seçeneği:</p>';
                    Object.keys(data.qualities).forEach((key, index) => {
                        const quality = data.qualities[key];
                        const isDefault = key === data.defaultQuality;
                        qualityOptionsHtml += `
                            <div class="quality-option ${isDefault ? 'selected' : ''}" data-quality="${key}" data-url="${quality.url}" data-filename="${filename}">
                                <span class="quality-name">${quality.label}</span>
                                ${isDefault ? '<span class="quality-badge">Varsayılan</span>' : ''}
                            </div>
                        `;
                    });
                    qualityOptionsHtml += '</div>';
                }
                
                // Seçili kaliteyi takip et
                let selectedQuality = data.defaultQuality || Object.keys(data.qualities || {})[0];
                let selectedProxyDownloadUrl = data.proxyDownloadUrl; // Backend'den gelen proxy URL'sini kullan
                
                resultDiv.innerHTML = `
                    <div class="success">
                        ${qualityOptionsHtml}
                        <div class="download-buttons">
                            <a href="${selectedProxyDownloadUrl}" download="${filename}" class="download-btn" id="downloadLink">
                                Videoyu İndir
                            </a>
                        </div>
                    </div>
                `;
                
                // Kalite seçimi için event listener'lar ekle
                if (data.qualities && Object.keys(data.qualities).length > 1) {
                    document.querySelectorAll('.quality-option').forEach(option => {
                        option.addEventListener('click', () => {
                            // Tüm seçeneklerden selected class'ını kaldır
                            document.querySelectorAll('.quality-option').forEach(opt => opt.classList.remove('selected'));
                            // Tıklanan seçeneği işaretle
                            option.classList.add('selected');
                            
                            // Yeni URL'i al ve proxy URL'sini oluştur
                            selectedQuality = option.dataset.quality;
                            const newVideoUrl = option.dataset.url;
                            const newFilename = option.dataset.filename;
                            selectedProxyDownloadUrl = `${API_BASE_URL}/proxy-video?videoUrl=${encodeURIComponent(newVideoUrl)}&filename=${encodeURIComponent(newFilename)}`;
                            
                            // İndirme ve önizleme linklerini güncelle
                            const downloadLink = document.getElementById('downloadLink');
                            if (downloadLink) {
                                downloadLink.href = selectedProxyDownloadUrl;
                                downloadLink.textContent = `${data.qualities[selectedQuality].label} İndir`;
                            }
                        });
                    });
                }
        } else {
            resultDiv.innerHTML = `<p class="error">Hata: ${data.error || 'Bilinmeyen bir hata oluştu.'}${data.details ? '<br><small>' + data.details + '</small>' : ''}</p>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        let errorMessage = 'Sunucuya bağlanırken bir hata oluştu.';
        
        if (error.name === 'AbortError') {
            errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = `
                <strong>Backend sunucusuna bağlanılamıyor!</strong><br>
                Lütfen backend sunucusunun çalıştığından emin olun:<br>
                <code style="background: #f0f0f0; padding: 5px; border-radius: 3px;">cd backend && npm start</code>
            `;
        } else {
            errorMessage = `Hata: ${error.message}`;
        }
        
        resultDiv.innerHTML = `<p class="error">${errorMessage}</p>`;
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Videoyu İndir';
    }
});

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        // Tüm tab butonlarından active class'ını kaldır
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Tıklanan tab'ı aktif yap
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Result div'i temizle
        document.getElementById('result').innerHTML = '';
    });
});

// MP3 İndirme
document.getElementById('downloadMp3Button').addEventListener('click', async () => {
    const tiktokUrl = document.getElementById('mp3Url').value;
    const resultDiv = document.getElementById('result');
    const downloadButton = document.getElementById('downloadMp3Button');

    if (!tiktokUrl) {
        resultDiv.innerHTML = '<p class="error">Lütfen bir TikTok URL\'si girin.</p>';
        return;
    }

    if (!tiktokUrl.includes('tiktok.com')) {
        resultDiv.innerHTML = '<p class="error">Geçerli bir TikTok URL\'si girin.</p>';
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = 'İşleniyor...';
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Video URL\'si alınıyor...</p></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/download-mp3`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: tiktokUrl })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'MP3 dönüştürme hatası');
        }

        const data = await response.json();

        if (data.videoUrl) {
            // Video URL'ini doğrudan indirme linki olarak göster
            const filename = (data.title || 'tiktok-video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            resultDiv.innerHTML = `
                <div class="success">
                    <p class="success-message">Video URL alındı!</p>
                    <p class="video-title">${data.title || 'TikTok Audio'}</p>
                    <p style="color: #b8b8d4; font-size: 14px; margin: 15px 0;">
                        Not: Video URL'si alındı. Video'yu indirip MP3'e dönüştürmek için harici araçlar kullanabilirsiniz.
                    </p>
                    <div class="download-buttons">
                        <a href="${data.videoUrl}" download="${filename}.mp4" class="download-btn">
                            Videoyu İndir
                        </a>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `<p class="error">Hata: ${data.error || 'Bilinmeyen bir hata oluştu.'}</p>`;
        }
    } catch (error) {
        console.error('MP3 download error:', error);
        resultDiv.innerHTML = '<p class="error">MP3 indirme hatası oluştu.</p>';
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'MP3 İndir';
    }
});

// Hikaye İndirme
document.getElementById('downloadStoryButton').addEventListener('click', async () => {
    const username = document.getElementById('storyUsername').value;
    const resultDiv = document.getElementById('result');
    const downloadButton = document.getElementById('downloadStoryButton');

    if (!username) {
        resultDiv.innerHTML = '<p class="error">Lütfen bir kullanıcı adı girin.</p>';
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = 'Yükleniyor...';
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Hikayeler yükleniyor...</p></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/download-story`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username })
        });

        const data = await response.json();

        if (response.ok && data.stories) {
            if (data.stories.length > 0) {
                let storiesHtml = '<div class="story-grid">';
                data.stories.forEach((story, index) => {
                    let storyUrl = story.url || story.video_url || story.cover;
                    if (storyUrl && storyUrl.startsWith('//')) storyUrl = 'https:' + storyUrl;
                    else if (storyUrl && storyUrl.startsWith('/')) storyUrl = 'https://tikwm.com' + storyUrl;
                    
                    storiesHtml += `
                        <div class="story-item">
                            ${storyUrl ? `<img src="${storyUrl}" alt="Story ${index + 1}">` : ''}
                            <a href="${storyUrl}" download>İndir</a>
                        </div>
                    `;
                });
                storiesHtml += '</div>';
                
                resultDiv.innerHTML = `
                    <div class="success">
                        <p class="success-message">${data.stories.length} hikaye bulundu!</p>
                        ${storiesHtml}
                    </div>
                `;
            } else {
                resultDiv.innerHTML = '<p class="error">Kullanıcının aktif hikayesi bulunamadı.</p>';
            }
        } else {
            resultDiv.innerHTML = `<p class="error">Hata: ${data.error || 'Hikaye bulunamadı.'}</p>`;
        }
    } catch (error) {
        console.error('Story download error:', error);
        resultDiv.innerHTML = '<p class="error">Hikaye indirme hatası oluştu.</p>';
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Hikayeleri Göster';
    }
});

// Fotoğraf İndirme
document.getElementById('downloadPhotoButton').addEventListener('click', async () => {
    const photoUrl = document.getElementById('photoUrl').value;
    const resultDiv = document.getElementById('result');
    const downloadButton = document.getElementById('downloadPhotoButton');

    if (!photoUrl) {
        resultDiv.innerHTML = '<p class="error">Lütfen bir TikTok URL\'si girin.</p>';
        return;
    }

    if (!photoUrl.includes('tiktok.com')) {
        resultDiv.innerHTML = '<p class="error">Geçerli bir TikTok URL\'si girin.</p>';
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = 'İndiriliyor...';
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Fotoğraflar yükleniyor...</p></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/download-photo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: photoUrl })
        });

        const data = await response.json();

        if (response.ok && data.images && data.images.length > 0) {
            let photosHtml = '<div class="photo-grid">';
            data.images.forEach((imageUrl, index) => {
                let imgUrl = imageUrl;
                if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
                else if (imgUrl.startsWith('/')) imgUrl = 'https://tikwm.com' + imgUrl;
                
                photosHtml += `
                    <div class="photo-item">
                        <img src="${imgUrl}" alt="Photo ${index + 1}">
                        <a href="${imgUrl}" download="${data.title || 'photo'}_${index + 1}.jpg">İndir</a>
                    </div>
                `;
            });
            photosHtml += '</div>';
            
            resultDiv.innerHTML = `
                <div class="success">
                    <p class="success-message">${data.images.length} fotoğraf bulundu!</p>
                    ${data.title ? `<p class="video-title">${data.title}</p>` : ''}
                    ${photosHtml}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `<p class="error">Hata: ${data.error || 'Fotoğraf bulunamadı.'}</p>`;
        }
    } catch (error) {
        console.error('Photo download error:', error);
        resultDiv.innerHTML = '<p class="error">Fotoğraf indirme hatası oluştu.</p>';
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Fotoğrafları İndir';
    }
});

// Allow Enter key to trigger download
document.getElementById('tiktokUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('downloadButton').click();
    }
});

document.getElementById('mp3Url').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('downloadMp3Button').click();
    }
});

document.getElementById('storyUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('downloadStoryButton').click();
    }
});

document.getElementById('photoUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('downloadPhotoButton').click();
    }
});
