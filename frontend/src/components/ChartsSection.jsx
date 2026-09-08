import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const CHART_COLORS = {
  blue:   '#58a6ff',
  green:  '#3fb950',
  amber:  '#d29922',
  purple: '#bc8cff',
};

function buildChartConfig(labels, datasets, title) {
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#8b949e',
            font: { family: 'Inter', size: 10 },
            boxWidth: 10,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: '#1c2128',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          bodyFont: { family: 'JetBrains Mono', size: 11 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8b949e', font: { size: 9 }, maxTicksLimit: 6, maxRotation: 0 },
          grid: { color: '#21262d' },
        },
        y: {
          ticks: { color: '#8b949e', font: { size: 9 } },
          grid: { color: '#21262d' },
        },
      },
      elements: {
        point: { radius: 0, hoverRadius: 3 },
        line:  { tension: 0.3, borderWidth: 1.5 },
      },
    },
  };
}

function LineChart({ config }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.data.labels = config.data.labels;
    config.data.datasets.forEach((ds, i) => {
      if (chartRef.current.data.datasets[i]) {
        chartRef.current.data.datasets[i].data = ds.data;
      }
    });
    chartRef.current.update('none');
  }, [config.data.labels, config.data.datasets]);

  return <canvas ref={canvasRef} />;
}

export default function ChartsSection({ history }) {
  const labels = history.map((d) => {
    const ts = d.timestamp?.split(' ')[1];
    return ts ? ts.slice(0, 5) : '';
  });

  const powerConfig = buildChartConfig(
    labels,
    [
      {
        label: 'Generation (kW)',
        data: history.map((d) => d.power_generation),
        borderColor: CHART_COLORS.green,
        backgroundColor: 'transparent',
      },
      {
        label: 'Consumption (kW)',
        data: history.map((d) => d.power_consumption),
        borderColor: CHART_COLORS.amber,
        backgroundColor: 'transparent',
      },
    ],
  );

  const healthConfig = buildChartConfig(
    labels,
    [
      {
        label: 'Generator Load (%)',
        data: history.map((d) => d.generator_load),
        borderColor: CHART_COLORS.blue,
        backgroundColor: 'transparent',
      },
      {
        label: 'Battery SOC (%)',
        data: history.map((d) => d.battery_soc),
        borderColor: CHART_COLORS.purple,
        backgroundColor: 'transparent',
      },
    ],
  );

  return (
    <>
      <div className="ps-bottom-section">
        <div className="ps-bottom-section__title">Power — Generation vs Consumption</div>
        <div className="ps-chart-wrap">
          <LineChart config={powerConfig} />
        </div>
      </div>

      <div className="ps-bottom-section">
        <div className="ps-bottom-section__title">Diagnostics — Load & Battery</div>
        <div className="ps-chart-wrap">
          <LineChart config={healthConfig} />
        </div>
      </div>
    </>
  );
}
