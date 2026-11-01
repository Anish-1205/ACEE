import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Batch, Course } from '@acee/shared';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { publicGet } from '@/lib/server-api';
import { BatchList } from '@/components/batch-list';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  return { title: `${code.toUpperCase()} coaching`, alternates: { canonical: `/coaching/${code.toLowerCase()}` } };
}

export default async function CourseDetailPage({ params }: Params) {
  const { code } = await params;
  const { t, lang } = await getT();
  const data = await publicGet<{ course: Course; batches: Batch[] }>(`/courses/${encodeURIComponent(code)}`, 0); // live seats and batch ids
  if (!data) notFound();
  const { course } = data;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-black text-royal">{course.code}</h1>
      <p className="mt-3 text-lg">{pickLocalized(course.description, lang)}</p>
      <p className="mt-3 rounded-xl bg-success/10 p-3 text-sm">
        <span className="font-semibold">{t('coaching:feeStatus')}:</span> {course.isFree ? t('common:free') : t('coaching:paid', { amount: course.feeAmount ?? 0 })} — {pickLocalized(course.feeNote, lang)}
      </p>
      <h2 className="mb-4 mt-10 text-2xl font-extrabold text-navy">{t('coaching:batches')}</h2>
      <BatchList batches={data.batches} courseCode={course.code} />
    </div>
  );
}
