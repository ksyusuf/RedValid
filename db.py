# db.py
from sqlmodel import SQLModel, Session, create_engine, select
from uuid import UUID
from models import Reporter, Video


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(
    sqlite_url,
    echo=True,
    connect_args={"check_same_thread": False}
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# ----------------------------
# CRUD: Reporter
# ----------------------------
def get_reporter_by_wallet(session: Session, wallet: str) -> Reporter | None:
    return session.exec(
        select(Reporter).where(Reporter.wallet_address == wallet)
    ).first()


def create_reporter_record(session: Session, reporter: Reporter) -> Reporter:
    session.add(reporter)
    session.commit()
    session.refresh(reporter)
    return reporter


def set_reporter_kyc_verified(session: Session, reporter_id: UUID, value: bool = True) -> Reporter | None:
    reporter = session.get(Reporter, reporter_id)
    if not reporter:
        return None

    reporter.kyc_verified = value
    session.commit()
    session.refresh(reporter)
    return reporter


# ----------------------------
# CRUD: Video
# ----------------------------
def create_video_record(session, reporter_id, video_url, platform, data_hash, prepared_tx_hash=None, tx_hash=None, reporter_wallet=None):
    video = Video(
        reporter_id=reporter_id,
        video_url=video_url,
        platform=platform,
        data_hash=data_hash,
        prepared_tx_hash=prepared_tx_hash,
        tx_hash=tx_hash,
        reporter_wallet=reporter_wallet,
        status="prepared",
        verified=False
    )
    session.add(video)
    session.commit()
    session.refresh(video)
    return video



def update_video_status(
    session: Session,
    video_id: UUID,
    status: str,
    tx_hash: str | None = None
) -> Video | None:

    video = session.get(Video, video_id)
    if not video:
        return None

    video.status = status
    if tx_hash:
        video.tx_hash = tx_hash

    session.commit()
    session.refresh(video)
    return video


def mark_video_verified(
    session: Session,
    video_id: UUID,
    verification_tx_hash: str
) -> Video | None:

    video = session.get(Video, video_id)
    if not video:
        return None

    video.verified = True
    video.verification_tx_hash = verification_tx_hash
    video.status = "verified"

    session.commit()
    session.refresh(video)
    return video


def get_video_by_url(session: Session, url: str) -> Video | None:
    return session.exec(
        select(Video).where(Video.video_url == url)
    ).first()
    
def get_video_by_data_hash(session: Session, data_hash: str) -> Video | None:
    return session.exec(
        select(Video).where(Video.data_hash == data_hash)
    ).first()
