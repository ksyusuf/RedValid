import hashlib
import os
from dotenv import load_dotenv
from typing import Optional, Tuple, List
from stellar_sdk import (
    TransactionBuilder, Server, Network, Keypair,
    Asset, TransactionEnvelope, Memo, MuxedAccount
)
from stellar_sdk.memo import HashMemo

from stellar_sdk.exceptions import BadRequestError
import asyncio

# ---------------------
# CONFIG
# ---------------------
HORIZON_URL = "https://horizon-testnet.stellar.org"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
SERVER = Server(HORIZON_URL)

load_dotenv()

SERVICE_SECRET_KEY = os.environ.get("STELLAR_SECRET")
if not SERVICE_SECRET_KEY:
    raise RuntimeError("STELLAR_SECRET environment variable required")

SERVICE_KEYPAIR = Keypair.from_secret(SERVICE_SECRET_KEY)
SERVICE_PUBLIC_KEY = SERVICE_KEYPAIR.public_key


# ---------------------
# DATABASE / KYC STUBS (SENİN DB ENTEGRASYONUNA GÖRE DOLDUR)
# ---------------------
def is_verified_reporter(reporter_public_key: str) -> bool:
    """
    KYC kontrolü. Gerçek veritabanı sorgunu buraya koy.
    MVP bypass'ı istiyorsan True döndür.
    """
    # TODO: gerçek DB sorgusu -> return Users.objects.get(...).is_verified
    # Şimdilik MVP davranışı: otomatik doğrula (ama prod'da bunu kaldır)
    return True


def store_prepared_transaction(
    reporter_public_key: str,
    data_hash: str,
    xdr: str,
    prepared_tx_hash: str,
    status: str = "prepared"
) -> None:
    """
    Prepared XDR'ı ve meta bilgisini veritabanına kaydet.
    TODO: kendi DB implementasyonunu ekle.
    """
    # örn: INSERT INTO prepared_txs (...)
    print("STORE_PREPARED_TX:", reporter_public_key, prepared_tx_hash, status)


def mark_transaction_submitted(prepared_tx_hash: str, horizon_tx_hash: str, ledger: Optional[int]) -> None:
    """
    Transaction başarıyla submit edildiğinde DB'yi güncelle.
    """
    print("MARK_SUBMITTED:", prepared_tx_hash, horizon_tx_hash, ledger)


# ---------------------
# HASH GENERATION
# ---------------------
def generate_data_hash(video_url: str, reporter_id: str) -> str:
    """
    Video URL + Reporter ID → SHA256 Hash (hex).
    """
    data_string = f"{video_url}:{reporter_id}"
    return hashlib.sha256(data_string.encode("utf-8")).hexdigest()


# ---------------------
# HELPERS (VALIDATION)
# ---------------------
def signature_hints_for_envelope(envelope: TransactionEnvelope) -> List[bytes]:
    """
    Envelope'daki imza hint'lerini byte listesi olarak döndür.
    """
    return [sig.signature_hint for sig in envelope.signatures]


def expected_signature_hint(public_key: str) -> bytes:
    """
    Bir public key için Stellar signature hint (4 byte) üret.
    """
    kp = Keypair.from_public_key(public_key)
    return kp.signature_hint()


def validate_envelope_contents(
        envelope: TransactionEnvelope,
        expected_data_hash: str,
        expected_reporter_public_key: str
) -> Tuple[bool, str]:
    """
    Gelen (imzalı veya imzasız) envelope'ı içeriğe göre doğrular.
    Kontroller:
      - Memo memo-hash olarak beklenen hash'i taşıyor mu?
      - En az 1 operation var mı ve operation.destination & operation.amount kontrolü
      - Operation.source reporter_public_key olarak ayarlanmış mı? (özel: Ping-Pong için)
    Döner: (True/False, message)
    """
    # Memo kontrolü
    memo = envelope.transaction.memo
    if not isinstance(memo, HashMemo):
        return False, "Memo HashMemo değil"
    if memo.memo_hash != bytes.fromhex(expected_data_hash):
        return False, "Memo hash veritabanındaki data_hash ile eşleşmiyor"

    ops = envelope.transaction.operations
    if not ops or len(ops) < 1:
        return False, "İşlemde operation yok"

    # Bizim hazırladığımız işlem tek bir payment op idi; burada ilk operation'ı kontrol ediyoruz.
    op = ops[0]
    # operation'ın destination ve amount alanlarına erişebilirsek kontrol et
    dest = getattr(op, "destination", None)
    if isinstance(dest, MuxedAccount):
        dest = dest.account_id  # MuxedAccount -> string

    amount = getattr(op, "amount", None)

    if dest is None or amount is None:
        return False, "Operation destination/amount bilgisi eksik"

    if dest != SERVICE_PUBLIC_KEY:
        return False, f"Operation destination beklenen servis hesabı değil ({dest})"

    # Eğer spesifik bir amount bekliyorsan burayı kontrol et (örn "0.0000001")
    # Bizim hazırladığımız örnekte küçük bir mikro-payment var; production'da bu opsiyonel olabilir.
    # Burada sadece amount var mı diye kontrol bırakıyorum, istersen stricter ol.
    if float(amount) <= 0:
        return False, "Amount sıfır veya negatif olamaz"

    # Operation source kontrolü: MUST be reporter_public_key (böylece reporter imzası gerekir)
    op_source = getattr(op, "source", None)
    if isinstance(op_source, MuxedAccount):
        op_source = op_source.account_id  # MuxedAccount -> string

    if op_source is None:
        return False, "Operation source boş; reporter imzası zorunlu kılınmamış"
    if op_source != expected_reporter_public_key:
        return False, f"Operation source beklenen muhabir değil ({op_source})"

    return True, "Envelope içeriği doğrulandı"


