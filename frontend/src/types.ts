export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface MenuItem {
  name_jp: string;
  name_en: string;
  description_en?: string;
  price_jpy?: number | null;
  allergens: string[];
  confidence: Confidence;
  bbox: BBox;
}

export type Currency = 'USD' | 'EUR' | 'GBP';
export type CurrencySymbol = '$' | '€' | '£';
