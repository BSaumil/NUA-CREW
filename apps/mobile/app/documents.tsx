import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/state/AuthProvider';
import { session } from '@/api/session';
import { messageOf, UserMessage } from '@/api/client';
import {
  documentKey,
  downloadPrivateDocument,
  ensureDocumentSession,
  useDeleteDocument,
  useDocuments,
  useDocumentStatus,
  useUploadDocument,
  type DocumentMetadata,
} from '@/api/documents';
import { Button, Card, Chip, ErrorState, Field, Row, Screen, Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';

type Picked = {
  uri: string;
  name: string;
  type: DocumentMetadata['content_type'];
  size: number;
  webFile?: globalThis.File;
};
const KINDS = [
  ['resume', 'Resume'],
  ['rsa', 'RSA'],
  ['food_safety', 'Food safety'],
  ['first_aid', 'First aid'],
  ['qualification', 'Qualification'],
  ['other', 'Other'],
] as const;
function cleanup(file: Picked | null) {
  if (Platform.OS !== 'web' && file?.uri.startsWith(Paths.cache.uri)) {
    try {
      new File(file.uri).delete();
    } catch {
      /* OS cache cleanup remains available. */
    }
  }
}

export default function Documents() {
  const auth = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const docs = useDocuments();
  const status = useDocumentStatus();
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const qc = useQueryClient();
  const [kind, setKind] = useState<DocumentMetadata['kind']>('resume');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [state, setState] = useState<DocumentMetadata['jurisdiction']>(null);
  const [completed, setCompleted] = useState('');
  const [due, setDue] = useState('');
  const [selected, setSelected] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const current = useRef<Picked | null>(null);
  const busy = useRef(false);
  const retry = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cleanup(current.current);
    };
  }, []);
  const enabled = status.data?.upload_enabled === true;
  async function pick(camera: boolean) {
    const revision = session.generation();
    setError(null);
    try {
      let file: Picked;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        ensureDocumentSession(revision);
        if (!permission.granted)
          throw new UserMessage(
            'Camera permission was not granted. You can choose a file instead.',
          );
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset) return;
        file = {
          uri: asset.uri,
          name: asset.fileName ?? 'certificate.jpg',
          type: (asset.mimeType ?? 'image/jpeg') as Picked['type'],
          size: asset.fileSize ?? new File(asset.uri).size,
        };
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type:
            kind === 'resume' ? 'application/pdf' : ['application/pdf', 'image/jpeg', 'image/png'],
          copyToCacheDirectory: true,
          multiple: false,
          base64: false,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset) return;
        file = {
          uri: asset.uri,
          name: asset.name,
          type: (asset.mimeType ??
            (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')) as Picked['type'],
          size:
            asset.size ??
            (Platform.OS === 'web' ? (asset.file?.size ?? 0) : new File(asset.uri).size),
          webFile: asset.file,
        };
      }
      try {
        ensureDocumentSession(revision);
        if (
          !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
          (kind === 'resume' && file.type !== 'application/pdf')
        )
          throw new UserMessage('Choose a PDF resume, or a PDF/JPG/PNG certificate.');
        if (!file.size || file.size > 4 * 1024 * 1024)
          throw new UserMessage('Choose a file up to 4 MB.');
      } catch (e) {
        cleanup(file);
        throw e;
      }
      cleanup(current.current);
      current.current = file;
      setSelected(file);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function save() {
    if (busy.current || !selected) return;
    const revision = session.generation();
    busy.current = true;
    setError(null);
    setNotice('');
    try {
      if (!title.trim()) throw new UserMessage('Give the document a name.');
      const metadata = {
        kind,
        title: title.trim(),
        filename: selected.name,
        content_type: selected.type,
        size_bytes: selected.size,
        issuer: issuer.trim() || null,
        jurisdiction: state,
        completed_on: completed || null,
        review_due_on: due || null,
      };
      const fingerprint = JSON.stringify([metadata, selected.uri]);
      if (retry.current.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: randomUUID() };
      const bytes =
        Platform.OS === 'web'
          ? new Uint8Array(await selected.webFile!.arrayBuffer())
          : await new File(selected.uri).bytes();
      ensureDocumentSession(revision);
      await upload.mutateAsync({
        metadata: { ...metadata, client_key: retry.current.key },
        bytes,
        revision,
      });
      ensureDocumentSession(revision);
      cleanup(current.current);
      current.current = null;
      setSelected(null);
      retry.current = { fingerprint: '', key: '' };
      setTitle('');
      setNotice('Saved after scanning. Qualification not verified.');
    } catch (e) {
      setError(messageOf(e));
      void qc.invalidateQueries({ queryKey: documentKey });
    } finally {
      busy.current = false;
    }
  }
  if (auth.role !== 'candidate')
    return (
      <Screen>
        <Text accessibilityRole="alert">A candidate account is required.</Text>
      </Screen>
    );
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        Your document wallet
      </Text>
      <Text muted>
        Private until you select files for a job application. Uploading does not verify a
        qualification.
      </Text>
      <Button title="Back to profile" variant="secondary" onPress={() => router.back()} />
      <Text accessibilityRole="status">
        {String(status.data?.message ?? 'Checking upload availability…')}
      </Text>
      <Card>
        <Text variant="heading">Upload a document</Text>
        <Row>
          {KINDS.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={kind === value}
              disabled={upload.isPending}
              onPress={() => {
                cleanup(current.current);
                current.current = null;
                setSelected(null);
                setKind(value);
              }}
            />
          ))}
        </Row>
        <Field
          label="Document name"
          value={title}
          onChangeText={setTitle}
          maxLength={160}
          editable={!upload.isPending}
        />
        {kind !== 'resume' ? (
          <>
            <Field
              label="Issuer (optional)"
              value={issuer}
              onChangeText={setIssuer}
              maxLength={160}
              editable={!upload.isPending}
            />
            <Text variant="label">State or territory</Text>
            <Row>
              {(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const).map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={state === s}
                  onPress={() => setState(state === s ? null : s)}
                  disabled={upload.isPending}
                />
              ))}
            </Row>
            <Field
              label="Completed on (YYYY-MM-DD, optional)"
              value={completed}
              onChangeText={setCompleted}
              editable={!upload.isPending}
            />
            <Field
              label="Refresher / review due (YYYY-MM-DD, optional)"
              value={due}
              onChangeText={setDue}
              editable={!upload.isPending}
            />
          </>
        ) : null}
        <Button
          title={selected ? 'Choose a different file' : 'Choose file'}
          variant="secondary"
          disabled={!enabled || upload.isPending}
          onPress={() => void pick(false)}
        />
        {kind !== 'resume' && Platform.OS !== 'web' ? (
          <Button
            title="Photograph certificate"
            variant="secondary"
            disabled={!enabled || upload.isPending}
            onPress={() => void pick(true)}
          />
        ) : null}
        {selected ? (
          <Text>
            {selected.name} · {(selected.size / 1024 / 1024).toFixed(1)} MB
          </Text>
        ) : null}
        <Button
          title="Upload and scan"
          disabled={!enabled || !selected}
          loading={upload.isPending}
          onPress={() => void save()}
        />
        {error ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        {notice ? <Text accessibilityRole="status">{notice}</Text> : null}
      </Card>
      <Text variant="heading">Saved documents</Text>
      {docs.isError ? (
        <ErrorState message={messageOf(docs.error)} onRetry={() => void docs.refetch()} />
      ) : null}
      {!docs.data?.length ? (
        <Text muted>No saved documents yet. Resume text is still available in Profile.</Text>
      ) : (
        docs.data.map((d) => (
          <Card key={d.id}>
            <Text variant="heading">{d.title}</Text>
            <Text>
              {d.kind.replaceAll('_', ' ')} ·{' '}
              {d.status === 'ready'
                ? 'Scanned file; qualification not verified'
                : 'Upload incomplete'}
            </Text>
            {d.review_due_on ? <Text>Review/refresher due: {d.review_due_on}</Text> : null}
            {d.status === 'ready' && Platform.OS !== 'web' ? (
              <Button
                title={`Open ${d.title}`}
                variant="secondary"
                onPress={() => {
                  void downloadPrivateDocument(
                    `/v1/candidate/documents/${d.id}/content`,
                    d.content_type,
                    () => active.current,
                  ).catch((e) => setError(messageOf(e)));
                }}
              />
            ) : null}
            <Button
              title={`Remove ${d.title}`}
              variant="secondary"
              disabled={remove.isPending}
              onPress={() => {
                void remove.mutateAsync(d.id).catch((e) => setError(messageOf(e)));
              }}
            />
          </Card>
        ))
      )}
      <Text variant="caption" muted>
        RSA recognition depends on the state and your refresher history. An uploaded file is not
        proof of current eligibility.
      </Text>
    </Screen>
  );
}
