import { useState } from "react";
import { SERVICES } from "./landingContent";
import { CalendarIcon } from "./icons";

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// `onSubmit(details)` is called with the form values. Wire it to your own backend or email.
export default function Booking({ onSubmit }) {
  const [form, setForm] = useState({ name: "", contact: "", service: SERVICES[0].title, date: "", time: "", notes: "" });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSubmit?.(form);
    setSent(true);
  };

  return (
    <section className="lp-section" id="booking" aria-labelledby="booking-title">
      <div className="lp-container lp-booking">
        <div className="lp-booking-copy">
          <p className="lp-eyebrow">Book a visit</p>
          <h2 id="booking-title">Choose a time that suits you</h2>
          <p>Tell us a little about what you need and when. We will get back to you to confirm.</p>
        </div>

        <form className="lp-form" onSubmit={submit} noValidate={false}>
          <div className="lp-field">
            <label htmlFor="b-name">Your name</label>
            <input id="b-name" className="lp-input" type="text" autoComplete="name" required value={form.name} onChange={set("name")} />
          </div>
          <div className="lp-field">
            <label htmlFor="b-contact">Phone or email</label>
            <input id="b-contact" className="lp-input" type="text" autoComplete="email" required value={form.contact} onChange={set("contact")} />
          </div>
          <div className="lp-field">
            <label htmlFor="b-service">Service</label>
            <select id="b-service" className="lp-input" value={form.service} onChange={set("service")}>
              {SERVICES.map((s) => <option key={s.title}>{s.title}</option>)}
            </select>
          </div>
          <div className="lp-row">
            <div className="lp-field">
              <label htmlFor="b-date">Preferred date</label>
              <input id="b-date" className="lp-input" type="date" min={todayISO()} required value={form.date} onChange={set("date")} />
            </div>
            <div className="lp-field">
              <label htmlFor="b-time">Preferred time</label>
              <input id="b-time" className="lp-input" type="time" value={form.time} onChange={set("time")} />
            </div>
          </div>
          <div className="lp-field">
            <label htmlFor="b-notes">Anything we should know? (optional)</label>
            <textarea id="b-notes" className="lp-input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
          <button className="lp-btn lp-btn-cta lp-btn-block" type="submit"><CalendarIcon size={20} /> Request this time</button>
          {sent && <p className="lp-success" role="status">Thank you. Your request is ready to send. We will confirm your visit shortly.</p>}
        </form>
      </div>
    </section>
  );
}
