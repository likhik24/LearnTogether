'use client';

import { useCallback, useState } from 'react';
import { Role, type PublicUser } from '@learn-and-build/api-client';
import { createAuthClient } from '../../lib/api';

const ROLES: Role[] = [Role.USER, Role.TEACHER, Role.ADMIN];

export default function AdminPage() {
  const [token, setToken] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
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
    <section>
      <h1>Admin Console</h1>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {!token ? (
        <form onSubmit={onLogin} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
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
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Email</th>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.email}</td>
            <td>{u.displayName}</td>
            <td>
              <select
                value={u.role}
                onChange={(e) => onChangeRole(u.id, e.target.value as Role)}
              >
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
  );
}
