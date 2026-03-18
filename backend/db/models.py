from sqlalchemy import (
    Column,
    Integer,
    Text,
    Boolean,
    DateTime,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone

DATABASE_URL = "sqlite:///./izakaya_lens.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name_jp = Column(Text, unique=True, nullable=False, index=True)
    name_en = Column(Text, nullable=False)
    description_en = Column(Text)
    allergens = Column(Text)  # JSON array e.g. '["Soy","Wheat"]'
    category = Column(Text)
    is_vegetarian = Column(Boolean, default=False)
    is_vegan = Column(Boolean, default=False)
    spicy_level = Column(Integer, default=0)
    typical_price_range = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
