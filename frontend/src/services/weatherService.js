/**
 * Weather Service — Antarctic Weather Data Integration
 */

const WEATHER_INTEGRATION_ENABLED = true;

// Pre-load data asynchronously so it doesn't block the main thread initially
let cachedWeatherData = null;

function normalizeValue(val) {
  if (val === -999 || val === '-999' || val === null || val === undefined) {
    return null;
  }
  return Number(val);
}

export async function fetchWeatherData(stationId, timeRange = '24H') {
  if (!WEATHER_INTEGRATION_ENABLED) return null;

  if (!cachedWeatherData) {
    try {
      const module = await import('../data/maitri_weather_2016.json');
      cachedWeatherData = module.default;
    } catch (e) {
      console.error("Failed to load weather data", e);
      return null;
    }
  }

  const rawData = cachedWeatherData;

  // Process data
  const processed = rawData.map(d => {
    // Basic parse assuming UTC
    const dateStr = d.obstime.replace(' ', 'T') + 'Z';
    return {
      timestamp: d.obstime, // Raw timestamp
      date: new Date(dateStr),
      temperature: normalizeValue(d.tempr),
      pressure: normalizeValue(d.ap),
      windSpeed: normalizeValue(d.ws),
      windDirection: normalizeValue(d.wd),
      humidity: normalizeValue(d.rh)
    };
  }).filter(d => !isNaN(d.date.getTime()));

  // Sort descending by time to find current
  processed.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Current conditions = first valid entry
  let current = null;
  for (const entry of processed) {
    if (entry.temperature !== null) {
      current = entry;
      break;
    }
  }
  if (!current) current = processed[0];

  // Filter by time range
  const latestTime = processed[0].date.getTime();
  let timeLimit = 0;
  if (timeRange === '24H') timeLimit = latestTime - 24 * 60 * 60 * 1000;
  else if (timeRange === '7D') timeLimit = latestTime - 7 * 24 * 60 * 60 * 1000;
  else if (timeRange === '30D') timeLimit = latestTime - 30 * 24 * 60 * 60 * 1000;
  else timeLimit = 0; // 'All'

  let filtered = processed.filter(d => d.date.getTime() >= timeLimit);
  // Sort ascending for charts
  filtered.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Downsample to max ~150 points for charts
  let downsampled = [];
  if (filtered.length > 150) {
    const step = Math.ceil(filtered.length / 150);
    for (let i = 0; i < filtered.length; i += step) {
      downsampled.push(filtered[i]);
    }
    // ensure the latest point is included
    if (filtered[filtered.length - 1] !== downsampled[downsampled.length - 1]) {
      downsampled.push(filtered[filtered.length - 1]);
    }
  } else {
    downsampled = filtered;
  }

  // Compute stats
  const temps = filtered.map(d => d.temperature).filter(v => v !== null);
  const winds = filtered.map(d => d.windSpeed).filter(v => v !== null);
  const pressures = filtered.map(d => d.pressure).filter(v => v !== null);
  const hums = filtered.map(d => d.humidity).filter(v => v !== null);

  const stats = {
    tempMin: temps.length ? Math.min(...temps) : null,
    tempMax: temps.length ? Math.max(...temps) : null,
    tempAvg: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    windMax: winds.length ? Math.max(...winds) : null,
    pressureAvg: pressures.length ? pressures.reduce((a, b) => a + b, 0) / pressures.length : null,
    humidityAvg: hums.length ? hums.reduce((a, b) => a + b, 0) / hums.length : null,
  };

  return {
    station: 'Maitri',
    source: 'AWS 2016',
    current,
    history: downsampled, // for charts
    stats,
    allObservations: filtered // available if needed for anomaly engine
  };
}

export default { fetchWeatherData };
