import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { STATUSES } from './constants';
import JobForm from './components/JobForm';
import StatusFilter from './components/StatusFilter';
import JobList from './components/JobList';
import './App.css';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState(new Set());
  const [toast, setToast] = useState(null); // { type: 'error' | 'info', message }

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 5000);
  };

  const loadJobs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load jobs.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    // Light polling so that changes made in another browser tab become
    // visible here too (relevant to the "two tabs" scenario in the brief) -
    // silent so it doesn't flash the loading state every 5s.
    const interval = setInterval(() => loadJobs({ silent: true }), 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const counts = useMemo(() => {
    const base = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const job of jobs) {
      base[job.status] = (base[job.status] || 0) + 1;
    }
    return base;
  }, [jobs]);

  const visibleJobs = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)),
    [jobs, filter],
  );

  const setBusy = (id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      const job = await api.createJob(payload);
      setJobs((prev) => [job, ...prev]);
    } finally {
      setCreating(false);
    }
  };

  const handleChangeStatus = async (id, status) => {
    setBusy(id, true);
    try {
      const updated = await api.updateStatus(id, status);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      // A 409 here most often means someone else (e.g. another browser
      // tab) already changed this job's status. Re-sync from the server
      // so the UI reflects reality instead of staying stale.
      showToast('error', err.message);
      await loadJobs({ silent: true });
    } finally {
      setBusy(id, false);
    }
  };

  const handleDelete = async (id) => {
    setBusy(id, true);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      showToast('error', err.message);
      await loadJobs({ silent: true });
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Job Queue Dashboard</h1>
        <button type="button" onClick={() => loadJobs()} disabled={loading}>
          Refresh
        </button>
      </header>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.message}</div>}

      <JobForm onCreate={handleCreate} submitting={creating} />

      <section className="jobs-section">
        <StatusFilter value={filter} onChange={setFilter} counts={counts} />

        {loading && <p className="loading-state">Loading jobs…</p>}

        {!loading && loadError && (
          <div className="error-state">
            <p>Could not load jobs: {loadError}</p>
            <button type="button" onClick={() => loadJobs()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <JobList
            jobs={visibleJobs}
            busyIds={busyIds}
            onChangeStatus={handleChangeStatus}
            onDelete={handleDelete}
          />
        )}
      </section>
    </div>
  );
}
