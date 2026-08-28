'use client';

import { useCallback, useEffect, useState } from 'react';
import { Role, type OidcProviderInfo, type PublicUser } from '@learn-and-build/api-client';
import { createAuthClient } from '../../lib/api';

const ROLES: Role[] = [Role.USER, Role.TEACHER, Role.ADMIN];

export default function AdminPage() {
  const [token, setToken] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [providers, setProviders] = useState<OidcProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (tok: string) => {
    try {
      const client = createAuthClient(tok);
      setUsers(await client.listUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }, []);

  // On mount: capture a token returned by the OIDC redirect (#access_token=...)
  // and load the list of configured OIDC providers for the sign-in buttons.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const oidcToken = hash.get('access_token');
    if (hash.get('error')) {
      setError('OIDC sign-in failed');
    }
    if (oidcToken) {
      history.replaceState(null, '', window.location.pathname);
      setToken(oidcToken);
      void loadUsers(oidcToken);
    }
    createAuthClient()
      .oidcProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [loadUsers]);

  const onLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await createAuthClient().login(email, password);
        setToken(res.accessToken);
        await loadUsers(res.accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    },
    [email, password, loadUsers],
  );

  const onChangeRole = useCallback(
    async (id: string, role: Role) => {
      if (!token) return;
      try {
        await createAuthClient(token).setUserRole(id, role);
        await loadUsers(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set role');
      }
    },
    [token, loadUsers],
  );

  return (
    <section className="admin-page">
      <h1>Admin Console</h1>
      {error && <p className="admin-error">{error}</p>}
      {!token ? (
        <div className="admin-login">
          <form onSubmit={onLogin}>
            <input
              type="email"
              placeholder="admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Sign in</button>
          </form>
          {providers.length > 0 && (
            <div className="admin-oidc">
              <span>Or continue with</span>
              {providers.map((p) => (
                <a key={p.id} href={p.loginUrl}>
                  Sign in with {p.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <UsersTable users={users} onChangeRole={onChangeRole} />
      )}
    </section>
  );
}

function UsersTable({
  users,
  onChangeRole,
}: {
  users: PublicUser[];
  onChangeRole: (id: string, role: Role) => void;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.displayName}</td>
              <td>
                <select value={u.role} onChange={(e) => onChangeRole(u.id, e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
