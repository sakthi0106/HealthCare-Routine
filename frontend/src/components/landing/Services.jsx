import { SERVICES } from "./landingContent";
import { ICONS } from "./icons";

export default function Services() {
  return (
    <section className="lp-section" id="services" aria-labelledby="services-title">
      <div className="lp-container">
        <p className="lp-eyebrow">What we offer</p>
        <h2 id="services-title">Services made around you</h2>
        <div className="lp-grid">
          {SERVICES.map(({ icon, title, text }) => {
            const Icon = ICONS[icon];
            return (
              <article className="lp-card" key={title}>
                <span className="lp-icon-circle">{Icon && <Icon size={26} />}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
