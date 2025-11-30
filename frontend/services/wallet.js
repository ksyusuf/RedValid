import { isConnected, requestAccess, getAddress } from "@stellar/freighter-api";

/**
 * Cüzdan bağlantısını kontrol eder
 * @returns {Promise<string|null>} Başarılıysa cüzdan adresi, değilse null
 */
export async function checkWalletConnection() {
  try {
    const connected = await isConnected();
    if (connected) {
      const addressResult = await getAddress();
      
      // Farklı response formatlarını destekle
      let walletAddress = null;
      
      if (typeof addressResult === 'string') {
        // String olarak gelirse
        walletAddress = addressResult;
      } else if (addressResult && typeof addressResult === 'object' && 'address' in addressResult) {
        // Object olarak gelirse ve address property'si varsa
        walletAddress = addressResult.address;
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
        const addressFromGet = await getAddress();
        if (!addressFromGet || typeof addressFromGet !== 'string') {
          throw new Error("Cüzdan adresi alınamadı.");
        }
        return addressFromGet;
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