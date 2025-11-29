from stellar_sdk import Keypair, TransactionEnvelope, Network
import requests
import time

# -------------------------
# AYARLAR
# -------------------------
BACKEND_URL = "http://127.0.0.1:8000"
PUBLIC_KEY = "GAVMYU2ZXTQ7IAK77NAICSKZZNH6T2FPVQ6XIAUWWHIZ6P7Y2CS736A6"
SECRET_KEY = "SBFMFNWUBHGRT6IAKNBQDREGTP33NHQ3FH6ITTXQWYBWTFL6WKGZMJW6"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"

kp = Keypair.from_secret(SECRET_KEY)

# -------------------------
# 1️⃣ Reporter oluştur
# -------------------------
print("📝 Step 1: Reporter oluşturuluyor...")

reporter_payload = {
    "full_name": "Test Reporter",
    "institution": "Test Agency", 
    "wallet_address": PUBLIC_KEY
}

try:
    resp = requests.post(f"{BACKEND_URL}/reporters/", json=reporter_payload)
    resp.raise_for_status()
    print("✅ Reporter oluşturuldu:", resp.json())
except requests.exceptions.HTTPError:
    print("ℹ️  Reporter muhtemelen zaten kayıtlı, devam ediliyor.")
except Exception as e:
    print("❌ Reporter creation hatası:", e)

# -------------------------
# 2️⃣ Video prepare (Ping)
# -------------------------
print("📹 Step 2: Video hazırlanıyor...")

video_url = "https://example.com/testvideo.mp4"

prep_payload = {
    "reporter_wallet": PUBLIC_KEY,
    "video_url": video_url,
}

try:
    resp = requests.post(f"{BACKEND_URL}/videos/prepare-transaction", json=prep_payload)
    resp.raise_for_status()
    prep_data = resp.json()
    print("✅ Video hazırlandı:", prep_data)
except Exception as e:
    print("❌ Prepare transaction hatası:", e)
    raise

video_id = prep_data["video_id"]
xdr_to_sign = prep_data["xdr_for_signing"]

# -------------------------
# 3️⃣ XDR imzala (Muhabir)
# -------------------------
print("✍️  Step 3: XDR imzalanıyor...")

te = TransactionEnvelope.from_xdr(xdr_to_sign, NETWORK_PASSPHRASE)
te.sign(kp)
signed_xdr = te.to_xdr()

print("✅ XDR imzalandı")

# -------------------------
# 4️⃣ Video submit (Pong)
# -------------------------
print("🚀 Step 4: Stellar blockchain'e gönderiliyor...")

submit_payload = {
    "video_id": video_id,
    "signed_xdr": signed_xdr
}

try:
    resp = requests.post(f"{BACKEND_URL}/videos/submit-transaction", json=submit_payload)
    resp.raise_for_status()
    submit_data = resp.json()
    print("✅ Blockchain'e gönderildi:", submit_data)
    
    # Blockchain işlemesi için kısa bekleme
    print("⏳ Blockchain işlemesi bekleniyor...")
    time.sleep(3)
    
except requests.exceptions.HTTPError as e:
    print("❌ HTTP Hatası:", e)
    print("Response content:", e.response.text)
    raise
except Exception as e:
    print("❌ Submit transaction hatası:", e)
    raise

# -------------------------
# 5️⃣ Verification kontrol
# -------------------------
print("🔍 Step 5: Doğrulama kontrolü yapılıyor...")

verify_payload = {
    "video_url": video_url
}

try:
    resp = requests.post(f"{BACKEND_URL}/verify", json=verify_payload)
    resp.raise_for_status()
    verify_data = resp.json()
    
    if verify_data.get("status") == "VERIFIED ON STELLAR":
        print("✅ Video başarıyla doğrulandı!")
        print(f"   Stellar Transaction ID: {verify_data.get('stellar_transaction_id')}")
        print(f"   Reporter: {verify_data.get('reporter', {}).get('full_name')}")
    else:
        print(f"⏳ Video durumu: {verify_data.get('status')}")
        
except requests.exceptions.HTTPError as e:
    print("❌ HTTP Hatası:", e)
    print("Response content:", e.response.text)
except Exception as e:
    print("❌ Verification kontrol hatası:", e)

print("\n🎉 Test tamamlandı!")
