import React from 'react';

export default function WeatherCards({ data }) {
  if (!data) return <div className="ps-weather-empty">Some weather measurements are unavailable.</div>;

  return (
    <div className="ps-weather-cards">
      <div className="ps-weather-card">
        <div className="ps-weather-card__label">TEMP</div>
        <div className="ps-weather-card__val">
          {data.temperature !== null ? data.temperature.toFixed(1) : 'N/A'}
          <span className="ps-weather-card__unit">°C</span>
        </div>
      </div>
      <div className="ps-weather-card">
        <div className="ps-weather-card__label">HUMIDITY</div>
        <div className="ps-weather-card__val">
          {data.humidity !== null ? data.humidity.toFixed(0) : 'N/A'}
          <span className="ps-weather-card__unit">%</span>
        </div>
      </div>
      <div className="ps-weather-card">
        <div className="ps-weather-card__label">WIND</div>
        <div className="ps-weather-card__val">
          {data.windSpeed !== null ? data.windSpeed.toFixed(1) : 'N/A'}
          <span className="ps-weather-card__unit">km/h</span>
        </div>
      </div>
      <div className="ps-weather-card">
        <div className="ps-weather-card__label">PRESSURE</div>
        <div className="ps-weather-card__val">
          {data.pressure !== null ? data.pressure.toFixed(1) : 'N/A'}
          <span className="ps-weather-card__unit">hPa</span>
        </div>
      </div>
    </div>
  );
}
