export const STATUSES = ['pending', 'running', 'completed', 'failed'];

export const JOB_TYPES = [
  'email',
  'report',
  'data-sync',
  'image-processing',
  'other',
];

// Mirrors the backend's state machine (src/jobs/jobs.service.ts on the
// server) purely for UI purposes: which "change status" buttons make sense
// to show for a job in a given state. The backend is the real enforcer -
// this is just so the UI doesn't offer buttons that would always fail.
export const NEXT_STATUSES = {
  pending: ['running', 'failed'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export const STATUS_LABELS = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};
