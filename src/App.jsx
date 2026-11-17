import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { area, polygon } from "@turf/turf";
import {
  HARYANA_RAINFALL,
  MONTHS,
  RAINFALL_SOURCE,
} from "./data/haryanaRainfall";
import { useEffect, useState } from "react";
import "./App.css";
function MapPlaceSearch() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState(null);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const searchPlace = async (event) => {
    event.preventDefault();
    const searchText = query.trim();
    if (!searchText || searching) return;
    setSearching(true);
    setMessage("");
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
        encodeURIComponent(searchText + ", Haryana, India");
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Search service unavailable");
      const results = await response.json();
      if (!results.length) {
        setPlace(null);
        setMessage("No matching place found. Try a nearby town or landmark.");
        return;
      }
      const result = results[0];
      const point = [Number(result.lat), Number(result.lon)];
      if (!point.every(Number.isFinite))
        throw new Error("Invalid location result");
      setPlace({ point, name: result.display_name });
      map.flyTo(point, 17, { duration: 1.2 });
      setMessage("Map centered on " + result.display_name);
    } catch {
      setMessage(
        "Could not search right now. Check your internet connection and try again.",
      );
    } finally {
      setSearching(false);
    }
  };
  return (
    <>
      <form
        className="map-search"
        onSubmit={searchPlace}
        onClick={(event) => event.stopPropagation()}
      >
        <label htmlFor="map-place-search">Find a place in Haryana</label>
        <div className="map-search-controls">
          <input
            id="map-place-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Town, address or landmark"
          />
          <button type="submit" disabled={searching || !query.trim()}>
            {searching ? "Searching…" : "Search map"}
          </button>
        </div>
        <p className="map-search-message" aria-live="polite">
          {message ||
            "Search once to center the map; click the map to mark roof corners."}
        </p>
        <small>
          Place search by OpenStreetMap Nominatim. Internet connection required.
        </small>
      </form>
      {place && (
        <CircleMarker
          center={place.point}
          radius={10}
          pathOptions={{
            color: "#b42318",
            fillColor: "#ef4444",
            fillOpacity: 0.9,
          }}
        >
          <Popup>{place.name}</Popup>
        </CircleMarker>
      )}
    </>
  );
}

function RoofMapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

const DEMO_STORAGE_KEY = "jalrakshak-demo-inputs";

const DEMO_DEFAULTS = {
  roofArea: 1637,
  district: "ROHTAK",
  coefficient: 0.8,
  firstFlush: 5,
  otherLoss: 10,
  dailyDemand: 5000,
  // Preserve the app's existing initial capacity; the conversation did not
  // establish 150,000 L as the user's selected baseline.
  tankCapacity: 150000,
  tankCost: 100000,
  pipeCost: 25000,
  filterCost: 15000,
  labourCost: 20000,
  annualMaintenance: 5000,
  waterTariff: 50,
};

function readDemoInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "{}");
    return { ...DEMO_DEFAULTS, ...saved };
  } catch {
    return DEMO_DEFAULTS;
  }
}

