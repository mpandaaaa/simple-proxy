import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Application from 'expo-application';
import { ModeScreen, Press, Rise, Toggle, Confirm } from '../src/ui/components';
import { go } from '../src/game/nav';
import { alpha, color, hue, line, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import { ENGINE_VERSION } from '../src/engine';
import {
  wipeCollection,
  wipeDynasty,
  wipeEverything,
  wipeUcl,
  wipeWorldCup,
} from '../src/game/reset';
import {
  careerStore,
  collectionStore,
  displayName,
  dynastyStore,
  historyStore,
  owned,
  progressStore,
  rename,
  settingsStore,
  uclStore,
  worldCupStore,
  type MatchSpeed,
} from '../src/save';

/**
 * Settings.
 *
 * Everything on this screen does something. There is no switch here that
 * is stored and never read: two of those existed from the first build and
 * they have been taken out rather than dressed up, because a settings
 * screen that lies about what it controls is worse than a short one.
 *
 * Three groups. How the game feels, who this phone is, and what is saved
 * on it, with the last one able to throw any of it away.
 */

const SPEEDS: { id: MatchSpeed; label: string; note: string }[] = [
  { id: 'slow', label: 'Slow', note: 'Every minute, unhurried' },
  { id: 'normal', label: 'Normal', note: 'Ninety minutes in about eight seconds' },
  { id: 'fast', label: 'Fast', note: 'Half the time, same commentary' },
  { id: 'instant', label: 'Instant', note: 'Straight to full time' },
];

type Wipe = 'worldcup' | 'ucl' | 'dynasty' | 'collection' | 'everything' | null;

const WIPE_TEXT: Record<Exclude<Wipe, null>, { title: string; body: string; label: string }> = {
  worldcup: {
    title: 'Throw away the World Cup?',
    body: 'The tournament you have on the go is deleted. Achievements you have already earned are kept.',
    label: 'Delete it',
  },
  ucl: {
    title: 'Throw away the campaign?',
    body: 'The Champions League campaign you have on the go is deleted. Achievements you have already earned are kept.',
    label: 'Delete it',
  },
  dynasty: {
    title: 'End the career?',
    body: 'The whole Dynasty career is deleted, every season of it. This cannot be undone.',
    label: 'Delete it',
  },
  collection: {
    title: 'Empty the album?',
    body: 'Every card, every completed set and everything bought with coins is deleted. Your level and coins are kept.',
    label: 'Empty it',
  },
  everything: {
    title: 'Delete everything?',
    body: 'Every season, career, card, coin, level and achievement on this phone. There is no backup and no way back.',
    label: 'Delete everything',
  },
};

export default function SettingsScreen() {
  const [s, setS] = useState(() => settingsStore.read());
  const [name, setName] = useState(() => displayName());
  const [wipe, setWipe] = useState<Wipe>(null);
  const [tick, setTick] = useState(0);

  const set = useCallback(<K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
    haptic('light');
    const next = settingsStore.update((cur) => ({ ...cur, [key]: value }));
    setS(next);
  }, []);

  /* What is actually on the phone, so the delete buttons are not abstract. */
  const held = useMemo(() => {
    void tick;
    const history = historyStore.read();
    const cards = owned(collectionStore.read()).size;
    const career = careerStore.read();
    const dyn = dynastyStore.read();
    const wc = worldCupStore.read();
    const ucl = uclStore.read();
    const prog = progressStore.read();
    return {
      seasons: history.runs?.length ?? 0,
      cards,
      earned: career.earned.length,
      dynasty: dyn ? `${dyn.club}, season ${dyn.year}` : null,
      worldCup: wc ? (wc.over ? 'finished' : `${wc.played.length} played`) : null,
      ucl: ucl ? (ucl.over ? 'finished' : `${ucl.played.length} played`) : null,
      level: prog.lvl,
      coins: prog.coins,
    };
  }, [tick]);

  const doWipe = useCallback(() => {
    const what = wipe;
    setWipe(null);
    if (!what) return;
    haptic('warning');
    try {
      if (what === 'worldcup') wipeWorldCup();
      else if (what === 'ucl') wipeUcl();
      else if (what === 'dynasty') wipeDynasty();
      else if (what === 'collection') wipeCollection();
      else if (what === 'everything') wipeEverything();
    } catch {
      /* A failed delete must never take the screen down. */
    }
    setTick((n) => n + 1);
    setName(displayName());
    setS(settingsStore.read());
  }, [wipe]);

  const version =
    Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';

  return (
    <>
      <ModeScreen overline="Perfect XI" title="Settings">
        {/* ================= how it feels ================= */}
        <Text style={[text.label, styles.sect]}>Sound and feel</Text>
        <View style={styles.card}>
          <Toggle
            label="Sound"
            hint="Whistles, goals and the full time cue"
            value={s.sound}
            onChange={(v) => {
              set('sound', v);
              if (v) sfx('pick');
            }}
          />
          <View style={styles.rule} />
          <Toggle
            label="Haptics"
            hint="The taps you feel when something lands"
            value={s.haptics}
            onChange={(v) => set('haptics', v)}
          />
          <View style={styles.rule} />
          <Toggle
            label="Reduce motion"
            hint="No spring, no sweep, no card animation"
            value={s.reducedMotion}
            onChange={(v) => set('reducedMotion', v)}
          />
        </View>
        <Text style={styles.note}>
          Reduce motion is also on whenever your phone has it on, whatever
          this switch says. Text size follows your phone, in Settings then
          Display and Brightness.
        </Text>

        {/* ================= how fast a match plays ================= */}
        <Text style={[text.label, styles.sect]}>Match speed</Text>
        <View style={styles.speeds}>
          {SPEEDS.map((sp) => {
            const on = s.matchSpeed === sp.id;
            return (
              <Press
                key={sp.id}
                onPress={() => set('matchSpeed', sp.id)}
                feel="none"
                scaleTo={0.98}
                style={[styles.speed, on ? styles.speedOn : null]}
              >
                <Text style={[styles.speedLabel, on ? styles.speedLabelOn : null]}>
                  {sp.label}
                </Text>
              </Press>
            );
          })}
        </View>
        <Text style={styles.note}>
          {SPEEDS.find((x) => x.id === s.matchSpeed)?.note}
        </Text>

        {/* ================= who this phone is ================= */}
        <Text style={[text.label, styles.sect]}>Your name</Text>
        <View style={styles.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => {
              const clean = name.trim().slice(0, 18);
              rename(clean);
              setName(displayName());
              haptic('light');
            }}
            placeholder="Your name"
            placeholderTextColor={color.text3}
            maxLength={18}
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <Text style={styles.note}>
          This is the only thing other players ever see. There is no account,
          no email and no sign in: nothing leaves this phone except a seed, a
          score and a random id that identifies nobody.
        </Text>

        {/* ================= what is saved ================= */}
        <Text style={[text.label, styles.sect]}>What is saved here</Text>
        <View style={styles.grid}>
          <Stat label="Seasons kept" value={String(held.seasons)} />
          <Stat label="Cards" value={held.cards.toLocaleString('en-GB')} />
          <Stat label="Achievements" value={String(held.earned)} />
          <Stat label="Level" value={String(held.level)} />
        </View>

        <View style={styles.card}>
          <Wipes
            label="World Cup"
            what={held.worldCup ?? 'Nothing on the go'}
            can={held.worldCup !== null}
            onPress={() => setWipe('worldcup')}
          />
          <View style={styles.rule} />
          <Wipes
            label="Champions League"
            what={held.ucl ?? 'Nothing on the go'}
            can={held.ucl !== null}
            onPress={() => setWipe('ucl')}
          />
          <View style={styles.rule} />
          <Wipes
            label="Dynasty career"
            what={held.dynasty ?? 'No career'}
            can={held.dynasty !== null}
            onPress={() => setWipe('dynasty')}
          />
          <View style={styles.rule} />
          <Wipes
            label="The album"
            what={held.cards ? `${held.cards.toLocaleString('en-GB')} cards` : 'Empty'}
            can={held.cards > 0}
            onPress={() => setWipe('collection')}
          />
        </View>

        <Press
          onPress={() => {
            haptic('warning');
            setWipe('everything');
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.danger}
        >
          <Text style={styles.dangerText}>Delete everything</Text>
        </Press>

        {/* ================= about ================= */}
        <Text style={[text.label, styles.sect]}>About</Text>
        <View style={styles.card}>
          <Line label="Version" value={`${version} (${build})`} />
          <View style={styles.rule} />
          <Line label="Engine" value={`v${ENGINE_VERSION}`} />
          <View style={styles.rule} />
          <Line label="Database" value="712 club seasons, 3,003 players" />
          <View style={styles.rule} />
          <Line label="Covering" value="51 clubs, 35 seasons, 1992 to 2026" />
        </View>

        <Rise delay={2}>
          <Press
            onPress={() => {
              haptic('light');
              go('/privacy');
            }}
            feel="light"
            scaleTo={0.98}
            style={styles.link}
          >
            <Text style={styles.linkText}>Privacy</Text>
            <Text style={styles.linkChev}>{'›'}</Text>
          </Press>
        </Rise>

        <Text style={styles.legal}>
          Perfect XI is a free unofficial fan game. No ads, no subscriptions,
          no in-app purchases, and it works with no connection at all. Not
          affiliated with, endorsed by or connected to the Premier League,
          FIFA, UEFA or any club or competition. Player names and ratings are
          used for identification in a work of statistical fiction.
        </Text>

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      <Confirm
        visible={wipe !== null}
        title={wipe ? WIPE_TEXT[wipe].title : ''}
        body={wipe ? WIPE_TEXT[wipe].body : ''}
        confirmLabel={wipe ? WIPE_TEXT[wipe].label : ''}
        cancelLabel="Keep it"
        onCancel={() => setWipe(null)}
        onConfirm={doWipe}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** One thing you can throw away, and what throwing it away would cost. */
function Wipes({
  label,
  what,
  can,
  onPress,
}: {
  label: string;
  what: string;
  can: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.wipe}>
      <View style={styles.wipeBody}>
        <Text style={styles.wipeLabel}>{label}</Text>
        <Text style={styles.wipeWhat} numberOfLines={1}>
          {what}
        </Text>
      </View>
      <Press
        onPress={can ? onPress : () => haptic('warning')}
        feel="none"
        scaleTo={0.94}
        style={[styles.wipeBtn, can ? null : styles.wipeBtnOff]}
      >
        <Text style={[styles.wipeBtnText, can ? null : styles.wipeBtnTextOff]}>Delete</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    paddingHorizontal: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rule: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  note: {
    ...text.small,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.text3,
    marginTop: space.s2,
  },

  speeds: { flexDirection: 'row', gap: space.s2 },
  speed: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  speedOn: { borderColor: alpha(hue.emerald, 0.5), backgroundColor: alpha(hue.emerald, 0.13) },
  speedLabel: { ...text.key, fontSize: 8.5, color: color.text3 },
  speedLabelOn: { color: hue.emerald },

  input: {
    minHeight: 52,
    color: color.text1,
    fontFamily: font.displayBold,
    fontSize: 18,
  },

  grid: { flexDirection: 'row', gap: '2%', marginBottom: space.s3 },
  stat: {
    width: '23.5%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 2,
  },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 24,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 6.5, color: color.text3, textAlign: 'center' },

  wipe: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 60 },
  wipeBody: { flex: 1, minWidth: 0, gap: 1 },
  wipeLabel: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  wipeWhat: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  wipeBtn: {
    minHeight: 38,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.45),
    backgroundColor: alpha(hue.crimson, 0.12),
  },
  wipeBtnOff: { borderColor: line.card, backgroundColor: 'transparent', opacity: 0.4 },
  wipeBtnText: { ...text.key, fontSize: 8.5, color: hue.crimson },
  wipeBtnTextOff: { color: color.text3 },

  danger: {
    marginTop: space.s3,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.55),
    backgroundColor: alpha(hue.crimson, 0.14),
  },
  dangerText: { ...text.button, fontSize: 14, color: hue.crimson },

  line: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 48 },
  lineLabel: { ...text.key, fontSize: 8.5, color: color.text3, flex: 1 },
  lineValue: {
    fontFamily: font.displayBold,
    fontSize: 13,
    color: color.text2,
    maxWidth: '62%',
    textAlign: 'right',
  },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    marginTop: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  linkText: { flex: 1, ...text.button, fontSize: 14, color: color.text2 },
  linkChev: { fontFamily: font.displayBold, fontSize: 18, color: color.text3 },

  legal: {
    ...text.small,
    fontSize: 10.5,
    lineHeight: 15,
    color: color.text3,
    marginTop: space.s4,
  },
});
