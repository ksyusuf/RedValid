import os
import hashlib
from moviepy import VideoFileClip


MAX_DURATION = 10          # saniye
MAX_FILE_SIZE = 50 * 1024 * 1024   # 50 MB


def validate_video(file_path: str):
    # --- Dosya mevcut mu?
    if not os.path.exists(file_path):
        return False, "Dosya bulunamadı."

    # --- Boyut kontrolü
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        return False, f"Video çok büyük! Maksimum 50MB olmalı. (Şu an: {file_size/1024/1024:.2f} MB)"

    # --- Süre kontrolü
    try:
        clip = VideoFileClip(file_path)
        duration = clip.duration
        clip.close()
    except Exception as e:
        return False, f"Video okunamadı: {e}"

    if duration > MAX_DURATION:
        return False, f"Video çok uzun! Maksimum 10 saniye olmalı. (Şu an: {duration:.2f} sn)"

    # --- SHA256 hash üretme
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)

    hash_hex = sha256_hash.hexdigest()

    return True, hash_hex


if __name__ == "__main__":
    file_path = input("Video dosya yolunu giriniz: ")

    is_valid, result = validate_video(file_path)

    if is_valid:
        print("\n✅ Video geçerli!")
        print("SHA256 Hash:", result)
    else:
        print("\n❌ Hata:", result)
