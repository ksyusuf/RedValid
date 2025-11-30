from typing import List, Optional
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, Relationship
from pydantic import BaseModel


# --- Request Models ---
class ReporterCreateRequest(BaseModel):
    full_name: str
    wallet_address: str
    institution: str | None = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Ayşe Yılmaz",
                "wallet_address": "GBX5BZ4YNU2JTXBZ5N6RMVDA7D7F3C2M6VX2YXK2XKL7HZDQ4NZXPQZ",
                "institution": "Serbest Muhabir"
            }
        }


class VideoPrepareRequest(BaseModel):
    reporter_wallet: str
    video_url: Optional[str] = None
    video_file: Optional[str] = None  # Base64 encoded video file

    class Config:
        json_schema_extra = {
            "example": {
                "reporter_wallet": "GAVMYU2ZXTQ7IAK77NAICSKZZNH6T2FPVQ6XIAUWWHIZ6P7Y2CS736A6",
                "video_url": "https://www.youtube.com/watch?v=PxAr1r-1EUA"
            }
    }



class SubmitTransactionRequest(BaseModel):
    video_id: UUID
    signed_xdr: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "550e8400-e29b-41d4-a716-446655440000",
                "signed_xdr": "AAAAAgAAAAC7E4G3gYs7L7m5gQFHZkJKF8gKj5Z2+9kz8K4B8j2xAAAB9C72..."
            }
        }


class VerificationRequest(BaseModel):
    video_url: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_url": "https://www.youtube.com/watch?v=PxAr1r-1EUA"
            }
        }


class DataHashCheckRequest(BaseModel):
    video_file: str = None  # Base64 encoded video file
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_file": "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAACKBtZGF0AAAC..."
            }
        }


# --- Temel Model Yapısı ---
class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- 1. Muhabir Modeli ---
class Reporter(BaseModel, table=True):
    full_name: str
    wallet_address: str = Field(index=True, unique=True)
    institution: Optional[str] = None
    kyc_verified: bool = Field(default=False)

    # İlişki
    videos: List["Video"] = Relationship(back_populates="reporter")

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Ayşe Yılmaz",
                "wallet_address": "GBX5BZ4YNU2JTXBZ5N6RMVDA7D7F3C2M6VX2YXK2XKL7HZDQ4NZXPQZ",
                "institution": "Serbest Muhabir",
                "kyc_verified": True
            }
        }


# --- 3. Video Modeli ---
class Video(BaseModel, table=True):
    video_url: str = Field(index=True, unique=True)
    platform: str
    data_hash: str = Field(index=True)

    # Stellar işlemleri
    prepared_tx_hash: Optional[str] = Field(default=None)
    tx_hash: Optional[str] = Field(default=None)
    verification_tx_hash: Optional[str] = Field(default=None)

    # Reporter doğrulaması için gerekli alan
    reporter_wallet: str = Field(index=True)
    # TODO: production'da sadece reporter_id üzerinden wallet alınmalı. Şu anda MVP için denormalize edildi.

    # MVP durum alanları
    status: str = Field(default="pending")
    verified: bool = Field(default=False)

    # Reporter FK
    reporter_id: UUID = Field(foreign_key="reporter.id")
    reporter: Reporter = Relationship(back_populates="videos")

    class Config:
        json_schema_extra = {
            "example": {
                "video_url": "https://www.youtube.com/watch?v=PxAr1r-1EUA",
                "platform": "youtube",
                "data_hash": "a1b2c3d4e5f6789012345678901234567890abcdef",
                "prepared_tx_hash": "a1b2c3d4e5f6789012345678901234567890abcdef",
                "tx_hash": None,
                "reporter_wallet": "GBX5BZ4YNU2JTXBZ5N6RMVDA7D7F3C2M6VX2YXK2XKL7HZDQ4NZXPQZ",
                "status": "prepared",
                "verified": False
            }
        }