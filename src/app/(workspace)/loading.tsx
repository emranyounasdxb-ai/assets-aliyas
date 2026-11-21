export default function Loading() {
  return (
    <div
      className="loading-layout"
      role="status"
      aria-label="Loading workspace"
      aria-busy="true"
    >
      <div className="skeleton" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton stat-skeleton" />
        ))}
      </div>
      <div className="skeleton chart-skeleton" />
    </div>
  );
}
