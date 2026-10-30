import { HERO, TRUST } from "./landingContent";
import { ArrowRightIcon, HeartIcon, LeafIcon, ShieldIcon } from "./icons";

export default function Hero() {
  return (
    <header className="lp-hero" id="top">
      <div className="lp-container lp-hero-grid">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">{HERO.eyebrow}</p>
          <h1>{HERO.title}</h1>
          <p className="lp-lead">{HERO.text}</p>
          <div className="lp-actions">
            <a className="lp-btn lp-btn-cta" href="#booking">{HERO.cta} <ArrowRightIcon size={20} /></a>
            <a className="lp-btn lp-btn-ghost" href="#services">{HERO.secondary}</a>
          </div>
          <ul className="lp-chips" aria-label="Why people choose us">
            {TRUST.map((t) => (
              <li key={t}><ShieldIcon size={18} />{t}</li>
            ))}
          </ul>
        </div>

        <div className="lp-hero-art" aria-hidden="true">
          <span className="lp-blob lp-blob-pink" />
          <span className="lp-blob lp-blob-sage" />
          <span className="lp-ring" />
          <div className="lp-art-card"><HeartIcon size={44} /></div>
          <div className="lp-art-leaf"><LeafIcon size={34} /></div>
        </div>
      </div>
    </header>
  );
}
