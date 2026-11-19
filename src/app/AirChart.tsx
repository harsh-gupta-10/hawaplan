import { useState } from "react";
import { Info } from "lucide-react";
import { formatTime, type Forecast } from "../shared/planner";

type PollutantMetric = "pm25" | "pm10" | "aqi";

interface AirChartProps {
  forecast: Forecast;
  selectedTime?: string;
}

export default function AirChart({ forecast, selectedTime }: AirChartProps) {
  const [metric, setMetric] = useState<PollutantMetric>("pm25");

  const points = forecast.hours
    .filter((point) => point.time >= forecast.currentTime)
    .slice(0, 12);

  if (points.length < 2)
    return <p className="chart-empty">Not enough forecast points yet.</p>;

  const getPointValue = (point: (typeof points)[0]): number => {
    switch (metric) {
      case "pm25":
        return point.pm25;
      case "pm10":
        return point.pm10;
      case "aqi":
        return point.aqi ?? point.pm25;
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case "pm25":
        return "Modeled PM₂.₅ · µg/m³";
      case "pm10":
        return "Modeled PM₁₀ · µg/m³";
      case "aqi":
        return "US Air Quality Index (AQI)";
    }
  };

  const values = points.map(getPointValue);
  const max = Math.max(50, ...values) * 1.2;
  const x = (index: number) => 30 + index * (624 / (points.length - 1));
  const y = (val: number) => 165 - (val / max) * 130;
  const line = points
    .map((point, index) => `${x(index)},${y(getPointValue(point))}`)
    .join(" ");

  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <div>
          <span className="eyebrow">NEXT 12 HOURS</span>
          <h3>Air quality outlook</h3>
        </div>
        <div className="chart-controls">
          <div
            className="metric-toggle"
            role="group"
            aria-label="Select pollutant view"
          >
            <button
              type="button"
              className={metric === "pm25" ? "active" : ""}
              onClick={() => setMetric("pm25")}
              aria-pressed={metric === "pm25"}
            >
              PM₂.₅
            </button>
            <button
              type="button"
              className={metric === "pm10" ? "active" : ""}
              onClick={() => setMetric("pm10")}
              aria-pressed={metric === "pm10"}
            >
              PM₁₀
            </button>
            <button
              type="button"
              className={metric === "aqi" ? "active" : ""}
              onClick={() => setMetric("aqi")}
              aria-pressed={metric === "aqi"}
            >
              US AQI
            </button>
          </div>
          <span className="chart-unit">{getMetricLabel()}</span>
        </div>
      </div>

      {/* Screen-reader accessible data table for 100% a11y compliance */}
      <div className="sr-only">
        <table>
          <caption>12-hour air quality forecast for {forecast.city}</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">PM2.5 (µg/m³)</th>
              <th scope="col">PM10 (µg/m³)</th>
              <th scope="col">US AQI</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.time}>
                <td>{formatTime(point.time)}</td>
                <td>{point.pm25}</td>
                <td>{point.pm10}</td>
                <td>{point.aqi ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chart-scroll">
        <svg
          className="chart"
          viewBox="0 0 684 192"
          role="img"
          aria-label={`Visual chart of ${getMetricLabel()} for the next 12 hours`}
        >
          <defs>
            <linearGradient id="airArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c2dd91" stopOpacity=".55" />
              <stop offset="1" stopColor="#c2dd91" stopOpacity=".03" />
            </linearGradient>
          </defs>
          {[55, 110, 165].map((gridY) => (
            <line
              key={gridY}
              x1="30"
              x2="654"
              y1={gridY}
              y2={gridY}
              stroke="#e8ede5"
              strokeDasharray="4 5"
            />
          ))}
          <polygon points={`30,165 ${line} 654,165`} fill="url(#airArea)" />
          <polyline
            points={line}
            fill="none"
            stroke="#4d784b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => {
            const val = getPointValue(point);
            const isSelected = point.time === selectedTime;
            return (
              <g key={point.time}>
                <circle
                  cx={x(index)}
                  cy={y(val)}
                  r={isSelected ? 6.5 : 3.5}
                  fill={isSelected ? "#174b35" : "#648c58"}
                />
                <title>
                  {formatTime(point.time)}: {val}{" "}
                  {metric === "aqi" ? "AQI" : "µg/m³"}
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="chart-axis">
        {points
          .filter((_, index) => index % 2 === 0)
          .map((point) => (
            <span key={point.time}>
              {formatTime(point.time).replace(":00", "")}
            </span>
          ))}
      </div>

      <p className="chart-note">
        <Info size={14} aria-hidden="true" /> A broad-area forecast. Air on a
        particular street or inside a home may differ.
      </p>
    </div>
  );
}
