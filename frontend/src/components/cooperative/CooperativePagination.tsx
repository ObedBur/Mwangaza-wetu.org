"use client";

import { useEffect } from "react";

type CooperativePaginationProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel: string;
  previousLabel?: string;
  nextLabel?: string;
};

const pageSizeOptions = [10, 15] as const;

export function CooperativePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel,
  previousLabel = "Précédent",
  nextLabel = "Suivant",
}: CooperativePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  useEffect(() => {
    if (page > pageCount) onPageChange(pageCount);
  }, [onPageChange, page, pageCount]);

  return (
    <nav className="coop-pagination" aria-label="Pagination">
      <span aria-live="polite">
        {firstItem}–{lastItem} sur {totalItems} {itemLabel}
      </span>
      <div className="coop-pagination-controls">
        <label className="coop-page-size">
          <span>Afficher</span>
          <select
            aria-label={`Nombre de ${itemLabel} par page`}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span>par page</span>
        </label>
        <button
          type="button"
          className="mw-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {previousLabel}
        </button>
        <span className="coop-page-number">Page {page} sur {pageCount}</span>
        <button
          type="button"
          className="mw-secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
