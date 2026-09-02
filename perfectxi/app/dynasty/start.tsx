import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, ClubDisc } from '../../src/ui/components';
import { color, gradient, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  SCENARIOS,
  clubsForScenario,
  objectiveFor,
  objectiveLabel,
  budgetFor,
  scenarioById,
  startCareer,
  type ClubOption,
  type Mode,
  type Scenario,
  type ScenarioId,
} from '../../src/engine';
import { dynastyStore } from '../../src/save';

/**
 * Starting a career, in four steps.
 *
 * How much you want to touch, what kind of job you want, which club, and
 * then the offer in writing before you take it. Four screens rather than
 * one because each decision changes what the next one shows, and a single
 * form with everything on it would hide that.
 */
export default function StartCareer() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>('simple');
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [club, setClub] = useState<ClubOption | null>(null);

  const sc: Scenario | null = scenario ? scenarioById(scenario) : null;
  const clubs = useMemo(() => (sc ? clubsForScenario(sc) : []), [sc]);

  const back = () => {
    if (step === 0) {
      router.back();
      return;
    }
    haptic('light');
    setStep(step - 1);
  };

  return (
    <ModeScreen
      overline={['How you manage', 'The job', 'The club', 'The offer'][step]}
      title={step === 2 && sc ? sc.title : 'Start a Dynasty'}
      onBack={back}
    >
      {step === 0 ? (
        <>
          <Text style={styles.lead}>
            Both play the same game underneath. This only decides how much of
            it you touch.
          </Text>
          <Choice
            title="Simple"
            note="Recommended"
            desc="Formation, mentality and style. Your staff, your facilities and your accounts look after themselves."
            on={mode === 'simple'}
            onPress={() => {
              haptic('select');
              setMode('simple');
            }}
          />
          <Choice
            title="Immersive"
            desc="Everything above, plus pressing, defensive line and tempo, each member of staff, the stadium, and the full accounts."
            on={mode === 'immersive'}
            onPress={() => {
              haptic('select');
              setMode('immersive');
            }}
          />
          <Press
            onPress={() => {
              haptic('medium');
              setStep(1);
            }}
            feel="none"
            style={styles.next}
            scaleTo={0.98}
          >
            <Text style={styles.nextText}>Choose a job</Text>
          </Press>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={styles.lead}>
            The job decides which clubs will have you, what you get to spend,
            and how long the board gives you.
          </Text>

          {SCENARIOS.map((s, i) => (
            <Rise key={s.id} delay={Math.min(i, 4)}>
              <Press
                onPress={() => {
                  haptic('medium');
                  setScenario(s.id);
                  setClub(null);
                  setStep(2);
                }}
                feel="none"
                style={styles.scen}
                scaleTo={0.985}
              >
                <Shine radius={radius.lg} group="card" bevel={false} clip={false} />
                <View style={styles.scenHead}>
                  <Text style={styles.scenTitle}>{s.title}</Text>
                  <View style={styles.scenTier}>
                    <Text style={styles.scenTierText} allowFontScaling={false}>
                      {s.tier[0]}
                      {'-'}
                      {s.tier[1]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.scenDesc}>{s.desc}</Text>
                <View style={styles.scenBars}>
                  <Meter label="Budget" value={s.budget / 1.35} tint={color.accent} />
                  <Meter
                    label="Pressure"
                    value={1 - (s.leash - 0.55) / 1.25}
                    tint={color.danger}
                  />
                </View>
              </Press>
            </Rise>
          ))}
          <Text style={styles.orKey}>Or the long way round</Text>
          <Press
            onPress={() => {
              haptic('light');
              router.dismissAll();
              router.push('/draft');
            }}
            feel="none"
            style={styles.own}
            scaleTo={0.99}
          >
            <View style={styles.ownBody}>
              <Text style={styles.ownTitle}>Create your own club</Text>
              <Text style={styles.ownDesc}>
                This one leaves Dynasty. You draft an XI from any era and play
                a season with it first, and the results screen then offers to
                carry those eleven into a career.
              </Text>
            </View>
            <Text style={styles.ownArrow} allowFontScaling={false}>
              {'›'}
            </Text>
          </Press>
        </>
      ) : null}

      {step === 2 && sc ? (
        <>
          <Text style={styles.lead}>
            {clubs.length} club{clubs.length === 1 ? '' : 's'} will take you on
            those terms. Ranked by how good the squad you inherit actually is.
          </Text>
          {clubs.map((c, i) => (
            <Rise key={c.key} delay={Math.min(i, 5)}>
              <Press
                onPress={() => {
                  haptic('medium');
                  setClub(c);
                  setStep(3);
                }}
                feel="none"
                style={styles.club}
                scaleTo={0.985}
              >
                <Shine radius={radius.lg} group="card" bevel={false} clip={false} />
                <ClubDisc club={c.club} size={44} />
                <View style={styles.clubBody}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {c.club}
                  </Text>
                  <Text style={styles.clubMeta} numberOfLines={1}>
                    {ordinalRank(c.rank)} strongest {'·'} squad {c.avg} {'·'}{' '}
                    {c.capacity.toLocaleString('en-GB')} seats
                  </Text>
                  {c.rival ? (
                    <Text style={styles.clubRival} numberOfLines={1}>
                      Rivals {c.rival}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.clubArrow} allowFontScaling={false}>
                  {'›'}
                </Text>
              </Press>
            </Rise>
          ))}
        </>
      ) : null}

      {step === 3 && sc && club ? <Offer club={club} sc={sc} mode={mode} /> : null}
    </ModeScreen>
  );
}

