'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClassModerationStatus,
  Role,
  VerificationStatus,
  type ClassOfferingDto,
  type ModerationAuditDto,
  type OidcProviderInfo,
  type PublicUser,
  type TeacherProfileDto,
} from '@learn-and-build/types';
import { createAuthClient, createSchedulingClient, createTeacherClient } from '../../lib/api';

const ROLES: Role[] = [Role.USER, Role.TEACHER, Role.ADMIN];
const TEACHER_STATUSES = Object.values(VerificationStatus);

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfileDto[]>([]);
  const [classes, setClasses] = useState<ClassOfferingDto[]>([]);
  const [audits, setAudits] = useState<ModerationAuditDto[]>([]);
  const [providers, setProviders] = useState<OidcProviderInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const [loadedUsers, teacherGroups, classQueue, teacherHistory, classHistory] =
        await Promise.all([
          createAuthClient().listUsers(),
          Promise.all(
            TEACHER_STATUSES.map((status) =>
              createTeacherClient().listTeachersForModeration(status),
            ),
          ),
          createSchedulingClient().listClassesForModeration(),
          createTeacherClient().teacherModerationHistory(),
          createSchedulingClient().classModerationHistory(),
        ]);
      setUsers(loadedUsers);
      setTeachers(teacherGroups.flat());
      setClasses(classQueue);
      setAudits(
        [...teacherHistory, ...classHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      setAuthenticated(true);
      setError(null);
    } catch (caught) {
      setAuthenticated(false);
      setError(caught instanceof Error ? caught.message : 'Failed to load admin workspace');
    }
  }, []);

  useEffect(() => {
    createAuthClient()
      .oidcProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
    createAuthClient()
      .me()
      .then((me) => {
        if (me.role !== Role.ADMIN) throw new Error('Administrator access is required.');
        return loadWorkspace();
      })
      .catch(() => undefined);
  }, [loadWorkspace]);

  const pendingTeacherCount = useMemo(
    () =>
      teachers.filter((teacher) =>
        [VerificationStatus.SUBMITTED, VerificationStatus.UNDER_REVIEW].includes(
          teacher.verificationStatus,
        ),
      ).length,
    [teachers],
  );

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await createAuthClient().login(email, password);
      if (response.user.role !== Role.ADMIN) throw new Error('Administrator access is required.');
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed');
    }
  }

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moderation action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectTeacher(teacher: TeacherProfileDto) {
    const reason = window.prompt('Reason to share with this provider:');
    if (!reason?.trim()) return;
    await runAction(teacher.id, () =>
      createTeacherClient().rejectTeacher(teacher.id, reason.trim()),
    );
  }

  async function rejectClass(item: ClassOfferingDto) {
    const reason = window.prompt('Reason to share with this provider:');
    if (!reason?.trim()) return;
    await runAction(item.id, () => createSchedulingClient().rejectClass(item.id, reason.trim()));
  }

  async function signOut() {
    await createAuthClient().logout();
    setAuthenticated(false);
    setUsers([]);
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <span>OPERATIONS</span>
          <h1>Admin Console</h1>
        </div>
        {authenticated && <button onClick={signOut}>Sign out</button>}
      </div>
      {error && <p className="admin-error">{error}</p>}
      {!authenticated ? (
        <div className="admin-login">
          <form onSubmit={onLogin}>
            <input
              type="email"
              placeholder="admin email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit">Sign in</button>
          </form>
          {providers.length > 0 && (
            <div className="admin-oidc">
              <span>Or continue with</span>
              {providers.map((provider) => (
                <a key={provider.id} href={`${provider.loginUrl}?returnTo=%2Fadmin`}>
                  Sign in with {provider.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="admin-workspace">
          <div className="admin-stats">
            <span>
              <strong>{pendingTeacherCount}</strong> provider reviews
            </span>
            <span>
              <strong>
                {
                  classes.filter((item) => item.moderationStatus === ClassModerationStatus.PENDING)
                    .length
                }
              </strong>{' '}
              class reviews
            </span>
            <span>
              <strong>{users.length}</strong> users
            </span>
          </div>

          <AdminSection title="Provider verification" count={teachers.length}>
            <div className="admin-card-grid">
              {teachers.map((teacher) => (
                <article className="admin-review-card" key={teacher.id}>
                  <div>
                    <span className="admin-badge">
                      {teacher.verificationStatus.replaceAll('_', ' ')}
                    </span>
                    <h3>{teacher.displayName}</h3>
                    <p>
                      {teacher.email || 'No public email'} · {teacher.city || 'Location missing'}
                    </p>
                  </div>
                  <p>{teacher.bio || teacher.skillDescription || 'No provider summary yet.'}</p>
                  <ul>
                    {teacher.documents.map((document) => (
                      <li key={document.id}>
                        {document.type}: {document.fileName}{' '}
                        <a
                          href={`/api/teacher/admin/teachers/${teacher.id}/documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review document
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="admin-actions">
                    {teacher.verificationStatus === VerificationStatus.SUBMITTED && (
                      <button
                        disabled={busyId === teacher.id}
                        onClick={() =>
                          runAction(teacher.id, () =>
                            createTeacherClient().startTeacherReview(teacher.id),
                          )
                        }
                      >
                        Start review
                      </button>
                    )}
                    {teacher.verificationStatus === VerificationStatus.UNDER_REVIEW && (
                      <button
                        disabled={busyId === teacher.id}
                        onClick={() =>
                          runAction(teacher.id, () =>
                            createTeacherClient().approveTeacher(teacher.id),
                          )
                        }
                      >
                        Approve
                      </button>
                    )}
                    {[VerificationStatus.SUBMITTED, VerificationStatus.UNDER_REVIEW].includes(
                      teacher.verificationStatus,
                    ) && (
                      <button
                        className="danger"
                        disabled={busyId === teacher.id}
                        onClick={() => rejectTeacher(teacher)}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Class moderation" count={classes.length}>
            <div className="admin-card-grid">
              {classes.map((item) => (
                <article className="admin-review-card" key={item.id}>
                  <div>
                    <span className="admin-badge">{item.moderationStatus}</span>
                    <h3>{item.activity}</h3>
                    <p>
                      {item.category} · ages {item.ageMin}–{item.ageMax} · ₹{item.priceMinor / 100}
                    </p>
                  </div>
                  <p>{item.description || 'No class description.'}</p>
                  <p>
                    {item.venueName || 'Venue missing'} · {item.seats} seats · {item.status}
                  </p>
                  {item.moderationReason && (
                    <p className="admin-note">Previous note: {item.moderationReason}</p>
                  )}
                  {item.moderationStatus === ClassModerationStatus.PENDING && (
                    <div className="admin-actions">
                      <button
                        disabled={busyId === item.id}
                        onClick={() =>
                          runAction(item.id, () => createSchedulingClient().approveClass(item.id))
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="danger"
                        disabled={busyId === item.id}
                        onClick={() => rejectClass(item)}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="Users and roles" count={users.length}>
            <UsersTable
              users={users}
              onChangeRole={(id, role) =>
                runAction(id, () => createAuthClient().setUserRole(id, role))
              }
            />
          </AdminSection>

          <AdminSection title="Audit history" count={audits.length}>
            <div className="admin-audit-list">
              {audits.map((audit) => (
                <article key={`${audit.resourceType}-${audit.id}`}>
                  <strong>
                    {audit.resourceType} · {audit.action.replaceAll('_', ' ')}
                  </strong>
                  <span>{new Date(audit.createdAt).toLocaleString()}</span>
                  <p>{audit.note || 'No moderator note.'}</p>
                </article>
              ))}
            </div>
          </AdminSection>
        </div>
      )}
    </section>
  );
}

function AdminSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-section">
      <header>
        <h2>{title}</h2>
        <span>{count}</span>
      </header>
      {children}
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
            <th>Verified</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.displayName}</td>
              <td>{user.emailVerified ? 'Yes' : 'No'}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(event) => onChangeRole(user.id, event.target.value as Role)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
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
