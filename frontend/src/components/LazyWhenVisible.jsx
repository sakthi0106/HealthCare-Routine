import { useEffect, useRef, useState } from "react";

// Shows its children only once they scroll into view, so the (large) chart code is not downloaded until it is needed.
export default function LazyWhenVisible({ children, minHeight = 260 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (seen) return undefined;
    if (!("IntersectionObserver" in window)) { setSeen(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen]);

  return <div ref={ref} style={{ minHeight: seen ? undefined : minHeight }}>{seen ? children : null}</div>;
}
