import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALLOWED_UPLOAD_TYPES, DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES, type DocumentDto } from '@acee/shared';
import { formatDate } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, ErrorView, H2, Loading, Notice, P, Screen, s, type Tone } from '@/components/ui';

const TONE: Record<string, Tone> = { PENDING: 'info', APPROVED: 'success', REJECTED: 'danger', MISSING: 'neutral' };
type Picked = { uri: string; name: string; mimeType: string; size?: number };

export default function Documents() {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ tone: Tone; text: string }>();
  const q = useQuery({ queryKey: ['documents'], queryFn: () => api.get<{ items: DocumentDto[] }>('/documents/mine') });

  const upload = useMutation({
    mutationFn: ({ category, file }: { category: string; file: Picked }) => {
      const fd = new FormData();
      fd.append('category', category);
      // React Native's FormData accepts a { uri, name, type } file descriptor.
      fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      return api.request<DocumentDto>('POST', '/documents', fd);
    },
    onSuccess: () => { setMsg({ tone: 'success', text: t('documents:uploaded') }); qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: () => setMsg({ tone: 'danger', text: t('documents:badType') }),
  });

  const send = (category: string, f: Picked) => {
    if (f.size && f.size > MAX_UPLOAD_BYTES) return setMsg({ tone: 'danger', text: t('documents:tooLarge') });
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(f.mimeType)) return setMsg({ tone: 'danger', text: t('documents:badType') });
    upload.mutate({ category, file: f });
  };
  const pickFile = async (category: string) => {
    const r = await DocumentPicker.getDocumentAsync({ type: [...ALLOWED_UPLOAD_TYPES], copyToCacheDirectory: true });
    const a = r.assets?.[0];
    if (!r.canceled && a) send(category, { uri: a.uri, name: a.name, mimeType: a.mimeType ?? '', size: a.size });
  };
  const takePhoto = async (category: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    // Moderate quality keeps uploads small on slow networks.
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] });
    const a = r.assets?.[0];
    if (!r.canceled && a) send(category, { uri: a.uri, name: `${category.toLowerCase()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  };

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error) return <Screen><ErrorView onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <P muted>{t('documents:subtitle')}</P>
      <Notice tone="warning" text={t('documents:sensitiveWarning')} />
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {DOCUMENT_CATEGORIES.map((cat) => {
        const d = q.data!.items.find((x) => x.category === cat && x.status !== 'SUPERSEDED');
        const status = d?.status ?? 'MISSING';
        return (
          <Card key={cat}>
            <View style={s.row}><View style={{ flex: 1 }}><H2>{t(`documents:categories.${cat}`)}</H2></View><Badge tone={TONE[status]} label={t(`documents:statuses.${status}`)} /></View>
            {d && <P muted>{d.fileName} · {formatDate(d.createdAt, lang)}</P>}
            {d?.rejectionReason && <P style={{ color: '#B3261E' }}>{t('documents:rejectionReason', { reason: d.rejectionReason })}</P>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button variant="outline" title={d ? t('documents:reupload') : t('documents:chooseFile')} onPress={() => pickFile(cat)} loading={upload.isPending && upload.variables?.category === cat} /></View>
              <View style={{ flex: 1 }}><Button variant="outline" title={t('documents:takePhoto')} onPress={() => takePhoto(cat)} /></View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
