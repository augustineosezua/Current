import {
  AI_LIMITS,
  answerAskTool,
  resolveAskCategories,
  routeAskQuestion,
  toCents,
  type AiFigure,
  type AiToolResult,
  type AiTurn,
  type AskToolCall,
} from '@current/core';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AppState, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCSSVariable, withUniwind } from 'uniwind';

import { askFigures, askReply } from '@/ai/figures';
import { BackButton } from '@/components/back-button';
import { PlusTeaser } from '@/components/plus';
import { addAskMessage, listChat, newChatId, previousChatId, setAskAction, type AskAction, type AskMessage } from '@/db/ask';
import { addTransaction, pickMainAccount } from '@/db/ledger';
import * as repo from '@/db/repo';
import { loadStsInput, type BudgetData } from '@/db/sts';
import { useAi } from '@/hooks/use-ai';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t, type MessageKey } from '@/i18n';
import { categoryName } from '@/lib/categories';
import { money } from '@/lib/format';
import { afterLogged } from '@/lib/milestones';
import { usePlus } from '@/lib/plus';

const StyledSafeAreaView = withUniwind(SafeAreaView);
const SUGGESTIONS: readonly MessageKey[] = ['ask.s1', 'ask.s2', 'ask.s3', 'ask.s4'];

// names the model may pick from, kept within the proxy's limits
function names(list: readonly string[]): string[] {
  return [...new Set(list.map((n) => n.slice(0, AI_LIMITS.itemLength)))].slice(0, AI_LIMITS.listItems);
}

// the most tools the assistant may call for one message before it has to reply
const MAX_TOOL_CALLS = 3;

// a tool call as core reads it. The model picks one category at most, but everyday words like "food" cover
// several (groceries, takeout, coffee), so code decides which categories a spending question is about; and
// display names map back to the stored names core matches on.
function toCoreCall(call: AskToolCall, text: string, input: BudgetData, categoryNames: string[]): AskToolCall {
  const stored = (name: string | undefined) => input.categories.find((c) => categoryName(c) === name)?.name;
  const out: AskToolCall = { ...call, category: stored(call.category) ?? call.category };
  if (call.tool === 'spending') {
    const resolved = resolveAskCategories(text, categoryNames);
    if (resolved.names.length > 0) {
      out.categories = resolved.names.map((n) => stored(n) ?? n);
      out.topic = resolved.topic;
    }
  }
  return out;
}

