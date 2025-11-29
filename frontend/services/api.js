import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Video URL'ini sorgular
 * @param {string} videoUrl - Video URL'i
 * @returns {Promise<Object>} Sorgulama sonucu
 */
export const queryVideo = async (videoUrl) => {
  try {
    const response = await api.post('/verify', {
      video_url: videoUrl
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Video URL'ini yükler ve hash hesaplar
 * @param {string} walletAddress - Cüzdan adresi
 * @param {string} videoUrl - Video URL'i
 * @param {string} fullName - Kullanıcı adı (opsiyonel)
 * @returns {Promise<Object>} Yükleme sonucu
 */
export const uploadVideo = async (walletAddress, videoUrl, fullName = null) => {
  try {
    const response = await api.post('/videos/prepare-transaction', {
      reporter_wallet: walletAddress,
      video_url: videoUrl,
      full_name: fullName
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * İmzalanmış transaction'ı gönderir
 * @param {string} urlHash - URL hash'i
 * @param {string} signedXdr - İmzalanmış XDR
 * @returns {Promise<Object>} Gönderim sonucu
 */
export const submitTransaction = async (urlHash, signedXdr) => {
  try {
    const response = await api.post('/api/videos/submit-transaction', {
      url_hash: urlHash,
      signed_xdr: signedXdr
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

