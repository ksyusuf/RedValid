# RedValid Frontend

React tabanlı video doğrulama uygulaması frontend'i.

## 🚀 Deployment

### Netlify Deployment

1. **GitHub'a yükleyin:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Netlify'ta site oluşturun:**
   - Netlify Dashboard → "New site from Git"
   - GitHub repo'nuzu seçin
   - Build settings:
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`

3. **Environment Variables (gerekirse):**
   - Site Settings → Environment variables
   - VITE_API_URL=https://your-backend-url.com

### Build locally

```bash
# Dependencies yükleyin
npm install

# Development modunda çalıştırın
npm run dev

# Production build oluşturun
npm run build

# Build'i local'de test edin
npm run preview
```

## 📁 Proje Yapısı

```
frontend/
├── src/
│   ├── components/     # React bileşenleri
│   ├── services/       # API ve wallet servisleri
│   ├── App.jsx         # Ana uygulama
│   ├── main.jsx        # Entry point
│   └── index.css       # Global stiller
├── public/             # Static dosyalar
├── dist/              # Build çıktısı (git'te yok)
├── netlify.toml       # Netlify konfigürasyonu
├── vite.config.js     # Vite konfigürasyonu
└── package.json       # Dependencies ve scriptler
```

## 🔧 Konfigürasyon

### Vite Konfigürasyonu
- `base`: Deployment root path
- `build.outDir`: Build çıktı dizini
- Asset optimization ve chunking ayarları

### Netlify Konfigürasyonu
- `netlify.toml`: MIME types ve header ayarları
- `_redirects`: SPA routing desteği

## 🐛 Troubleshooting

### MIME Type Hatası
- `netlify.toml` dosyası MIME type ayarları içeriyor
- Build sonrası cache'i temizleyin: Netlify → Trigger deploy → Clear cache

### 404 Errors
- `_redirects` dosyası SPA routing'i handle eder
- Tüm route'lar `index.html`'e yönlendirilir

## 📱 Desteklenen Browsers
- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+