import React from 'react';

export default function WeatherSummary({ current, stats }) {
  if (!stats) return null;

  return (
    <div className="ps-weather-summary">
      <div className="ps-section-title">WEATHER SUMMARY</div>
      <div className="ps-weather-summary__grid">
        <div className="ps-weather-summary__col">
          <div className="ps-weather-summary__header">Temperature</div>
          <div className="ps-weather-summary__row"><span>Current</span> <span>{current.temperature?.toFixed(1) ?? 'N/A'} °C</span></div>
          <div className="ps-weather-summary__row"><span>Min</span> <span>{stats.tempMin?.toFixed(1) ?? 'N/A'} °C</span></div>
          <div className="ps-weather-summary__row"><span>Max</span> <span>{stats.tempMax?.toFixed(1) ?? 'N/A'} °C</span></div>
          <div className="ps-weather-summary__row"><span>Average</span> <span>{stats.tempAvg?.toFixed(1) ?? 'N/A'} °C</span></div>
        </div>
        <div className="ps-weather-summary__col">
          <div className="ps-weather-summary__header">Wind</div>
          <div className="ps-weather-summary__row"><span>Current</span> <span>{current.windSpeed?.toFixed(1) ?? 'N/A'} km/h</span></div>
          <div className="ps-weather-summary__row"><span>Maximum</span> <span>{stats.windMax?.toFixed(1) ?? 'N/A'} km/h</span></div>
        </div>
        <div className="ps-weather-summary__col">
          <div className="ps-weather-summary__header">Pressure</div>
          <div className="ps-weather-summary__row"><span>Current</span> <span>{current.pressure?.toFixed(1) ?? 'N/A'} hPa</span></div>
          <div className="ps-weather-summary__row"><span>Average</span> <span>{stats.pressureAvg?.toFixed(1) ?? 'N/A'} hPa</span></div>
        </div>
        <div className="ps-weather-summary__col">
          <div className="ps-weather-summary__header">Humidity</div>
          <div className="ps-weather-summary__row"><span>Current</span> <span>{current.humidity?.toFixed(0) ?? 'N/A'} %</span></div>
          <div className="ps-weather-summary__row"><span>Average</span> <span>{stats.humidityAvg?.toFixed(0) ?? 'N/A'} %</span></div>
        </div>
      </div>
    </div>
  );
}
