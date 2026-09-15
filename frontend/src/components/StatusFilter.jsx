import { STATUSES, STATUS_LABELS } from '../constants';

export default function StatusFilter({ value, onChange, counts }) {
  const options = ['all', ...STATUSES];

  return (
    <div className="status-filter" role="tablist" aria-label="Filter jobs by status">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={value === opt}
          className={`status-filter__tab${value === opt ? ' is-active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt === 'all' ? 'All' : STATUS_LABELS[opt]}
          <span className="status-filter__count">
            {opt === 'all'
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[opt] || 0}
          </span>
        </button>
      ))}
    </div>
  );
}
