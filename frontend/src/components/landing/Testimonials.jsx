import { TESTIMONIALS } from "./landingContent";
import { StarIcon } from "./icons";

export default function Testimonials() {
  return (
    <section className="lp-section lp-section-tint" id="testimonials" aria-labelledby="testimonials-title">
      <div className="lp-container">
        <p className="lp-eyebrow">Kind words</p>
        <h2 id="testimonials-title">What our clients say</h2>
        <div className="lp-grid">
          {TESTIMONIALS.map((t, i) => (
            <figure className="lp-card lp-quote" key={i}>
              <div className="lp-stars" role="img" aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((n) => <StarIcon key={n} size={18} />)}
              </div>
              <blockquote>{t.quote}</blockquote>
              <figcaption><strong>{t.name}</strong><span>{t.detail}</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
