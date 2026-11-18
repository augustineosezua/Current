import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Text } from 'react-native';

import { Button, Sheet } from '@/components/form';
import { saveSetting } from '@/db/plan';
import { t } from '@/i18n';

// the one-time screen before any AI feature uses the cloud (2.9): shown only on iPhones that can't run the model
export default function CloudAiScreen() {
  const db = useSQLiteContext();

  const accept = async () => {
    await saveSetting(db, 'cloudAiDisclosedAt', new Date().toISOString());
    router.back();
  };

  // turning it off hides AI features; quick add still works from history
  const decline = async () => {
    await saveSetting(db, 'cloudAiDisclosedAt', new Date().toISOString());
    await saveSetting(db, 'cloudAi', false);
    router.back();
  };

  return (
    <Sheet title={t('ai.disclosureTitle')}>
      <Text className="font-sans-medium text-lg leading-7 text-ink">{t('ai.disclosure')}</Text>
      <Button label={t('ai.disclosureOk')} onPress={() => void accept()} />
      <Button label={t('ai.disclosureOff')} kind="plain" onPress={() => void decline()} />
    </Sheet>
  );
}
