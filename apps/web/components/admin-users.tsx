'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES, type Paged, type Role } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useMe } from './providers';
import { Alert, Badge, ConfirmButton, EmptyState, Input, Loading, Pager, Table, Td } from './ui';

type UserRow = { id: string; fullName: string; email: string; mobile: string; role: Role; status: string; district: string | null; createdAt: string; lastLoginAt: string | null };

/** Searchable, paginated user table. `role` fixes the role filter (students page); otherwise a role filter is shown. */
export function UsersTable({ role }: { role?: Role }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(role ?? '');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '20', ...(q ? { q } : {}), ...(roleFilter ? { role: roleFilter } : {}) });
  const users = useQuery({ queryKey: ['admin-users', params.toString()], queryFn: () => api.get<Paged<UserRow>>(`/admin/users?${params}`), placeholderData: keepPreviousData });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const csv = new URLSearchParams(params);
  csv.set('format', 'csv');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><Input label={t('common:search')} placeholder={t('admin:searchPlaceholder')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {!role && (
          <select aria-label={t('admin:role')} className="min-h-11 rounded-xl border border-line px-2" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">{t('common:all')}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`authentication:roles.${r}`)}</option>)}
          </select>
        )}
        <a href={`/api/v1/admin/users?${csv}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold">{t('common:export')}</a>
      </div>
      {update.error && <Alert tone="danger">{errorText(t, update.error)}</Alert>}
      {users.isLoading ? <Loading /> : !users.data?.items.length ? <EmptyState /> : (
        <>
          <Table head={[t('authentication:fullName'), t('authentication:mobile'), t('admin:role'), t('common:status'), t('admin:joined'), t('common:actions')]}>
            {users.data.items.map((u) => (
              <tr key={u.id}>
                <Td>{u.role === 'STUDENT' ? <Link href={`/counselor/students/${u.id}`} className="font-semibold text-royal underline">{u.fullName}</Link> : <b>{u.fullName}</b>}<br /><span className="text-xs text-muted">{u.email}</span></Td>
                <Td>{u.mobile}<br /><span className="text-xs text-muted">{u.district}</span></Td>
                <Td>
                  {me?.role === 'SUPER_ADMIN' && u.id !== me.id ? (
                    <select aria-label={t('admin:changeRole')} className="min-h-10 rounded-lg border border-line px-1" value={u.role} onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })}>
                      {ROLES.map((r) => <option key={r} value={r}>{t(`authentication:roles.${r}`)}</option>)}
                    </select>
                  ) : t(`authentication:roles.${u.role}`)}
                </Td>
                <Td><Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status === 'ACTIVE' ? t('admin:active') : t('admin:inactive')}</Badge></Td>
                <Td>{formatDate(u.createdAt, lang)}</Td>
                <Td>
                  {u.id !== me?.id && (u.status === 'ACTIVE'
                    ? <ConfirmButton message={t('admin:disableConfirm')} onConfirm={() => update.mutate({ id: u.id, body: { status: 'DISABLED' } })}>{t('admin:disable')}</ConfirmButton>
                    : <ConfirmButton variant="primary" message={t('admin:enable')} onConfirm={() => update.mutate({ id: u.id, body: { status: 'ACTIVE' } })}>{t('admin:enable')}</ConfirmButton>)}
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={page} pageSize={20} total={users.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