// a purchase the assistant offers to log: nothing is saved until the user taps Log it
function LogOffer({ message }: { message: AskMessage & { action: AskAction } }) {
  const db = useSQLiteContext();
  const [error, setError] = useState<string | null>(null);
  const action = message.action;

  const log = async () => {
    const accounts = await repo.accounts.list(db);
    const account = pickMainAccount(accounts) ?? accounts[0];
    if (!account) {
      setError(t('ask.log.noAccount'));
      return;
    }
    const transactionId = await addTransaction(db, {
      accountId: account.id,
      amount: action.amount,
      date: new Date(),
      merchantName: action.merchant,
      categoryId: action.categoryId,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setAskAction(db, message.id, { ...action, status: 'done', transactionId });
    await afterLogged(db).catch(() => null);
  };

  if (action.status !== 'pending') {
    return <Text className="font-sans-bold text-sm text-muted">{action.status === 'done' ? `✓ ${t('ask.log.done')}` : t('ask.log.dismissed')}</Text>;
  }
  return (
    <View className="gap-2">
      {error ? <Text className="font-sans-medium text-sm text-ink">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={() => void log()} accessibilityRole="button" className="min-h-11 justify-center rounded-full bg-cta px-4 active:opacity-70">
          <Text className="font-sans-bold text-sm text-on-cta">{t('ask.log.confirm')}</Text>
        </Pressable>
        <Pressable
          onPress={() => void setAskAction(db, message.id, { ...action, status: 'dismissed' })}
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-full bg-field px-4 active:opacity-70">
          <Text className="font-sans-medium text-sm text-ink">{t('ask.log.dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// one message; an answer can open the figures it was written from, and an offer shows its confirm buttons
function Bubble({ message }: { message: AskMessage }) {
  const [open, setOpen] = useState(false);
  const mine = message.role === 'user';
  return (
    <View className={`max-w-[88%] gap-2 rounded-md p-4 ${mine ? 'self-end bg-cta' : 'self-start bg-card'}`}>
      <Text className={`font-sans text-base leading-6 ${mine ? 'text-on-cta' : 'text-ink'}`}>{message.text}</Text>
      {message.action ? <LogOffer message={message as AskMessage & { action: AskAction }} /> : null}
      {message.figures.length > 0 ? (
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8}>
          <Text className="font-sans-bold text-sm text-muted underline">{open ? t('ask.hideFigures') : t('ask.figures')}</Text>
        </Pressable>
      ) : null}
      {open
        ? message.figures.map((f, i) => (
            // the same figure can come back from two tool calls, so the position keeps keys unique
            <View key={i} className="flex-row justify-between gap-3">
              <Text className="shrink font-sans text-sm text-muted">{f.label}</Text>
              <Text className="shrink text-right font-sans-medium text-sm tabular-nums text-ink">{f.value}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

// 2.13 (Plus): Ask Current. Questions about the user's own budget go to a tool core answers, and the model writes
// the reply from those figures only. Anything else goes to the on-device model as a general assistant, with the
// chat so far. Without a model (no Apple Intelligence, or it fails), code picks the budget tool from keywords and
// writes a plain reply, so budget questions work on every iPhone. Opening the screen, or coming back to the app,
// starts a new chat; the one before it can be reopened. Conversations stay on this phone.
export default function AskScreen() {
  const db = useSQLiteContext();
  const isPlus = usePlus();
  const ai = useAi();
  const [muted, onCta] = useCSSVariable(['--color-muted', '--color-on-cta']) as string[];
  const [chatId, setChatId] = useState(newChatId);
  const loadChat = useCallback((database: SQLiteDatabase) => listChat(database, chatId), [chatId]);
  const loadPrevious = useCallback((database: SQLiteDatabase) => previousChatId(database, chatId), [chatId]);
  const { data: messages } = useLiveQuery(loadChat);
  const { data: previous } = useLiveQuery(loadPrevious);
  const [text, setText] = useState('');

  // leaving the app and coming back starts fresh; the chat just had stays one tap away under "Last chat"
  useEffect(() => {
    let wasAway = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') wasAway = true;
      if (state === 'active' && wasAway) {
        wasAway = false;
        setChatId(newChatId());
      }
    });
    return () => sub.remove();
  }, []);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  // answer one message: the assistant loop when the on-device model is here, otherwise code picks the tool
  const ask = async (question: string, database: SQLiteDatabase) => {
    const q = question.trim().slice(0, AI_LIMITS.question);
    if (!q || busy) return;
    setText('');
    setBusy(true);
    const id = chatId;
    const say = (message: Parameters<typeof addAskMessage>[2]) => addAskMessage(database, id, message);
    // the chat so far, so follow-ups ("and last week?") make sense
    const history: AiTurn[] = (messages ?? []).slice(-AI_LIMITS.historyTurns).map((m) => ({ role: m.role, text: m.text.slice(0, AI_LIMITS.turnLength) }));
    try {
      await say({ role: 'user', text: q });
      const input = await loadStsInput(database);
      const categoryNames = names(input.categories.map(categoryName));
      const goalNames = names(input.goals.map((g) => g.name));

      if (ai.ready && (await runAssistant({ q, input, history, categoryNames, goalNames, say }))) return;

      // no model, or it failed: code picks the tool from keywords and writes a plain reply
      const call = routeAskQuestion(q, categoryNames, goalNames);
      if (!call || call.tool === 'decline') {
        await say({ role: 'assistant', text: ai.ready ? t('ai.failed') : call ? t('ask.declineNoAi') : t('ask.unsure') });
        return;
      }
      const answer = answerAskTool(toCoreCall(call, q, input, categoryNames), input, new Date());
      await say({ role: 'assistant', text: answer.declined ? t('ask.declineNoAi') : askReply(answer, input), figures: askFigures(answer, input), backend: 'code' });
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // the assistant: each step the model calls one of Current's tools or replies. Core answers every tool, so the
  // numbers come from the budget, never the model. Returns false when the model couldn't answer at all.
  const runAssistant = async ({
    q,
    input,
    history,
    categoryNames,
    goalNames,
    say,
  }: {
    q: string;
    input: BudgetData;
    history: AiTurn[];
    categoryNames: string[];
    goalNames: string[];
    say: (message: Parameters<typeof addAskMessage>[2]) => Promise<void>;
  }): Promise<boolean> => {
    const results: AiToolResult[] = [];
    const used: AiFigure[] = [];
    const seen = new Set<string>();
    let mustReply = false;
    for (let step = 0; step <= MAX_TOOL_CALLS; step++) {
      mustReply ||= step === MAX_TOOL_CALLS;
      const out = await ai.run({ task: 'assistant', question: q, history, results, categories: categoryNames, goals: goalNames, mustReply });
      if (!out) return step > 0 ? (await say({ role: 'assistant', text: t('ai.failed'), figures: used }), true) : false;
      const r = out.result;
      if (r.action === 'reply' || mustReply) {
        await say({ role: 'assistant', text: r.reply.trim() || t('ai.failed'), figures: used.slice(0, AI_LIMITS.figures), backend: 'on-device' });
        return true;
      }

      // the same call twice means it has what it needs: reply next
      const key = [r.action, r.category, r.range, r.goal, r.amount].join('|');
      if (seen.has(key)) {
        mustReply = true;
        continue;
      }
      seen.add(key);

      // a purchase to log: offer it with a confirm button, never save on the model's word
      if (r.action === 'log_expense') {
        const amount = toCents(r.amount);
        if (amount === null || amount <= 0) {
          results.push({ tool: 'log_expense', figures: [{ label: t('ask.f.nothing'), value: t('ask.r.none.log_expense') }] });
          continue;
        }
        const category = input.categories.find((c) => categoryName(c) === r.category) ?? null;
        const merchant = r.merchant.trim() && r.merchant !== 'none' ? r.merchant.trim() : null;
        await say({
          role: 'assistant',
          text: t('ask.log.offer', {
            amount: money(amount),
            merchant: merchant ? t('ask.log.at', { merchant }) : '',
            category: category ? t('ask.log.in', { category: categoryName(category) }) : '',
          }),
          action: { type: 'log_expense', amount, merchant, categoryId: category?.id ?? null, status: 'pending' },
          backend: 'on-device',
        });
        return true;
      }

      const call: AskToolCall = {
        tool: r.action,
        range: r.range,
        category: r.category === 'none' ? undefined : r.category,
        goal: r.goal === 'none' ? undefined : r.goal,
        amount: r.amount || undefined,
      };
      const answer = answerAskTool(toCoreCall(call, `${q} ${call.category ?? ''}`, input, categoryNames), input, new Date());
      const figures = askFigures(answer, input);
      results.push({ tool: r.action, figures });
      used.push(...figures);
    }
    return false;
  };

  if (!isPlus) {
    return (
      <StyledSafeAreaView className="flex-1 gap-5 bg-bg px-5 pt-3">
        <BackButton />
        <Text className="font-display text-4xl text-ink">{t('ask.title')}</Text>
        <PlusTeaser title={t('ask.title')} body={t('plus.f.ask')} from="ask" />
      </StyledSafeAreaView>
    );
  }

  const list = messages ?? [];

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 pt-3">
          <BackButton />
          <View className="flex-row gap-4">
            {previous ? (
              <Pressable onPress={() => setChatId(previous)} accessibilityRole="button" hitSlop={8} className="active:opacity-70">
                <Text className="font-sans-medium text-base text-muted">{t('ask.lastChat')}</Text>
              </Pressable>
            ) : null}
            {list.length > 0 ? (
              <Pressable onPress={() => setChatId(newChatId())} accessibilityRole="button" hitSlop={8} className="active:opacity-70">
                <Text className="font-sans-medium text-base text-ink">{t('ask.newChat')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView
          ref={scroll}
          className="flex-1"
          contentContainerClassName="gap-3 px-5 py-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          <Text className="font-display text-4xl text-ink">{t('ask.title')}</Text>
          <Text className="font-sans text-base leading-6 text-muted">{ai.ready ? t('ask.intro') : t('ask.introNoAi')}</Text>
          {list.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {busy ? <Text className="font-sans-medium text-base text-muted">{t('ask.thinking')}</Text> : null}
        </ScrollView>

        <View className="gap-2 px-5 pb-3">
          {text === '' && !busy ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
              {SUGGESTIONS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => void ask(t(key), db)}
                  accessibilityRole="button"
                  className="min-h-11 justify-center rounded-full bg-field px-4 active:opacity-70">
                  <Text className="font-sans-medium text-sm text-ink">{t(key)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View className="flex-row items-center gap-2 rounded-full bg-field pl-4 pr-1">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('ask.placeholder')}
              placeholderTextColor={muted}
              maxLength={AI_LIMITS.question}
              returnKeyType="send"
              onSubmitEditing={() => void ask(text, db)}
              accessibilityLabel={t('ask.placeholder')}
              className="min-h-12 flex-1 font-sans-medium text-base text-ink"
            />
            <Pressable
              onPress={() => void ask(text, db)}
              disabled={busy || !text.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('ask.send')}
              className={`h-11 w-11 items-center justify-center rounded-full bg-cta ${busy || !text.trim() ? 'opacity-40' : ''}`}>
              <SymbolView name="arrow.up" size={18} weight="bold" tintColor={onCta} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
