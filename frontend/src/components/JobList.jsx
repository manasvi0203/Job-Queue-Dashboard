import { NEXT_STATUSES, STATUS_LABELS } from '../constants';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function JobRow({ job, busy, onChangeStatus, onDelete }) {
  const nextStatuses = NEXT_STATUSES[job.status] || [];

  return (
    <tr className={busy ? 'is-busy' : ''}>
      <td>{job.title}</td>
      <td>{job.type}</td>
      <td>
        <span className={`badge badge--${job.status}`}>
          {STATUS_LABELS[job.status]}
        </span>
      </td>
      <td>{formatDate(job.createdAt)}</td>
      <td className="job-row__actions">
        {nextStatuses.length === 0 && (
          <span className="muted">no actions (final state)</span>
        )}
        {nextStatuses.map((next) => (
          <button
            key={next}
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus(job.id, next)}
          >
            Mark {STATUS_LABELS[next].toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => onDelete(job.id)}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function JobList({ jobs, busyIds, onChangeStatus, onDelete }) {
  if (jobs.length === 0) {
    return <p className="empty-state">No jobs match this filter yet.</p>;
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            busy={busyIds.has(job.id)}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
