from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File
from contextlib import asynccontextmanager
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import io
from dotenv import load_dotenv
import base64

from stellar_utils import (
    submit_stellar_transaction,
    verify_transaction_on_blockchain,
)
from hashing import (
    generate_hash_from_video_file,
    process_video_preparation,
    generate_hash_from_video_url
)

from models import (
    Reporter,
    ReporterCreateRequest,
    VideoPrepareRequest, 
    SubmitTransactionRequest,
    VerificationRequest,
    DataHashCheckRequest
)
from db import (
    create_db_and_tables,
    get_session,
    get_reporter_by_wallet,
    create_reporter_record,
    create_video_record,
    update_video_status,
    get_video_by_url,
    get_video_by_data_hash
)
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Load environment variables
load_dotenv()
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    print("Uygulama başlatıldı")
    yield
    print("Uygulama kapanıyor")


app = FastAPI(
    lifespan=lifespan,
    title="RedValid Stellar Doğrulama Servisi",
    version="1.0.0",
    description="Video içeriği hash'lerini Stellar Testnet'e kaydetmek için çekirdek servis."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------
# Muhabir Kaydı
# -------------------------------------------
@app.post("/reporters/")
def create_reporter_endpoint(req: ReporterCreateRequest, session=Depends(get_session)):
    existing = get_reporter_by_wallet(session, req.wallet_address)
    if existing:
        raise HTTPException(400, "Bu cüzdan adresi zaten kayıtlı.")

    reporter = Reporter(
        full_name=req.full_name,
        wallet_address=req.wallet_address,
        institution=req.institution,
        kyc_verified=True  # MVP bypass
    )
    return create_reporter_record(session, reporter)

@app.get("/reporters/{wallet_address}")
def get_reporter_endpoint(wallet_address: str, session=Depends(get_session)):
    """
    Muhabir bilgilerini cüzdan adresi ile getir
    """
    reporter = get_reporter_by_wallet(session, wallet_address)
    if not reporter:
        raise HTTPException(404, "Muhabir bulunamadı.")
    
    return {
        "id": reporter.id,
        "full_name": reporter.full_name,
        "wallet_address": reporter.wallet_address,
        "institution": reporter.institution,
        "kyc_verified": reporter.kyc_verified,
        "created_at": reporter.created_at.isoformat()
    }



@app.post("/videos/prepare-transaction")
async def prepare_video_verification(
    req: VideoPrepareRequest,
    session=Depends(get_session)
    ):
    logger.info(f"Video prepare request geldi: URL={req.video_url} - {req.reporter_wallet}")

    reporter = get_reporter_by_wallet(session, req.reporter_wallet)
    if not reporter:
        raise HTTPException(404, "Muhabir cüzdanı bulunamadı.")

    if not req.video_url:
        raise HTTPException(400, "Video URL sağlanmalıdır.")

    # URL'den hash üret
    data_hash = generate_hash_from_video_url(req.video_url, session)
    return process_video_preparation(
        session=session,
        data_hash=data_hash,
        video_identifier=req.video_url,
        reporter=reporter        
    )


@app.post("/videos/prepare-transaction/upload")
async def prepare_video_verification_with_upload(
    video_file: UploadFile = File(...),
    reporter_wallet: str = None,
    session=Depends(get_session)
    ):
    print(reporter_wallet)
    print(video_file)
    logger.info(f"Video upload request geldi: File={video_file.filename} - {reporter_wallet}")

    reporter = get_reporter_by_wallet(session, reporter_wallet)
    if not reporter:
        logger.warning(f"Muhabir bulunamadı: {reporter_wallet}")
        raise HTTPException(404, "Muhabir cüzdanı bulunamadı.")

    if not video_file:
        raise HTTPException(400, "Video dosyası boş.")

    try:
        # UploadFile'ı BytesIO'ya dönüştür
        video_content = await video_file.read()
        video_file_like = io.BytesIO(video_content)
        
        data_hash = generate_hash_from_video_file(video_file_like, session)
        
        # Handle the case where data_hash is a dict (video already exists)
        if isinstance(data_hash, dict):
            # Video already exists, return the existing record
            return data_hash
        
        # data_hash is a string, proceed with normal processing
        video_identifier = f"uploaded_video_{data_hash[:16]}"
        return process_video_preparation(
            session=session,
            data_hash=data_hash,
            video_identifier=video_identifier,
            reporter=reporter
        )
        
    except Exception as e:
        logger.error(f"Video işleme hatası: {e}")
        raise HTTPException(400, f"Video işleme hatası: {e}")


# -------------------------------------------
# 2. Submit Transaction (Pong)
# -------------------------------------------
@app.post("/videos/submit-transaction")
async def submit_verification(
    req: SubmitTransactionRequest = Body(...),
    session=Depends(get_session)
):
    video = update_video_status(session, req.video_id, status="sending")
    if not video:
        raise HTTPException(404, "Video bulunamadı.")

    try:
        actual_hash = await submit_stellar_transaction(
            signed_xdr=req.signed_xdr,
            expected_data_hash=video.data_hash,
            expected_reporter_public_key=video.reporter.wallet_address,
            prepared_tx_hash=video.prepared_tx_hash
        )

        if actual_hash:
            update_video_status(
                session,
                video.id,
                status="verified",
                tx_hash=actual_hash
            )
            return {
                "status": "success",
                "stellar_tx_hash": actual_hash,
            }

        update_video_status(session, video.id, status="failed")
        raise HTTPException(500, "Stellar ağına gönderim hatası.")

    except Exception as e:
        print("Bilinmeyen Hata:", e)
        raise


# -------------------------------------------
# Public Verify Endpoint
# -------------------------------------------
@app.post("/verify")
async def get_verification(req: VerificationRequest, session=Depends(get_session)):
    video = get_video_by_url(session, req.video_url)
    if not video:
        raise HTTPException(404, "Doğrulama kaydı bulunamadı.")
        
    reporter = video.reporter

    # Eğer video'nun bir tx_hash'i varsa blockchain'de kontrol et
    if video.tx_hash:
        tx = await verify_transaction_on_blockchain(video.tx_hash)

        if tx:
            memo_base64 = tx.get("memo")
            memo_bytes = base64.b64decode(memo_base64)
            memo_hex = memo_bytes.hex()
            
            # Transaction blockchain'de bulundu → video kesin kaydedilmiş
            return {
                "status": "VERIFIED_ON_STELLAR",
                "video_url": video.video_url,
                "memo_hex": memo_hex,
                "data_hash": video.data_hash,
                "reporter": {
                    "full_name": reporter.full_name,
                    "institution": reporter.institution,
                    "wallet_address": reporter.wallet_address,
                },
                "recorded_at": video.created_at.isoformat(),
                "stellar_transaction_id": video.tx_hash,
                "stellar_ledger": tx.get("ledger"),
                "stellar_created_at": tx.get("created_at"),
                "stellar_operation_count": tx.get("operation_count"),
                "blockchain_verified": True
            }
        else:
            # Transaction henüz işlenmemiş olabilir
            return {
                "status": "PROCESSING_ON_BLOCKCHAIN",
                "video_url": video.video_url,
                "stellar_transaction_id": video.tx_hash,
                "blockchain_verified": False,
                "message": "Transaction Stellar blockchain'e gönderildi, henüz işlenmedi."
            }

    # Eğer daha hiç tx_hash yoksa → kullanıcıya mevcut local status'u döndür
    return {"status": video.status.upper()}


# -------------------------------------------
# Data Hash Check Endpoint
# -------------------------------------------
@app.post("/verify/upload")
async def check_data_hash_existence(
    video_file: UploadFile = File(...),
    session=Depends(get_session)
):
    """
    Dosya yükleyerek data_hash oluşturup, veritabanında ve zincirde varlığını kontrol eder.
    """
    logger.info(f"Data hash check request geldi: File={video_file.filename}")
    
    if not video_file:
        raise HTTPException(400, "Video dosyası boş.")
    
    try:
        # 1. Dosyayı oku ve data_hash oluştur
        video_content = await video_file.read()
        video_file_like = io.BytesIO(video_content)
        
        # Hash oluştur
        data_hash = generate_hash_from_video_file(video_file_like, session)
        
        # Eğer hash zaten mevcutsa dict döndü, string döndüyse yeni hash
        if isinstance(data_hash, dict):
            existing_video = data_hash
            logger.info(f"Video hash already exists: {data_hash['data_hash']}")
            
            # Get reporter information
            video_record = get_video_by_data_hash(session, existing_video['data_hash'])
            reporter = None
            if video_record:
                reporter = session.get(Reporter, video_record.reporter_id)
            
            # Blockchain durumunu kontrol et
            blockchain_status = None
            if existing_video.get('prepared_tx_hash'):
                tx = await verify_transaction_on_blockchain(existing_video['prepared_tx_hash'])
                if tx:
                    blockchain_status = "VERIFIED_ON_STELLAR"
                else:
                    blockchain_status = "PREPARED_NOT_SUBMITTED"
            else:
                blockchain_status = "NOT_ON_BLOCKCHAIN"
            
            return {
                "status": "ALREADY_EXISTS",
                "data_hash": existing_video['data_hash'],
                "database_status": existing_video['status'],
                "blockchain_status": blockchain_status,
                "video_info": {
                    "video_id": existing_video['video_id'],
                    "video_url": existing_video['video_url'],
                    "prepared_tx_hash": existing_video['prepared_tx_hash']
                },
                "reporter_info": {
                    "reporter_id": str(reporter.id),
                    "full_name": reporter.full_name,
                    "wallet_address": reporter.wallet_address,
                    "institution": reporter.institution,
                    "kyc_verified": reporter.kyc_verified
                } if reporter else None,
                "message": "Bu video zaten kayıtlı."
            }
        
        # 2. Yeni hash, veritabanında ara
        data_hash_str = data_hash  # string olarak hash al
        logger.info(f"Generated new data hash: {data_hash_str}")
        
        # Veritabanında ara
        existing_video = get_video_by_data_hash(session, data_hash_str)
        
        if existing_video:
            logger.info(f"Data hash found in database: {data_hash_str}")
            
            # Get reporter information
            reporter = session.get(Reporter, existing_video.reporter_id)
            
            # Blockchain durumunu kontrol et
            blockchain_status = None
            if existing_video.tx_hash:
                tx = await verify_transaction_on_blockchain(existing_video.tx_hash)
                if tx:
                    blockchain_status = "VERIFIED_ON_STELLAR"
                else:
                    blockchain_status = "SUBMITTED_PROCESSING"
            else:
                blockchain_status = "NOT_ON_BLOCKCHAIN"
            
            return {
                "status": "EXISTS_IN_DATABASE",
                "data_hash": data_hash_str,
                "database_status": existing_video.status,
                "blockchain_status": blockchain_status,
                "video_info": {
                    "video_id": str(existing_video.id),
                    "video_url": existing_video.video_url,
                    "prepared_tx_hash": existing_video.prepared_tx_hash,
                    "tx_hash": existing_video.tx_hash
                },
                "reporter_info": {
                    "reporter_id": str(reporter.id),
                    "full_name": reporter.full_name,
                    "wallet_address": reporter.wallet_address,
                    "institution": reporter.institution,
                    "kyc_verified": reporter.kyc_verified
                } if reporter else None,
                "message": "Bu video veritabanında mevcut."
            }
        
        # 3. Veritabanında yok, blockchain'de ara (opsiyonel - hash ile arama mümkünse)
        # Not: Stellar blockchain'de doğrudan hash ile arama yapmak mümkün değil
        # Bu nedenle bu adımı atlayıp "NOT_FOUND" dönebiliriz
        
        return {
            "status": "NOT_FOUND",
            "data_hash": data_hash_str,
            "database_status": "NOT_EXISTS",
            "blockchain_status": "UNKNOWN",
            "message": "Bu video hiçbir yerde bulunamadı. Yeni kayıt oluşturulabilir."
        }
        
    except Exception as e:
        logger.error(f"Data hash check error: {e}")
        raise HTTPException(400, f"Data hash check error: {e}")
