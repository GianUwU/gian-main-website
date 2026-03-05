import { useEffect, useState, useRef } from "react";
import { useAuth } from "../AuthContext";
import { fetchWithTokenRefresh } from "../utils/fetchWithTokenRefresh";
import { createCategoryColorMap } from "../utils/colorUtils";
import MonthDetailModal from "./MonthDetailModal";
import UserBadge from "./UserBadge";
import "../Stats.css";

export interface Transaction {
  id: number;
  amount: number;
  categories: string[];
  description: string;
  date: string;
  type?: "expense" | "income";
}

const API_BASE = "/transactions";

export default function Stats() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | "latest">("latest");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    category: string;
    amount: number;
  }>({ visible: false, x: 0, y: 0, category: "", amount: 0 });
  const [selectedMonth, setSelectedMonth] = useState<{
    key: string;
    label: string;
    breakdown: Map<string, number>;
    total: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!token) return;
    fetchWithTokenRefresh(API_BASE, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data: Transaction[]) => {
        if (!mounted) return;
        setTransactions(data || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError("Failed to load transactions");
        console.error(err);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const availableYears = Array.from(
    new Set(transactions.map((tx) => parseInt(tx.date.slice(0, 4))))
  ).sort((a, b) => b - a);

  if (availableYears.length === 0) {
    availableYears.push(new Date().getFullYear());
  }

  // Generate months based on selected year or "latest" mode
  const months = selectedYear === "latest"
    ? Array.from({ length: 12 }).map((_, idx) => {
        // Start from current month and go back 11 months
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { key, label: d.toLocaleString("en-US", { month: "short" }), total: 0 };
      })
    : Array.from({ length: 12 }).map((_, idx) => {
        const d = new Date(selectedYear, idx, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { key, label: d.toLocaleString("en-US", { month: "short" }), total: 0 };
      });

  // Filter only expense transactions for stats
  const expenseTransactions = transactions.filter((tx) => tx.type !== "income");
  
  // Get all unique expense categories for color mapping
  const categories = Array.from(new Set(expenseTransactions.flatMap((t) => t.categories || []))).filter(Boolean);
  const categoryColorMap = createCategoryColorMap(categories);

  const monthBreakdowns = months.map((m) => {
    const breakdown = new Map<string, number>();
    const graphBreakdown = new Map<string, number>();
    let monthlyIncome = 0;
    let monthlyExpenseTotal = 0;
    
    transactions.forEach((tx) => {
      const key = tx.date.slice(0, 7);
      if (key !== m.key) return;
      
      if (tx.type === "income") {
        monthlyIncome += Number(tx.amount || 0);
      } else {
        const txCategories = tx.categories && tx.categories.length > 0 ? tx.categories : ["(uncategorized)"];
        const amount = Number(tx.amount || 0);
        monthlyExpenseTotal += amount;
        // For modal breakdown: count full amount for each category
        txCategories.forEach((cat) => {
          breakdown.set(cat, (breakdown.get(cat) || 0) + amount);
        });
        // For graph: count amount only under first category
        const firstCategory = txCategories[0];
        graphBreakdown.set(firstCategory, (graphBreakdown.get(firstCategory) || 0) + amount);
      }
    });
    
    const total = monthlyExpenseTotal;
    return { ...m, total, breakdown, graphBreakdown, income: monthlyIncome };
  });

  // Filter out the current incomplete month for calculations
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const completedMonths = monthBreakdowns.filter(m => m.key !== currentMonthKey);
  
  const monthlyTotals = monthBreakdowns.map((m) => ({ key: m.key, label: m.label, total: m.total }));
  const yearlyTotal = completedMonths.reduce((acc, m) => acc + m.total, 0);
  const totalIncome = completedMonths.reduce((acc, m) => acc + m.income, 0);
  const netSavings = totalIncome - yearlyTotal;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const monthsWithData = completedMonths.filter((m) => m.total > 0).length;
  const averageMonthly = monthsWithData > 0 ? yearlyTotal / monthsWithData : 0;

  const chartWidth = 600;
  const chartHeight = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingBottom = 40;
  const slots = monthlyTotals.length || 12;
  const slotWidth = (chartWidth - paddingLeft - paddingRight) / slots;
  // Include income in max value calculation for proper scaling
  const maxVal = Math.max(
    ...monthBreakdowns.map((m) => Math.max(m.total, m.income)),
    1
  );

  // Scroll to the right (most recent data) on mount or when data changes
  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.scrollLeft = chartContainerRef.current.scrollWidth;
    }
  }, [monthlyTotals, selectedYear]);

  return (
    <div className="page">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>Finance Stats</h1>
            <p>Summary of your transactions</p>
          </div>
          <UserBadge />
        </div>
      </header>

      <main className="main-content">
        <div className="card">
          <h2>Total Transactions Sum</h2>
          {loading && <p>Loading…</p>}
          {error && <p>{error}</p>}

          {!loading && !error && (
            <>
              <div className="year-selector">
                <label htmlFor="year-select">Select Year: </label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedYear(val === "latest" ? "latest" : parseInt(val));
                  }}
                >
                  <option value="latest">Latest</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <p 
                className="stats-total" 
                style={{ color: netSavings >= 0 ? '#2A9D8F' : '#E76F51' }}
              >
                {netSavings >= 0 ? '+' : ''}{netSavings.toFixed(2)} CHF
              </p>
              <p className="stats-subtitle">
                {selectedYear === "latest" 
                  ? `Net savings (${savingsRate.toFixed(1)}% saved) - Last ${completedMonths.length} completed months` 
                  : `Net savings (${savingsRate.toFixed(1)}% saved) - ${selectedYear} (${completedMonths.length} completed months)`}
              </p>

              <div className="stats-chart">
                {monthlyTotals.length > 0 ? (
                  <>
                    <div className="chart-container" ref={chartContainerRef}>
                      <div style={{ position: "relative", width: "100%", maxWidth: 680, minWidth: 600 }} ref={chartRef}>
                        <svg
                          className="chart-svg"
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          preserveAspectRatio="xMidYMid meet"
                          role="img"
                          aria-label="Spending over last 12 months"
                          style={{ display: "block" }}
                        >
                          <line
                            x1={paddingLeft}
                            y1={chartHeight - paddingBottom}
                            x2={chartWidth - paddingRight}
                            y2={chartHeight - paddingBottom}
                            stroke="#ccc"
                          />

                          {monthBreakdowns.map((m, i) => {
                        const x = paddingLeft + i * slotWidth + slotWidth * 0.1;
                        const barW = slotWidth * 0.8;
                        const incomeBarW = slotWidth * 0.12; // Slim income bar
                        const incomeBarX = x - incomeBarW - 2; // Position to the left with small gap
                        
                        let accumulated = 0;
                        const segments: Array<{ category: string; amount: number; height: number }> = [];
                        Array.from(m.graphBreakdown.entries()).forEach(([cat, amt]) => {
                          const h = (amt / maxVal) * (chartHeight - paddingBottom - 20);
                          segments.push({ category: cat, amount: amt, height: h });
                        });

                        // Calculate income bar height
                        const incomeHeight = m.income > 0 
                          ? (m.income / maxVal) * (chartHeight - paddingBottom - 20)
                          : 0;
                        const incomeY = chartHeight - paddingBottom - incomeHeight;

                        // Check if this is the current month
                        const now = new Date();
                        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                        const isCurrentMonth = m.key === currentMonthKey;

                        return (
                          <g key={m.key}>
                            {/* Income bar (slim, on the left) */}
                            {m.income > 0 && (
                              <rect
                                x={incomeBarX}
                                y={incomeY}
                                width={incomeBarW}
                                height={Math.max(incomeHeight, 1)}
                                fill="#7BB662"
                                opacity={0.7}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => {
                                  const svg = chartRef.current?.querySelector('svg');
                                  if (!svg) return;
                                  const svgRect = svg.getBoundingClientRect();
                                  const scale = svgRect.width / chartWidth;
                                  const barCenterX = (incomeBarX + incomeBarW / 2) * scale;
                                  const barTopY = incomeY * scale;
                                  setTooltip({
                                    visible: true,
                                    x: barCenterX,
                                    y: barTopY,
                                    category: "Income",
                                    amount: m.income,
                                  });
                                }}
                                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                              />
                            )}

                            {/* Expense bars (stacked) */}
                            {segments.map((seg, sidx) => {
                              const h = Math.max(seg.height, 1);
                              const y = chartHeight - paddingBottom - accumulated - h;
                              accumulated += h;
                              const fill = categoryColorMap.get(seg.category) || "#999";
                              return (
                                <rect
                                  key={seg.category + sidx}
                                  x={x}
                                  y={y}
                                  width={barW}
                                  height={h}
                                  fill={fill}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setSelectedMonth({ key: m.key, label: m.label, breakdown: m.breakdown, total: m.total })}
                                  onMouseEnter={() => {
                                    const svg = chartRef.current?.querySelector('svg');
                                    if (!svg) return;
                                    const svgRect = svg.getBoundingClientRect();
                                    const scale = svgRect.width / chartWidth;
                                    const barCenterX = (x + barW / 2) * scale;
                                    const barTopY = y * scale;
                                    setTooltip({
                                      visible: true,
                                      x: barCenterX,
                                      y: barTopY,
                                      category: seg.category,
                                      amount: seg.amount,
                                    });
                                  }}
                                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                                />
                              );
                            })}

                            {m.total > 0 && (
                              <text
                                className="bar-total-label"
                                x={x + barW / 2}
                                y={chartHeight - paddingBottom - accumulated - 6}
                                textAnchor="middle"
                              >
                                {m.total.toFixed(0)}
                              </text>
                            )}

                            <text
                              className="bar-label"
                              x={x + barW / 2}
                              y={chartHeight - paddingBottom + 14}
                              textAnchor="middle"
                              style={{
                                fontWeight: isCurrentMonth ? 'bold' : 'normal',
                                fontSize: isCurrentMonth ? '13px' : '12px',
                                fill: isCurrentMonth ? '#2A9D8F' : '#666'
                              }}
                            >
                              {m.label}
                            </text>
                          </g>
                        );
                      })}
                        </svg>

                        <div
                          className="chart-tooltip"
                          style={{
                            display: tooltip.visible ? "block" : "none",
                            position: "absolute",
                            left: tooltip.x,
                            top: Math.max(tooltip.y - 40, 10),
                            transform: "translate(-50%, -100%)",
                            pointerEvents: "none",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{tooltip.category}</div>
                          <div>{tooltip.amount.toFixed(2)} CHF</div>
                        </div>
                      </div>
                    </div>

                    {categories.length > 0 && (
                      <div className="chart-legend">
                        {categories.map((c) => (
                          <div key={c} className="legend-item">
                            <span className="legend-swatch" style={{ background: categoryColorMap.get(c) }} />
                            <span className="legend-label">{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p>No monthly data</p>
                )}
              </div>

              {selectedMonth && (
                <MonthDetailModal
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  transactions={transactions}
                  averageMonthly={averageMonthly}
                  categoryColorMap={categoryColorMap}
                  onClose={() => setSelectedMonth(null)}
                />
              )}
            </>
          )}

          <p>
            <a
              href="/"
              className="input"
              style={{
                display: "inline-block",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 8,
                marginTop: 10,
              }}
            >
              Back
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
