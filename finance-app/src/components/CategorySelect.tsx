import { useState, useRef, useEffect } from "react";
import { getCategoryColor } from "../utils/colorUtils";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  className?: string;
}

export default function CategorySelect({
  value,
  onChange,
  categories,
  className = "",
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (cat: string) => {
    onChange(cat);
    setIsOpen(false);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedCategory = value !== "__choose_category__" && value !== "__add_category__" ? value : null;
  const selectedColor = selectedCategory ? getCategoryColor(selectedCategory) : "#ccc";

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "10px",
          border: "1px solid #d0d0d0",
          borderRadius: "10px",
          backgroundColor: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "15px",
          fontFamily: "inherit",
        }}
        className={className}
      >
        {selectedCategory ? (
          <>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "2px",
                backgroundColor: selectedColor,
                flexShrink: 0,
              }}
            />
            <span>{selectedCategory}</span>
          </>
        ) : (
          <span style={{ color: "#999" }}>Choose Category</span>
        )}
        <span style={{ marginLeft: "auto" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            border: "1px solid #d0d0d0",
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          {categories.map((cat) => {
            if (cat === "__add_category__") return null;
            if (cat === "__choose_category__") return null;

            const catColor = getCategoryColor(cat);
            const isSelected = value === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelect(cat)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "none",
                  backgroundColor: isSelected ? "#f5f5f5" : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "15px",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f9f9f9";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? "#f5f5f5" : "#fff";
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "2px",
                    backgroundColor: catColor,
                    flexShrink: 0,
                  }}
                />
                <span>{cat}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              onChange("__add_category__");
              setIsOpen(false);
            }}
            style={{
              width: "100%",
              padding: "10px",
              border: "none",
              backgroundColor: "#fff",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "15px",
              fontFamily: "inherit",
              borderTop: "1px solid #d0d0d0",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f9f9f9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
            }}
          >
            + Add New Category
          </button>
        </div>
      )}
    </div>
  );
}