# ---------------------
# TRANSACTION PREPARE
# ---------------------
def prepare_stellar_transaction(
    reporter_public_key: str,
    data_hash: str
) -> Tuple[str, str]:
    """
    RedValid (fee payer) hazırlık: Payment operation'ın source'u MUHABİR hesabı olarak ayarlandı.
    Böylece muhabirin XDR'ı imzalaması zorunlu hale gelir.
    Döner:
      - xdr_for_reporter (servis tarafından önceden imzalanmış XDR; muhabire gönderilecek)
      - prepared_tx_hash (transaction hash, horizon sorgusu vs için saklanacak)
    """
    # KYC kontrolü (Adım 0)
    if not is_verified_reporter(reporter_public_key):
        raise PermissionError("Reporter KYC doğrulaması yok")

    account = SERVER.load_account(SERVICE_PUBLIC_KEY)

    builder = TransactionBuilder(
        source_account=account,
        network_passphrase=NETWORK_PASSPHRASE,
        base_fee=100
    )

    # Payment operation: source=reporter_public_key -> muhabirin imzası gerekecek
    builder.append_payment_op(
        destination=SERVICE_PUBLIC_KEY,
        asset=Asset.native(),
        amount="0.0000001",
        source=reporter_public_key
    )

    # MemoHash: Stellar binary 32 byte ister
    builder.add_memo(HashMemo(bytes.fromhex(data_hash)))

    # Build transaction (servis hesabı sequence numarası ile)
    tx = builder.build()

    # Servis hesabı imzalıyor (fee payer imzası)
    tx.sign(SERVICE_KEYPAIR)

    # Muhabire gönderilecek XDR (henüz muhabir imzası yok)
    xdr_for_reporter = tx.to_xdr()

    # prepared_tx_hash (bu hash transaction içeriğine dayalıdır; imzalardan bağımsızdır)
    prepared_tx_hash = tx.hash_hex()

    # DB'ye kaydet (prepared)
    store_prepared_transaction(
        reporter_public_key=reporter_public_key,
        data_hash=data_hash,
        xdr=xdr_for_reporter,
        prepared_tx_hash=prepared_tx_hash,
        status="prepared"
    )

    return xdr_for_reporter, prepared_tx_hash


# ---------------------
# TRANSACTION SUBMIT
# ---------------------
async def submit_stellar_transaction(
        signed_xdr: str,
        expected_data_hash: str,
        expected_reporter_public_key: str,
        prepared_tx_hash: str) -> Optional[str]:
    """
    Muhabirin imzaladığı XDR'ı alır, içeriğini ve imzaları doğrular, sonra Horizon'a gönderir.
    Parametreler:
      - signed_xdr: Muhabirin imzalayıp gönderdiği XDR string
      - expected_data_hash: DB'de tuttuğun data_hash (hex string)
      - expected_reporter_public_key: Muhabirin public key'i (kontrol için)
      - prepared_tx_hash: Önceden DB'de tutulan prepared hash (log/bağlantı için)
    Döner: Horizon tarafından dönen transaction hash ya da None (hata)
    """
    try:
        envelope = TransactionEnvelope.from_xdr(signed_xdr, NETWORK_PASSPHRASE)

        # 1) İçerik doğrulaması (memo, op.source, op.dest, amount vs)
        ok, msg = validate_envelope_contents(envelope, expected_data_hash, expected_reporter_public_key)
        if not ok:
            print("Envelope içeri doğrulaması başarısız:", msg)
            return None

        # 2) İmzaların gerçekten SERVICE ve REPORTER tarafından atıldığını kontrol et (hint)
        hints = signature_hints_for_envelope(envelope)
        service_hint = expected_signature_hint(SERVICE_PUBLIC_KEY)
        reporter_hint = expected_signature_hint(expected_reporter_public_key)

        if service_hint not in hints:
            print("Eksik servis imzası (hint bulunamadı)")
            return None
        if reporter_hint not in hints:
            print("Eksik reporter imzası (hint bulunamadı)")
            return None

        # NOT: hint kontrolü temel bir kontrol sağlar; ek doğrulama istersen
        # envelope.verify([Keypair.from_public_key(...)]) gibi kriptografik doğrulama ekle.

        # 3) Submit transaction (network call)
        response = await asyncio.to_thread(SERVER.submit_transaction, envelope)

        horizon_tx_hash = response.get("hash")
        ledger = response.get("ledger")

        # DB update: submitted
        mark_transaction_submitted(prepared_tx_hash=prepared_tx_hash, horizon_tx_hash=horizon_tx_hash, ledger=ledger)

        return horizon_tx_hash

    except BadRequestError as e:
        print("Stellar İşlem Hatası:", e, getattr(e, "response", None))
        return None
    except Exception as e:
        print("Bilinmeyen Hata:", e)
        return None
