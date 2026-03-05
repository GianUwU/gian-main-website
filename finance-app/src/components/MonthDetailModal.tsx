import type { Transaction } from "./Stats";

interface MonthDetailModalProps {
  selectedMonth: {
    key: string;
    label: string;
    breakdown: Map<string, number>;
    total: number;
  };
  selectedYear: number | "latest";
  transactions: Transaction[];
  averageMonthly: number;
  categoryColorMap: Map<string, string>;
  onClose: () => void;
}

export default function MonthDetailModal({
  selectedMonth,
  selectedYear,
  transactions,
  averageMonthly,
  categoryColorMap,
  onClose,
}: MonthDetailModalProps) {
  // Note: categoryColorMap is created with sorted categories from Stats.tsx
  const sortedCategories = Array.from(selectedMonth.breakdown.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const topCategory = sortedCategories[0];

  // Extract year from month key for calculations
  const actualYear = selectedYear === "latest" 
    ? parseInt(selectedMonth.key.split("-")[0]) 
    : selectedYear;

  // Find transactions for this month (expenses only)
  const monthTransactions = transactions.filter(
    (tx) => tx.date.slice(0, 7) === selectedMonth.key && tx.type !== "income"
  );
  const transactionCount = monthTransactions.length;
  const averageTransaction =
    transactionCount > 0 ? selectedMonth.total / transactionCount : 0;

  // Calculate total earnings for this month
  const monthEarnings = transactions
    .filter(
      (tx) => tx.date.slice(0, 7) === selectedMonth.key && tx.type === "income"
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Compare to yearly average
  const yearlyAverage = averageMonthly;
  const vsAverage = selectedMonth.total - yearlyAverage;
  const percentDiff =
    yearlyAverage > 0 ? (vsAverage / yearlyAverage) * 100 : 0;

  // Find most expensive single transaction
  const maxTransactionObj =
    monthTransactions.length > 0
      ? monthTransactions.reduce((max, tx) =>
          tx.amount > max.amount ? tx : max,
          monthTransactions[0]
        )
      : null;

  return (
    <div className="month-detail-modal">
      <div className="month-detail-content">
        <div className="month-detail-header">
          <h3>
            Spending Details - {selectedMonth.label} {actualYear}
          </h3>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="month-detail-body">
          <div className="month-total-summary">
            <span className="month-total-label">Total Spending:</span>
            <span className="month-total-amount">
              {selectedMonth.total.toFixed(2)} CHF
            </span>
          </div>

          <div className="month-total-summary" style={{ backgroundColor: "#d4edda", borderColor: "#c3e6cb" }}>
            <span className="month-total-label">Total Earnings:</span>
            <span className="month-total-amount" style={{ color: "#2a9d8f" }}>
              {monthEarnings.toFixed(2)} CHF
            </span>
          </div>

          <div className="insights-grid">
            <div className="insight-card">
              <div className="insight-icon">🏆</div>
              <div className="insight-content">
                <div className="insight-label">Top Category</div>
                <div className="insight-value">
                  {topCategory ? topCategory[0] : "N/A"}
                </div>
                <div className="insight-detail">
                  {topCategory
                    ? `${topCategory[1].toFixed(2)} CHF (${(
                        (topCategory[1] / selectedMonth.total) *
                        100
                      ).toFixed(1)}%)`
                    : ""}
                </div>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">📊</div>
              <div className="insight-content">
                <div className="insight-label">Transactions</div>
                <div className="insight-value">{transactionCount}</div>
                <div className="insight-detail">
                  Avg: {averageTransaction.toFixed(2)} CHF
                </div>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">📈</div>
              <div className="insight-content">
                <div className="insight-label">vs. Year Average</div>
                <div
                  className="insight-value"
                  style={{ color: vsAverage > 0 ? "#e76f51" : "#2a9d8f" }}
                >
                  {vsAverage > 0 ? "+" : ""}
                  {vsAverage.toFixed(2)} CHF
                </div>
                <div className="insight-detail">
                  {Math.abs(percentDiff).toFixed(1)}%{" "}
                  {vsAverage > 0 ? "above" : "below"} average
                </div>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">💰</div>
              <div className="insight-content">
                <div className="insight-label">Largest Purchase</div>
                <div className="insight-value">
                  {maxTransactionObj
                    ? maxTransactionObj.amount.toFixed(2)
                    : "0.00"}{" "}
                  CHF
                </div>
                <div className="insight-detail">
                  {maxTransactionObj ? maxTransactionObj.description : "N/A"}
                </div>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">📅</div>
              <div className="insight-content">
                <div className="insight-label">Daily Average</div>
                <div className="insight-value">
                  {(
                    selectedMonth.total /
                    new Date(
                      actualYear,
                      parseInt(selectedMonth.key.split("-")[1]),
                      0
                    ).getDate()
                  ).toFixed(2)}{" "}
                  CHF
                </div>
                <div className="insight-detail">Per day this month</div>
              </div>
            </div>
          </div>

          <div className="category-list">
            <h4>Category Breakdown</h4>
            <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px 0', fontStyle: 'italic' }}>
              Transactions with multiple categories count their full amount toward each category. The graph shows each transaction only under its first category.
            </p>
            <table className="category-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(selectedMonth.breakdown.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => {
                    const percentage = (
                      (amt / selectedMonth.total) *
                      100
                    ).toFixed(1);
                    return (
                      <tr key={cat}>
                        <td>
                          <span
                            className="category-dot"
                            style={{
                              backgroundColor:
                                categoryColorMap.get(cat) || "#999",
                            }}
                          />
                          {cat}
                        </td>
                        <td className="amount-cell">{amt.toFixed(2)} CHF</td>
                        <td className="percentage-cell">{percentage}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
