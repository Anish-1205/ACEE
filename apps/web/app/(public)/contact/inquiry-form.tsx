'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inquirySchema } from '@acee/shared';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Button, Card, Checkbox, Input, Select, Textarea } from '@/components/ui';

const INTERESTS = ['SCHOLARSHIP', 'COACHING', 'ADMISSION', 'OTHER'] as const;

export function InquiryForm() {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: '', mobile: '', email: '', interest: 'SCHOLARSHIP', message: '', consent: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [formError, setFormError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inquirySchema.safeParse(f);
    setErrors(fieldErrors(t, parsed));
    if (!parsed.success) return;
    setState('busy');
    try {
      await api.post('/inquiries', parsed.data);
      setState('sent');
    } catch (err) {
      setFormError(errorText(t, err));
      setState('idle');
    }
  }

  if (state === 'sent') return <Card><Alert tone="success">{t('common:contactPage.sent')}</Alert></Card>;
  return (
    <Card title={t('common:contactPage.formTitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label={t('authentication:fullName')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input label={t('authentication:mobile')} type="tel" inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} error={errors.mobile} />
        <Input label={<>{t('authentication:email')} ({t('common:optional')})</>} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select label={t('common:contactPage.interest')} value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })}
          options={INTERESTS.map((i) => ({ value: i, label: t(`common:contactPage.interests.${i}`) }))} />
        <Textarea label={t('admin:message')} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={2000} />
        <Checkbox label={t('common:contactPage.consent')} checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} error={errors.consent} />
        <Button type="submit" loading={state === 'busy'}>{t('common:submit')}</Button>
      </form>
    </Card>
  );
}
