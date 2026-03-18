import json
import re
from pathlib import Path
from typing import List, Dict

from .models import SessionLocal
from .crud import upsert_translation

SEED_FILE = Path(__file__).resolve().parent.parent.parent / "samples" / "izakaya_seed_data.json"


def _load_seed_json() -> List[Dict]:
    text = SEED_FILE.read_text(encoding="utf-8")
    # Remove JS-style single-line comments (// ...)
    text = re.sub(r"//.*", "", text)
    return json.loads(text)


def seed_database():
    """Load seed data into DB. Skips dishes that already exist (upsert)."""
    if not SEED_FILE.exists():
        print(f"[seed] Seed file not found: {SEED_FILE}")
        return

    dishes = _load_seed_json()
    db = SessionLocal()
    try:
        inserted = 0
        for dish in dishes:
            result = upsert_translation(db, dish)
            if result.description_en == dish.get("description_en", ""):
                inserted += 1
        print(f"[seed] {inserted} dishes loaded ({len(dishes)} total in seed file)")
    finally:
        db.close()
