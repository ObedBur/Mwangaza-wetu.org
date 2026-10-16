'use client';

import React from "react";
import { IconAlertCircle, IconDatabaseOff } from "@tabler/icons-react";

import { cooperativeCopy } from "@/lib/cooperative-copy";

type CooperativeDataStateProps = {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  children: React.ReactNode;
};

export function CooperativeDataState({
  loading = false,
  error = false,
  empty = false,
  emptyMessage = cooperativeCopy.empty,
  skeletonRows = 3,
  children,
}: CooperativeDataStateProps) {
  if (loading) {
    return (
      <div className="coop-skeleton-stack" aria-label={cooperativeCopy.loading}>
        {Array.from({ length: skeletonRows }, (_, index) => (
          <span className="coop-skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="coop-empty-state" role="alert">
        <IconAlertCircle aria-hidden="true" />
        <span>{cooperativeCopy.error}</span>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="coop-empty-state" role="status">
        <IconDatabaseOff aria-hidden="true" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return <>{children}</>;
}