function useDemoInput(name) {
  const [value, setValue] = useState(() => readDemoInputs()[name]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "{}");
      localStorage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({ ...saved, [name]: value }),
      );
    } catch {
      // Keep the calculator usable if browser storage is unavailable.
    }
  }, [name, value]);
  return [value, setValue];
}
function App() {
  const [page, setPage] = useState("Dashboard");
  const [roofPoints, setRoofPoints] = useState([]);
  const mappedRoofArea =
    roofPoints.length >= 3
      ? area(
          polygon([
            [
              ...roofPoints.map(([lat, lng]) => [lng, lat]),
              [roofPoints[0][1], roofPoints[0][0]],
            ],
          ]),
        )
      : 0;

  const [roofArea, setRoofArea] = useDemoInput("roofArea");
  const [district, setDistrict] = useDemoInput("district");

  const monthlyRainfall = HARYANA_RAINFALL[district];

  const rainfall = monthlyRainfall.reduce((total, value) => total + value, 0);
  const [coefficient, setCoefficient] = useDemoInput("coefficient");
  const [firstFlush, setFirstFlush] = useDemoInput("firstFlush");
  const [otherLoss, setOtherLoss] = useDemoInput("otherLoss");
  const [dailyDemand, setDailyDemand] = useDemoInput("dailyDemand");
  const [tankCapacity, setTankCapacity] = useDemoInput("tankCapacity");
  // Editable example cost assumptions in INR
  const [tankCost, setTankCost] = useDemoInput("tankCost");
  const [pipeCost, setPipeCost] = useDemoInput("pipeCost");
  const [filterCost, setFilterCost] = useDemoInput("filterCost");
  const [labourCost, setLabourCost] = useDemoInput("labourCost");
  const [annualMaintenance, setAnnualMaintenance] =
    useDemoInput("annualMaintenance");
  const [waterTariff, setWaterTariff] = useDemoInput("waterTariff");
  const potentialRunoff = roofArea * rainfall * coefficient;

  const totalLoss = Math.min(firstFlush + otherLoss, 100);

  const usableWater = potentialRunoff * (1 - totalLoss / 100);

  const annualDemand = dailyDemand * 365;

  const coverage =
    annualDemand > 0 ? Math.min((usableWater / annualDemand) * 100, 100) : 0;
  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthlySimulation = monthlyRainfall.reduce(
    (simulation, rain, index) => {
      const monthlyInflow =
        roofArea * rain * coefficient * (1 - totalLoss / 100);
      const demand = dailyDemand * DAYS_IN_MONTH[index];
      const waterBeforeOverflow = simulation.storage + monthlyInflow;
      const overflow = Math.max(0, waterBeforeOverflow - tankCapacity);
      const availableWater = Math.min(waterBeforeOverflow, tankCapacity);
      const consumed = Math.min(availableWater, demand);
      const unmetDemand = demand - consumed;
      const endingStorage = availableWater - consumed;
      const monthResult = {
        month: MONTHS[index],
        inflow: monthlyInflow,
        demand,
        overflow,
        consumed,
        unmetDemand,
        endingStorage,
      };
      return {
        storage: endingStorage,
        rows: [...simulation.rows, monthResult],
      };
    },
    { storage: 0, rows: [] },
  ).rows;
  const formatNumber = (number) => Math.round(number).toLocaleString("en-IN");
  const annualWaterSupplied = monthlySimulation.reduce(
    (sum, month) => sum + month.consumed,
    0,
  );

  const totalInvestment = tankCost + pipeCost + filterCost + labourCost;

  const annualWaterSavings = (annualWaterSupplied / 1000) * waterTariff;

  const netAnnualSavings = annualWaterSavings - annualMaintenance;

  const paybackPeriod =
    netAnnualSavings > 0 ? totalInvestment / netAnnualSavings : null;

  const fiveYearNetBenefit = netAnnualSavings * 5 - totalInvestment;

  const fiveYearROI =
    totalInvestment > 0 ? (fiveYearNetBenefit / totalInvestment) * 100 : 0;

  const simulatedCoverage =
    annualDemand > 0
      ? Math.min((annualWaterSupplied / annualDemand) * 100, 100)
      : 0;
  const meetsWaterImpact = simulatedCoverage >= 25;
  const meetsFinancialScreen =
    netAnnualSavings > 0 && paybackPeriod !== null && paybackPeriod <= 10;
  const hasHarvestableSupply = annualWaterSupplied > 0;
  const recommendation =
    dailyDemand <= 0
      ? {
          label: "HOLD — ADD WATER DEMAND",
          tone: "hold",
          summary:
            "Enter a realistic daily water demand first. Without demand, the simulation cannot judge how useful the stored water would be.",
        }
      : !hasHarvestableSupply
        ? {
            label: "NO — NOT WITH THESE INPUTS",
            tone: "no",
            summary:
              "The current scenario shows no water supplied from the tank. Do not proceed with this design yet. Check the roof area, district rainfall, demand and tank capacity, then recalculate.",
          }
        : meetsWaterImpact && meetsFinancialScreen
          ? {
              label: "YES — GO FOR A PILOT",
              tone: "go",
              summary:
                "The scenario clears the demo's water impact and financial screens. Validate the assumptions and get a local design and quotation before committing to a full installation.",
            }
          : {
              label: "HOLD — NEED MORE INFO",
              tone: "hold",
              summary:
                "The model shows some water benefit, but one or more screening targets are missed. Adjust the design or verify the cost and tariff assumptions, then review the results again.",
            };
  const analysisPoints = [
    `Water impact: the model estimates ${formatNumber(annualWaterSupplied)} L/year supplied by the tank, equal to ${simulatedCoverage.toFixed(1)}% of entered annual demand. Demo screen: at least 25% coverage. ${meetsWaterImpact ? "Pass." : "Not met; consider a larger catchment, demand matching or a different storage design."}`,
    `Financial screen: estimated net savings are ₹${formatNumber(netAnnualSavings)}/year${paybackPeriod === null ? " and payback is not reached under the current inputs" : `, with ${paybackPeriod.toFixed(1)} years estimated payback`}. Demo target: positive net savings and payback within 10 years. ${meetsFinancialScreen ? "Pass." : "Not met; verify tariff and costs, compare tank sizes or treat this primarily as a water resilience project."}`,
    `Rainfall and roof estimate: ${rainfall.toFixed(1)} mm/year for ${district}, ${formatNumber(roofArea)} m² roof, and ${formatNumber(usableWater)} L/year estimated usable runoff before monthly tank limits. Rainfall is seasonal, so annual totals alone do not guarantee supply in every month.`,
    "Next step: confirm the roof measurements, local rainfall normal, actual water bill/tariff, installation quotation and monthly demand. Then ask a qualified local professional to verify the design before construction.",
  ];

  const alternativeSuggestions = !hasHarvestableSupply
    ? [
        "Recheck the district and roof inputs first. If the roof catchment is genuinely small or dry, prioritize leak repairs and water-efficient fixtures; compare greywater reuse only if the building plumbing and local rules support it.",
      ]
    : !meetsWaterImpact
      ? [
          "Demand reduction (repair leaks and fit efficient fixtures) may offer a more reliable first step at low estimated coverage.",
          "If the goal is groundwater recharge rather than stored reuse, ask a local groundwater or civil engineer whether a recharge structure is suitable for this soil, water quality and site; do not assume it is permitted or safe.",
        ]
      : !meetsFinancialScreen
        ? [
            "Compare a smaller modular tank sized to seasonal inflow and non-potable demand, and consider installing in phases after getting local quotations.",
            "If the main goal is reducing fresh-water demand, compare leak repair, efficient fixtures and appropriately designed greywater reuse. Recharge structures need a site and water-quality assessment.",
          ]
        : [
            "Proceed with a small, professionally checked pilot. Compare the tank with water-efficiency measures and, only if site conditions permit, a professionally designed recharge option.",
          ];

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>💧 JalRakshak</h2>
        <p className="tagline">Smart Water Planning</p>

        <nav>
          {[
            "Dashboard",
            "Water Calculator",
            "Roof Mapping",
            "Investment Simulator",
            "Reports",
          ].map((item) => (
            <a
              href="#"
              key={item}
              className={page === item ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                setPage(item);
              }}
            >
              {item}
            </a>
          ))}
        </nav>

        <p className="sidebar-footer">Environment & Sustainability</p>
      </aside>

      <main className="main">
        {page === "Dashboard" ? (
          <>
            <header className="topbar">
              <div>
                <h1>Water Dashboard</h1>
                <p>Plan smarter. Save every drop.</p>
              </div>
              <span className="location">📍 Rohtak, Haryana</span>
            </header>

            <section className="welcome">
              <div>
                <p className="eyebrow">WELCOME TO JALRAKSHAK</p>
                <h2>Turn your rooftop into a water resource.</h2>
                <p>
                  Estimate rainwater potential, explore harvesting options and
                  understand your investment.
                </p>
              </div>
              <div className="water-icon">💧</div>
            </section>

            <section className="section">
              <h2>Building Overview</h2>
              <div className="cards">
                <div className="card">
                  <span>Roof Area</span>
                  <h3>{roofArea} m²</h3>
                  <p>Entered value</p>
                </div>
                <div className="card">
                  <span>Annual Rainfall</span>
                  <h3>{rainfall} mm</h3>
                  <p>Entered value</p>
                </div>
                <div className="card">
                  <span>Potential Runoff</span>
                  <h3>{formatNumber(potentialRunoff)} L</h3>
                  <p>Before collection losses</p>
                </div>
                <div className="card">
                  <span>Usable Water</span>
                  <h3>{formatNumber(usableWater)} L</h3>
                  <p>After estimated losses</p>
                </div>
              </div>
            </section>

            <section className="section action-section">
              <h2>Get Started</h2>
              <p>
                Enter your building details to calculate its rainwater
                potential.
              </p>
              <button onClick={() => setPage("Water Calculator")}>
                Open Water Calculator →
              </button>
            </section>
          </>
        ) : page === "Water Calculator" ? (
          <>
            <header className="topbar">
              <div>
                <h1>Rainwater Calculator</h1>
                <p>Estimate your building's rainwater potential.</p>
              </div>
              <span className="location">📍 Rohtak, Haryana</span>
            </header>

            <section className="calculator-layout">
              <div className="calculator-panel">
                <h2>Building Details</h2>
                <p>Change the values to calculate your results.</p>

                <label>Roof area (m²)</label>
                <input
                  type="number"
                  min="0"
                  value={roofArea}
                  onChange={(e) =>
                    setRoofArea(Math.max(0, Number(e.target.value)))
                  }
                />

                <label>Haryana District</label>

                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  {Object.keys(HARYANA_RAINFALL)
                    .sort()
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>

                <p className="rainfall-source">
                  Annual normal rainfall: {rainfall.toFixed(1)} mm
                </p>

                <p className="rainfall-source">Source: {RAINFALL_SOURCE}</p>

                <div className="monthly-rainfall">
                  <h3>Monthly Rainfall Distribution</h3>

                  {MONTHS.map((month, index) => (
                    <div className="month-row" key={month}>
                      <span>{month}</span>

                      <div className="month-bar">
                        <div
                          style={{
                            width: `${
                              (monthlyRainfall[index] /
                                Math.max(...monthlyRainfall)) *
                              100
                            }%`,
                          }}
                        />
                      </div>

                      <strong>{monthlyRainfall[index]} mm</strong>
                    </div>
                  ))}
                </div>

                <label>Tank Storage Capacity (litres)</label>

                <input
                  type="number"
                  min="1"
                  value={tankCapacity}
                  onChange={(e) =>
                    setTankCapacity(Math.max(1, Number(e.target.value) || 1))
                  }
                />

                <p className="rainfall-source">
                  Change tank capacity to see overflow and water availability.
                </p>

                <label>Runoff coefficient</label>
                <select
                  value={coefficient}
                  onChange={(e) => setCoefficient(Number(e.target.value))}
                >
                  <option value="0.8">Concrete roof — 0.80</option>
                  <option value="0.9">Metal roof — 0.90</option>
                  <option value="0.75">Tiled roof — 0.75</option>
                  <option value="0.6">Other surface — 0.60</option>
                </select>

                <label>First-flush diversion (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={firstFlush}
                  onChange={(e) =>
                    setFirstFlush(
                      Math.min(100, Math.max(0, Number(e.target.value))),
                    )
                  }
                />

                <label>Other collection losses (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={otherLoss}
                  onChange={(e) =>
                    setOtherLoss(
                      Math.min(100, Math.max(0, Number(e.target.value))),
                    )
                  }
                />

                <label>Daily building water demand (litres)</label>
                <input
                  type="number"
                  min="0"
                  value={dailyDemand}
                  onChange={(e) =>
                    setDailyDemand(Math.max(0, Number(e.target.value)))
                  }
                />
              </div>

              <div className="results-panel">
                <h2>Calculation Results</h2>

                <div className="result-card">
                  <span>Potential annual runoff</span>
                  <h3>{formatNumber(potentialRunoff)} L</h3>
                </div>

                <div className="result-card">
                  <span>Estimated usable water</span>
                  <h3>{formatNumber(usableWater)} L</h3>
                </div>

                <div className="result-card">
                  <span>Estimated annual demand</span>
                  <h3>{formatNumber(annualDemand)} L</h3>
                </div>

                <div className="result-card">
                  <span>Annual demand coverage</span>
                  <h3>{coverage.toFixed(1)}%</h3>
                  <div className="progress">
                    <div style={{ width: `${coverage}%` }} />
                  </div>
                </div>

                <div className="result-card">
                  <span>Total annual overflow</span>
                  <h3>
                    {Math.round(
                      monthlySimulation.reduce(
                        (sum, month) => sum + month.overflow,
                        0,
                      ),
                    ).toLocaleString("en-IN")}{" "}
                    L
                  </h3>
                </div>

                <div className="result-card">
                  <span>Annual water supplied from tank</span>
                  <h3>
                    {Math.round(
                      monthlySimulation.reduce(
                        (sum, month) => sum + month.consumed,
                        0,
                      ),
                    ).toLocaleString("en-IN")}{" "}
                    L
                  </h3>
                </div>

                <h3 className="simulation-heading">Monthly Tank Simulation</h3>

                <div className="simulation-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Inflow (L)</th>
                        <th>Overflow (L)</th>
                        <th>Storage (L)</th>
                        <th>Unmet Demand (L)</th>
                      </tr>
                    </thead>

                    <tbody>
                      {monthlySimulation.map((item) => (
                        <tr key={item.month}>
                          <td>{item.month}</td>
                          <td>
                            {Math.round(item.inflow).toLocaleString("en-IN")}
                          </td>
                          <td>
                            {Math.round(item.overflow).toLocaleString("en-IN")}
                          </td>
                          <td>
                            {Math.round(item.endingStorage).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                          <td>
                            {Math.round(item.unmetDemand).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="monthly-chart">
                  <h3>Monthly Water Analysis</h3>

                  {monthlySimulation.map((item) => (
                    <div className="chart-row" key={item.month}>
                      <strong>{item.month}</strong>

                      <div className="chart-values">
                        <div
                          className="chart-inflow"
                          style={{
                            width: `${Math.min(item.inflow / 1000, 100)}%`,
                          }}
                        />

                        <div
                          className="chart-overflow"
                          style={{
                            width: `${Math.min(item.overflow / 1000, 100)}%`,
                          }}
                        />
                      </div>

                      <span>
                        {Math.round(item.inflow).toLocaleString("en-IN")} L
                      </span>
                    </div>
                  ))}

                  <p className="chart-legend">
                    <span>■ Inflow</span>
                    <span>■ Overflow</span>
                  </p>
                </div>

                <div className="formula">
                  <strong>Calculation method</strong>
                  <p>
                    Roof area × rainfall × runoff coefficient = potential
                    runoff.
                  </p>
                  <p>
                    Potential runoff × (1 − collection losses) = estimated
                    usable water.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : page === "Roof Mapping" ? (
          <>
            <section className="section action-section">
              <h1>Roof Mapping</h1>
              <p>Map your rooftop to estimate its catchment area.</p>

              <div className="map-panel">
                <h2>Rohtak, Haryana</h2>
                <p>Click the map to mark rooftop boundary points.</p>

                <MapContainer
                  center={[28.8955, 76.6066]}
                  zoom={18}
                  maxZoom={19}
                  scrollWheelZoom={true}
                  style={{ height: "450px", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />

                  <MapPlaceSearch />
                  <RoofMapClickHandler
                    onMapClick={(point) =>
                      setRoofPoints((previous) => [...previous, point])
                    }
                  />

                  {roofPoints.map((point, index) => (
                    <CircleMarker
                      key={index}
                      center={point}
                      radius={6}
                      pathOptions={{
                        color: "blue",
                        fillColor: "blue",
                        fillOpacity: 1,
                      }}
                    />
                  ))}

                  {roofPoints.length >= 3 && (
                    <Polygon
                      positions={roofPoints}
                      pathOptions={{ color: "blue", fillOpacity: 0.25 }}
                    />
                  )}
                </MapContainer>

                <div className="roof-area-result">
                  <h3>Roof Mapping Controls</h3>

                  <p>
                    {roofPoints.length < 3
                      ? "Click at least 3 points around your rooftop."
                      : `Mapped Area: ${mappedRoofArea.toFixed(2)} m²`}
                  </p>

                  <p>Boundary points: {roofPoints.length}</p>

                  <button
                    onClick={() =>
                      setRoofPoints((previous) => previous.slice(0, -1))
                    }
                    disabled={roofPoints.length === 0}
                  >
                    Undo Last Point
                  </button>

                  <button onClick={() => setRoofPoints([])}>
                    Reset Roof Drawing
                  </button>

                  <button
                    disabled={roofPoints.length < 3}
                    onClick={() => {
                      setRoofArea(Math.round(mappedRoofArea));
                      setPage("Water Calculator");
                    }}
                  >
                    Use This Area
                  </button>
                </div>
              </div>

              <button onClick={() => setPage("Dashboard")}>
                Back to Dashboard
              </button>
            </section>
          </>
        ) : page === "Investment Simulator" ? (
          <>
            <header className="topbar">
              <div>
                <h1>Investment Simulator</h1>
                <p>Estimate the financial value of rainwater harvesting.</p>
              </div>
              <span className="location">Rohtak, Haryana</span>
            </header>

            <section className="calculator-layout">
              <div className="calculator-panel">
                <h2>Installation Costs</h2>
                <p>Enter estimated project costs in Indian rupees.</p>

                <label>Storage tank cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={tankCost}
                  onChange={(e) =>
                    setTankCost(Math.max(0, Number(e.target.value)))
                  }
                />

                <label>Pipes and fittings cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={pipeCost}
                  onChange={(e) =>
                    setPipeCost(Math.max(0, Number(e.target.value)))
                  }
                />

                <label>Filter cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={filterCost}
                  onChange={(e) =>
                    setFilterCost(Math.max(0, Number(e.target.value)))
                  }
                />

                <label>Installation and labour (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={labourCost}
                  onChange={(e) =>
                    setLabourCost(Math.max(0, Number(e.target.value)))
                  }
                />

                <h2>Operating Costs</h2>

                <label>Annual maintenance cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={annualMaintenance}
                  onChange={(e) =>
                    setAnnualMaintenance(Math.max(0, Number(e.target.value)))
                  }
                />

                <label>Water cost per 1,000 litres (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={waterTariff}
                  onChange={(e) =>
                    setWaterTariff(Math.max(0, Number(e.target.value)))
                  }
                />

                <p className="rainfall-source">
                  These are editable assumptions. Replace them with actual
                  supplier quotations and your building's water tariff.
                </p>
              </div>

              <div className="results-panel">
                <h2>Financial Results</h2>

                <div className="result-card">
                  <span>Total Installation Investment</span>
                  <h3>₹{formatNumber(totalInvestment)}</h3>
                </div>

                <div className="result-card">
                  <span>Annual Water Supplied</span>
                  <h3>{formatNumber(annualWaterSupplied)} L</h3>
                </div>

                <div className="result-card">
                  <span>Estimated Annual Water Savings</span>
                  <h3>₹{formatNumber(annualWaterSavings)}</h3>
                </div>

                <div className="result-card">
                  <span>Annual Maintenance</span>
                  <h3>₹{formatNumber(annualMaintenance)}</h3>
                </div>

                <div className="result-card">
                  <span>Net Annual Savings</span>
                  <h3>₹{formatNumber(netAnnualSavings)}</h3>
                </div>

                <div className="result-card">
                  <span>Estimated Payback Period</span>
                  <h3>
                    {paybackPeriod === null
                      ? "Not achievable with current assumptions"
                      : `${paybackPeriod.toFixed(1)} years`}
                  </h3>
                </div>

                <div className="result-card">
                  <span>5-Year Net Benefit</span>
                  <h3>₹{formatNumber(fiveYearNetBenefit)}</h3>
                </div>

                <div className="result-card">
                  <span>5-Year ROI</span>
                  <h3>{fiveYearROI.toFixed(1)}%</h3>
                </div>

                <div className="formula">
                  <strong>How the financial estimate works</strong>
                  <p>Total investment = Tank + Pipes + Filter + Labour.</p>
                  <p>
                    Annual water savings = Water supplied (in kL) × Water tariff
                    per kL.
                  </p>
                  <p>
                    Net annual savings = Annual water savings − Annual
                    maintenance.
                  </p>
                  <p>Payback period = Total investment ÷ Net annual savings.</p>
                  <p>
                    5-year ROI = (5-year net benefit ÷ Total investment) × 100.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="section action-section">
              <h1>Reports</h1>
              <p>Summary of your current planning scenario.</p>
              <div className="cards report-cards">
                <div className="card">
                  <span>District</span>
                  <h3>{district}</h3>
                </div>
                <div className="card">
                  <span>Roof area</span>
                  <h3>{formatNumber(roofArea)} m²</h3>
                </div>
                <div className="card">
                  <span>Annual rainfall</span>
                  <h3>{rainfall.toFixed(1)} mm</h3>
                </div>
                <div className="card">
                  <span>Estimated usable water</span>
                  <h3>{formatNumber(usableWater)} L</h3>
                </div>
                <div className="card">
                  <span>Tank supplied</span>
                  <h3>{formatNumber(annualWaterSupplied)} L</h3>
                </div>
                <div className="card">
                  <span>Simulated demand coverage</span>
                  <h3>{simulatedCoverage.toFixed(1)}%</h3>
                </div>
                <div className="card">
                  <span>Total investment</span>
                  <h3>₹{formatNumber(totalInvestment)}</h3>
                </div>
                <div className="card">
                  <span>Payback estimate</span>
                  <h3>
                    {paybackPeriod === null
                      ? "Not reached"
                      : `${paybackPeriod.toFixed(1)} years`}
                  </h3>
                </div>
              </div>
              <div className="analysis-panel">
                <p className="eyebrow">
                  JALRAKSHAK PROJECT DECISION · OFFLINE DEMO
                </p>
                <div className={`decision-badge ${recommendation.tone}`}>
                  {recommendation.label}
                </div>
                <p className="decision-summary">{recommendation.summary}</p>
                <h2>Why this recommendation?</h2>
                <ul>
                  {analysisPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <h3 className="alternatives-heading">
                  Other methods to compare
                </h3>
                <ul className="alternative-list">
                  {alternativeSuggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
                <p className="analysis-note">
                  Demo screening rules: at least 25% annual demand coverage,
                  positive estimated net annual savings, and payback within 10
                  years for “Go for a pilot.” These are transparent demo
                  thresholds, not official engineering or financial standards.
                </p>
                <p className="analysis-note">
                  This is a transparent rule-based analysis from your inputs,
                  not a generative AI service. It works offline and does not
                  send project data anywhere.
                </p>
              </div>
              <p className="rainfall-source">
                Rainfall data source: {RAINFALL_SOURCE}. All results are
                preliminary planning estimates. Validate costs and local
                conditions before installation.
              </p>
              <button onClick={() => window.print()}>
                Print / Save report
              </button>{" "}
              <button onClick={() => setPage("Water Calculator")}>
                Edit assumptions
              </button>
            </section>
          </>
        )}

        <footer>
          JalRakshak · Preliminary planning estimates, not engineering
          certification.
        </footer>
      </main>
    </div>
  );
}

export default App;
