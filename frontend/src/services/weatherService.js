/**
 * Weather Service — Future Integration Stub
 *
 * This service is prepared for future Antarctic weather data integration.
 * Currently returns null (no data) — the WeatherPanel displays a placeholder.
 *
 * FUTURE INTEGRATION SPEC:
 * ─────────────────────────────────────────────────────────────────────
 * When implementing, connect to an Antarctic weather data source such as:
 *   - SCAR (Scientific Committee on Antarctic Research) weather API
 *   - WMO (World Meteorological Organization) Antarctic stations feed
 *   - BAS (British Antarctic Survey) meteorological service
 *   - Custom edge gateway transmitting local weather sensor readings
 *
 * Expected weather data shape:
 * {
 *   station: 'MAITRI',
 *   temperature_c: -12.4,       // Air temperature in Celsius
 *   wind_speed_kmh: 28,         // Wind speed in km/h
 *   wind_direction: 'SSW',      // Compass direction
 *   pressure_hpa: 988,          // Atmospheric pressure in hPa
 *   humidity_pct: 72,           // Relative humidity %
 *   visibility_km: 4.5,         // Visibility in km
 *   snowfall_mm: 0,             // Snowfall in mm (last 1h)
 *   condition: 'blizzard',      // e.g. clear, cloudy, snowing, blizzard
 *   wind_warning: true,         // Storm/wind advisory active
 *   updated_at: '2026-09-07T14:30:00Z',
 * }
 *
 * Architecture:
 *   Antarctic Weather API → fetchWeatherData() → App.jsx weatherData state → WeatherPanel
 *
 * Keep weatherData isolated from stationData.
 * Do NOT merge or compute weather metrics from station telemetry.
 * ─────────────────────────────────────────────────────────────────────
 */

const WEATHER_INTEGRATION_ENABLED = false; // Set to true when API is ready

/**
 * Fetch current Antarctic weather data for the given station.
 * @param {string} stationId - e.g. 'MAITRI' or 'BHARATI'
 * @returns {Promise<Object|null>} Weather data or null if not yet integrated
 */
export async function fetchWeatherData(stationId) {
  if (!WEATHER_INTEGRATION_ENABLED) {
    return null;
  }

  // TODO: Replace with real Antarctic weather API endpoint
  // const response = await fetch(`https://weather-api.example.com/antarctic/${stationId}`);
  // if (!response.ok) throw new Error('Weather API request failed');
  // return await response.json();

  return null;
}

export default { fetchWeatherData };
