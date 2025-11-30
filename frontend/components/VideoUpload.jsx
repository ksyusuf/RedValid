import React, { useState, useEffect } from 'react';
import { uploadVideoFromUrl, uploadVideoFromFile, submitTransaction, getReporter, createReporter } from '../services/api';
import { getWalletAddress, autoConnectWallet, disconnectWallet, checkWalletConnection } from '../services/wallet';
import { signTransaction } from '@stellar/freighter-api';
import './VideoUpload.css';

const VideoUpload = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [autoCheckingConnection, setAutoCheckingConnection] = useState(true);
  const [uploadType, setUploadType] = useState('url'); // 'url' veya 'file'
  const [preparingHash, setPreparingHash] = useState(false);
  const [signingTransaction, setSigningTransaction] = useState(false);
  const [registeringUser, setRegisteringUser] = useState(false);
  const [existingUserData, setExistingUserData] = useState(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [userRegistered, setUserRegistered] = useState(false);

  // Kullanıcı verilerini cüzdan adresinden getir
  const fetchUserData = async (address) => {
    try {
      const reporterData = await getReporter(address);
      if (reporterData) {
        setExistingUserData(reporterData);
        setIsExistingUser(true);
        setUserRegistered(true);
        setFullName(reporterData.full_name);
        setInstitution(reporterData.institution || '');
        console.log('Kullanıcı verileri bulundu:', reporterData);
      }
    } catch (error) {
      // Kullanıcı bulunamadı, yeni kullanıcı
      console.log('Kullanıcı verisi bulunamadı, yeni kullanıcı:', error.message);
      setIsExistingUser(false);
      setUserRegistered(false);
      setExistingUserData(null);
    }
  };

  // Component mount edildiğinde otomatik cüzdan bağlantısı kontrol et
  useEffect(() => {
    const checkConnectionOnLoad = async () => {
      try {
        const address = await checkWalletConnection();
        if (address) {
          setWalletAddress(address);
          await fetchUserData(address);
          console.log('Otomatik cüzdan bağlantısı başarılı:', address);
        }
      } catch (error) {
        console.log('Otomatik cüzdan bağlantısı başarısız:', error);
        // Hata durumunda sessizce devam et, kullanıcı manuel bağlanabilir
      } finally {
        setAutoCheckingConnection(false);
      }
    };

    checkConnectionOnLoad();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setAutoCheckingConnection(false);
    setError(null);
    try {
      const address = await getWalletAddress();
      setWalletAddress(address);
      
      // Kullanıcı verilerini getir
      await fetchUserData(address);
      
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
    setFullName('');
    setInstitution('');
    setExistingUserData(null);
    setIsExistingUser(false);
    setUserRegistered(false);
  };

  // Kullanıcı kaydı işlemi
  const handleRegisterUser = async () => {
    if (!fullName.trim()) {
      setError('Lütfen adınızı girin.');
      return;
    }

    setRegisteringUser(true);
    setError(null);

    try {
      console.log('Kullanıcı kaydı oluşturuluyor...');
      const newReporter = await createReporter(fullName, walletAddress, institution);
      console.log('Kullanıcı kaydı başarılı:', newReporter);
      
      // Kullanıcıyı mevcut kullanıcı olarak işaretle
      setExistingUserData(newReporter);
      setIsExistingUser(true);
      setUserRegistered(true);

      setRegisteringUser(false);
      
    } catch (reporterError) {
      console.error('Kullanıcı kaydı başarısız:', reporterError);
      setRegisteringUser(false);
      
      // Backend'den gelen hatayı parse et
      let errorMessage = 'Kullanıcı kaydı oluşturulamadı.';
      if (reporterError.response?.data) {
        const responseData = reporterError.response.data;
        if (responseData.detail) {
          if (Array.isArray(responseData.detail)) {
            errorMessage = responseData.detail.map(item => 
              typeof item === 'string' ? item : 
              item.msg || item.message || JSON.stringify(item)
            ).join(', ');
          } else if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail;
          }
        } else {
          errorMessage = typeof responseData === 'string' ? responseData : 
                        JSON.stringify(responseData);
        }
      } else if (reporterError.message) {
        errorMessage = reporterError.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleUpload = async () => {
    if (!walletAddress) {
      setError('Lütfen önce cüzdanınıza bağlanın.');
      return;
    }

    // Kullanıcı kaydı kontrolü
    if (!userRegistered) {
      setError('Lütfen önce kullanıcı kaydınızı oluşturun.');
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
    setPreparingHash(true);
    setSigningTransaction(false);
    setRegisteringUser(false);
    setError(null);
    setUploadResult(null);

    try {
      let uploadData;

      // ----------- PREPARING PHASE -----------
      setPreparingHash(true);
      
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

      // Yeni kullanıcı için fullName bilgisini kaydet (varsa)
      if (!isExistingUser && fullName.trim()) {
        console.log('Yeni kullanıcı tespit edildi, fullName kaydedilecek:', fullName);
      }

      setUploadResult(uploadData);

      // ----------- KAYITLI VİDEO KONTROLÜ -----------
      if (uploadData.already_registered) {
        // Video zaten kayıtlı, işlem tamamlandı
        console.log('Video zaten kayıtlı, işlem durduruluyor');
        setPreparingHash(false);
        setUploadResult({
          ...uploadData,
          signed: true, // Zaten kayıtlı olduğu için imzalanmış olarak işaretle
          video_url: uploadType === 'url' ? videoUrl : uploadData.video_url,
          file_name: uploadType === 'file' ? videoFile.name : null,
          owner_wallet: walletAddress,
          message: uploadData.message || 'Bu video zaten kayıtlı.'
        });
        return; // İşlemi burada sonlandır
      }

      // ----------- XDR VALİDASYON -----------
      if (!uploadData.xdr_for_signing || typeof uploadData.xdr_for_signing !== 'string') {
        throw new Error('Geçersiz XDR verisi alındı. Lütfen tekrar deneyin.');
      }

      console.log('XDR length:', uploadData.xdr_for_signing.length);
      console.log('XDR starts with:', uploadData.xdr_for_signing.substring(0, 20) + '...');

      // ----------- SIGNING PHASE -----------
      setPreparingHash(false);
      setSigningTransaction(true);
      
      console.log('Wallet address:', walletAddress);
      
      let signedXdr;
      try {
        signedXdr = await signTransaction(uploadData.xdr_for_signing, {
          networkPassphrase: 'Test SDF Network ; September 2015',
          accountToSign: walletAddress
        });
        console.log('XDR signing successful, signed XDR length:', signedXdr?.length);
        setSigningTransaction(false);
      } catch (signError) {
        console.error('XDR signing failed:', signError);
        setSigningTransaction(false);
        
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
      console.log('Transaction submission successful:', uploadResult);

    } catch (err) {
      console.error('Upload error:', err);
      setPreparingHash(false);
      setSigningTransaction(false);
      setRegisteringUser(false);
      
      let errorMessage = 'Bir hata oluştu.';
      
      // Backend'den gelen hatayı parse et
      if (err.response?.data) {
        const responseData = err.response.data;
        
        // FastAPI validation error format
        if (responseData.detail) {
          if (Array.isArray(responseData.detail)) {
            // Validation error array
            errorMessage = responseData.detail.map(item => 
              typeof item === 'string' ? item : 
              item.msg || item.message || JSON.stringify(item)
            ).join(', ');
          } else if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail;
          } else if (typeof responseData.detail === 'object') {
            // Object format validation error
            errorMessage = responseData.detail.msg || responseData.detail.message || 
                          JSON.stringify(responseData.detail);
          }
        } else {
          // Response data'yı string'e çevir
          errorMessage = typeof responseData === 'string' ? responseData : 
                        JSON.stringify(responseData);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Freighter wallet hataları için özel mesajlar (önce kontrol et)
      if (errorMessage.includes('internal error') || errorMessage.includes('wallet encountered')) {
        setError('Freighter cüzdanında bir hata oluştu. Lütfen cüzdan eklentisini yenileyin ve tekrar deneyin.');
      } else if (errorMessage.includes('User rejected') || errorMessage.includes('reddedildi')) {
        setError('İşlem cüzdan tarafından reddedildi. Tekrar denemek için butona tıklayın.');
      } else if (errorMessage.includes('not connected') || errorMessage.includes('bağlı değil')) {
        setError('Cüzdan bağlantısı kesildi. Lütfen önce tekrar bağlanın.');
      } else {
        setError(errorMessage);
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
      {autoCheckingConnection ? (
        <div className="connect-section">
          <div className="checking-connection">
            <div className="loading-spinner"></div>
            <p>Cüzdan bağlantısı kontrol ediliyor...</p>
          </div>
        </div>
      ) : !walletAddress ? (
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

            {/* KULLANICI KAYIT BÖLÜMÜ - Sadece kayıtlı olmayan kullanıcılar için */}
            {!userRegistered && (
              <div className="user-info-section">
                <h3>👤 Kullanıcı Kaydı</h3>
                <p className="user-info-text">Bu cüzdan adresi ile ilk kez kayıt oluyorsunuz. Lütfen bilgilerinizi girin:</p>
                
                <div className="form-group">
                  <label htmlFor="fullName">Tam Ad *</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="form-input"
                    placeholder="Adınızı ve soyadınızı girin"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="institution">Kurum (Opsiyonel)</label>
                  <input
                    id="institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="form-input"
                    placeholder="Çalıştığınız kurum veya serbest çalışıyorsanız boş bırakabilirsiniz"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="walletAddress">Cüzdan Adresi</label>
                  <input
                    id="walletAddress"
                    type="text"
                    value={walletAddress}
                    disabled
                    className="form-input disabled"
                    placeholder="Cüzdan adresiniz"
                  />
                </div>

                {/* KAYIT BUTONU */}
                <button
                  onClick={handleRegisterUser}
                  disabled={registeringUser || !fullName.trim()}
                  className="register-button"
                >
                  {registeringUser ? 'Kayıt Oluşturuluyor...' : 'Kullanıcı Kaydı Oluştur'}
                </button>
              </div>
            )}

            {/* MEVCUT KULLANICI BİLGİLERİ - Sadece kayıtlı kullanıcılar için */}
            {userRegistered && isExistingUser && existingUserData && (
              <div className="user-info-section">
                <h3>✓ Kayıtlı Kullanıcı</h3>
                <div className="existing-user-info">
                  <p className="user-info-text">
                    <strong>Ad:</strong> {existingUserData.full_name}
                  </p>
                  {existingUserData.institution && (
                    <p className="user-info-text">
                      <strong>Kurum:</strong> {existingUserData.institution}
                    </p>
                  )}
                  <p className="user-info-text">
                    <strong>Cüzdan:</strong> {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
                  </p>
                </div>
              </div>
            )}

            {/* VİDEO YÜKLEME BÖLÜMÜ - Sadece kayıtlı kullanıcılar için */}
            {userRegistered && (
              <>
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

            {/* YÜKLEME BUTONU VE LOADING STATES */}
            {!preparingHash && !signingTransaction && !registeringUser && (
              <button
                onClick={handleUpload}
                disabled={loading}
                className="upload-button"
              >
                {loading ? 'Yükleniyor...' : `${uploadType === 'url' ? 'URL\'den' : 'Dosyadan'} Video Yükle ve Zincire Kaydet`}
              </button>
            )}

            {/* PREPARING HASH STATE */}
            {preparingHash && (
              <div className="loading-state">
                <div className="cool-spinner preparing-spinner"></div>
                <div className="loading-text">
                  <h4>🔐 Hash Hazırlanıyor</h4>
                  <p>Video hash'i oluşturulup blockchain'e hazırlanıyor...</p>
                  <div className="progress-dots">
                    <span className="dot active"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            )}

            {/* SIGNING TRANSACTION STATE */}
            {signingTransaction && (
              <div className="loading-state">
                <div className="cool-spinner signing-spinner"></div>
                <div className="loading-text">
                  <h4>✍️ İşlem İmzalanıyor</h4>
                  <p>Freighter cüzdanınızda işlemi imzalayın...</p>
                  <div className="progress-dots">
                    <span className="dot completed"></span>
                    <span className="dot active"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            )}

            {/* REGISTERING USER STATE */}
            {registeringUser && (
              <div className="loading-state">
                <div className="cool-spinner registering-spinner"></div>
                <div className="loading-text">
                  <h4>👤 Kullanıcı Kaydı</h4>
                  <p>Kullanıcı bilgileriniz sisteme kaydediliyor...</p>
                  <div className="progress-dots">
                    <span className="dot completed"></span>
                    <span className="dot completed"></span>
                    <span className="dot active"></span>
                  </div>
                </div>
              </div>
            )}

            {/* GENERAL LOADING STATE */}
            {loading && !preparingHash && !signingTransaction && !registeringUser && (
              <div className="loading-state">
                <div className="cool-spinner upload-spinner"></div>
                <div className="loading-text">
                  <h4>📤 Yükleniyor</h4>
                  <p>Video işleniyor, lütfen bekleyin...</p>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------ HATA ------------ */}
      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* ------------ SONUÇ ------------ */}
      {uploadResult && (
        <div className={`result-container ${uploadResult.already_registered ? 'already-registered' : (uploadResult.signed ? 'success' : 'pending')}`}>
          <h3>
            {uploadResult.already_registered 
              ? '🟠 Video Zaten Zincirde Kayıtlı' 
              : (uploadResult.signed ? '✓ Video Başarıyla Zincire Kaydedildi' : '⚠ İmzalanıyor...')}
          </h3>

          {uploadResult.signed ? (
            <div className="success-details">
              {uploadResult.already_registered ? (
                <div className="already-registered-info">
                  <p className="success-message">
                    <strong>🟠 Bu video zaten Stellar blockchain'inde kayıtlı!</strong><br/>
                    {uploadResult.message || 'Video daha önce zincire kaydedilmiş ve doğrulanmış durumda.'}
                  </p>
                  <div className="detail-item">
                    <strong>📊 Durum:</strong> 
                    <span className="status-badge already-registered">
                      ✓ Zincirde Kayıtlı ve Doğrulanmış
                    </span>
                  </div>
                  {uploadResult.tx_hash && (
                    <div className="detail-item">
                      <strong>⛓️ Transaction Hash:</strong>
                      <span className="tx-hash">{uploadResult.tx_hash}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="new-registration-info">
                  <p className="success-message">
                    <strong>✅ Video başarıyla Stellar blockchain'ine kaydedildi!</strong><br/>
                    {uploadResult.message || 'Video sahipliği zincirde doğrulandı.'}
                  </p>
                </div>
              )}

              {uploadResult.video_url && (
                <div className="detail-item">
                  <strong>Video:</strong> {uploadResult.video_url}
                </div>
              )}

              {uploadResult.file_name && (
                <div className="detail-item">
                  <strong>Dosya:</strong> {uploadResult.file_name}
                </div>
              )}

              {uploadResult.tx_hash && (
                <div className="detail-item">
                  <strong>Transaction Hash:</strong>
                  <span className="tx-hash">{uploadResult.tx_hash}</span>
                </div>
              )}

              {uploadResult.prepared_tx_hash && (
                <div className="detail-item">
                  <strong>Hazırlanan Transaction Hash:</strong>
                  <span className="tx-hash">{uploadResult.prepared_tx_hash}</span>
                </div>
              )}

              <div className="detail-item">
                <strong>Video ID:</strong> {uploadResult.video_id}
              </div>

              <div className="detail-item">
                <strong>Cüzdan:</strong>
                <span className="tx-hash">{uploadResult.owner_wallet}</span>
              </div>

              {uploadResult.data_hash && (
                <div className="detail-item">
                  <strong>Data Hash:</strong>
                  <span className="hash-preview">{uploadResult.data_hash.substring(0, 16)}...</span>
                </div>
              )}
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
