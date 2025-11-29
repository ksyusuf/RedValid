from fastapi import FastAPI, Depends, HTTPException, Body
from contextlib import asynccontextmanager
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from stellar_utils import (
    generate_data_hash,
    prepare_stellar_transaction,
    submit_stellar_transaction
)

from models import (
    Reporter,
    ReporterCreateRequest,
    VideoPrepareRequest, 
    SubmitTransactionRequest,
    VerificationRequest
)
from db import (
    create_db_and_tables,
    get_session,
    get_reporter_by_wallet,
    create_reporter_record,
    create_video_record,
    update_video_status,
    get_video_by_url
)
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

BASE_URL = "http://127.0.0.1:8000"

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



@app.post("/videos/prepare-transaction")
def prepare_video_verification(req: VideoPrepareRequest, session=Depends(get_session)):
    logger.info(f"Video prepare request geldi: {req.video_url} - {req.reporter_wallet}")

    reporter = get_reporter_by_wallet(session, req.reporter_wallet)
    if not reporter:
        logger.warning(f"Muhabir bulunamadı: {req.reporter_wallet}")
        raise HTTPException(404, "Muhabir cüzdanı bulunamadı.")

    try:
        data_hash = generate_data_hash(req.video_url, str(reporter.id))
        logger.info(f"Data hash üretildi: {data_hash}")
    except Exception as e:
        logger.error(f"Hash oluşturulamadı: {e}", exc_info=True)
        raise HTTPException(500, f"Hash oluşturulamadı: {e}")

    try:
        xdr_base64, prepared_tx_hash = prepare_stellar_transaction(
            reporter_public_key=reporter.wallet_address,
            data_hash=data_hash
        )
        logger.info(f"Stellar işlem hazır: {prepared_tx_hash}")
    except Exception as e:
        logger.error(f"Stellar işlem hazırlığı başarısız: {e}", exc_info=True)
        raise HTTPException(500, f"Stellar işlem hazırlığı başarısız: {e}")

    try:
        video = create_video_record(
            session,
            reporter_id=reporter.id,
            video_url=req.video_url,
            platform="unknown",
            data_hash=data_hash,
            prepared_tx_hash=prepared_tx_hash,
            tx_hash=None,
            reporter_wallet=reporter.wallet_address
        )
        logger.info(f"Video kaydedildi: {video.id}")
    except Exception as e:
        logger.error(f"Veritabanına kaydedilemedi: {e}", exc_info=True)
        raise HTTPException(500, f"Veritabanına kaydedilemedi: {e}")

    return {
        "message": "İşlem imzaya hazır.",
        "video_id": video.id,
        "video_url": video.video_url,
        "data_hash": video.data_hash,
        "xdr_for_signing": xdr_base64,
        "prepared_tx_hash": prepared_tx_hash
    }


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
            updated_video = update_video_status(
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

    if video.status == "verified":
        return {
            "status": "VERIFIED ON STELLAR",
            "video_url": video.video_url,
            "reporter": {
                "full_name": reporter.full_name,
                "institution": reporter.institution,
                "wallet_address": reporter.wallet_address
            },
            "data_hash_on_chain": video.data_hash,
            "recorded_at": video.created_at.isoformat(),
            "stellar_transaction_id": video.tx_hash
        }

    return {"status": video.status.upper()}
