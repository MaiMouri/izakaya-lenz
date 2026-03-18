"""Gemini 2.0 Flash integration for menu structuring, translation, and allergen estimation."""

import json
import os
from typing import Any, Dict, List

from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """\
You are a Japanese izakaya menu translator for foreign tourists.

Given OCR text and bounding boxes from a hand-written izakaya menu photo,
you must:
1. Identify individual menu items (dish name + price).
2. Group related text blocks (a dish name and its price may be separate blocks).
3. Translate each dish name into natural, descriptive English (not literal).
4. Write a 2-3 sentence English description (ingredients, cooking method, taste).
5. Estimate common allergens from this list:
   Wheat, Soy, Egg, Milk, Shellfish, Fish, Peanut, Tree Nuts, Sesame, Buckwheat
6. Assign a confidence level: "high", "medium", or "low" based on OCR clarity.
7. Return the bounding box that best covers the dish name on the photo.

IMPORTANT:
- Prices are typically in yen (¥). Look for numbers like 480, 580, ¥480 etc.
- Some items may not have visible prices.
- If OCR text is unclear, still attempt translation but set confidence to "low".
- Return ONLY valid JSON, no markdown fences.
"""

USER_PROMPT_TEMPLATE = """\
Here is the OCR result from a hand-written izakaya menu.

== Full OCR Text ==
{full_text}

== Text Blocks with Bounding Boxes ==
{blocks_json}

Analyze this menu and return a JSON object with this exact structure:
{{
  "items": [
    {{
      "name_jp": "Japanese dish name",
      "name_en": "Descriptive English name",
      "description_en": "2-3 sentence description of the dish",
      "price_jpy": 480,
      "allergens": ["Soy", "Wheat"],
      "confidence": "high",
      "bbox": {{"x": 120, "y": 340, "width": 180, "height": 36}}
    }}
  ]
}}

Rules:
- price_jpy should be an integer or null if not found
- allergens should be an array (empty if none suspected)
- bbox should use the coordinates from the OCR blocks that best match each dish name
- Return ONLY the JSON object, nothing else
"""


def _get_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in .env")
    return genai.Client(api_key=GEMINI_API_KEY)


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    return cleaned.strip()


async def structure_menu(
    full_text: str,
    blocks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Send OCR results to Gemini for menu structuring and translation.

    Args:
        full_text: Full OCR text from Vision API
        blocks: Text blocks with bounding boxes

    Returns:
        {
            "items": [
                {
                    "name_jp": str,
                    "name_en": str,
                    "description_en": str,
                    "price_jpy": int | None,
                    "allergens": list[str],
                    "confidence": str,
                    "bbox": {"x": int, "y": int, "width": int, "height": int}
                }
            ]
        }
    """
    client = _get_client()

    user_prompt = USER_PROMPT_TEMPLATE.format(
        full_text=full_text,
        blocks_json=json.dumps(blocks, ensure_ascii=False, indent=2),
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {"role": "user", "parts": [{"text": user_prompt}]},
        ],
        config={
            "system_instruction": SYSTEM_PROMPT,
            "temperature": 0.2,
            "max_output_tokens": 16384,
            "response_mime_type": "application/json",
        },
    )

    raw_text = response.text
    finish_reason = None
    if response.candidates:
        finish_reason = response.candidates[0].finish_reason
    print(f"[gemini] finish_reason={finish_reason}, response length={len(raw_text)} chars")
    if finish_reason and str(finish_reason) not in ("FinishReason.STOP", "STOP", "1"):
        print(f"[gemini] WARNING: unexpected finish_reason={finish_reason!r} — response may be truncated")
    print(raw_text[:500])

    result = _parse_gemini_response(raw_text)

    # Validate structure
    if "items" not in result:
        result = {"items": []}

    return result
