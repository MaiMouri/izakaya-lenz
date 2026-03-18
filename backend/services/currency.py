"""Frankfurter API integration for real-time currency conversion."""

from typing import Dict, Optional

import httpx

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"

# Module-level cache (refreshed per server restart)
_rate_cache: Dict[str, float] = {}


async def get_exchange_rates(base: str = "JPY") -> Dict[str, float]:
    """
    Fetch latest exchange rates from Frankfurter API.

    Returns:
        {"USD": 0.0067, "EUR": 0.0062, "GBP": 0.0053, ...}
    """
    global _rate_cache
    if _rate_cache:
        return _rate_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            FRANKFURTER_URL,
            params={"base": base, "symbols": "USD,EUR,GBP"},
        )
        resp.raise_for_status()
        data = resp.json()

    _rate_cache = data.get("rates", {})
    return _rate_cache


def convert_jpy(amount_jpy: Optional[int], rates: Dict[str, float]) -> Dict[str, Optional[float]]:
    """Convert JPY amount to multiple currencies."""
    if amount_jpy is None:
        return {"USD": None, "EUR": None, "GBP": None}

    return {
        currency: round(amount_jpy * rate, 2)
        for currency, rate in rates.items()
    }
