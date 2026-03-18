"""Google Cloud Vision API integration for OCR + bounding box extraction."""

import base64
import os
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv

load_dotenv()

VISION_API_KEY = os.getenv("GOOGLE_CLOUD_VISION_API_KEY", "")
VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"


"""Build the Vision API request payload for text detection."""
def _build_request_body(image_base64: str) -> Dict[str, Any]:
    return {
        "requests": [
            {
                "image": {"content": image_base64},
                "features": [
                    {"type": "TEXT_DETECTION", "maxResults": 50}
                ],
                "imageContext": {
                    "languageHints": ["ja", "en"]
                },
            }
        ]
    }


def _extract_text_blocks(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract individual text blocks with bounding boxes from Vision API response.

    Returns a list of dicts:
    {
        "text": "recognized text",
        "bbox": {"x": int, "y": int, "width": int, "height": int},
        "confidence": float  (0.0 - 1.0, if available)
    }
    """
    annotations = response.get("responses", [{}])[0]

    # Full text for Gemini context
    full_text = ""
    full_text_annotation = annotations.get("fullTextAnnotation")
    if full_text_annotation:
        full_text = full_text_annotation.get("text", "")

    # Individual text blocks with bounding boxes
    text_annotations = annotations.get("textAnnotations", [])
    if not text_annotations:
        return []

    blocks = []
    # Skip first element (it's the entire text)
    for annotation in text_annotations[1:]:
        text = annotation.get("description", "")
        vertices = annotation.get("boundingPoly", {}).get("vertices", [])

        if not vertices or not text.strip():
            continue

        # Convert vertices to bbox {x, y, width, height}
        xs = [v.get("x", 0) for v in vertices]
        ys = [v.get("y", 0) for v in vertices]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)

        blocks.append({
            "text": text.strip(),
            "bbox": {
                "x": x_min,
                "y": y_min,
                "width": x_max - x_min,
                "height": y_max - y_min,
            },
        })

    return blocks


async def detect_text(image_base64: str) -> Dict[str, Any]:
    """
    Send image to Vision API and return OCR results.

    Args:
        image_base64: Base64-encoded image (without data URI prefix)

    Returns:
        {
            "full_text": "全テキスト",
            "blocks": [ { "text": "...", "bbox": {...} }, ... ]
        }
    """
    if not VISION_API_KEY:
        raise ValueError("GOOGLE_CLOUD_VISION_API_KEY is not set in .env")

    body = _build_request_body(image_base64)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            VISION_API_URL,
            params={"key": VISION_API_KEY},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract full text
    annotations = data.get("responses", [{}])[0]
    full_text_annotation = annotations.get("fullTextAnnotation")
    full_text = full_text_annotation.get("text", "") if full_text_annotation else ""

    blocks = _extract_text_blocks(data)

    return {
        "full_text": full_text,
        "blocks": blocks,
    }
