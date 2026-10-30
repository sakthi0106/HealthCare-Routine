import { ArrowRightIcon } from "./icons";

// The primary call to action, repeated right after the testimonials.
export default function CtaBand() {
  return (
    <section className="lp-cta-band" aria-labelledby="cta-title">
      <div className="lp-container lp-cta-inner">
        <div>
          <h2 id="cta-title">Ready for a calmer visit?</h2>
          <p>Choose a time that suits you and we will confirm it personally.</p>
        </div>
        <a className="lp-btn lp-btn-cta" href="#booking">Book a visit <ArrowRightIcon size={20} /></a>
      </div>
    </section>
  );
}
