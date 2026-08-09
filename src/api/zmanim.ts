import { apiRequest } from './client';

export interface ZmanimMethod {
  id: string;
  type: 'time' | 'duration_ms' | 'number';
  menu_ru?: string | null;
  title_ru?: string | null;
  category?: string | null;
  what_is_it_ru?: string | null;
  how_calculated_ru?: string | null;
  bounds_ru?: {
    start_ru?: string | null;
    end_ru?: string | null;
  } | null;
  returns?: {
    type?: 'time' | 'duration_ms' | 'number' | string | null;
    unit_ru?: string | null;
    meaning_ru?: string | null;
    error_value?: string | null;
    error_ru?: string | null;
  } | null;
  deprecated?: boolean | null;
  deprecated_ru?: string | null;
  attribution?: string | null;
  authors?: string[] | null;
  author_primary?: string | null;
  tags?: string[] | null;
}

export interface ZmanimMethodsResponse {
  methods: ZmanimMethod[];
}

export interface ZmanimCalculatePayload {
  date: string;
  timezone: string;
  location: {
    name?: string;
    lat: number;
    lon: number;
    elevation_m?: number | null;
  };
  methods: string[];
  use_elevation?: boolean;
  ateret_torah_sunset_offset?: number | null;
}

export interface ZmanimCalculateResponse {
  results: Record<string, string | number | null>;
  errors?: Record<string, string>;
}

export interface ElevationResponse {
  elevation_m: number | null;
  source?: string;
}

export async function getZmanimMethods(): Promise<ZmanimMethodsResponse> {
  return apiRequest<ZmanimMethodsResponse>('/zmanim/methods');
}

export async function calculateZmanim(payload: ZmanimCalculatePayload): Promise<ZmanimCalculateResponse> {
  return apiRequest<ZmanimCalculateResponse>('/zmanim/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getElevation(lat: number, lon: number): Promise<ElevationResponse> {
  return apiRequest<ElevationResponse>('/geo/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  });
}
