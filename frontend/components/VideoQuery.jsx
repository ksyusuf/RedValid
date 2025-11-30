import React, { useState, useEffect } from 'react';
import { queryVideo, queryVideoFromFile } from '../services/api';
import './VideoQuery.css';

const VideoQuery = ({ initialUrl = '' }) => {
  const [videoUrl, setVideoUrl] = useState(initialUrl);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('url'); // 'url' or 'file'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [queryType, setQueryType] = useState(''); // 'url' or 'file'

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) {
      setVideoUrl(initialUrl);
      handleQuery(initialUrl);
    }
  }, [initialUrl]);

  const handleQuery = async (urlToQuery = null) => {
    const queryUrl = urlToQuery || videoUrl;
    
    if (!queryUrl.trim()) {
      setError('Lütfen bir video linki girin.');
      return;
    }

    setLoading(true);
    setQueryType('url');
    setError(null);
    setResult(null);

    try {
      const response = await queryVideo(queryUrl);

      // Backend response formatını frontend formatına dönüştür
      let formattedResult;

      if (response.status === 'VERIFIED_ON_STELLAR') {
        formattedResult = {
          found: true,
          verified: true,
          already_registered: false, // Videos verified on Stellar should show green theme
          message: '✅ Video Stellar blockchain üzerinde doğrulanmış ve kayıtlı.',
          video_url: response.video_url || queryUrl,
          platform: 'unknown', // Backend'den gelmiyor
          tx_hash: response.stellar_transaction_id,
          owner: {
            wallet_address: response.reporter?.wallet_address,
            full_name: response.reporter?.full_name
          }
        };
      } else if (response.status === 'PROCESSING_ON_BLOCKCHAIN') {
        formattedResult = {
          found: true,
          verified: false,
          message: response.message || 'Video blockchain\'de işleniyor.',
          video_url: response.video_url || queryUrl,
          tx_hash: response.stellar_transaction_id
        };
      } else if (response.status === 'VERIFIED' || response.status === 'SENDING') {
        formattedResult = {
          found: true,
          verified: response.status === 'VERIFIED',
          message: response.status === 'VERIFIED' ? 'Video doğrulanmış.' : 'Video doğrulanıyor.',
          video_url: response.video_url || queryUrl
        };
      } else {
        formattedResult = {
          found: false,
          verified: false,
          message: 'Video bulunamadı.'
        };
      }

      setResult(formattedResult);
    } catch (err) {
      console.error('Query error:', err);
      
      if (err.response?.status === 404) {
        setResult({
          found: false,
          verified: false,
          message: 'Video doğrulama kaydı bulunamadı.'
        });
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || 'Geçersiz video URL\'i.');
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
        setError('Sunucuya bağlanılamadı. Lütfen backend servisinin çalıştığından emin olun.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileQuery = async () => {
    if (!selectedFile) {
      setError('Lütfen bir video dosyası seçin.');
      return;
    }

    setLoading(true);
    setQueryType('file');
    setError(null);
    setResult(null);

    try {
      const response = await queryVideoFromFile(selectedFile);

      // Backend response formatını frontend formatına dönüştür
      let formattedResult;

      if (response.status === 'ALREADY_EXISTS' || response.status === 'EXISTS_IN_DATABASE') {
        const isVerified = response.blockchain_status === 'VERIFIED_ON_STELLAR';
        formattedResult = {
          found: true,
          verified: isVerified,
          already_registered: !isVerified, // Mark as already registered only for non-verified uploads (orange theme)
          message: isVerified 
            ? '✅ Bu video dosyası Stellar blockchain üzerinde doğrulanmış ve kayıtlı.' 
            : '🟠 Bu video dosyası zaten yüklenmiş ancak henüz blockchain\'de doğrulanmamış.',
          video_url: response.video_info?.video_url || `Dosya: ${selectedFile.name}`,
          platform: 'uploaded',
          tx_hash: response.video_info?.tx_hash || response.video_info?.prepared_tx_hash,
          data_hash: response.data_hash,
          owner: response.reporter_info ? {
            wallet_address: response.reporter_info.wallet_address,
            full_name: response.reporter_info.full_name
          } : null,
          file_info: {
            name: selectedFile.name,
            size: selectedFile.size,
            database_status: response.database_status,
            blockchain_status: response.blockchain_status
          }
        };
      } else if (response.status === 'NOT_FOUND') {
        formattedResult = {
          found: false,
          verified: false,
          message: 'Bu video dosyası henüz hiçbir yerde kayıtlı değil.',
          file_info: {
            name: selectedFile.name,
            size: selectedFile.size,
            data_hash: response.data_hash
          }
        };
      } else {
        formattedResult = {
          found: false,
          verified: false,
          message: response.message || 'Video dosyası için sonuç alınamadı.'
        };
      }

      setResult(formattedResult);
    } catch (err) {
      console.error('File query error:', err);
      
      if (err.response?.status === 400) {
        setError(err.response?.data?.detail || 'Geçersiz video dosyası.');
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
        setError('Sunucuya bağlanılamadı. Lütfen backend servisinin çalıştığından emin olun.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Video dosyası kontrolü
      if (!file.type.startsWith('video/')) {
        setError('Lütfen geçerli bir video dosyası seçin.');
        setSelectedFile(null);
        return;
      }
      
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Video dosyası 50MB\'dan büyük olamaz.');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  return (
    <div className="video-query">
      <h2>🔍 Video Sorgula</h2>
      <p className="description">
        Video linkini girin veya video dosyası yükleyerek zincirde doğrulanıp doğrulanmadığını kontrol edin.
      </p>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => setActiveTab('url')}
        >
          🔗 URL ile Sorgula
        </button>
        <button
          className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          📁 Dosya ile Sorgula
        </button>
      </div>

      {/* URL Query Tab */}
      {activeTab === 'url' && (
        <div className="tab-content">
          <div className="input-group">
            <input
              type="text"
              placeholder="Video linki girin (örn: https://www.youtube.com/watch?v=...)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="video-url-input"
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
            />
            {!loading ? (
              <button
                onClick={() => handleQuery()}
                disabled={loading}
                className="query-button"
              >
                🔍 Sorgula
              </button>
            ) : (
              <div className="query-loading">
                <div className="query-spinner"></div>
                <span>Sorgulanıyor...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Query Tab */}
      {activeTab === 'file' && (
        <div className="tab-content">
          <div className="file-upload-section">
            <div className="file-input-wrapper">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="file-input"
                id="video-file-input"
              />
              <label htmlFor="video-file-input" className="file-input-label">
                📁 Video Dosyası Seç
              </label>
              {selectedFile && (
                <div className="selected-file-info">
                  <strong>📄 Seçilen Dosya:</strong> {selectedFile.name}
                  <br />
                  <strong>📏 Boyut:</strong> {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              )}
            </div>
            {!loading ? (
              <button
                onClick={handleFileQuery}
                disabled={loading || !selectedFile}
                className="query-button"
              >
                🔍 Dosya Sorgula
              </button>
            ) : (
              <div className="query-loading">
                <div className="query-spinner"></div>
                <span>Analiz Ediliyor...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className={`result-container ${result.verified && !result.already_registered ? 'verified' : (result.already_registered ? 'already-registered' : (result.found ? 'not-verified' : 'not-found'))}`}>
          <h3>
            {result.verified && !result.already_registered
              ? '✅ Video Zincirde Kayıtlı'
              : (result.already_registered 
                ? '🟠 Video Zaten Yüklenmiş'
                : (result.found 
                  ? '⚠️ Video Kayıtlı Ama Doğrulanmamış'
                  : '❌ Video Bulunamadı'))}
          </h3>
          <p className="result-message">
            {result.verified && !result.already_registered
              ? '✅ Bu video Stellar blockchain üzerinde kayıtlı ve doğrulanmış durumda.'
              : result.message}
          </p>
          
          <div className="video-details">
            <div className="detail-item">
              <strong>📹 Video:</strong>
              {result.video_url && result.video_url.startsWith('http') ? (
                <a href={result.video_url} target="_blank" rel="noopener noreferrer" className="long-text">
                  {result.video_url}
                </a>
              ) : (
                <span className="long-text">{result.video_url}</span>
              )}
            </div>
            
            {result.platform && (
              <div className="detail-item">
                <strong>🌐 Platform:</strong> {result.platform}
              </div>
            )}
            
            {result.tx_hash && (
              <div className="detail-item">
                <strong>⛓️ Transaction Hash:</strong>
                <span className="tx-hash">{result.tx_hash}</span>
              </div>
            )}
            
            {result.data_hash && (
              <div className="detail-item">
                <strong>🔐 Data Hash:</strong>
                <span className="data-hash">{result.data_hash}</span>
              </div>
            )}
            
            {result.file_info && (
              <div className="file-info">
                <h4>📁 Dosya Bilgileri</h4>
                <div className="detail-item">
                  <strong>📄 Dosya Adı:</strong>
                  <span className="long-text">{result.file_info.name}</span>
                </div>
                <div className="detail-item">
                  <strong>📏 Boyut:</strong> {(result.file_info.size / (1024 * 1024)).toFixed(2)} MB
                </div>
                {result.file_info.database_status && (
                  <div className="detail-item">
                    <strong>💾 Veritabanı Durumu:</strong> {result.file_info.database_status}
                  </div>
                )}
                {result.file_info.blockchain_status && (
                  <div className="detail-item">
                    <strong>⛓️ Blockchain Durumu:</strong> {result.file_info.blockchain_status}
                  </div>
                )}
              </div>
            )}
            
            {result.owner && (
              <div className="owner-info">
                <h4>👤 Sahip Bilgileri</h4>
                <div className="detail-item">
                  <strong>💼 Cüzdan Adresi:</strong>
                  <span className="wallet-address">{result.owner.wallet_address}</span>
                </div>
                {result.owner.full_name && (
                  <div className="detail-item">
                    <strong>👥 Ad Soyad:</strong>
                    <span className="long-text">{result.owner.full_name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoQuery;

