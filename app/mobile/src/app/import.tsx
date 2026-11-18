import { importSpan, parseBankFile, skipExisting, type ImportedRow, type ImportFormat } from '@current/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chips, Sheet } from '@/components/form';
import { PlusTeaser } from '@/components/plus';
import { useToast } from '@/components/toast';
import { importTransactions } from '@/db/import';
import { pickMainAccount } from '@/db/ledger';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { track } from '@/lib/analytics';
import { getSeeds } from '@/lib/categories';
import { monthDayLabel } from '@/lib/format';
import { usePlus } from '@/lib/plus';

interface Preview {
  format: ImportFormat;
  fresh: ImportedRow[];
  duplicates: number;
  skipped: number;
}

// 2.5 (Plus): pick a CSV or OFX/QFX export, see what's in it, then bring in what's new
export default function ImportScreen() {
  const db = useSQLiteContext();
  const toast = useToast();
  const isPlus = usePlus();
  const { data: accounts } = useLiveQuery(repo.accounts.list);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // read the file on the phone and compare it with what's already logged
  const pick = async () => {
    setError(null);
    setPreview(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled) return;
    const asset = picked.assets[0]!;
    try {
      const text = await new File(asset.uri).text();
      const parsed = parseBankFile(text, asset.name);
      if (!parsed || parsed.rows.length === 0) {
        setError(t('import.unreadable'));
        return;
      }
      const { fresh, duplicates } = skipExisting(parsed.rows, await repo.transactions.list(db));
      setPreview({ format: parsed.format, fresh, duplicates, skipped: parsed.skipped });
    } catch {
      setError(t('import.unreadable'));
    }
  };

  const run = async () => {
    if (!preview || preview.fresh.length === 0) return;
    setBusy(true);
    try {
      const target = accountId ?? pickMainAccount(accounts ?? [])?.id ?? null;
      const count = await importTransactions(db, preview.fresh, target, getSeeds());
      track('import_done', { format: preview.format });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast({ message: t('import.done', { count }) });
      router.back();
    } catch (e) {
      setError(t('common.didntSave', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  if (!isPlus) {
    return (
      <Sheet title={t('import.title')}>
        <PlusTeaser title={t('import.title')} body={t('plus.f.import')} from="import" />
      </Sheet>
    );
  }

  const span = preview ? importSpan(preview.fresh) : null;
  const spendable = (accounts ?? []).filter((a) => a.type !== 'savings');
  const chosen = accountId ?? pickMainAccount(accounts ?? [])?.id ?? null;

  return (
    <Sheet title={t('import.title')}>
      <Text className="font-sans text-base leading-6 text-muted">{t('import.body')}</Text>
      <Button label={t('import.pick')} kind={preview ? 'secondary' : 'primary'} onPress={() => void pick()} />
      {error ? <Text className="font-sans-medium text-base text-ink">{error}</Text> : null}

      {preview ? (
        <View className="gap-2 rounded-md bg-card p-4">
          <Text className="font-sans text-sm text-muted">{t('import.format', { bank: t(`bank.${preview.format}`) })}</Text>
          {span ? (
            <Text className="font-sans-medium text-base text-ink">
              {preview.fresh.length === 1
                ? t('import.foundOne', { from: monthDayLabel(span.from) })
                : t('import.found', { count: preview.fresh.length, from: monthDayLabel(span.from), to: monthDayLabel(span.to) })}
            </Text>
          ) : (
            <Text className="font-sans-medium text-base text-ink">{t('import.nothingNew')}</Text>
          )}
          {preview.duplicates > 0 ? <Text className="font-sans text-base text-muted">{t('import.dupes', { count: preview.duplicates })}</Text> : null}
          {preview.skipped > 0 ? <Text className="font-sans text-base text-muted">{t('import.skipped', { count: preview.skipped })}</Text> : null}
        </View>
      ) : null}

      {preview && preview.fresh.length > 0 ? (
        <>
          {spendable.length > 1 ? (
            <Chips label={t('import.into')} options={spendable.map((a) => ({ value: a.id, label: a.name }))} value={chosen} onChange={setAccountId} />
          ) : null}
          <Text className="font-sans text-sm leading-5 text-muted">{t('import.balanceNote')}</Text>
          <Button label={t('import.go', { count: preview.fresh.length })} onPress={() => void run()} disabled={busy} />
        </>
      ) : null}
    </Sheet>
  );
}
