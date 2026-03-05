import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { fetchWithTokenRefresh } from "../utils/fetchWithTokenRefresh";
import { getCategoryColor, hexToRgba } from "../utils/colorUtils";
import CategorySelect from "./CategorySelect";
import UserBadge from "./UserBadge";
import "../FinanceTracker.css";

interface Transaction {
  id: number;
  amount: number;
  categories: string[];
  description: string;
  date: string;
  type?: "expense" | "income";
}

const API_BASE = "/transactions";
const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Subscription", "Shopping", "Other"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Pocket Money", "Other"];

function formatDayOnly(dateStr: string): string {
  const [, , day] = dateStr.split("-");
  return day;
}

export default function FinanceTracker() {
  const { token, isAdmin } = useAuth();
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [categories, setCategories] = useState<string[]>(["__choose_category__"]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(DEFAULT_INCOME_CATEGORIES);
  const [newCategory, setNewCategory] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterYear, setFilterYear] = useState<string>("current");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; description: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [categoryOverrideIds, setCategoryOverrideIds] = useState<Set<number>>(new Set());
  const [showAllByDefault, setShowAllByDefault] = useState<boolean>(() => {
    return typeof window !== "undefined" && window.innerWidth >= 768;
  });

  const availableCategories = transactionType === "expense" ? expenseCategories : incomeCategories;

  useEffect(() => {
    function handleResize() {
      setShowAllByDefault(window.innerWidth >= 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
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
        setTransactions(data);
        const dbExpenseCategories = Array.from(new Set(
          data
            .filter(tx => tx.type !== "income")
            .flatMap((tx) => tx.categories || [])
            .map((c: string) => c.slice(0, 20))
        ));
        const dbIncomeCategories = Array.from(new Set(
          data
            .filter(tx => tx.type === "income")
            .flatMap((tx) => tx.categories || [])
            .map((c: string) => c.slice(0, 20))
        ));
        setExpenseCategories((prev) => {
          const trimmedPrev = prev.map((c: string) => c.slice(0, 20));
          return Array.from(new Set([...trimmedPrev, ...dbExpenseCategories]));
        });
        setIncomeCategories((prev) => {
          const trimmedPrev = prev.map((c: string) => c.slice(0, 20));
          return Array.from(new Set([...trimmedPrev, ...dbIncomeCategories]));
        });
      })
      .catch((err) => {
        console.error("Error fetching transactions:", err);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    
    // Validate amount
    if (!amount || amount.trim() === "") {
      setFormError("Please enter an amount.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      setFormError("Please enter a valid number for amount.");
      return;
    }

    if (parsedAmount === 0) {
      setFormError("Amount cannot be zero.");
      return;
    }

    if (parsedAmount < 0 || parsedAmount > 100000) {
      setFormError("Amount must be between 0 and 100,000.");
      return;
    }

    // Validate description (trim whitespace)
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 30) {
      setFormError("Description must be 30 characters or less.");
      return;
    }

    // Validate categories
    const validCategories = categories.filter(cat => cat && cat.trim() !== "" && cat !== "__add_category__" && cat !== "__choose_category__");
    if (validCategories.length === 0) {
      setFormError("Please select at least one category.");
      return;
    }

    // Check for duplicate categories
    const uniqueCategories = new Set(validCategories);
    if (uniqueCategories.size !== validCategories.length) {
      setFormError("You cannot select the same category twice.");
      return;
    }

    // Validate date format and value
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      setFormError("Please provide a valid date (YYYY-MM-DD).");
      return;
    }
    
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      setFormError("Please provide a valid date.");
      return;
    }

    // If editingId is set, update existing transaction, otherwise create new
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;

    const res = await fetchWithTokenRefresh(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        amount: parsedAmount, 
        categories: validCategories, 
        description: trimmedDescription, 
        date, 
        type: transactionType 
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Server error");
      setFormError(`Failed to save transaction: ${errText}`);
      return;
    }

    const savedTx = await res.json();
    if (editingId) {
      setTransactions(transactions.map((tx) => (tx.id === savedTx.id ? savedTx : tx)));
      setEditingId(null);
    } else {
      setTransactions([savedTx, ...transactions]);
    }
    setAmount("");
    setDescription("");
    setTransactionType("expense");
    setCategories(["__choose_category__"]);
    setFormError(null);
  }

  function handleEditClick(tx: Transaction) {
    setEditingId(tx.id);
    setAmount(tx.amount.toString());
    setDescription(tx.description);
    setCategories(tx.categories || ["Food"]);
    setDate(tx.date);
    setTransactionType(tx.type || "expense");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setCategories(["__choose_category__"]);
    setDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setTransactionType("expense");
  }

  function handleFlipCard() {
    const newType = transactionType === "expense" ? "income" : "expense";
    setTransactionType(newType);
    setCategories(["__choose_category__"]);
    setFormError(null);
  }

  async function deleteTransaction(id: number) {
    await fetchWithTokenRefresh(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    setTransactions(transactions.filter((tx) => tx.id !== id));
  }

  function handleDeleteClick(id: number, description: string) {
    setDeleteConfirm({ id, description });
  }

  async function handleConfirmDelete() {
    if (deleteConfirm) {
      await deleteTransaction(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  }

  function handleCancelDelete() {
    setDeleteConfirm(null);
  }

  function handleAddCategory() {
    const normalized = newCategory.trim().slice(0, 20);
    
    if (!normalized) {
      setFormError("Category name cannot be empty.");
      return;
    }

    if (normalized.length < 2) {
      setFormError("Category name must be at least 2 characters.");
      return;
    }

    if (availableCategories.includes(normalized)) {
      setFormError("This category already exists.");
      return;
    }

    if (transactionType === "expense") {
      setExpenseCategories([...expenseCategories.map((c) => c.slice(0, 20)), normalized]);
    } else {
      setIncomeCategories([...incomeCategories.map((c) => c.slice(0, 20)), normalized]);
    }
    // Update the categories array to include the new category, replacing the "__add_category__" option
    setCategories(categories.map((c) => (c === "__add_category__" ? normalized : c)));
    setNewCategory("");
    setFormError(null);
  }

  function getFilteredTransactions() {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    
    let filtered = transactions;
    
    if (filterYear === "current") {
      filtered = filtered.filter((tx) => tx.date.startsWith(`${year}-${month}`));
    } else if (filterYear !== "all") {
      filtered = filtered.filter((tx) => tx.date.startsWith(filterYear));
    }
    
    if (filterCategory !== "All") {
      filtered = filtered.filter((tx) => (tx.categories || []).includes(filterCategory));
    }
    
    return filtered;
  }

  const availableYears = Array.from(
    new Set(transactions.map((tx) => parseInt(tx.date.slice(0, 4))))
  ).sort((a, b) => b - a);

  function handlePreviousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  }

  function formatMonthYear(): string {
    return currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function toggleTransactionCategoryExpansion(txId: number) {
    setCategoryOverrideIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  }

  function toggleAllCategoriesExpansion() {
    setShowAllByDefault(!showAllByDefault);
    setCategoryOverrideIds(new Set());
  }

  function shouldShowAllCategories(txId: number): boolean {
    const isOverridden = categoryOverrideIds.has(txId);
    return isOverridden ? !showAllByDefault : showAllByDefault;
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>Finance Tracker</h1>
            <p>Manage your expenses</p>
          </div>
          <UserBadge />
        </div>
      </header>

      <main className="main-content">
        <div className={`card add-transaction-card ${transactionType === "income" ? "income-mode" : ""}`}>
          <div className="card-header-with-toggle">
            <h2>{editingId ? "Edit Transaction" : (transactionType === "expense" ? "Add Transaction" : "Add Income")}</h2>
            <button 
              type="button" 
              className={`flip-card-button ${transactionType === "income" ? "rotated" : ""}`}
              onClick={handleFlipCard}
              title={transactionType === "expense" ? "Switch to Income" : "Switch to Expense"}
            >
              +
            </button>
          </div>

        <form onSubmit={handleSubmit} className="form">
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            max={100000}
            min={0}
            placeholder="0.00"
            onChange={(e) => {
              setAmount(e.target.value);
              setFormError(null);
            }}
            step="0.05"
            className="input"
            required
          />

          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setFormError(null);
            }}
            maxLength={30}
            className="input"
            placeholder="Description"
          />

          <label>Category</label>
          <div className="categories-input-group">
            {categories.map((cat, idx) => (
              <div key={idx} className="category-row">
                <CategorySelect
                  value={cat}
                  onChange={(selectedValue) => {
                    if (selectedValue === "__choose_category__") {
                      setFormError("Please select a valid category.");
                      return;
                    }
                    // Check if this category is already selected elsewhere (excluding current index)
                    if (selectedValue !== "__add_category__" && categories.some((c, i) => c === selectedValue && i !== idx)) {
                      setFormError(`"${selectedValue}" is already selected. Please choose a different category.`);
                      return;
                    }
                    const newCategories = [...categories];
                    newCategories[idx] = selectedValue;
                    setCategories(newCategories);
                    setFormError(null);
                  }}
                  categories={transactionType === "expense" ? expenseCategories : incomeCategories}
                  className="input"
                />
                {idx > 0 && (
                  <button
                    type="button"
                    className="button button-remove-category"
                    onClick={() => {
                      setCategories(categories.filter((_, i) => i !== idx));
                    }}
                    title="Remove category"
                  >
                    −
                  </button>
                )}
                {idx === categories.length - 1 && (
                    <button
                    type="button"
                    className="button button-add-category-plus"
                    onClick={() => {
                      setCategories([...categories, "__choose_category__"]);
                    }}
                    title="Add another category"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>

          {categories.some(cat => cat === "__add_category__") && (
            <div className="add-category-inputs">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value);
                  setFormError(null);
                }}
                maxLength={20}
                placeholder="New category name"
                className="input"
                minLength={2}
              />
              <button type="button" onClick={handleAddCategory} className="button button-add-category">
                Add
              </button>
            </div>
          )}

          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setFormError(null);
            }}
            className="input"
            required
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="button" type="submit">{editingId ? 'Save' : 'Add'}</button>
            {editingId && (
              <button type="button" className="button button-cancel-edit" onClick={handleCancelEdit} style={{ background: '#999' }}>
                Cancel
              </button>
            )}
          </div>
          {formError && <div className="form-error">{formError}</div>}
        </form>
      </div>

      <div className="card transaction-history-card">
        <h2>Transaction History</h2>

        <div className="month-header">
          <h3>{formatMonthYear()}</h3>
        </div>

        <div className="filters-row">
          <div className="filter-section">
          <label>Filter by Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input">
            <option value="All">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
              ))}
            </select>
          </div>

          <div className="filter-section">
          <label>Filter by Year</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="input">
            <option value="current">Current Month</option>
            <option value="all">All Years</option>
            <option disabled>─────────────</option>
            {availableYears.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
        </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} title="Click to toggle all categories" onClick={toggleAllCategoriesExpansion}>
                  Category
                </th>
                <th>Description</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {getFilteredTransactions().length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ border: 'none', padding: 0 }}>
                    <div className="empty-state">
                      {isAdmin && (
                        <div className="empty-state-image">
                          <img 
                            src="/illustrations/empty-transactions.png" 
                            alt="No transactions"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="empty-state-placeholder">📊</div>';
                            }}
                          />
                        </div>
                      )}
                      <p>Add your first transaction to get started!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                getFilteredTransactions()
                  .map((tx) => {
                    const firstCategory = (tx.categories && tx.categories.length > 0) ? tx.categories[0] : "Other";
                    const bgColor = tx.type === "income" 
                      ? "#e8f5e9" 
                      : hexToRgba(getCategoryColor(firstCategory), 0.15);
                    
                    return (
                      <tr key={tx.id} style={{ backgroundColor: bgColor }}>
                        <td>{formatDayOnly(tx.date)}</td>
                        <td
                          onClick={() => toggleTransactionCategoryExpansion(tx.id)}
                          style={{ cursor: "pointer", userSelect: "none" }}
                        >
                          <div className="category-badges">
                            {(() => {
                              const catArray = tx.categories && tx.categories.length > 0 ? tx.categories : ["Other"];
                              const showAll = shouldShowAllCategories(tx.id);
                              const displayCats = showAll ? catArray : [catArray[0]];
                              
                              return (
                                <>
                                  {displayCats.map((cat) => (
                                    <span
                                      key={cat}
                                      className="category-badge"
                                      style={{
                                        backgroundColor: getCategoryColor(cat),
                                        color: "#fff",
                                      }}
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                  {!showAll && catArray.length > 1 && (
                                    <span
                                      style={{
                                        fontWeight: "bold",
                                        color: "#666",
                                        marginLeft: "4px",
                                      }}
                                    >
                                      +{catArray.length - 1}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="description">{tx.description}</td>
                        <td className={`amount-cell ${tx.type === "income" ? "income" : "expense"}`}>
                          {tx.amount.toFixed(2)}
                        </td>
                        <td>
                          <div className="row-actions">
                            <div className="actions-toggle" aria-hidden>
                              ⋯
                            </div>
                            <div className="actions-dropdown">
                              <button type="button" className="action-item" onClick={() => handleEditClick(tx)}>
                                Edit
                              </button>
                              <button type="button" className="action-item delete-action" onClick={() => handleDeleteClick(tx.id, tx.description)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        <div className="month-navigation">
          <button className="nav-button" onClick={handlePreviousMonth}>
            ← Prev
          </button>
          <button className="nav-button" onClick={handleNextMonth}>
            Next →
          </button>
        </div>
      </div>
      </main>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Are you sure you want to delete <strong>{deleteConfirm.description}</strong>?</p>
            <div className="modal-buttons">
              <button className="button button-confirm" onClick={handleConfirmDelete}>
                Yes
              </button>
              <button className="button button-cancel" onClick={handleCancelDelete}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bottom-actions">
        <a href="/stats" className="footer-link">Stats</a>
      </div>
    </div>
  );
}
