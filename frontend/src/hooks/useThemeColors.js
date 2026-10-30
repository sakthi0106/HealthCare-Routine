import { useEffect, useState } from "react";

const read = () => {
  const dark = document.documentElement.dataset.theme === "dark";
  return { text: getComputedStyle(document.body).color, grid: dark ? "rgba(255,255,255,.14)" : "rgba(20,40,70,.10)" };
};

// Gives charts the right text/grid colours and updates them when the Dark/Light button is pressed.
export default function useThemeColors() {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}
