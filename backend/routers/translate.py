"""Translate endpoint: Image → Vision OCR → DB cache → Gemini → Response."""

import json
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import get_db
from db.crud import get_translations_by_names, upsert_translation
from services.vision import detect_text
from services.gemini import structure_menu
from services.currency import get_exchange_rates, convert_jpy


router = APIRouter(prefix="/api", tags=["translate"])


# ── Request / Response models ──────────────────────────────


class TranslateRequest(BaseModel):
    image_base64: str  # Base64-encoded image (no data URI prefix)


class BBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class MenuItem(BaseModel):
    name_jp: str
    name_en: str
    description_en: str
    price_jpy: Optional[int] = None
    price_converted: Optional[Dict[str, Optional[float]]] = None
    allergens: List[str] = []
    confidence: str = "high"
    bbox: Optional[BBox] = None
    cached: bool = False


class TranslateResponse(BaseModel):
    items: List[MenuItem]
    currency_rates: Dict[str, float] = {}


# ── Endpoint ───────────────────────────────────────────────


@router.post("/translate", response_model=TranslateResponse)
async def translate_menu(req: TranslateRequest, db: Session = Depends(get_db)):
    """
    Main pipeline:
    1. Vision API: OCR + bounding boxes
    2. Gemini: structure, translate, describe, estimate allergens
    3. DB cache: skip Gemini for known dishes, save new ones
    4. Currency conversion
    """
    # Strip data URI prefix if present
    image_data = req.image_base64
    if "," in image_data and image_data.index(",") < 100:
        image_data = image_data.split(",", 1)[1]

    # 1. OCR via Vision API
    try:
        ocr_result = await detect_text(image_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Vision API error: {str(e)}")

    if not ocr_result["blocks"]:
        return TranslateResponse(items=[], currency_rates={})

    # 2. Gemini structuring
    try:
        gemini_result = await structure_menu(
            full_text=ocr_result["full_text"],
            blocks=ocr_result["blocks"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    # 3. DB cache lookup + save new translations
    gemini_items = gemini_result.get("items", [])
    names_jp = [item["name_jp"] for item in gemini_items if item.get("name_jp")]
    cached = get_translations_by_names(db, names_jp)

    # 4. Currency rates
    try:
        rates = await get_exchange_rates()
    except Exception:
        rates = {}

    # 5. Build response items
    items: List[MenuItem] = []
    for item in gemini_items:
        name_jp = item.get("name_jp", "")
        is_cached = name_jp in cached

        if is_cached:
            # Use cached translation data but keep Gemini's bbox and price
            t = cached[name_jp]
            allergens = json.loads(t.allergens) if t.allergens else []
            menu_item = MenuItem(
                name_jp=name_jp,
                name_en=t.name_en,
                description_en=t.description_en or "",
                price_jpy=item.get("price_jpy"),
                allergens=allergens,
                confidence=item.get("confidence", "high"),
                bbox=item.get("bbox"),
                cached=True,
            )
        else:
            # Use Gemini result and save to DB
            menu_item = MenuItem(
                name_jp=name_jp,
                name_en=item.get("name_en", ""),
                description_en=item.get("description_en", ""),
                price_jpy=item.get("price_jpy"),
                allergens=item.get("allergens", []),
                confidence=item.get("confidence", "high"),
                bbox=item.get("bbox"),
                cached=False,
            )
            # Persist to DB for future cache hits
            try:
                upsert_translation(db, {
                    "name_jp": name_jp,
                    "name_en": menu_item.name_en,
                    "description_en": menu_item.description_en,
                    "allergens": menu_item.allergens,
                })
            except Exception:
                pass  # Non-critical: don't fail the request

        # Add currency conversion
        menu_item.price_converted = convert_jpy(menu_item.price_jpy, rates)
        items.append(menu_item)

    return TranslateResponse(items=items, currency_rates=rates)
