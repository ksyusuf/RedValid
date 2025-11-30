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
 * Video URL'ini yükler ve hash hesaplar
 * @param {string} walletAddress - Cüzdan adresi
 * @param {string} videoUrl - Video URL'i
 * @returns {Promise<Object>} Yükleme sonucu
 */
export const uploadVideo = async (walletAddress, videoUrl) => {
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

