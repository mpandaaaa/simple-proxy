import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Shine } from '../../src/ui/components';
import { color, gradient, line, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  STAFF,
  STAR_NAMES,
  devMultiplier,
  injuryMultiplier,
  staffCost,
  staffUpgradeCost,
  staffWages,
  type StaffRole,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/**
 * The backroom.
 *
 * Five people, one to five stars each. Cheap at the bottom and brutal at
 * the top: an all elite backroom costs £150m a season, which is a genuine
 * trade against buying anybody.
 *
 * What each of them actually does is spelled out as a number, because
 * "improves development" means nothing and "your players improve 25%
 * faster" means something.
 */
/** One colour each, so five cards are not five copies of the same card. */
const ROLE_HUE: Record<StaffRole, string> = {
  coach: hue.mint,
  medical: hue.rose,
  youth: hue.lime,
  setpiece: hue.indigo,
  scout: hue.sky,
};

export default function Staff() {
  const career = useCareer();

  const upgrade = useCallback((id: StaffRole) => {
    updateCareer((d) => {
      const cur = d.staff[id];
      if (cur >= 5) return d;
      const cost = staffUpgradeCost(cur);
      if (d.budget < cost) return d;
      return { ...d, staff: { ...d.staff, [id]: cur + 1 }, budget: d.budget - cost };
    });
    haptic('success');
    sfx('pick');
  }, []);

  if (!career) return null;

  const wages = staffWages(career);

  return (
    <ModeScreen overline={career.club} title="Staff" onBack={() => router.back()}>
      <View style={styles.summary}>
        <Shine radius={radius.lg} group="panel" />
        <View style={styles.sumRow}>
          <Text style={styles.sumKey}>Backroom wages</Text>
          <Text style={styles.sumValue} allowFontScaling={false}>
            £{wages}m a season
          </Text>
        </View>
        <Text style={styles.sumNote}>
          Charged against the accounts every year, not once. An elite five
          costs £150m a season, which is a striker you did not buy.
        </Text>
        <View style={styles.effects}>
          <Effect
            label="Development"
            value={`${Math.round((devMultiplier(career) - 1) * 100) >= 0 ? '+' : ''}${Math.round((devMultiplier(career) - 1) * 100)}%`}
            tint={devMultiplier(career) >= 1 ? hue.mint : hue.crimson}
          />
          <Effect
            label="Injuries"
            value={`${Math.round((injuryMultiplier(career) - 1) * 100)}%`}
            tint={injuryMultiplier(career) <= 1 ? hue.mint : hue.crimson}
          />
        </View>
      </View>

      <View style={styles.list}>
        {STAFF.map((s) => {
          const stars = career.staff[s.id];
          const cost = stars >= 5 ? 0 : staffUpgradeCost(stars);
          const can = stars < 5 && career.budget >= cost;
          const tint = ROLE_HUE[s.id];
          return (
            <View
              key={s.id}
              style={[
                styles.card,
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
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={[styles.cardTier, { color: tint }]}>{STAR_NAMES[stars]}</Text>
              </View>
              <Text style={styles.cardDesc}>{s.desc}</Text>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.star,
                      {
                        backgroundColor: i <= stars ? tint : 'rgba(255,255,255,0.09)',
                      },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.costRow}>
                <Text style={styles.costText}>
                  £{staffCost(stars)}m a season now
                  {stars < 5 ? `, £${staffCost(stars + 1)}m at ${STAR_NAMES[stars + 1]}` : ''}
                </Text>
              </View>

              {stars < 5 ? (
                <Press
                  onPress={() => can && upgrade(s.id)}
                  feel="none"
                  scaleTo={0.98}
                  style={[
                    styles.upgrade,
                    can
                      ? { borderColor: alpha(tint, 0.45), backgroundColor: alpha(tint, 0.12) }
                      : styles.upgradeOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.upgradeText,
                      { color: can ? tint : color.text3 },
                    ]}
                  >
                    {can
                      ? `Upgrade for £${cost}m`
                      : `£${cost}m to upgrade, you have £${career.budget}m`}
                  </Text>
                </Press>
              ) : (
                <View style={[styles.upgrade, styles.upgradeDone]}>
                  <Text style={[styles.upgradeText, { color: color.gold }]}>
                    The best there is
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Effect({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.effect}>
      <Text style={[styles.effectValue, { color: tint }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.effectLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sumKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  sumValue: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  sumNote: { ...text.small, fontSize: 11.5, lineHeight: 16 },
  effects: { flexDirection: 'row', marginTop: space.s2 },
  effect: { flex: 1, alignItems: 'center', gap: 1 },
  effectValue: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
  effectLabel: { ...text.key, fontSize: 8, color: color.text3 },

  list: { gap: space.s3, marginTop: space.s5 },
  card: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 24, color: color.text1 },
  cardTier: { ...text.key, fontSize: 9, color: color.gold },
  cardDesc: { ...text.small, fontSize: 12, lineHeight: 16 },
  stars: { flexDirection: 'row', gap: 4 },
  star: { flex: 1, height: 5, borderRadius: 3 },
  costRow: { marginTop: 2 },
  costText: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  upgrade: {
    marginTop: space.s2,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.10)',
  },
  upgradeOff: { borderColor: line.card, backgroundColor: 'rgba(255,255,255,0.03)' },
  upgradeDone: { borderColor: line.gold, backgroundColor: 'rgba(214,178,94,0.10)' },
  upgradeText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: color.accent,
  },
});
