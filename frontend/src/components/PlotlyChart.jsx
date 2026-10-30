import factoryModule from "react-plotly.js/factory";
import PlotlyModule from "plotly.js";
import useThemeColors from "../hooks/useThemeColors";

// (the two "|| ..." lines make the imports work in both development and the production build)
const createPlotlyComponent = factoryModule.default || factoryModule;
const Plotly = PlotlyModule.default || PlotlyModule;
const Plot = createPlotlyComponent(Plotly);

const FONT = "system-ui, 'Segoe UI', Roboto, Arial, sans-serif";

// An interactive chart: hover for details, drag to zoom, double-click to reset, click the legend to hide a series.
export default function PlotlyChart({ data, layout = {}, height = 300 }) {
  const c = useThemeColors();
  const merged = {
    autosize: true,
    height,
    uirevision: "keep", // keeps the user's zoom and hidden series when live data refreshes
    margin: { l: 52, r: 18, t: 12, b: 56 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: FONT, size: 13, color: c.text },
    hoverlabel: { font: { family: FONT, size: 14 } },
    legend: { orientation: "h", x: 0, y: -0.28 },
    ...layout,
    xaxis: { gridcolor: c.grid, zerolinecolor: c.grid, ...layout.xaxis },
    yaxis: { gridcolor: c.grid, zerolinecolor: c.grid, ...layout.yaxis },
  };
  if (layout.yaxis2) merged.yaxis2 = { gridcolor: c.grid, ...layout.yaxis2 };

  return (
    <Plot
      data={data}
      layout={merged}
      config={{ responsive: true, displaylogo: false, scrollZoom: false, modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] }}
      useResizeHandler
      style={{ width: "100%", height }}
    />
  );
}
