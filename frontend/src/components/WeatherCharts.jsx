import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function WeatherCharts({ history }) {
  const tempChartRef = useRef(null);
  const windChartRef = useRef(null);
  const pressChartRef = useRef(null);
  const chartsRef = useRef({});

  useEffect(() => {
    if (!history || history.length === 0) return;

    const labels = history.map(d => {
      const dt = new Date(d.date);
      return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:00`;
    });
    
    const temps = history.map(d => d.temperature);
    const winds = history.map(d => d.windSpeed);
    const pressures = history.map(d => d.pressure);

    const makeChart = (ctx, label, data, color, yAxisLabel) => {
      if (chartsRef.current[label]) {
        chartsRef.current[label].destroy();
      }
      chartsRef.current[label] = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label,
            data,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 10,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false }
          },
          scales: {
            x: { 
              display: true, 
              ticks: { color: '#8b949e', maxTicksLimit: 6 },
              grid: { color: '#30363d' }
            },
            y: { 
              display: true, 
              title: { display: true, text: yAxisLabel, color: '#8b949e', font: { size: 10 } }, 
              ticks: { color: '#8b949e' },
              grid: { color: '#30363d' }
            }
          }
        }
      });
    };

    if (tempChartRef.current) makeChart(tempChartRef.current, 'Temperature', temps, '#58a6ff', '°C');
    if (windChartRef.current) makeChart(windChartRef.current, 'Wind Speed', winds, '#79c0ff', 'km/h');
    if (pressChartRef.current) makeChart(pressChartRef.current, 'Pressure', pressures, '#3fb950', 'hPa');

    return () => {
      Object.values(chartsRef.current).forEach(c => c.destroy());
    };
  }, [history]);

  return (
    <div className="ps-weather-charts">
      <div className="ps-weather-chart-box">
        <div className="ps-weather-chart-title">Temperature Trend</div>
        <div className="ps-weather-chart-canvas"><canvas ref={tempChartRef}></canvas></div>
      </div>
      <div className="ps-weather-chart-box">
        <div className="ps-weather-chart-title">Wind Speed Trend</div>
        <div className="ps-weather-chart-canvas"><canvas ref={windChartRef}></canvas></div>
      </div>
      <div className="ps-weather-chart-box">
        <div className="ps-weather-chart-title">Pressure Trend</div>
        <div className="ps-weather-chart-canvas"><canvas ref={pressChartRef}></canvas></div>
      </div>
    </div>
  );
}
