import logging
from fastapi import HTTPException
import hashlib
from sqlalchemy.orm import Session
from stellar_utils import prepare_stellar_transaction
from db import create_video_record
import hashlib
from typing import Union, BinaryIO
from db import (
    create_video_record,
    get_video_by_url,
    get_video_by_data_hash
)
from add_video import validate_video


logger = logging.getLogger(__name__)


def generate_hash_from_video_url(video_url: str, session: any):
    # Check if video URL already exists (app-level check as requested)
    existing_video = get_video_by_url(session, video_url)
    if existing_video:
        logger.info(f"Video URL already exists: {video_url}")
        return {
            "message": "Bu video URL'si zaten kayıtlı.",
            "video_id": existing_video.id,
            "video_url": existing_video.video_url,
            "status": existing_video.status,
            "data_hash": existing_video.data_hash,
            "prepared_tx_hash": existing_video.prepared_tx_hash,
            "already_registered": True
        }
    try:
        data_hash = hashlib.sha256(video_url.encode("utf-8")).hexdigest()
        logger.info(f"Data hash üretildi: {data_hash}")
        return data_hash
        
    except Exception as e:
        logger.error(f"Hash oluşturulamadı: {e}", exc_info=True)
        raise HTTPException(500, f"Hash oluşturulamadı: {e}")


def generate_hash_from_video_file(video_file_data: Union[str, BinaryIO], session: any):
    # add_video içerisindeki validate_video metodunu kullanarak hash dönüşümü yap
    
    # Video dosyasını validate_video'ya ver ve hash dönüşümü yap
    validation_result = validate_video(video_file_data)
    
    if not validation_result[0]:
        logger.error(f"Video validation failed: {validation_result[1].get('error', 'Unknown error')}")
        raise HTTPException(400, f"Video validation failed: {validation_result[1].get('error', 'Unknown error')}")
    
    # Hash verisini al
    data_hash = validation_result[1]["hash"]
    logger.info(f"Data hash üretildi: {data_hash}")
    
    # data hash üretilecek burada. eğer verilen hash zaten varsa, hata döndürülecek
    existing_video = get_video_by_data_hash(session, data_hash)
    if existing_video:
        logger.info(f"Video Hash already exists: {data_hash}")
        return {
            "message": "Bu video URL'si zaten kayıtlı.",
            "video_id": existing_video.id,
            "video_url": existing_video.video_url,
            "status": existing_video.status,
            "data_hash": existing_video.data_hash,
            "prepared_tx_hash": existing_video.prepared_tx_hash,
            "already_registered": True
        }
    
    return data_hash

    
def process_video_preparation(session: Session, data_hash: Union[str, dict], video_identifier: str, reporter):
    logger.info(f"process_video_preparation - session type: {type(session)}")
    logger.info(f"process_video_preparation - reporter type: {type(reporter)}")
    logger.info(f"process_video_preparation - video_identifier type: {type(video_identifier)}")
    logger.info(f"process_video_preparation - data_hash type: {type(data_hash)}")

    # Check if this is a duplicate video registration response
    if isinstance(data_hash, dict):
        logger.info(f"Video already registered: {data_hash.get('message', 'Duplicate detected')}")
        return data_hash

    # data_hash is a string - proceed with transaction preparation
    try:
        try:
            # Prepare transaction using centralized function
            xdr_base64, prepared_tx_hash = prepare_stellar_transaction(
                reporter_public_key=reporter.wallet_address,
                data_hash=data_hash
            )
            logger.info(f"Stellar işlem hazır: {prepared_tx_hash}")
            
        except Exception as e:
            logger.error(f"Stellar işlem hazırlığı başarısız: {e}", exc_info=True)
            raise HTTPException(500, f"Stellar işlem hazırlığı başarısız: {e}")
        
        
        # Save to database
        video = create_video_record(
            session,
            reporter_id=reporter.id,
            video_url=video_identifier,
            platform="unknown",
            data_hash=data_hash,
            prepared_tx_hash=prepared_tx_hash,
            tx_hash=None,
            reporter_wallet=reporter.wallet_address
        )
        logger.info(f"Video kaydedildi: {video.id}")

        return {
            "message": "İşlem imzaya hazır.",
            "video_id": video.id,
            "video_url": video.video_url,
            "data_hash": video.data_hash,
            "xdr_for_signing": xdr_base64,
            "prepared_tx_hash": prepared_tx_hash,
            "already_registered": False
        }
        
    except Exception as e:
        logger.error(f"Video işleme hatası: {e}", exc_info=True)
        raise