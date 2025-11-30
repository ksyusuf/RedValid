import React, { useState, useEffect } from 'react';
import { queryVideo } from '../services/api';
import './VideoQuery.css';

const VideoQuery = ({ initialUrl = '' }) => {
  const [videoUrl, setVideoUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
          message: 'Video Stellar blockchain üzerinde doğrulanmış.',
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

  return (
    <div className="video-query">
      <h2>🔍 Video Sorgula</h2>
      <p className="description">
        YouTube, Twitter, TikTok gibi platformlardan video linkini girin ve zincirde doğrulanıp doğrulanmadığını kontrol edin.
      </p>
      
      <div className="input-group">
        <input
          type="text"
          placeholder="Video linki girin (örn: https://www.youtube.com/watch?v=...)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="video-url-input"
          onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
        />
        <button
          onClick={() => handleQuery()}
          disabled={loading}
          className="query-button"
        >
          {loading ? '⏳ Sorgulanıyor...' : '🔍 Sorgula'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className={`result-container ${result.found ? (result.verified ? 'verified' : 'not-verified') : 'not-found'}`}>
          <h3>
            {result.found 
              ? (result.verified ? '✅ Video Doğrulanmış' : '⚠️ Video Kayıtlı Ama Doğrulanmamış')
              : '❌ Video Bulunamadı'}
          </h3>
          <p className="result-message">{result.message}</p>
          
          {result.found && (
            <div className="video-details">
              <div className="detail-item">
                <strong>📹 Video URL:</strong>
                <a href={result.video_url} target="_blank" rel="noopener noreferrer">
                  {result.video_url}
                </a>
              </div>
              <div className="detail-item">
                <strong>🌐 Platform:</strong> {result.platform}
              </div>
              {result.tx_hash && (
                <div className="detail-item">
                  <strong>⛓️ Transaction Hash:</strong>
                  <span className="tx-hash">{result.tx_hash}</span>
                </div>
              )}
              {result.owner && (
                <div className="owner-info">
                  <h4>👤 Sahip Bilgileri</h4>
                  <div className="detail-item">
                    <strong>💼 Cüzdan Adresi:</strong> {result.owner.wallet_address}
                  </div>
                  {result.owner.full_name && (
                    <div className="detail-item">
                      <strong>👥 Ad Soyad:</strong> {result.owner.full_name}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoQuery;