function ordinalRank(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * The offer, in writing.
 *
 * The objective shown here is the one the board will actually judge you
 * on, worked out from the squad and then shifted by the job. Showing the
 * unshifted one would be a lie you find out about a year later.
 */
function Offer({ club, sc, mode }: { club: ClubOption; sc: Scenario; mode: Mode }) {
  const base = objectiveFor(club.avg);
  const target = Math.max(1, Math.min(20, base.target + sc.expect));
  const label = objectiveLabel(target);
  const budget = Math.round(budgetFor(target) * sc.budget);

  return (
    <>
      <View style={styles.offer}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <View style={styles.bloom} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="offerBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color.gold} stopOpacity={0.26} />
                <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="4" rx="66" ry="44" fill="url(#offerBloom)" />
          </Svg>
        </View>
        <View style={styles.grain} pointerEvents="none">
          <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
        </View>

        <ClubDisc club={club.club} size={60} />
        <Text style={styles.offerClub}>{club.club}</Text>
        <Text style={styles.offerJob}>{sc.title}</Text>

        <View style={styles.offerRule} />

        <Text style={styles.offerKey}>The board want</Text>
        <Text style={styles.offerObj}>{label}</Text>

        <View style={styles.offerStats}>
          <OfferStat label="To spend" value={`£${budget}m`} tint={color.accent} />
          <OfferStat label="Squad" value={String(club.avg)} />
          <OfferStat
            label="Patience"
            value={sc.leash >= 1.4 ? 'High' : sc.leash >= 0.9 ? 'Normal' : 'Low'}
            tint={sc.leash < 0.9 ? color.danger : undefined}
          />
        </View>
      </View>

      <Press
        onPress={() => {
          haptic('success');
          sfx('trophy');
          dynastyStore.write(
            startCareer({
              clubKey: club.key,
              scenario: sc.id,
              mode,
              formation: '4-3-3',
              seed: Math.floor(Math.random() * 0x7fffffff),
            }),
          );
          router.dismissAll();
          router.push('/dynasty');
        }}
        feel="none"
        style={styles.take}
        scaleTo={0.98}
      >
        <Text style={styles.takeText}>Take the job</Text>
      </Press>

      <Text style={styles.smallprint}>
        You inherit the fourteen best players at {club.club}, at their peak
        ratings and the ages they were when they hit them.
      </Text>
    </>
  );
}

function Choice({
  title,
  note,
  desc,
  on,
  onPress,
}: {
  title: string;
  note?: string;
  desc: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      feel="none"
      style={[styles.choice, on ? styles.choiceOn : null]}
      scaleTo={0.985}
    >
      <View style={styles.choiceHead}>
        <Text style={[styles.choiceTitle, on ? { color: color.accent } : null]}>
          {title}
        </Text>
        {note ? <Text style={styles.choiceNote}>{note}</Text> : null}
      </View>
      <Text style={styles.choiceDesc}>{desc}</Text>
    </Press>
  );
}

function Meter({ label, value, tint }: { label: string; value: number; tint: string }) {
  const lit = Math.max(1, Math.min(5, Math.round(value * 5)));
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterBars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.meterBar,
              { backgroundColor: i < lit ? tint : 'rgba(255,255,255,0.10)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function OfferStat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.offerStat}>
      <Text
        style={[styles.offerStatValue, tint ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.offerStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  bloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },

  lead: { ...text.body, color: color.text2, marginBottom: space.s4 },

  choice: {
    padding: space.s4,
    marginBottom: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: 4,
  },
  choiceOn: {
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.09)',
  },
  choiceHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  choiceTitle: {
    flex: 1,
    fontFamily: font.displayBold,
    fontSize: 21,
    lineHeight: 26,
    color: color.text1,
  },
  choiceNote: { ...text.key, fontSize: 8.5, color: color.text3 },
  choiceDesc: { ...text.small, lineHeight: 18 },

  next: {
    marginTop: space.s3,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow: '0px 8px 22px rgba(31,197,126,0.3)',
  },
  nextText: { ...text.button, color: '#05170E' },

  orKey: {
    ...text.key,
    fontSize: 9,
    color: color.text3,
    marginTop: space.s5,
    marginBottom: space.s3,
  },
  own: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    marginBottom: space.s6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ownBody: { flex: 1, minWidth: 0 },
  ownTitle: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    color: color.text2,
  },
  ownDesc: { ...text.small, fontSize: 11.5, lineHeight: 16 },
  ownArrow: { fontSize: 18, color: color.text3 },

  scen: {
    padding: space.s4,
    marginBottom: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  scenHead: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  scenTitle: {
    flex: 1,
    fontFamily: font.displayBold,
    fontSize: 21,
    lineHeight: 26,
    color: color.text1,
  },
  scenTier: {
    paddingHorizontal: space.s2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scenTierText: {
    ...text.key,
    fontSize: 9,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  scenDesc: { ...text.small, lineHeight: 18 },
  scenBars: { flexDirection: 'row', gap: space.s4, marginTop: 2 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  meterLabel: { ...text.key, fontSize: 8, color: color.text3 },
  meterBars: { flexDirection: 'row', gap: 3 },
  meterBar: { width: 12, height: 4, borderRadius: 2 },

  club: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    marginBottom: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  clubBody: { flex: 1, minWidth: 0 },
  clubName: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
  },
  clubMeta: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  clubRival: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.danger },
  clubArrow: { fontSize: 20, color: color.text3, paddingRight: space.s1 },

  offer: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 62%, #0D0C07 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  offerClub: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: 0.3,
    color: color.text1,
    marginTop: space.s3,
  },
  offerJob: { ...text.key, fontSize: 10, color: color.gold },
  offerRule: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(214,178,94,0.28)',
    marginVertical: space.s4,
  },
  offerKey: { ...text.key, fontSize: 9, color: color.text3 },
  offerObj: {
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
    textAlign: 'center',
    marginTop: 2,
  },
  offerStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.s4 },
  offerStat: { flex: 1, alignItems: 'center', gap: 2 },
  offerStatValue: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  offerStatLabel: { ...text.key, fontSize: 8, color: color.text3 },

  take: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.14)',
  },
  takeText: { ...text.button, color: color.gold },
  smallprint: {
    ...text.small,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.s3,
    marginBottom: space.s6,
  },
});
