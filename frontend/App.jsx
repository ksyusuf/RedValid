import React, { useState } from 'react'; // <-- React burada import edilmeli
import VideoQuery from './components/VideoQuery';
import VideoUpload from './components/VideoUpload';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [searchInput, setSearchInput] = useState('');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>🎬 RedValid</h1>
            <p className="tagline">Blockchain Video Doğrulama Sistemi</p>
          </div>
          <p className="subtitle">Video içeriklerini Stellar blockchain üzerinde güvenli ve şeffaf şekilde doğrulayın</p>
        </div>
      </header>

      {activeTab === 'home' && (
        <section className="hero-section">
          <div className="hero-content">
            <h2>Video Doğrulama Aracı</h2>
            <p>YouTube, Twitter, TikTok ve diğer platformlardan video URL'sini girin ve blockchain'de doğrulanıp doğrulanmadığını kontrol edin.</p>
            
            <div className="search-container">
              <input
                type="text"
                placeholder="Video linki girin (örn: https://www.youtube.com/watch?v=...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="hero-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    setActiveTab('check');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (searchInput.trim()) {
                    setActiveTab('check');
                  }
                }}
                className="hero-search-button"
              >
                Video Sorgula
              </button>
            </div>

            <div className="features">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>Hızlı Sorgulama</h3>
                <p>Video URL'ini girerek anında doğrulama durumunu öğrenin</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Güvenli Kayıt</h3>
                <p>Videolarınızı Stellar blockchain'e güvenle kaydedin</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⛓️</div>
                <h3>Blockchain Teknolojisi</h3>
                <p>Merkeziyetsiz ve değiştirilemeyen doğrulama sistemi</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          🏠 Ana Sayfa
        </button>
        <button
          className={`tab-button ${activeTab === 'check' ? 'active' : ''}`}
          onClick={() => setActiveTab('check')}
        >
          🔍 Video Sorgula
        </button>
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Video Yükle
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'check' && <VideoQuery initialUrl={searchInput} />}
        {activeTab === 'upload' && <VideoUpload />}
      </main> {/* Düzeltilmiş kapanış etiketi */}

      <footer className="app-footer"> {/* Parantez hatası düzeltildi */}
        <p>© 2024 RedValid - Stellar Blockchain Tabanlı Video Doğrulama Sistemi</p>
        <p className="footer-note">Tüm işlemler merkeziyetsiz blockchain ağında kaydedilmektedir.</p>
      </footer>
    </div>
  );
}

export default App;

