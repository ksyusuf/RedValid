import { retrievePublicKey } from '@stellar/freighter-api';

/**
 * Freighter API'nin kullanılabilir olup olmadığını kontrol eder
 * @returns {Promise<boolean>}
 */
export const checkFreighterAvailable = async () => {
  try {
    // Freighter API'nin mevcut olup olmadığını kontrol et
    if (typeof window !== 'undefined' && window.freighter) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Cüzdan adresini getirir (bağlanır)
 * @returns {Promise<string|null>} Public key veya null
 */
export const getWalletAddress = async () => {
  const isInstalled = await checkFreighterInstalled();
  if (!isInstalled) {
    throw new Error('Freighter cüzdanı bulunamadı. Lütfen Chrome uzantılarından Freighter\'ı yükleyin ve sayfayı yenileyin.');
  }

  try {
    // Önce aktif oturum var mı kontrol et
    const publicKey = await retrievePublicKey();
    if (publicKey) {
      localStorage.setItem('isWalletConnected', 'true');
      localStorage.setItem('walletAddress', publicKey);
      return publicKey;
    }
  } catch (error) {
    if (error.message && error.message.includes('User rejected')) {
      throw new Error('Cüzdan bağlantısı kullanıcı tarafından reddedildi.');
    } else if (error.message && error.message.includes('not connected')) {
      throw new Error('Freighter\'da aktif oturum bulunamadı. Lütfen Freighter uzantısını açın ve oturum açın.');
    }
    throw new Error('Cüzdan bağlantısı başarısız. Freighter uzantısının açık ve oturumun aktif olduğundan emin olun.');
  }

  return null;
};

/**
 * Otomatik bağlanmayı dener - Freighter API ile sessiz bağlantı
 * @returns {Promise<string|null>} Public key veya null
 */
export const autoConnectWallet = async () => {
  try {
    // Freighter API mevcut mu kontrol et
    const isAvailable = await checkFreighterAvailable();
    if (!isAvailable) {
      return null; // Sessizce başarısız ol, hata gösterme
    }

    // Sessizce public key almayı dene (kullanıcı etkileşimi olmadan)
    const publicKey = await retrievePublicKey();
    if (publicKey) {
      localStorage.setItem('isWalletConnected', 'true');
      localStorage.setItem('walletAddress', publicKey);
      return publicKey;
    }
  } catch (error) {
    // Otomatik bağlantı başarısız olursa sessizce geç
    localStorage.removeItem('isWalletConnected');
    localStorage.removeItem('walletAddress');
  }

  return null;
};

/**
 * Bağlantıyı keser
 */
export const disconnectWallet = () => {
  localStorage.removeItem('isWalletConnected');
  localStorage.removeItem('walletAddress');
};

