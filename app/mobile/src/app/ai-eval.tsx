import { AI_EVAL_SET, EVAL_CATEGORIES, gradeAiEval, type AiResults } from '@current/core';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { runAi } from '@/ai';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { t } from '@/i18n';
import { DEBUG_TOOLS } from '@/lib/debug';

// testing builds only (DEBUG_TOOLS): run the 2.9 test set on whichever backend this phone uses and show the pass rate.
// Run before each release and after every major iOS update. The cloud side also has app/api/scripts/ai-eval.ts.
export default function AiEvalScreen() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setLines([]);
    let passed = 0;
    let backend = '';
    // cloud runs need the disclosure accepted in Settings first; this screen assumes it
    const settings = { cloudAi: true, cloudAiDisclosedAt: 'eval' };
    for (const c of AI_EVAL_SET) {
      const answer =
        c.task === 'parse'
          ? await runAi({ task: 'parse', text: c.text, categories: EVAL_CATEGORIES }, settings)
          : await runAi({ task: 'route', question: c.question, categories: EVAL_CATEGORIES, goals: ['Laptop'] }, settings);
      backend = answer?.backend ?? backend;
      const ok = !!answer && gradeAiEval(c, answer.result as AiResults['parse'] | AiResults['route']);
      if (ok) passed++;
      else setLines((l) => [...l, `✗ ${c.task === 'parse' ? c.text : c.question} → ${JSON.stringify(answer?.result ?? null)}`]);
    }
    setLines((l) => [`${passed}/${AI_EVAL_SET.length} passed (${backend || 'no backend'})`, ...l]);
    setRunning(false);
  };

  if (!DEBUG_TOOLS) return <Screen header={<BackButton />}>{null}</Screen>;
  return (
    <Screen header={<BackButton />} title={t('settings.aiTest')}>
      <Button label={running ? t('common.loading') : 'Run'} onPress={() => void run()} disabled={running} />
      <View className="gap-2">
        {lines.map((line, i) => (
          <Text key={i} className="font-sans text-sm text-ink">
            {line}
          </Text>
        ))}
      </View>
    </Screen>
  );
}
