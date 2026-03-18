import json
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from .models import Translation


def get_translation_by_name_jp(db: Session, name_jp: str) -> Optional[Translation]:
    return db.query(Translation).filter(Translation.name_jp == name_jp).first()


def get_translations_by_names(db: Session, names_jp: List[str]) -> Dict[str, Translation]:
    """Batch lookup: returns {name_jp: Translation} for all found entries."""
    results = db.query(Translation).filter(Translation.name_jp.in_(names_jp)).all()
    return {t.name_jp: t for t in results}


def create_translation(db: Session, data: dict) -> Translation:
    allergens = data.get("allergens", [])
    if isinstance(allergens, list):
        allergens = json.dumps(allergens)

    translation = Translation(
        name_jp=data["name_jp"],
        name_en=data["name_en"],
        description_en=data.get("description_en", ""),
        allergens=allergens,
        category=data.get("category", ""),
        is_vegetarian=data.get("is_vegetarian", False),
        is_vegan=data.get("is_vegan", False),
        spicy_level=data.get("spicy_level", 0),
        typical_price_range=data.get("typical_price_range", ""),
    )
    db.add(translation)
    db.commit()
    db.refresh(translation)
    return translation


def upsert_translation(db: Session, data: dict) -> Translation:
    """Insert or update a translation by name_jp."""
    existing = get_translation_by_name_jp(db, data["name_jp"])
    if existing:
        return existing
    return create_translation(db, data)
