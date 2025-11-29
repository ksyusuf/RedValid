import requests
from stellar_sdk import Keypair


def create_stellar_keys():
    """Stellar Public + Secret key üretir."""
    kp = Keypair.random()
    return kp.public_key, kp.secret


def fund_account(public_key: str):
    """Friendbot üzerinden Testnet fonlaması yapar."""
    url = f"https://friendbot.stellar.org/?addr={public_key}"
    print(f"[INFO] Friendbot fonlaması yapılıyor...")
    response = requests.get(url)

    if response.status_code == 200:
        print("[OK] Hesap başarıyla fonlandı ✔\n")
        return True
    else:
        print("[ERROR] Fonlama başarısız ❌\n", response.text)
        return False


def main():
    print("\n========================================")
    print("   ⭐ Stellar Testnet Setup Assistant ⭐")
    print("========================================\n")

    # 1) Anahtarları üret
    public_key, secret_key = create_stellar_keys()
    print("[OK] Stellar anahtar çiftiniz oluşturuldu.\n")

    # 2) Hesabı fonla
    fund_account(public_key)

    # 3) Kullanıcıya kopyalanabilir çıktı ver
    print("========================================")
    print("📌 KOPYALANACAK ENV DEĞERLERİN")
    print("========================================\n")

    print("🔑 PUBLIC KEY:")
    print(public_key, "\n")

    print("🔐 SECRET KEY:")
    print(secret_key, "\n")

    print("🌐 STELLAR NETWORK AYARLARI (Testnet):")
    print("STELLAR_NETWORK_PASSPHRASE = Test SDF Network ; September 2015")
    print("STELLAR_HORIZON_URL = https://horizon-testnet.stellar.org\n")

    print("========================================")
    print("📌 Yapman Gerekenler")
    print("========================================")
    print("1️⃣ Yukarıdaki PUBLIC KEY ve SECRET KEY değerlerini kopyala.")
    print("2️⃣ Projendeki `.env` dosyasına manuel olarak ekle:")
    print("""
STELLAR_SECRET=BURAYA_SECRET
STELLAR_PUBLIC=BURAYA_PUBLIC

STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
""")
    print("3️⃣ Artık Stellar işlemleri göndermeye hazırsın! 🚀\n")


if __name__ == "__main__":
    main()
