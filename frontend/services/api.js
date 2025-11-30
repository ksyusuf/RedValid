import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Yeni muhabir oluştur
 * @param {string} fullName - Muhabirin tam adı
 * @param {string} walletAddress - Cüzdan adresi
 * @param {string} institution - Kurum adı (opsiyonel)
 * @returns {Promise<Object>} Muhabir oluşturma sonucu
 */
export const createReporter = async (fullName, walletAddress, institution = null) => {
  try {
    const response = await api.post('/reporters/', {
      full_name: fullName,
      wallet_address: walletAddress,
      institution: institution
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Cüzdan adresi ile muhabir bilgilerini getir
 * @param {string} walletAddress - Cüzdan adresi
 * @returns {Promise<Object>} Muhabir bilgileri
 */
export const getReporter = async (walletAddress) => {
  try {
    const response = await api.get(`/reporters/${walletAddress}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Video URL'ini sorgular
 * @param {string} videoUrl - Video URL'i
 * @returns {Promise<Object>} Sorgulama sonucu
 */
export const queryVideo = async (videoUrl) => {
  try {
    // Video URL validation
    if (!videoUrl || typeof videoUrl !== 'string') {
      throw new Error('Geçerli bir video URL\'i sağlanmalıdır.');
    }

    const cleanUrl = videoUrl.trim();
    if (!cleanUrl) {
      throw new Error('Video URL\'i boş olamaz.');
    }

    const response = await api.post('/verify', {
      video_url: cleanUrl
    });
    
    return response.data;
  } catch (error) {
    // Improve error handling for better debugging
    if (error.response) {
      // Server responded with error status
      console.error('Server error:', error.response.data);
      throw error;
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network error:', error.request);
      const networkError = new Error('Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    } else {
      // Something else happened
      console.error('Request setup error:', error.message);
      throw error;
    }
  }
};

/**
 * Video URL'ini yükler ve hash hesaplar (URL tabanlı doğrulama)
 * @param {string} walletAddress - Cüzdan adresi
 * @param {string} videoUrl - Video URL'i
 * @returns {Promise<Object>} Yükleme sonucu
 */
export const uploadVideoFromUrl = async (walletAddress, videoUrl, fullName = null) => {
  try {
    const response = await api.post('/videos/prepare-transaction', {
      reporter_wallet: walletAddress,
      video_url: videoUrl
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Video dosyasını yükler ve hash hesaplar (Dosya tabanlı doğrulama)
 * @param {string} reporter_wallet - Cüzdan adresi
 * @param {File} video_file - Video dosyası
 * @returns {Promise<Object>} Yükleme sonucu
 */
export const uploadVideoFromFile = async (reporter_wallet, video_file) => {
  try {
    if (!reporter_wallet) {
      throw new Error('Cüzdan adresi gereklidir.');
    }
    
    if (!video_file) {
      throw new Error('Video dosyası seçilmedi.');
    }
    
    // Dosya boyutu kontrolü (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (video_file.size > maxSize) {
      throw new Error('Video dosyası 50MB\'dan büyük olamaz.');
    }

    const formData = new FormData();
    formData.append('video_file', video_file);

    console.log('Dosya upload başlatılıyor:', {
      video_file: video_file.name,
      fileSize: video_file.size,
      reporter_wallet: reporter_wallet
    });

    // reporter_wallet'ı URL query parameter olarak gönder
    const response = await api.post(`/videos/prepare-transaction/upload?reporter_wallet=${reporter_wallet}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000, // 30 saniye timeout
    });
    
    console.log('Dosya upload başarılı:', response.data);
    return response.data;
  } catch (error) {
    console.error('Dosya upload hatası:', error);
    
    // Özel hata mesajları
    if (error.code === 'ECONNABORTED') {
      throw new Error('İstek zaman aşımına uğradı. Lütfen daha küçük bir dosya deneyin.');
    } else if (error.response?.status === 413) {
      throw new Error('Video dosyası çok büyük.');
    } else if (error.response?.status === 415) {
      throw new Error('Desteklenmeyen dosya formatı. Lütfen video dosyası seçin.');
    }
    
    throw error;
  }
};

/**
 * İmzalanmış transaction'ı gönderir
 * @param {number} videoId - Video ID'si
 * @param {string} signedXdr - İmzalanmış XDR
 * @returns {Promise<Object>} Gönderim sonucu
 */
export const submitTransaction = async (videoId, signedXdr) => {
  try {
    const response = await api.post('/videos/submit-transaction', {
      video_id: videoId,
      signed_xdr: signedXdr
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

