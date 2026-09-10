import React from 'react';

export default function WindCompass({ direction }) {
  if (direction === null || isNaN(direction)) return null;

  return (
    <div className="ps-wind-compass-container">
      <div className="ps-weather-chart-title">Wind Direction</div>
      <div className="ps-wind-compass">
        <div className="ps-wind-compass__circle">
          <span className="ps-wind-compass__n">N</span>
          <span className="ps-wind-compass__e">E</span>
          <span className="ps-wind-compass__s">S</span>
          <span className="ps-wind-compass__w">W</span>
          <div 
            className="ps-wind-compass__arrow" 
            style={{ transform: `translate(-50%, -50%) rotate(${direction}deg)` }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L12 22" />
              <path d="M12 2L6 8" />
              <path d="M12 2L18 8" />
            </svg>
          </div>
        </div>
        <div className="ps-wind-compass__val">{direction}°</div>
      </div>
    </div>
  );
}
