import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type RelationshipRef, type SessionUser, type UpstreamHealth } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

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
      setNotice(`Created ${email} for ${relationship.name}`);
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
    ? 'Loading relationships...'
    : relationships.length
      ? `${relationships.length} ED relationships available to allocate.`
      : 'No ED relationships were returned by the configured data source.';
  const customerAccounts = users.filter((account) => account.role === 'user');
  const assignedAccounts = customerAccounts.filter((account) => account.relationshipId).length;

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand-lockup">
          <BrandLogo className="admin-brand-logo" />
          <div>
            <div className="admin-brand-sub">Administration console</div>
          </div>
        </div>
        <div className="admin-account-menu">
          <span className="admin-avatar" aria-hidden="true">{user?.email?.charAt(0).toUpperCase() ?? 'A'}</span>
          <span className="admin-account-copy"><small>Signed in as</small><strong>{user?.email}</strong></span>
          <button className="admin-signout" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-hero">
          <div className="admin-hero-copy">
            <span className="admin-eyebrow">Access operations</span>
            <h1>Portal administration</h1>
            <p>Create customer access, allocate one relationship, and monitor account coverage from a single workspace.</p>
          </div>
          <div className="admin-source-card">
            <span className={`source-status ${loadingRelationships || !upstream ? 'loading' : upstream.source === 'mock' ? 'warn' : relationships.length ? 'ready' : 'error'}`}>
              {loadingRelationships || !upstream ? 'Checking source' : upstream.source === 'mock' ? 'Mock source' : relationships.length ? 'Peeredge connected' : 'Source unavailable'}
            </span>
            <small>Relationship directory</small>
            <strong>{loadingRelationships ? 'Syncing...' : `${relationships.length} records available`}</strong>
          </div>
        </section>

        {error && <div className="alert admin-alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert admin-alert alert-ok" role="status">{notice}</div>}
        {upstream?.source === 'mock' && (
          <div className="alert admin-alert alert-warn" role="status">
            Demo data is active. Customer reports will use generated records until the live Peeredge source is configured.
          </div>
        )}

        <section className="admin-metrics" aria-label="Portal account summary">
          <article className="admin-metric admin-metric-primary">
            <span className="admin-metric-icon" aria-hidden="true">01</span>
            <div><small>Portal accounts</small><strong>{loadingUsers ? '--' : users.length}</strong></div>
          </article>
          <article className="admin-metric">
            <span className="admin-metric-icon" aria-hidden="true">02</span>
            <div><small>Customer access</small><strong>{loadingUsers ? '--' : assignedAccounts}</strong></div>
          </article>
          <article className="admin-metric">
            <span className="admin-metric-icon" aria-hidden="true">03</span>
            <div><small>Available relationships</small><strong>{loadingRelationships ? '--' : relationships.length}</strong></div>
          </article>
        </section>

        <div className="admin-golden-grid">
          <section className="admin-neu-panel admin-create-panel">
            <div className="admin-section-head">
              <div>
                <span className="admin-section-kicker">New access</span>
                <h2>Create a portal user</h2>
                <p>Assign one dedicated Peeredge relationship to a customer login.</p>
              </div>
              <span className="admin-step">01</span>
            </div>
            <form className="admin-form" onSubmit={onCreate}>
              <label className="admin-field">
                <span>Email address</span>
                <input type="email" value={email} autoComplete="off" placeholder="name@company.com" onChange={(event) => setEmail(event.target.value)} required />
                <small className="field-help">Used as the customer's sign-in ID.</small>
              </label>
              <label className="admin-field">
                <span>Temporary password</span>
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
                <small id="temporary-password-help" className={`field-help ${password.length > 0 && !passwordValid ? 'invalid' : ''}`}>
                  {password.length > 0 && !passwordValid
                    ? `${password.length} of 8 required characters`
                    : 'The customer can use this password immediately.'}
                </small>
              </label>
              <label className="admin-field">
                <span>Dedicated relationship</span>
                <select
                  value={relationshipId}
                  onChange={(event) => setRelationshipId(event.target.value)}
                  disabled={loadingRelationships || relationships.length === 0}
                  required
                >
                  <option value="">{loadingRelationships ? 'Loading relationships...' : 'Select an ED relationship...'}</option>
                  {relationships.map((relationship) => (
                    <option key={relationship.id} value={relationship.id}>
                      {relationship.name} (#{relationship.id})
                    </option>
                  ))}
                </select>
                <small className="field-help" aria-live="polite">{relationshipHint}</small>
              </label>
              <button
                className="admin-create-button"
                disabled={busy || loadingRelationships || !relationshipId || !emailValid || !passwordValid}
              >
                <span>{busy ? 'Creating account...' : 'Create customer account'}</span>
                <b aria-hidden="true">+</b>
              </button>
            </form>
          </section>

          <section className="admin-neu-panel admin-users-panel">
            <div className="admin-section-head">
              <div>
                <span className="admin-section-kicker">Directory</span>
                <h2>Portal users</h2>
                <p>Review every customer login and its allocated relationship.</p>
              </div>
              {!loadingUsers && <span className="user-count">{users.length} {users.length === 1 ? 'account' : 'accounts'}</span>}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Allocated relationship</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers && (
                    <tr><td colSpan={4} className="admin-table-state">Loading portal users...</td></tr>
                  )}
                  {!loadingUsers && users.length === 0 && (
                    <tr><td colSpan={4} className="admin-table-state">No portal users found.</td></tr>
                  )}
                  {!loadingUsers && users.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <span className="admin-user-cell">
                          <i aria-hidden="true">{account.email.charAt(0).toUpperCase()}</i>
                          <span><strong>{account.email}</strong><small>{account.role === 'admin' ? 'Workspace administrator' : 'Customer portal access'}</small></span>
                        </span>
                      </td>
                      <td><span className={`role-badge ${account.role}`}>{account.role}</span></td>
                      <td className="admin-relationship-cell">{account.relationshipName ? `${account.relationshipName} (#${account.relationshipId})` : 'Not assigned'}</td>
                      <td className="admin-table-action">
                        {account.role !== 'admin' && (
                          <button
                            className="admin-delete-button"
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
        </div>
      </main>

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
                {deleting ? 'Deleting...' : 'Delete user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
