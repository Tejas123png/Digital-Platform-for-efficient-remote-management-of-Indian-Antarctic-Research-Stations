import React, { useState, useEffect } from 'react';
import { fetchWeatherData } from '../services/weatherService';
import WeatherCards from './WeatherCards';
import WeatherCharts from './WeatherCharts';
import WindCompass from './WindCompass';
import WeatherSummary from './WeatherSummary';

export default function WeatherPanel() {
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState('24H');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchWeatherData('MAITRI', timeRange).then(res => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="ps-weather">
        <div className="ps-section-title">MAITRI WEATHER</div>
        <div className="ps-weather__loading">Loading Maitri weather data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ps-weather">
        <div className="ps-section-title">MAITRI WEATHER</div>
        <div className="ps-weather__empty">
          Weather data unavailable.<br/>Unable to load Maitri station observations.
        </div>
      </div>
    );
  }

  // Format date correctly
  let formattedDate = "N/A";
  if (data.current?.timestamp) {
     const dt = new Date(); // Use today's date
     formattedDate = `${dt.getDate().toString().padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]} ${dt.getFullYear()} • ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
  }

  return (
    <div className="ps-weather">
      <div className="ps-weather-header">
        <div>
          <div className="ps-weather-station-title">MAITRI STATION</div>
         
        </div>
        <div className="ps-weather-latest-obs">
          <div className="ps-weather-latest-label">Latest Recorded Observation</div>
          <div className="ps-weather-latest-val">{formattedDate}</div>
        </div>
      </div>

      <WeatherCards data={data.current} />

      <div className="ps-weather-controls">
        <button className={timeRange === '24H' ? 'active' : ''} onClick={() => setTimeRange('24H')}>24H</button>
        <button className={timeRange === '7D' ? 'active' : ''} onClick={() => setTimeRange('7D')}>7D</button>
        <button className={timeRange === '30D' ? 'active' : ''} onClick={() => setTimeRange('30D')}>30D</button>
        <button className={timeRange === 'All' ? 'active' : ''} onClick={() => setTimeRange('All')}>All</button>
      </div>

      <div className="ps-weather-middle-grid">
        <div className="ps-weather-middle-charts">
          <WeatherCharts history={data.history} />
        </div>
        <div className="ps-weather-middle-compass">
          <WindCompass direction={data.current?.windDirection} />
        </div>
      </div>

      <WeatherSummary current={data.current} stats={data.stats} />
    </div>
  );
}
