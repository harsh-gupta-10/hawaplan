import { Info } from "lucide-react";
import { formatTime, type Forecast } from "../shared/planner";

export default function AirChart({
  forecast,
  selectedTime,
}: {
  forecast: Forecast;
  selectedTime?: string;
}) {
  const points = forecast.hours
    .filter((point) => point.time >= forecast.currentTime)
    .slice(0, 12);
  if (points.length < 2)
    return <p className="chart-empty">Not enough forecast points yet.</p>;
  const max = Math.max(50, ...points.map((point) => point.pm25)) * 1.2;
  const x = (index: number) => 30 + index * (624 / (points.length - 1));
  const y = (pm25: number) => 165 - (pm25 / max) * 130;
  const line = points
    .map((point, index) => `${x(index)},${y(point.pm25)}`)
    .join(" ");
  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <div>
          <span className="eyebrow">NEXT 12 HOURS</span>
          <h3>Air quality outlook</h3>
        </div>
        <span className="chart-unit">Modeled PM₂.₅ · µg/m³</span>
      </div>
      <div className="chart-scroll">
        <svg
          className="chart"
          viewBox="0 0 684 192"
          role="img"
          aria-label="Modeled outdoor PM2.5 for the next 12 hours"
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
          {points.map((point, index) => (
            <g key={point.time}>
              <circle
                cx={x(index)}
                cy={y(point.pm25)}
                r={point.time === selectedTime ? 6.5 : 3.5}
                fill={point.time === selectedTime ? "#174b35" : "#648c58"}
              />
              <title>
                {formatTime(point.time)}: {point.pm25} µg/m³
              </title>
            </g>
          ))}
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
        <Info size={14} /> A broad-area forecast. Air on a particular street or
        inside a home may differ.
      </p>
    </div>
  );
}
