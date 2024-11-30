import mbxClient from '@mapbox/mapbox-sdk';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

if (!process.env.MAPBOX_ACCESS_TOKEN) {
  throw new Error('MAPBOX_ACCESS_TOKEN environment variable is required');
}

const baseClient = mbxClient({ accessToken: process.env.MAPBOX_ACCESS_TOKEN });
export const geocodingService = mbxGeocoding(baseClient);

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  place_formatted: string;
  full_address?: string;
  mapbox_id?: string;
  match_code?: any;
  timezone?: string;
  metadata?: any;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await geocodingService.forwardGeocode({
      query: address,
      limit: 1,
      types: ['address']
    }).send();

    const [feature] = response.body.features;
    
    if (!feature) {
      return null;
    }

    return {
      latitude: feature.center[1],
      longitude: feature.center[0],
      formatted_address: feature.place_name,
      place_formatted: feature.place_name,
      full_address: feature.place_name,
      mapbox_id: feature.id,
      match_code: feature.properties?.accuracy || null,
      timezone: null,
      metadata: feature.properties
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
