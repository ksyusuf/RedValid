import os
import hashlib
import tempfile
import shutil
from moviepy import VideoFileClip
from dotenv import load_dotenv
from typing import Union, Tuple, Dict, Any, BinaryIO

import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# Load environment variables
load_dotenv()

MAX_DURATION = 10          # saniye
MAX_FILE_SIZE = 50 * 1024 * 1024   # 50 MB

VIDEO_BASE_DIR = os.environ.get("VIDEO_BASE_DIR")
if not VIDEO_BASE_DIR:
    raise RuntimeError("VIDEO_BASE_DIR environment variable required. Please set it in your .env file.")


def crop_video(input_path: str, output_path: str, max_duration: int = MAX_DURATION) -> Tuple[bool, str]:
    try:
        with VideoFileClip(input_path) as clip:
            duration = clip.duration

            if duration <= max_duration:
                # Kısa videoyu olduğu gibi kopyala
                shutil.copy2(input_path, output_path)
                return True, f"Video {max_duration} saniyeden kısa, olduğu gibi kullanıldı."

            # Kırpma işlemi
            cropped_clip = clip.subclipped(0, max_duration)
            cropped_clip.write_videofile(output_path, logger=None)
            # cropped_clip ile iş bitince 'with' bloğu kapanınca otomatik kapatılır

        return True, f"Video {max_duration} saniyeye kırpıldı (orijinal: {duration:.2f} saniye)"
    except Exception as e:
        return False, f"Video kırpılırken hata oluştu: {e}"



def validate_video(file: Union[str, BinaryIO]) -> Tuple[bool, Dict[str, Any]]:
    temp_file_path = None
    try:
        if isinstance(file, str):
            logger.info(f"Dosya yolu kontrol ediliyor: {file}")
            if not os.path.exists(file):
                logger.error("Dosya bulunamadı")
                return False, {"error": "Dosya bulunamadı.", "processed_path": None}
            file_path = file
        else:
            logger.info("Bellekten video alınıyor, geçici dosya oluşturuluyor")
            temp_fd, temp_file_path = tempfile.mkstemp(suffix=".mp4")
            with os.fdopen(temp_fd, "wb") as f:
                shutil.copyfileobj(file, f)
            file_path = temp_file_path
            logger.info(f"Geçici dosya oluşturuldu: {file_path}")

        file_size = os.path.getsize(file_path)
        logger.info(f"Dosya boyutu: {file_size} byte")
        if file_size > MAX_FILE_SIZE:
            logger.error("Dosya çok büyük")
            if temp_file_path:
                os.remove(temp_file_path)
            return False, {"error": "Dosya çok büyük", "processed_path": None}

        logger.info("Video açılıyor ve süresi alınıyor")
        clip = VideoFileClip(file_path)
        duration = clip.duration
        clip.close()
        logger.info(f"Video süresi: {duration:.2f} saniye")

        processed_path = file_path
        if duration > MAX_DURATION:
            logger.info("Video kırpılacak")
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            processed_path = os.path.join(VIDEO_BASE_DIR, f"{base_name}_cropped_{MAX_DURATION}s.mp4")
            success, message = crop_video(file_path, processed_path)
            logger.info(message)
            if not success:
                if temp_file_path:
                    os.remove(temp_file_path)
                return False, {"error": message, "processed_path": None}

        logger.info("Hash oluşturuluyor")
        sha256_hash = hashlib.sha256()
        with open(processed_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        hash_hex = sha256_hash.hexdigest()
        logger.info(f"Hash oluşturuldu: {hash_hex}")

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            logger.info(f"Geçici dosya siliniyor: {temp_file_path}")
            os.remove(temp_file_path)

    return True, {
        "hash": hash_hex,
        "processed_path": processed_path,
        "original_duration": duration,
        "processed_duration": min(duration, MAX_DURATION),
        "was_cropped": duration > MAX_DURATION
    }



if __name__ == "__main__":
    path_or_file = input("Video dosya yolunu giriniz veya test için dosya açınız: ")

    # Örnek: file yolu ile
    if os.path.exists(path_or_file):
        is_valid, result = validate_video(path_or_file)
    else:
        # Örnek: bellekten çalıştırmak için
        with open(path_or_file, "rb") as f:
            is_valid, result = validate_video(f)

    if is_valid:
        print("\n✅ Video işleme tamamlandı!")
        print("SHA256 Hash:", result["hash"])
        print("İşlenen video yolu:", result["processed_path"])
        print("Orijinal süre:", f"{result['original_duration']:.2f} saniye")
        print("İşlenen süre:", f"{result['processed_duration']:.2f} saniye")
        print("⚠️  Video 10 saniyeye kırpıldı!" if result["was_cropped"] else "ℹ️  Video değiştirilmedi (zaten 10 saniyeden kısa)")
    else:
        print("\n❌ Hata:", result["error"])
