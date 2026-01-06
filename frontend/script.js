// Backend bağlantı kontrolü
async function checkBackendConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye timeout
        
        const response = await fetch('http://localhost:3000/health', {
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
        
        const response = await fetch('http://localhost:3000/download', {
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

        if (data.downloadUrl) {
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
                        <div class="quality-option ${isDefault ? 'selected' : ''}" data-quality="${key}" data-url="${quality.url}">
                            <span class="quality-name">${quality.label}</span>
                            ${isDefault ? '<span class="quality-badge">Varsayılan</span>' : ''}
                        </div>
                    `;
                });
                qualityOptionsHtml += '</div>';
            }
            
            // Seçili kaliteyi takip et
            let selectedQuality = data.defaultQuality || Object.keys(data.qualities || {})[0];
            let selectedUrl = data.downloadUrl;
            
            resultDiv.innerHTML = `
                <div class="success">
                    ${qualityOptionsHtml}
                    <div class="download-buttons">
                        <a href="${selectedUrl}" download="${filename}" class="download-btn" id="downloadLink">
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
                        
                        // Yeni URL'i al
                        selectedQuality = option.dataset.quality;
                        selectedUrl = option.dataset.url;
                        
                        // İndirme ve önizleme linklerini güncelle
                        const downloadLink = document.getElementById('downloadLink');
                        const previewLink = document.getElementById('previewLink');
                        if (downloadLink) {
                            downloadLink.href = selectedUrl;
                            downloadLink.textContent = `${data.qualities[selectedQuality].label} İndir`;
                        }
                        if (previewLink) {
                            previewLink.href = selectedUrl;
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

// Allow Enter key to trigger download
document.getElementById('tiktokUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('downloadButton').click();
    }
});
