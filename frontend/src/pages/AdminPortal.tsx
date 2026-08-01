import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type RelationshipRef, type SessionUser, type UpstreamHealth } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/brand';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

export function AdminPortal() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRef[]>([]);
  const [upstream, setUpstream] = useState<UpstreamHealth | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRelationships, setLoadingRelationships] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [relationshipId, setRelationshipId] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SessionUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      setUsers(await api.admin.users());
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadRelationships() {
    setLoadingRelationships(true);
    try {
      setRelationships(await api.admin.relationships());
    } finally {
      setLoadingRelationships(false);
    }
  }

  async function loadUpstream() {
    setUpstream(await api.upstreamHealth());
  }

  async function refresh() {
    setError(null);
    const results = await Promise.allSettled([loadUsers(), loadRelationships(), loadUpstream()]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setError(errorMessage(failed.reason, 'Failed to load admin data.'));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!emailValid) {
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordValid) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }
    const relationship = relationships.find((item) => item.id === relationshipId);
    if (!relationship) {
      setError('Pick a relationship to allocate.');
      return;
    }
    setBusy(true);
    try {
      await api.admin.createUser({
        email,
        password,
        relationshipId: relationship.id,
        relationshipName: relationship.name,
      });
      setNotice(`Created ${email} → ${relationship.name}`);
      setEmail('');
      setPassword('');
      setRelationshipId('');
      await loadUsers();
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to create the portal user.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await api.admin.deleteUser(pendingDelete.id);
      setNotice(`Deleted ${pendingDelete.email}`);
      setPendingDelete(null);
      await loadUsers();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete the portal user.'));
    } finally {
      setDeleting(false);
    }
  }

  const relationshipHint = loadingRelationships
    ? 'Loading relationships…'
    : relationships.length
      ? `${relationships.length} ED relationships available to allocate.`
      : 'No ED relationships were returned by the configured data source.';

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-symbol">))</span>
          <div>
            <div className="brand-name">{brand.name} Admin</div>
            <div className="brand-sub">User &amp; relationship management</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="who">{user?.email}</span>
          <button className="btn btn-link" onClick={logout}>Sign out</button>
        </div>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {upstream?.source === 'mock' && (
        <div className="alert alert-warn" role="status">
          Demo data is active. New users work, but their dashboard and reports are generated mock records until the live Peeredge source is configured.
        </div>
      )}

      <section className="panel admin-create-panel">
        <div className="admin-section-head">
          <div>
            <h2>Create a portal user</h2>
            <p>Each customer account is limited to one dedicated relationship.</p>
          </div>
          <span className={`source-status ${loadingRelationships || !upstream ? 'loading' : upstream.source === 'mock' ? 'warn' : relationships.length ? 'ready' : 'error'}`}>
            {loadingRelationships || !upstream ? 'Loading source' : upstream.source === 'mock' ? 'Mock data' : relationships.length ? 'Live source' : 'Source unavailable'}
          </span>
        </div>
        <form className="admin-form" onSubmit={onCreate}>
          <label>
            Email
            <input type="email" value={email} autoComplete="off" onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              placeholder="Minimum 8 characters"
              aria-invalid={password.length > 0 && !passwordValid}
              aria-describedby="temporary-password-help"
              required
            />
            <span id="temporary-password-help" className={`field-help ${password.length > 0 && !passwordValid ? 'invalid' : ''}`}>
              {password.length > 0 && !passwordValid
                ? `${password.length} of 8 required characters`
                : 'Use at least 8 characters.'}
            </span>
          </label>
          <label>
            Dedicated relationship
            <select
              value={relationshipId}
              onChange={(event) => setRelationshipId(event.target.value)}
              disabled={loadingRelationships || relationships.length === 0}
              required
            >
              <option value="">{loadingRelationships ? 'Loading relationships…' : 'Select an ED relationship…'}</option>
              {relationships.map((relationship) => (
                <option key={relationship.id} value={relationship.id}>
                  {relationship.name} (#{relationship.id})
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            disabled={busy || loadingRelationships || !relationshipId || !emailValid || !passwordValid}
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
        <p className="hint" aria-live="polite">{relationshipHint}</p>
      </section>

      <section className="panel admin-users-panel">
        <div className="admin-section-head">
          <div>
            <h2>Portal users</h2>
            <p>Review the relationship assigned to every customer login.</p>
          </div>
          {!loadingUsers && <span className="user-count">{users.length} {users.length === 1 ? 'account' : 'accounts'}</span>}
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Allocated relationship</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers && (
                <tr><td colSpan={4} className="admin-table-state">Loading portal users…</td></tr>
              )}
              {!loadingUsers && users.length === 0 && (
                <tr><td colSpan={4} className="admin-table-state">No portal users found.</td></tr>
              )}
              {!loadingUsers && users.map((account) => (
                <tr key={account.id}>
                  <td>{account.email}</td>
                  <td><span className={`role-badge ${account.role}`}>{account.role}</span></td>
                  <td>{account.relationshipName ? `${account.relationshipName} (#${account.relationshipId})` : '—'}</td>
                  <td className="admin-table-action">
                    {account.role !== 'admin' && (
                      <button
                        className="btn btn-link btn-danger"
                        aria-label={`Delete ${account.email}`}
                        onClick={() => setPendingDelete(account)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => !deleting && setPendingDelete(null)}>
          <div
            className="modal admin-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" id="delete-user-title">Delete portal user?</div>
            <div className="modal-body">
              <p className="confirm-copy">
                <strong>{pendingDelete.email}</strong> will immediately lose access to the customer portal.
              </p>
              <p className="confirm-meta">Assigned relationship: {pendingDelete.relationshipName ?? 'None'}</p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn btn-danger-solid btn-sm" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'Deleting…' : 'Delete user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
