import React, { useState, useEffect } from 'react';
import { uploadVideoFromUrl, uploadVideoFromFile, submitTransaction } from '../services/api';
import { getWalletAddress, autoConnectWallet, disconnectWallet } from '../services/wallet';
import { signTransaction } from '@stellar/freighter-api';
import './VideoUpload.css';

const VideoUpload = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [uploadType, setUploadType] = useState('url'); // 'url' veya 'file'

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await getWalletAddress();
      setWalletAddress(address);
    } catch (err) {
      console.error('Wallet connection error:', err);
      
      // Daha kullanıcı dostu hata mesajları
      if (err.message?.includes('internal error') || err.message?.includes('wallet encountered')) {
        setError('Freighter cüzdanında bir hata oluştu. Lütfen cüzdan eklentisini yenileyin veya tekrar deneyin.');
      } else if (err.message?.includes('not connected') || err.message?.includes('bağlı değil')) {
        setError('Freighter cüzdanınız bağlı değil. Lütfen cüzdan eklentisini yükleyin ve bağlayın.');
      } else if (err.message?.includes('rejected') || err.message?.includes('reddedildi')) {
        setError('Cüzdan bağlantısı iptal edildi. Tekrar denemek için butona tıklayın.');
      } else {
        setError(err.message || 'Cüzdan bağlantısı kurulamadı. Lütfen Freighter eklentisinin yüklü ve aktif olduğundan emin olun.');
      }
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
    if (!walletAddress) {
      setError('Lütfen önce cüzdanınıza bağlanın.');
      return;
    }

    // Seçilen yükleme tipine göre input kontrolü
    if (uploadType === 'url' && !videoUrl.trim()) {
      setError('Lütfen bir video URL\'i girin.');
      return;
    }
    
    if (uploadType === 'file' && !videoFile) {
      setError('Lütfen bir video dosyası seçin.');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      let uploadData;

      if (uploadType === 'url') {
        // -----------  URL YÜKLEME  -----------
        console.log('URL yükleme başlatılıyor:', videoUrl);
        uploadData = await uploadVideoFromUrl(walletAddress, videoUrl, fullName);
        console.log('URL yükleme tamamlandı:', uploadData);

      } else {
        // -----------  DOSYA YÜKLEME  -----------
        console.log('Dosya yükleme başlatılıyor:', videoFile.name);
        uploadData = await uploadVideoFromFile(walletAddress, videoFile);
      }

      setUploadResult(uploadData);

      // ----------- XDR VALİDASYON -----------
      if (!uploadData.xdr_for_signing || typeof uploadData.xdr_for_signing !== 'string') {
        throw new Error('Geçersiz XDR verisi alındı. Lütfen tekrar deneyin.');
      }

      console.log('XDR length:', uploadData.xdr_for_signing.length);
      console.log('XDR starts with:', uploadData.xdr_for_signing.substring(0, 20) + '...');

      // ----------- XDR İMZALAMA -----------
      console.log('Wallet address:', walletAddress);
      
      let signedXdr;
      try {
        signedXdr = await signTransaction(uploadData.xdr_for_signing, {
          networkPassphrase: 'Test SDF Network ; September 2015',
          accountToSign: walletAddress
        });
        console.log('XDR signing successful, signed XDR length:', signedXdr?.length);
      } catch (signError) {
        console.error('XDR signing failed:', signError);
        
        // Eğer imzalama başarısız olursa, kullanıcıya özel mesaj göster
        if (signError.message?.includes('internal error')) {
          throw new Error('Freighter cüzdanında bir hata oluştu. Lütfen cüzdan eklentisini yenileyin ve tekrar deneyin.');
        } else if (signError.message?.includes('User rejected') || signError.message?.includes('cancelled')) {
          throw new Error('İmzalama işlemi iptal edildi. Tekrar denemek için butona tıklayın.');
        } else if (signError.message?.includes('invalid') || signError.message?.includes('malformed')) {
          throw new Error('İmza verisi geçersiz. Backend ile iletişim kurun.');
        } else {
          throw new Error(`İmzalama hatası: ${signError.message || 'Bilinmeyen hata'}`);
        }
      }

      // ----------- ZİNCİRE GÖNDERME ---------
      const submitData = await submitTransaction(uploadData.video_id, signedXdr);

      setUploadResult({
        ...uploadData,
        ...submitData,
        signed: true,
        video_url: uploadType === 'url' ? videoUrl : uploadData.video_url,
        file_name: uploadType === 'file' ? videoFile.name : null,
        owner_wallet: walletAddress
      });

    } catch (err) {
      console.error('Upload error:', err);
      
      // Freighter wallet hataları için özel mesajlar
      if (err.message?.includes('internal error') || err.message?.includes('wallet encountered')) {
        setError('Freighter cüzdanında bir hata oluştu. Lütfen cüzdan eklentisini yenileyin ve tekrar deneyin.');
      } else if (err.message?.includes('User rejected')) {
        setError('İşlem cüzdan tarafından reddedildi. Tekrar denemek için butona tıklayın.');
      } else if (err.message?.includes('not connected') || err.message?.includes('bağlı değil')) {
        setError('Cüzdan bağlantısı kesildi. Lütfen önce tekrar bağlanın.');
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
        Freighter cüzdanınızla giriş yapın ve video URL veya dosyası yükleyerek sahipliğinizi zincire kaydedin.
      </p>

      {/* ------------ CÜZDAN BAĞLANTISI ------------ */}
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

          {/* ------------ FORM ------------ */}
          <div className="upload-form">

            {/* YÜKLEME TİPİ SEÇİMİ */}
            <div className="form-group">
              <label>Yükleme Tipi:</label>
              <div className="upload-type-selection">
                <label className={`upload-type-option ${uploadType === 'url' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="uploadType"
                    value="url"
                    checked={uploadType === 'url'}
                    onChange={(e) => {
                      setUploadType(e.target.value);
                      setVideoFile(null);
                      setVideoUrl('');
                    }}
                  />
                  <span>🔗 Video URL'si</span>
                </label>
                <label className={`upload-type-option ${uploadType === 'file' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="uploadType"
                    value="file"
                    checked={uploadType === 'file'}
                    onChange={(e) => {
                      setUploadType(e.target.value);
                      setVideoFile(null);
                      setVideoUrl('');
                    }}
                  />
                  <span>📁 Video Dosyası</span>
                </label>
              </div>
            </div>

            {/* URL YÜKLEME */}
            {uploadType === 'url' && (
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
            )}

            {/* DOSYA YÜKLEME */}
            {uploadType === 'file' && (
              <div className="form-group">
                <label htmlFor="videoFile">Video Dosyası</label>
                <input
                  id="videoFile"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files[0])}
                  className="form-input"
                />
                {videoFile && (
                  <p className="selected-file">Seçilen dosya: {videoFile.name}</p>
                )}
              </div>
            )}

            {/* YÜKLEME BUTONU */}
            <button
              onClick={handleUpload}
              disabled={loading}
              className="upload-button"
            >
              {loading ? 'Yükleniyor...' : `${uploadType === 'url' ? 'URL\'den' : 'Dosyadan'} Video Yükle ve Zincire Kaydet`}
            </button>
          </div>
        </div>
      )}

      {/* ------------ HATA ------------ */}
      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* ------------ SONUÇ ------------ */}
      {uploadResult && (
        <div className={`result-container ${uploadResult.signed ? 'success' : 'pending'}`}>
          <h3>
            {uploadResult.signed ? '✓ Video Başarıyla Zincire Kaydedildi' : '⚠ İmzalanıyor...'}
          </h3>

          {uploadResult.signed ? (
            <div className="success-details">
              <p className="success-message">{uploadResult.message}</p>

              {uploadResult.video_url && (
                <div className="detail-item">
                  <strong>Video URL:</strong> {uploadResult.video_url}
                </div>
              )}

              {uploadResult.file_name && (
                <div className="detail-item">
                  <strong>Dosya:</strong> {uploadResult.file_name}
                </div>
              )}

              <div className="detail-item">
                <strong>Transaction Hash:</strong>
                <span className="tx-hash">{uploadResult.tx_hash}</span>
              </div>

              <div className="detail-item">
                <strong>Cüzdan:</strong> {uploadResult.owner_wallet}
              </div>
            </div>
          ) : (
            <div className="pending-details">
              <p>İşlem hazırlandı. Freighter ile imzalamak için bekleniyor...</p>
              <div className="detail-item">
                <strong>URL Hash:</strong> {uploadResult.url_hash}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
