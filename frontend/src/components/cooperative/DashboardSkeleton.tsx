import styles from "./DashboardSkeleton.module.css";

type DashboardSkeletonProps = {
  isAdmin: boolean;
};

const adminMetrics = [0, 1, 2, 3, 4];
const agentMetrics = [0, 1, 2, 3];
const chartBars = [44, 58, 38, 52, 43, 67, 49, 56, 82, 68, 57, 92];

function Placeholder({ className = "" }: { className?: string }) {
  return <span className={`${styles.placeholder} ${className}`} />;
}

export function DashboardSkeleton({ isAdmin }: DashboardSkeletonProps) {
  const metrics = isAdmin ? adminMetrics : agentMetrics;

  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>Chargement des données du tableau de bord…</span>

      <div className={styles.heading} aria-hidden="true">
        <div className={styles.headingText}>
          <Placeholder className={styles.title} />
          <Placeholder className={styles.date} />
        </div>
        <Placeholder className={styles.headingAction} />
      </div>

      <div className={`${styles.metrics} ${isAdmin ? styles.fiveMetrics : ""}`} aria-hidden="true">
        {metrics.map((metric) => (
          <div className={styles.metricCard} key={metric}>
            <div className={styles.metricTop}>
              <Placeholder className={styles.metricLabel} />
              <Placeholder className={styles.metricIcon} />
            </div>
            <Placeholder className={styles.metricValue} />
            <Placeholder className={styles.metricCaption} />
          </div>
        ))}
      </div>

      <div className={styles.dashboardGrid} aria-hidden="true">
        <div className={styles.mainColumn}>
          <section className={`${styles.panel} ${styles.chartPanel}`}>
            <div className={styles.panelHeader}>
              <Placeholder className={styles.panelTitle} />
              <div className={styles.pills}>
                <Placeholder className={styles.pill} />
                <Placeholder className={styles.pill} />
                <Placeholder className={styles.pill} />
              </div>
            </div>
            <div className={styles.chartSummary}>
              <Placeholder className={styles.chartTotal} />
              <Placeholder className={styles.chartNote} />
            </div>
            <div className={styles.chartArea}>
              <div className={styles.chartGrid} />
              <div className={styles.bars}>
                {chartBars.map((height, index) => (
                  <Placeholder className={styles.bar} key={index} />
                ))}
              </div>
            </div>
            <div className={styles.legend}>
              <Placeholder className={styles.legendItem} />
              <Placeholder className={styles.legendItem} />
            </div>
          </section>

          <section className={`${styles.panel} ${styles.tablePanel}`}>
            <div className={styles.tableToolbar}>
              <Placeholder className={styles.panelTitle} />
              <div className={styles.pills}>
                <Placeholder className={styles.pill} />
                <Placeholder className={styles.pill} />
                <Placeholder className={styles.search} />
              </div>
            </div>
            <div className={styles.tableHeader}>
              {Array.from({ length: 5 }, (_, index) => <Placeholder key={index} className={styles.tableHeading} />)}
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div className={styles.tableRow} key={index}>
                <div className={styles.memberCell}>
                  <Placeholder className={styles.avatar} />
                  <Placeholder className={styles.memberName} />
                </div>
                <Placeholder className={styles.tableCell} />
                <Placeholder className={styles.tableCell} />
                <Placeholder className={styles.tableCell} />
                <Placeholder className={styles.status} />
              </div>
            ))}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={`${styles.panel} ${styles.listPanel}`}>
            <div className={styles.panelHeader}>
              <Placeholder className={styles.panelTitle} />
              <Placeholder className={styles.smallPill} />
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div className={styles.listRow} key={index}>
                <Placeholder className={styles.listIcon} />
                <div className={styles.listText}>
                  <Placeholder className={styles.listPrimary} />
                  <Placeholder className={styles.listSecondary} />
                </div>
                <Placeholder className={styles.listValue} />
              </div>
            ))}
          </section>

          <section className={`${styles.panel} ${styles.reminderPanel}`}>
            <div className={styles.panelHeader}>
              <Placeholder className={styles.panelTitle} />
              <Placeholder className={styles.metricIcon} />
            </div>
            <div className={styles.reminderContent}>
              <Placeholder className={styles.reminderIcon} />
              <Placeholder className={styles.reminderLine} />
              <Placeholder className={styles.reminderLineShort} />
            </div>
          </section>
        </aside>
      </div>

      {isAdmin && (
        <div className={`${styles.panel} ${styles.footerPanel}`} aria-hidden="true">
          <Placeholder className={styles.metricIcon} />
          <div className={styles.footerText}>
            <Placeholder className={styles.footerTitle} />
            <Placeholder className={styles.footerDescription} />
          </div>
          <Placeholder className={styles.footerAction} />
        </div>
      )}
    </div>
  );
}
