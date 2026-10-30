import { useEffect } from "react";
import Hero from "../components/landing/Hero";
import Services from "../components/landing/Services";
import Testimonials from "../components/landing/Testimonials";
import CtaBand from "../components/landing/CtaBand";
import Booking from "../components/landing/Booking";
import Contact from "../components/landing/Contact";
import { BRAND, CONTACT } from "../components/landing/landingContent";
import "../components/landing/landing.css";

// Section order: Hero, Services, Testimonials (+ repeated call to action), Booking, Contact.
export default function Landing() {
  // This page is light-only, whatever look the app is set to.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = "light";
    document.title = BRAND;
    return () => { if (previous) root.dataset.theme = previous; };
  }, []);

  // No server is needed: this opens the visitor's email app with the details filled in.
  // Replace with a call to your own API if you prefer.
  const sendBooking = (f) => {
    const body = [`Name: ${f.name}`, `Contact: ${f.contact}`, `Service: ${f.service}`, `Date: ${f.date}`, `Time: ${f.time || "any"}`, `Notes: ${f.notes || "-"}`].join("\n");
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Booking request: " + f.service)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="landing">
      <Hero />
      <main>
        <Services />
        <Testimonials />
        <CtaBand />
        <Booking onSubmit={sendBooking} />
        <Contact />
      </main>
    </div>
  );
}
