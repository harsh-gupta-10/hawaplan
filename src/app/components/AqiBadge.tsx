import { AlertTriangle, CheckCircle, ShieldAlert, Wind } from "lucide-react";
import type { AqiCategory } from "../../shared/planner";

interface AqiBadgeProps {
  aqiCategory: AqiCategory;
  showAdvisory?: boolean;
}

export default function AqiBadge({
  aqiCategory,
  showAdvisory = true,
}: AqiBadgeProps) {
  const getIcon = () => {
    switch (aqiCategory.level) {
      case "good":
        return <CheckCircle size={14} aria-hidden="true" />;
      case "moderate":
        return <Wind size={14} aria-hidden="true" />;
      case "sensitive":
      case "unhealthy":
        return <AlertTriangle size={14} aria-hidden="true" />;
      case "very_unhealthy":
      case "hazardous":
        return <ShieldAlert size={14} aria-hidden="true" />;
    }
  };

  return (
    <div
      className={`aqi-badge-container aqi-${aqiCategory.level}`}
      style={{
        backgroundColor: aqiCategory.bgColor,
        borderColor: aqiCategory.color,
      }}
      role="region"
      aria-label={`Air quality category: ${aqiCategory.label}`}
    >
      <div className="aqi-badge-header" style={{ color: aqiCategory.color }}>
        {getIcon()}
        <strong>{aqiCategory.label}</strong>
      </div>
      {showAdvisory && (
        <p className="aqi-badge-advisory" style={{ color: aqiCategory.color }}>
          {aqiCategory.advisory}
        </p>
      )}
    </div>
  );
}
