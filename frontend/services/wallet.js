import { isConnected, requestAccess } from "@stellar/freighter-api";

/**
 * Cüzdan bağlantısını kontrol eder
 * @returns {Promise<string|null>} Başarılıysa cüzdan adresi, değilse null
 */
export async function checkWalletConnection() {
  try {
    const connected = await isConnected();
    if (connected) {
      // requestAccess ile adresi al (kullanıcı onayı gerekmeden)
      const accessResult = await requestAccess();
      
      // Farklı response formatlarını destekle
      let walletAddress = null;
      
      if (accessResult && typeof accessResult === 'object' && 'address' in accessResult) {
        // Object olarak gelirse ve address property'si varsa
        walletAddress = accessResult.address;
      } else if (typeof accessResult === 'string') {
        // String olarak gelirse
        if (accessResult === "true") {
          // Bu durumda adresi alamıyoruz, null döndür
          walletAddress = null;
        } else if (/^G[A-Z2-7]{55}$/.test(accessResult)) {
          // Direkt Stellar adresi gelmişse
          walletAddress = accessResult;
        }
      }
      
      if (walletAddress && typeof walletAddress === 'string' && walletAddress.startsWith('G')) {
        return walletAddress;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Cüzdan bağlantı kontrolü başarısız:', error);
    return null;
  }
}

/**
 * Cüzdan adresini alır (bağlantı yoksa hata fırlatır)
 * @returns {Promise<string>} Cüzdan adresi
 */
export async function getWalletAddress() {
  try {
    const connected = await isConnected();
    if (!connected) {
      throw new Error("Freighter cüzdanı bağlı değil. Lütfen önce cüzdanınızı bağlayın.");
    }
    
    const addressResult = await requestAccess();
    
    // requestAccess başarılı olduğunda { address: string } döndürür
    if (addressResult && typeof addressResult === 'object' && 'address' in addressResult) {
      return addressResult.address;
    }
    
    // Eski format kontrolü
    if (typeof addressResult === 'string') {
      if (addressResult === "true") {
        // Bu durumda adresi alamıyoruz
        throw new Error("Cüzdan adresi alınamadı. Lütfen cüzdanınızı tekrar bağlayın.");
      } else if (/^G[A-Z2-7]{55}$/.test(addressResult)) {
        // Direkt adres döndürülmüşse
        return addressResult;
      }
    }
    
    throw new Error("Cüzdan bağlantısı iptal edildi veya onay verilmedi.");
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Cüzdan bağlantısı kurulamadı.");
  }
}

/**
 * Otomatik olarak cüzdana bağlanmayı dener
 * @returns {Promise<string|null>} Başarılıysa cüzdan adresi, değilse null
 */
export async function autoConnectWallet() {
  try {
    const address = await checkWalletConnection();
    return address;
  } catch (error) {
    console.log('Otomatik bağlantı başarısız:', error);
    return null;
  }
}

/**
 * Cüzdandan bağlantıyı keser
 */
export function disconnectWallet() {
  // Freighter API'de direkt disconnect fonksiyonu yok
  // Bu fonksiyon sadece state'i temizlemek için kullanılır
  console.log('Cüzdan bağlantısı kesildi');
} 