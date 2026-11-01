'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnnouncementDto } from '@acee/shared';
import { formatDate, pickLocalized, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, Input, PageHeader, Select, Textarea } from '@/components/ui';

const LANGS = ['en', 'te', 'hi'] as const;

export default function AdminAnnouncementsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['announcements'], queryFn: () => api.get<{ items: AnnouncementDto[] }>('/announcements') });
  const empty = { en: '', te: '', hi: '' };
  const [f, setF] = useState({ title: { ...empty }, body: { ...empty }, audience: 'PUBLIC', expiresAt: '' });
  const create = useMutation({
    mutationFn: () => api.post('/admin/announcements', { ...f, expiresAt: f.expiresAt || null }),
    onSuccess: () => { setF({ title: { ...empty }, body: { ...empty }, audience: 'PUBLIC', expiresAt: '' }); qc.invalidateQueries({ queryKey: ['announcements'] }); },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/admin/announcements/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:announcements')} />
      <Card title={t('admin:newAnnouncement')}>
        <div className="grid gap-3 md:grid-cols-3">
          {LANGS.map((l) => <Input key={`t${l}`} lang={l} label={`${t('coaching:announcementTitle')} (${t(`common:languages.${l}`)})`} value={f.title[l]} onChange={(e) => setF({ ...f, title: { ...f.title, [l]: e.target.value } })} />)}
          {LANGS.map((l) => <Textarea key={`b${l}`} lang={l} label={`${t('coaching:announcementBody')} (${t(`common:languages.${l}`)})`} value={f.body[l]} onChange={(e) => setF({ ...f, body: { ...f.body, [l]: e.target.value } })} />)}
          <Select label={t('admin:audience')} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={['PUBLIC', 'STUDENTS', 'STAFF'].map((a) => ({ value: a, label: t(`admin:audiences.${a}`) }))} />
          <Input label={t('admin:expiresAt')} type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
        </div>
        {create.error && <div className="mt-3"><Alert tone="danger">{errorText(t, create.error)}</Alert></div>}
        <Button className="mt-3" disabled={!f.title.en.trim() || !f.body.en.trim()} loading={create.isPending} onClick={() => create.mutate()}>{t('common:submit')}</Button>
      </Card>
      {!list.data?.items.length ? <EmptyState /> : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((a) => (
            <li key={a.id} className="rounded-card border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{pickLocalized(a.title, lang)}</b>
                <span className="flex items-center gap-2"><Badge>{t(`admin:audiences.${a.audience}`)}</Badge><span className="text-xs text-muted">{formatDate(a.publishedAt, lang)}</span></span>
              </div>
              <p className="mt-1">{pickLocalized(a.body, lang)}</p>
              <div className="mt-2"><ConfirmButton message={t('common:delete')} onConfirm={() => remove.mutate(a.id)}>{t('common:delete')}</ConfirmButton></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
