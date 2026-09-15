import { useState } from 'react';
import { JOB_TYPES } from '../constants';

export default function JobForm({ onCreate, submitting }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState(JOB_TYPES[0]);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!title.trim()) {
      setLocalError('Title is required.');
      return;
    }

    try {
      await onCreate({ title: title.trim(), type });
      setTitle('');
      setType(JOB_TYPES[0]);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <h2>New job</h2>
      <div className="job-form__row">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          maxLength={200}
          placeholder="e.g. Send weekly report"
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="job-form__row">
        <label htmlFor="type">Type</label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={submitting}
        >
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create job'}
      </button>

      {localError && <p className="form-error">{localError}</p>}
    </form>
  );
}
