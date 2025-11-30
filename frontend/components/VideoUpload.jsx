import React, { useState, useEffect } from 'react';
import { uploadVideo, submitTransaction } from '../services/api';
import { getWalletAddress, autoConnectWallet, disconnectWallet } from '../services/wallet';
import './VideoUpload.css';

const VideoUpload = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

  useEffect(() => {
    // Sayfa yüklendiğinde otomatik bağlanmayı dene
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const address = await autoConnectWallet();
      if (address) {
        setWalletAddress(address);
      }
    } catch (err) {
      console.log('Otomatik bağlantı başarısız:', err);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    
    try {
      const address = await getWalletAddress();
      setWalletAddress(address);
    } catch (err) {
      setError(err.message || 'Cüzdan bağlantısı kurulamadı.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setWalletAddress(null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!videoUrl.trim()) {
      setError('Lütfen bir video linki girin.');
      return;
    }

    if (!walletAddress) {
      setError('Lütfen önce cüzdanınıza bağlanın.');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      // 1. Video'yu yükle ve XDR al
      const uploadData = await uploadVideo(walletAddress, videoUrl, fullName || null);
      setUploadResult(uploadData);

      // 2. XDR'ı Freighter ile imzala
      const { signTransaction } = await import('@stellar/freighter-api');
      const signedXdr = await signTransaction(uploadData.xdr_for_signing, {
        network: 'testnet',
        accountToSign: walletAddress
      });

      // 3. İmzalanmış transaction'ı gönder
      const submitData = await submitTransaction(uploadData.video_id, signedXdr);

      setUploadResult({
        ...uploadData,
        ...submitData,
        signed: true,
        video_url: videoUrl,
        owner_wallet: walletAddress
      });

    } catch (err) {
      if (err.message && err.message.includes('User rejected')) {
        setError('İşlem kullanıcı tarafından reddedildi.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-upload">
      <h2>Video Yükle</h2>
      <p className="description">
        Freighter cüzdanınızla giriş yapın ve video URL'inizi yükleyerek sahipliğinizi zincire kaydedin.
      </p>

      {!walletAddress ? (
        <div className="connect-section">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="connect-button"
          >
            {connecting ? 'Bağlanıyor...' : 'Freighter ile Bağlan'}
          </button>
        </div>
      ) : (
        <div className="connected-section">
          <div className="wallet-info">
            <div className="wallet-badge">
              ✓ Bağlı: {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
            </div>
            <button onClick={handleDisconnect} className="disconnect-button">
              Bağlantıyı Kes
            </button>
          </div>

          <div className="upload-form">
            <div className="form-group">
              <label htmlFor="fullName">Ad Soyad (Opsiyonel)</label>
              <input
                id="fullName"
                type="text"
                placeholder="Adınız ve soyadınız"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="videoUrl">Video URL</label>
              <input
                id="videoUrl"
                type="text"
                placeholder="Video linki girin (YouTube, Twitter, TikTok, vb.)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="form-input"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={loading}
              className="upload-button"
            >
              {loading ? 'Yükleniyor...' : 'Video Yükle ve Zincire Kaydet'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {uploadResult && (
        <div className={`result-container ${uploadResult.signed ? 'success' : 'pending'}`}>
          <h3>
            {uploadResult.signed ? '✓ Video Başarıyla Zincire Kaydedildi' : '⚠ İşlem Hazır, İmzalanıyor...'}
          </h3>
          
          {uploadResult.signed ? (
            <div className="success-details">
              <p className="success-message">{uploadResult.message}</p>
              <div className="detail-item">
                <strong>Video URL:</strong> {uploadResult.video_url}
              </div>
              <div className="detail-item">
                <strong>Transaction Hash:</strong>
                <span className="tx-hash">{uploadResult.tx_hash}</span>
              </div>
              <div className="detail-item">
                <strong>Cüzdan Adresi:</strong> {uploadResult.owner_wallet}
              </div>
            </div>
          ) : (
            <div className="pending-details">
              <p>İşlem hazırlandı. Freighter ile imzalamak için bekleniyor...</p>
              <div className="detail-item">
                <strong>URL Hash:</strong> {uploadResult.url_hash}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;

