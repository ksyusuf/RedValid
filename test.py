from stellar_sdk import Keypair, TransactionEnvelope, Network
import requests

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
reporter_payload = {
    "full_name": "Test Reporter",
    "institution": "Test Agency",
    "wallet_address": PUBLIC_KEY
}

try:
    resp = requests.post(f"{BACKEND_URL}/reporters/", json=reporter_payload)
    resp.raise_for_status()
    print("Reporter created:", resp.json())
except requests.exceptions.HTTPError:
    print("Reporter muhtemelen zaten kayıtlı, devam ediliyor.")
except Exception as e:
    print("Reporter creation hatası:", e)

# -------------------------
# 2️⃣ Video prepare (Ping)
# -------------------------
video_url = "https://example.com/testvideo.mp4"
keywords = ["test", "video", "stellar"]

prep_payload = {
    "reporter_wallet": PUBLIC_KEY,
    "video_url": video_url,
    "keywords": keywords
}

try:
    resp = requests.post(f"{BACKEND_URL}/videos/prepare-transaction", json=prep_payload)
    resp.raise_for_status()
    prep_data = resp.json()
    print("Prepare response:", prep_data)
except Exception as e:
    print("Prepare transaction hatası:", e)
    raise

video_id = prep_data["video_id"]
xdr_to_sign = prep_data["xdr_for_signing"]

# -------------------------
# 3️⃣ XDR imzala (Muhabir)
# -------------------------
te = TransactionEnvelope.from_xdr(xdr_to_sign, NETWORK_PASSPHRASE)
te.sign(kp)
signed_xdr = te.to_xdr()

# -------------------------
# 4️⃣ Video submit (Pong)
# -------------------------
submit_payload = {
    "video_id": video_id,
    "signed_xdr": signed_xdr
}

try:
    resp = requests.post(f"{BACKEND_URL}/videos/submit-transaction", json=submit_payload)
    resp.raise_for_status()
    submit_data = resp.json()
    print("Submit response:", submit_data)
except requests.exceptions.HTTPError as e:
    print("HTTP Hatası:", e)
    print("Response content:", e.response.text)
    raise
except Exception as e:
    print("Submit transaction hatası:", e)
    raise

# -------------------------
# 5️⃣ Verification kontrol
# -------------------------
verification_link = submit_data.get("verification_link")
if verification_link:
    public_slug = verification_link.split("/")[-1]
    try:
        resp = requests.get(f"{BACKEND_URL}/verify/{public_slug}")
        resp.raise_for_status()
        verify_data = resp.json()
        print("Verify response:", verify_data)
    except Exception as e:
        print("Verification kontrol hatası:", e)
else:
    print("Video henüz doğrulanmadı veya Stellar gönderimi başarısız.")
