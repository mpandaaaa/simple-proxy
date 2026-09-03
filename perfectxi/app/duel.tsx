import { useCallback, useMemo, useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Collapse } from '../src/ui/components';
import { color, hue, line, radius, space, alpha, gradient } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  decodeDuel,
  duelRules,
  defaultConfig,
  ordinal,
  type DuelRecord,
  type DuelResult,
} from '../src/engine';
import { duelStore } from '../src/save';
import { startRun } from '../src/game/run';

/**
 * Duels.
 *
 * Two halves of one thing, so they are one screen. You send a challenge
 * and get a code, or you paste a code somebody sent you and play the
 * identical spins.
 *
 * Nothing is uploaded and nothing is fetched. The code is the whole duel,
 * which means it works with no signal, in any messaging app, with anybody,
 * forever.
 */
export default function Duel() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [record, setRecord] = useState<DuelRecord>(() => duelStore.read());
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setRecord(duelStore.read());
      setCopied(false);
    }, []),
  );

  /* What has been typed, if it is a duel at all. Read on every keystroke
     so the card underneath fills in as the last character lands. */
  const incoming = useMemo(() => (code.trim() ? decodeDuel(code) : null), [code]);
  const typed = code.replace(/[^0-9A-Za-z]/g, '').length;

  const send = useCallback(() => {
    haptic('medium');
    sfx('pick');
    /* A challenge is a normal draft that turns into a code at the end,
       which is why the seed is fresh and the rules are the standard ones:
       both of you have to be playing the same game for the code to mean
       anything. */
    startRun({ ...defaultConfig, diff: 'normal' }, undefined, { sending: true });
    router.push('/draft/board');
  }, []);

  const answer = useCallback(() => {
    if (!incoming) return;
    haptic('medium');
    sfx('pick');
    startRun(incoming.config, incoming.seed, { duel: code.trim().toUpperCase() });
    router.push('/draft/board');
  }, [incoming, code]);

  const showAgain = useCallback(async () => {
    if (!record.outstanding) return;
    haptic('light');
    await Share.share({
      message:
        `I have set you a Perfect XI duel.\n\n${record.outstanding}\n\n` +
        `Same spins, same rules. Beat my points.`,
    });
  }, [record.outstanding]);

  const copyOutstanding = useCallback(async () => {
    if (!record.outstanding) return;
    haptic('light');
    await Clipboard.setStringAsync(record.outstanding);
    setCopied(true);
  }, [record.outstanding]);

  const paste = useCallback(async () => {
    haptic('light');
    const text = await Clipboard.getStringAsync();
    if (text) setCode(text.trim());
  }, []);

  const wantsEnter = params.mode === 'enter';

  return (
    <ModeScreen overline="Play today" title="Duels" onBack={() => router.back()}>
      {/* ---- your record ---- */}
      {record.played ? (
        <View style={styles.record}>
          <Shine radius={radius.lg} group="panel" />
          <Stat value={String(record.won)} label="won" tint={hue.emerald} />
          <Stat value={String(record.drew)} label="drawn" tint={hue.amber} />
          <Stat value={String(record.lost)} label="lost" tint={hue.crimson} />
        </View>
      ) : null}

      {/* ---- answering one ---- */}
      <View style={[styles.card, wantsEnter ? styles.cardFirst : null]}>
        <Text style={styles.cardKey}>Somebody sent you a code</Text>
        <Text style={styles.cardNote}>
          Paste it in and you draft from their exact spins, in their shape and
          their era, and the game says who won.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="XXXXX-XXXXX-XXXX"
            placeholderTextColor={color.text3}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            maxLength={20}
          />
          <Press onPress={paste} feel="light" scaleTo={0.95} style={styles.paste}>
            <Text style={styles.pasteText}>Paste</Text>
          </Press>
        </View>

        {incoming ? (
          <Rise delay={0}>
            <View style={styles.reading}>
              <Text style={styles.readingKey}>Their challenge</Text>
              <Text style={styles.readingRules}>{duelRules(incoming)}</Text>
              <Text style={styles.readingScore}>
                {incoming.pts} points to beat, with an XI rated {incoming.rating}.
              </Text>
            </View>
          </Rise>
        ) : typed >= 14 ? (
          <Text style={styles.wrong}>
            That is not a code. Check for a wrong character and try again.
          </Text>
        ) : null}

        <Press
          onPress={answer}
          feel={incoming ? 'medium' : 'none'}
          scaleTo={0.98}
          style={[styles.go, !incoming ? styles.goOff : null]}
        >
          <Text style={[styles.goText, !incoming ? { color: color.text3 } : null]}>
            {incoming ? `Take on ${incoming.pts} points` : 'Enter a code to play'}
          </Text>
        </Press>
      </View>

      {/* ---- sending one ---- */}
      <View style={styles.card}>
        <Text style={styles.cardKey}>Set somebody a challenge</Text>
        <Text style={styles.cardNote}>
          Draft an XI and play the season. At the end you get a code carrying
          your spins, your rules and your points, and whoever you send it to
          plays exactly what you played.
        </Text>
        <Press onPress={send} feel="medium" scaleTo={0.98} style={styles.send}>
          <Text style={styles.sendText}>Draft a challenge</Text>
        </Press>

        {record.outstanding ? (
          <View style={styles.outstanding}>
            <Text style={styles.outKey}>Your last challenge</Text>
            <Text style={styles.outCode} allowFontScaling={false}>
              {record.outstanding}
            </Text>
            <View style={styles.outRow}>
              <Press onPress={copyOutstanding} feel="light" scaleTo={0.97} style={styles.outAct}>
                <Text style={styles.outActText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Press>
              <Press onPress={showAgain} feel="light" scaleTo={0.97} style={styles.outAct}>
                <Text style={styles.outActText}>Send it again</Text>
              </Press>
            </View>
          </View>
        ) : null}
      </View>

      {/* ---- the ones before ---- */}
      {record.results.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Your duels</Text>
          <Collapse label="Every duel you have played" count={record.results.length}>
            <View style={styles.past}>
              {record.results.map((d, i) => (
                <PastDuel key={`${d.code}-${i}`} duel={d} />
              ))}
            </View>
          </Collapse>
        </>
      ) : null}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PastDuel({ duel: d }: { duel: DuelResult }) {
  const tint =
    d.outcome === 'won' ? hue.emerald : d.outcome === 'drew' ? hue.amber : hue.crimson;
  return (
    <View style={styles.pastRow}>
      <Text style={[styles.pastOutcome, { color: tint }]}>{d.outcome}</Text>
      <Text style={styles.pastScore} allowFontScaling={false}>
        {d.mine} {'–'} {d.theirs}
      </Text>
      <Text style={styles.pastWho} numberOfLines={1}>
        {d.sent ? 'you set it' : 'you answered'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  record: {
    flexDirection: 'row',
    paddingVertical: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
    marginBottom: space.s4,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 33,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 8, color: color.text3 },

  card: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.26),
    backgroundColor: '#150C0D',
    experimental_backgroundImage:
      'linear-gradient(180deg, #241214 0%, #150C0D 66%, #0A0607 100%)',
    gap: space.s2,
    marginBottom: space.s4,
  },
  cardFirst: {},
  cardKey: { ...text.key, fontSize: 9.5, color: hue.crimson },
  cardNote: { ...text.small, fontSize: 12.5, lineHeight: 18 },

  inputRow: { flexDirection: 'row', gap: space.s2, marginTop: space.s2 },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: color.text1,
    fontFamily: font.displayBold,
    fontSize: 19,
    letterSpacing: 1.6,
  },
  paste: {
    minWidth: 76,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pasteText: { ...text.key, fontSize: 9.5, color: color.text2 },

  reading: {
    marginTop: space.s2,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.34),
    backgroundColor: alpha(hue.emerald, 0.09),
    gap: 2,
  },
  readingKey: { ...text.key, fontSize: 8.5, color: hue.emerald },
  readingRules: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 21,
    color: color.text1,
  },
  readingScore: { ...text.small, fontSize: 12, lineHeight: 17 },
  wrong: { ...text.small, fontSize: 12, lineHeight: 17, color: hue.amber, marginTop: space.s2 },

  go: {
    marginTop: space.s3,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.5),
    backgroundColor: alpha(hue.crimson, 0.16),
  },
  goOff: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  goText: { ...text.button, fontSize: 15, color: hue.crimson },

  send: {
    marginTop: space.s3,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.5),
    backgroundColor: alpha(hue.sky, 0.14),
  },
  sendText: { ...text.button, fontSize: 15, color: hue.sky },

  outstanding: {
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  outKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  outCode: {
    fontFamily: font.displayBlack,
    fontSize: 21,
    lineHeight: 27,
    color: color.text1,
    letterSpacing: 1.4,
  },
  outRow: { flexDirection: 'row', gap: space.s2 },
  outAct: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  outActText: { ...text.key, fontSize: 9, color: color.text2 },

  sect: { marginTop: space.s5, marginBottom: space.s3 },
  past: { gap: 5, paddingTop: space.s2 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pastOutcome: { ...text.key, fontSize: 9, width: 52 },
  pastScore: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
    width: 86,
    fontVariant: ['tabular-nums'],
  },
  pastWho: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3, flex: 1 },
});
