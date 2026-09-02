import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Shine, ClubDisc } from '../../src/ui/components';
import { color, gradient, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  STADIUM_STEP,
  matchdayRevenue,
  stadiumCost,
  stadiumPayback,
  ticketYield,
  trainingMultiplier,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/** What a level of training ground or academy costs to build. */
const FACILITY_COST = [0, 0, 25, 55, 100, 180];

/**
 * The club itself.
 *
 * Seats, the training ground and the academy. All three are the same
 * decision: money now against something that compounds. The stadium pays
 * back in years and the app says how many rather than making you work it
 * out, because seven and a half years at a big club and twenty at a small
 * one is the whole point of the choice.
 */
export default function Club() {
  const career = useCareer();

  const build = useCallback(() => {
    updateCareer((d) => {
      const cost = stadiumCost();
      if (d.budget < cost) return d;
      return {
        ...d,
        budget: d.budget - cost,
        infra: {
          ...d.infra,
          stadium: d.infra.stadium + 1,
          capacity: d.infra.capacity + STADIUM_STEP,
        },
      };
    });
    haptic('success');
    sfx('trophy');
  }, []);

  const improve = useCallback((which: 'training' | 'academy') => {
    updateCareer((d) => {
      const cur = d.infra[which];
      if (cur >= 5) return d;
      const cost = FACILITY_COST[cur + 1];
      if (d.budget < cost) return d;
      return { ...d, infra: { ...d.infra, [which]: cur + 1 }, budget: d.budget - cost };
    });
    haptic('success');
    sfx('pick');
  }, []);

  if (!career) return null;

  const pay = stadiumPayback(career);
  const canBuild = career.budget >= pay.cost;

  return (
    <ModeScreen overline={career.club} title="The club" onBack={() => router.back()}>
      {/* ---- the ground ---- */}
      <View style={styles.ground}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <ClubDisc club={career.club} size={48} />
        <Text style={styles.capacity} allowFontScaling={false}>
          {career.infra.capacity.toLocaleString('en-GB')}
        </Text>
        <Text style={styles.capKey}>seats</Text>
        <View style={styles.groundStats}>
          <GStat label="Matchday" value={`£${matchdayRevenue(career)}m`} />
          <GStat label="Per seat" value={`£${Math.round(ticketYield(career))}`} />
          <GStat label="Expansions" value={String(career.infra.stadium)} />
        </View>
      </View>

      <View style={styles.build}>
        <Text style={styles.buildKey}>Add {STADIUM_STEP.toLocaleString('en-GB')} seats</Text>
        <Text style={styles.buildBody}>
          £{pay.cost}m to build. It brings in about £{pay.addRev}m more a season
          at what you charge now, so it pays for itself in {pay.years} years.
        </Text>
        <Press
          onPress={() => canBuild && build()}
          feel="none"
          scaleTo={0.98}
          style={[styles.buildCta, !canBuild ? styles.off : null]}
        >
          <Text style={[styles.buildCtaText, !canBuild ? { color: color.text3 } : null]}>
            {canBuild ? `Build it for £${pay.cost}m` : `£${pay.cost}m, you have £${career.budget}m`}
          </Text>
        </Press>
        <Text style={styles.buildNote}>
          A bigger ground is worth more the higher you finish, because you
          charge more and fill it. Building one while you are near the bottom
          takes a very long time to come back.
        </Text>
      </View>

      {/* ---- the facilities ---- */}
      <Text style={[text.label, styles.sect]}>Facilities</Text>
      <Facility
        title="Training ground"
        level={career.infra.training}
        effect={`Players develop ${Math.round((trainingMultiplier(career) - 1) * 100)}% faster than average`}
        next={
          career.infra.training < 5
            ? `Level ${career.infra.training + 1} costs £${FACILITY_COST[career.infra.training + 1]}m`
            : null
        }
        cost={career.infra.training < 5 ? FACILITY_COST[career.infra.training + 1] : 0}
        budget={career.budget}
        onPress={() => improve('training')}
      />
      <Facility
        title="Academy"
        level={career.infra.academy}
        effect={`${career.infra.academy >= 4 ? 'Four or five' : career.infra.academy >= 3 ? 'Three or four' : 'Two or three'} come through each summer, and better ones`}
        next={
          career.infra.academy < 5
            ? `Level ${career.infra.academy + 1} costs £${FACILITY_COST[career.infra.academy + 1]}m`
            : null
        }
        cost={career.infra.academy < 5 ? FACILITY_COST[career.infra.academy + 1] : 0}
        budget={career.budget}
        onPress={() => improve('academy')}
      />

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function GStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gstat}>
      <Text style={styles.gstatValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.gstatLabel}>{label}</Text>
    </View>
  );
}

function Facility({
  title,
  level,
  effect,
  next,
  cost,
  budget,
  onPress,
}: {
  title: string;
  level: number;
  effect: string;
  next: string | null;
  cost: number;
  budget: number;
  onPress: () => void;
}) {
  const can = next !== null && budget >= cost;
  return (
    <View style={styles.facility}>
      <Shine radius={radius.lg} group="card" bevel={false} clip={false} />
      <View style={styles.facHead}>
        <Text style={styles.facTitle}>{title}</Text>
        <Text style={styles.facLevel} allowFontScaling={false}>
          {level} of 5
        </Text>
      </View>
      <View style={styles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i <= level ? color.accent : 'rgba(255,255,255,0.09)' },
            ]}
          />
        ))}
      </View>
      <Text style={styles.facEffect}>{effect}</Text>
      {next ? (
        <Press
          onPress={() => can && onPress()}
          feel="none"
          scaleTo={0.98}
          style={[styles.facCta, !can ? styles.off : null]}
        >
          <Text style={[styles.facCtaText, !can ? { color: color.text3 } : null]}>
            {can ? `Build for £${cost}m` : next}
          </Text>
        </Press>
      ) : (
        <Text style={styles.facDone}>Nothing left to build.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    overflow: 'hidden',
  },
  capacity: {
    fontFamily: font.hero,
    fontSize: 46,
    lineHeight: 60,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    marginTop: space.s2,
  },
  capKey: { ...text.key, fontSize: 9, color: color.text3, marginTop: -space.s2 },
  groundStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.s4 },
  gstat: { flex: 1, alignItems: 'center', gap: 1 },
  gstatValue: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  gstatLabel: { ...text.key, fontSize: 8, color: color.text3 },

  build: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: space.s2,
  },
  buildKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  buildBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },
  buildCta: {
    marginTop: space.s2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.10)',
  },
  buildCtaText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: color.accent,
  },
  buildNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  off: { borderColor: line.card, backgroundColor: 'rgba(255,255,255,0.03)' },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  facility: {
    marginBottom: space.s3,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  facHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  facTitle: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 24, color: color.text1 },
  facLevel: { ...text.key, fontSize: 9, color: color.text3, fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  facEffect: { ...text.small, fontSize: 12, lineHeight: 16 },
  facCta: {
    marginTop: space.s2,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.10)',
  },
  facCtaText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: color.accent,
  },
  facDone: { ...text.small, fontSize: 11.5, color: color.gold },
});
