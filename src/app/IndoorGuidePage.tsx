import {
  ArrowUpRight,
  BookOpen,
  House,
  Info,
  ShieldCheck,
  Wind,
} from "lucide-react";

export default function IndoorGuidePage() {
  return (
    <div className="page-content secondary-page">
      <div className="breadcrumb">
        PRACTICAL GUIDE <span>/</span> AT HOME
      </div>
      <h1>
        Make home a <em>cleaner space.</em>
      </h1>
      <p className="page-intro">
        Outdoor pollution can enter buildings, while cooking and other indoor
        sources can add to it. Start with what fits your home and budget.
      </p>
      <div className="guide-grid">
        <article className="guide-card">
          <span className="guide-num">01</span>
          <div className="guide-icon">
            <House size={25} />
          </div>
          <h2>Cut smoke at the source</h2>
          <p>
            Avoid indoor smoking and burning incense or candles when possible.
            These add particles indoors, even when windows are closed.
          </p>
          <span className="guide-tag">LOW COST</span>
        </article>
        <article className="guide-card">
          <span className="guide-num">02</span>
          <div className="guide-icon">
            <Wind size={25} />
          </div>
          <h2>Manage cooking air</h2>
          <p>
            Use a kitchen exhaust that vents outdoors if available. Cleaner
            cooking fuels and technologies reduce pollution at the source.
          </p>
          <span className="guide-tag">EVERYDAY HABIT</span>
        </article>
        <article className="guide-card">
          <span className="guide-num">03</span>
          <div className="guide-icon">
            <ShieldCheck size={25} />
          </div>
          <h2>Know what a filter does</h2>
          <p>
            A correctly sized portable air cleaner may help some households.
            Check its filter and room rating; it does not remove every
            pollutant.
          </p>
          <span className="guide-tag">IF AVAILABLE</span>
        </article>
      </div>
      <div className="guide-callout">
        <Info size={21} />
        <div>
          <strong>There is no one perfect window rule.</strong>
          <p>
            Ventilation choices depend on outdoor conditions and indoor sources.
            HawaPlan cannot know indoor air quality without an indoor sensor.
          </p>
        </div>
      </div>
      <div className="source-list">
        <h3>Evidence behind this guide</h3>
        <a
          href="https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen size={17} /> WHO: Personal interventions and risk
          communication <ArrowUpRight size={16} />
        </a>
        <a
          href="https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen size={17} /> WHO: Household air pollution{" "}
          <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}
