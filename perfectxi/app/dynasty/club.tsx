import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Shine, ClubDisc } from '../../src/ui/components';
import { color, gradient, line, radius, space, hue, alpha, wear, vivid } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  STADIUM_STEP,
  RETAIL_COST,
  FAN_CEIL,
  merchRevenue,
  clubColour,
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

  const toggleInjuries = useCallback(() => {
    updateCareer((d) => ({ ...d, injuriesOn: !d.injuriesOn }));
    haptic('select');
  }, []);

  const openShop = useCallback(() => {
    updateCareer((d) => {
      const cur = d.infra.retail;
      if (cur >= 5) return d;
      const cost = RETAIL_COST[cur + 1];
      if (d.budget < cost) return d;
      return { ...d, infra: { ...d.infra, retail: cur + 1 }, budget: d.budget - cost };
    });
    haptic('success');
    sfx('pick');
  }, []);

  if (!career) return null;

  const pay = stadiumPayback(career);
  const canBuild = career.budget >= pay.cost;
  // The ground is painted in the club's own colours, not the app's.
  const kit = wear(clubColour(career.club));

  return (
    <ModeScreen overline={career.club} title="The club" onBack={() => router.back()}>
      {/* ---- the ground ---- */}
      <View style={[styles.ground, { borderColor: kit.lineSoft, experimental_backgroundImage: kit.grad }]}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <ClubDisc club={career.club} size={48} />
        <Text style={[styles.capacity, { color: vivid(kit.key) }]} allowFontScaling={false}>
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

      {/* ---- how you want to play it ---- */}
      <Text style={[text.label, styles.sect]}>How you want to play it</Text>
      <Press onPress={toggleInjuries} feel="none" scaleTo={0.99} style={styles.setting}>
        <View style={styles.settingBody}>
          <Text style={styles.settingTitle}>Injuries</Text>
          <Text style={styles.settingNote}>
            {career.injuriesOn
              ? 'On. Players pick up knocks and miss games, at the rate the Premier League actually records.'
              : 'Off. Nobody gets injured, ever. Your best player is available every week.'}
          </Text>
        </View>
        <View style={[styles.switch, career.injuriesOn ? styles.switchOn : null]}>
          <View style={[styles.knob, career.injuriesOn ? styles.knobOn : null]} />
        </View>
      </Press>

      {/* ---- the following ---- */}
      <Text style={[text.label, styles.sect]}>The following</Text>
      <View style={styles.fans}>
        <Shine radius={radius.lg} group="panel" />
        <View style={styles.fansTop}>
          <View style={styles.fansLeft}>
            <Text style={styles.fansValue} allowFontScaling={false}>
              {career.fans.toFixed(1)}m
            </Text>
            <Text style={styles.fansKey}>supporters</Text>
          </View>
          <View style={styles.fansRight}>
            <Text style={styles.fansMerch} allowFontScaling={false}>
              £{merchRevenue(career)}m
            </Text>
            <Text style={styles.fansKey}>sold a season</Text>
          </View>
        </View>
        <View style={styles.fansTrack}>
          <View
            style={[
              styles.fansFill,
              { width: `${Math.max(2, (career.fans / FAN_CEIL) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.fansBody}>
          People come for winning and for players worth watching, and they
          leave when there is neither. Everything with a badge on it is sold
          to them, so the shop below is only worth building once there are
          enough of them to sell to.
        </Text>
      </View>

      {/* ---- the shop ---- */}
      <View style={styles.shop}>
        <View style={styles.shopHead}>
          <Text style={styles.shopTitle}>The club shop</Text>
          <Text style={styles.shopLevel} allowFontScaling={false}>
            {career.infra.retail} of 5
          </Text>
        </View>
        <View style={styles.bars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  backgroundColor:
                    i <= career.infra.retail ? hue.rose : 'rgba(255,255,255,0.09)',
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.shopEffect}>
          Every level is worth another 12% of everything sold. At {career.fans.toFixed(1)}m
          following you that is £{merchRevenue(career)}m a season now
          {career.infra.retail < 5
            ? `, and £${Math.round(career.fans * 9 * (1 + (career.infra.retail + 1) * 0.12))}m at the next level`
            : ''}
          .
        </Text>
        {career.infra.retail < 5 ? (
          <Press
            onPress={() => career.budget >= RETAIL_COST[career.infra.retail + 1] && openShop()}
            feel="none"
            scaleTo={0.98}
            style={[
              styles.facCta,
              career.budget >= RETAIL_COST[career.infra.retail + 1]
                ? { borderColor: alpha(hue.rose, 0.45), backgroundColor: alpha(hue.rose, 0.12) }
                : styles.off,
            ]}
          >
            <Text
              style={[
                styles.facCtaText,
                {
                  color:
                    career.budget >= RETAIL_COST[career.infra.retail + 1]
                      ? hue.rose
                      : color.text3,
                },
              ]}
            >
              {career.budget >= RETAIL_COST[career.infra.retail + 1]
                ? `Build it out for £${RETAIL_COST[career.infra.retail + 1]}m`
                : `Level ${career.infra.retail + 1} costs £${RETAIL_COST[career.infra.retail + 1]}m`}
            </Text>
          </Press>
        ) : (
          <Text style={styles.facDone}>There is nothing left to sell them.</Text>
        )}
      </View>

      {/* ---- the facilities ---- */}
      <Text style={[text.label, styles.sect]}>Facilities</Text>
      <Facility
        tint={hue.mint}
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
        tint={hue.lime}
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
  tint,
  onPress,
}: {
  title: string;
  level: number;
  effect: string;
  next: string | null;
  cost: number;
  budget: number;
  tint: string;
  onPress: () => void;
}) {
  const can = next !== null && budget >= cost;
  return (
    <View
      style={[
        styles.facility,
        {
          borderColor: alpha(tint, 0.26),
          experimental_backgroundImage: `linear-gradient(180deg, ${alpha(
            tint,
            0.13,
          )} 0%, rgba(10,15,12,0) 76%)`,
        },
      ]}
    >
      <Shine radius={radius.lg} group="card" bevel={false} clip={false} />
      <View style={styles.facHead}>
        <Text style={styles.facTitle}>{title}</Text>
        <Text style={[styles.facLevel, { color: tint }]} allowFontScaling={false}>
          {level} of 5
        </Text>
      </View>
      <View style={styles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i <= level ? tint : 'rgba(255,255,255,0.09)' },
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
          style={[
            styles.facCta,
            can
              ? { borderColor: alpha(tint, 0.45), backgroundColor: alpha(tint, 0.12) }
              : styles.off,
          ]}
        >
          <Text style={[styles.facCtaText, { color: can ? tint : color.text3 }]}>
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
    borderColor: alpha(hue.amber, 0.26),
    backgroundColor: '#15120A',
    experimental_backgroundImage:
      'linear-gradient(180deg, #231C0C 0%, #14120A 62%, #0B0A07 100%)',
    gap: space.s2,
  },
  buildKey: { ...text.key, fontSize: 9.5, color: hue.amber },
  buildBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },
  buildCta: {
    marginTop: space.s2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.amber, 0.45),
    backgroundColor: alpha(hue.amber, 0.12),
  },
  buildCtaText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: hue.amber,
  },
  buildNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  off: { borderColor: line.card, backgroundColor: 'rgba(255,255,255,0.03)' },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  settingBody: { flex: 1, minWidth: 0 },
  settingTitle: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  settingNote: { ...text.small, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  switch: {
    width: 46,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: { borderColor: hue.crimson, backgroundColor: alpha(hue.crimson, 0.3) },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: color.text3 },
  knobOn: { backgroundColor: hue.crimson, alignSelf: 'flex-end' },

  fans: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.rose, 0.26),
    backgroundColor: '#190F14',
    experimental_backgroundImage:
      'linear-gradient(180deg, #2A1520 0%, #170E13 62%, #0C070A 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  fansTop: { flexDirection: 'row', alignItems: 'flex-end' },
  fansLeft: { flex: 1 },
  fansRight: { alignItems: 'flex-end' },
  fansValue: {
    fontFamily: font.hero,
    fontSize: 40,
    lineHeight: 52,
    color: hue.rose,
    fontVariant: ['tabular-nums'],
  },
  fansMerch: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  fansKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  fansTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  fansFill: { height: 6, borderRadius: 3, backgroundColor: hue.rose },
  fansBody: { ...text.small, fontSize: 11.5, lineHeight: 16 },

  shop: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.rose, 0.22),
    backgroundColor: '#140E11',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221319 0%, #140E11 62%, #0A0709 100%)',
    gap: space.s2,
  },
  shopHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  shopTitle: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 24, color: color.text1 },
  shopLevel: { ...text.key, fontSize: 9, color: hue.rose },
  shopEffect: { ...text.small, fontSize: 12, lineHeight: 17 },
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
