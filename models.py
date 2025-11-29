from typing import List, Optional
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, Relationship


# --- Temel Model Yapısı ---
class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- 1. Muhabir Modeli ---
class Reporter(BaseModel, table=True):
    full_name: str
    wallet_address: str = Field(index=True, unique=True)
    institution: Optional[str] = None
    profile_photo: Optional[str] = None
    kyc_verified: bool = Field(default=False)

    # İlişki
    videos: List["Video"] = Relationship(back_populates="reporter")

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Ayşe Yılmaz",
                "wallet_address": "GB...XYZ",
                "institution": "Serbest Muhabir"
            }
        }


# --- 2. Keyword Modeli (YENİ - 1-N İlişki) ---
class Keyword(BaseModel, table=True):
    # Anahtar kelimenin kendisi (Örn: "savaş", "deepfake_yok")
    keyword: str = Field(index=True)
    # Foreign Key: Hangi video ile ilişkilendirildiği
    video_id: UUID = Field(foreign_key="video.id")
    # İlişki: Video objesine geri bağlantı
    video: "Video" = Relationship(back_populates="keywords")


# --- 3. Video Modeli ---
class Video(BaseModel, table=True):
    video_url: str
    platform: str
    public_slug: str = Field(index=True, unique=True)
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

    # Keyword ilişkisi
    keywords: List[Keyword] = Relationship(back_populates="video")

    # Reporter FK
    reporter_id: UUID = Field(foreign_key="reporter.id")
    reporter: Reporter = Relationship(back_populates="videos")

    class Config:
        json_schema_extra = {
            "example": {
                "video_url": "https://youtu.be/abcxyz",
                "platform": "youtube",
                "public_slug": "RdVd-001A",
                "data_hash": "a1b2c3d4e5f6...",
            }
        }