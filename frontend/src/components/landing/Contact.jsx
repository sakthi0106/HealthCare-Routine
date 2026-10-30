import { BRAND, CONTACT } from "./landingContent";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";

export default function Contact() {
  const items = [
    { Icon: PhoneIcon, label: "Call us", value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
    { Icon: MailIcon, label: "Email us", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { Icon: MapPinIcon, label: "Find us", value: CONTACT.address },
    { Icon: ClockIcon, label: "Opening hours", value: CONTACT.hours },
  ];
  return (
    <section className="lp-section lp-section-tint" id="contact" aria-labelledby="contact-title">
      <div className="lp-container">
        <p className="lp-eyebrow">Get in touch</p>
        <h2 id="contact-title">We would love to hear from you</h2>
        <div className="lp-grid">
          {items.map(({ Icon, label, value, href }) => (
            <div className="lp-card lp-contact" key={label}>
              <span className="lp-icon-circle"><Icon size={24} /></span>
              <h3>{label}</h3>
              {href ? <a href={href}>{value}</a> : <p>{value}</p>}
            </div>
          ))}
        </div>
        <p className="lp-footer">© {new Date().getFullYear()} {BRAND}</p>
      </div>
    </section>
  );
}
