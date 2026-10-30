import { lazy, Suspense } from "react";

// The chart library is large, so it is only downloaded when a chart is actually shown (the father's screens never load it).
const PlotlyChart = lazy(() => import("./PlotlyChart"));

export default function LiveChart(props) {
  return (
    <Suspense fallback={<p className="center muted" style={{ minHeight: props.height || 300 }}>Loading chart…</p>}>
      <PlotlyChart {...props} />
    </Suspense>
  );
}
