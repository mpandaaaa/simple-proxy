import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, PlayerSheet } from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import { releaseYouth, scoutRange, type DynastyPlayer } from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/** What one look at a player costs. */
const SCOUT_FEE = 1;

/**
 * The academy.
 *
 * You are never told what a young player will become. Scouting narrows a
 * range and never closes it fully until he is nearly there, which is the
 * honest version of what a club actually knows.
 *
 * Four in a hundred of them are generational. Fifty five never make it.
 * The fog is the game.
 */
export default function Academy() {
  const career = useCareer();
  const [open, setOpen] = useState<number | null>(null);

  const scout = useCallback((index: number) => {
    updateCareer((d) => {
      if (d.budget < SCOUT_FEE) return d;
      const youth = [...d.youth];
      const p = youth[index];
      if (!p) return d;
      youth[index] = { ...p, scout: p.scout + 1 };
      return { ...d, youth, budget: d.budget - SCOUT_FEE };
    });
    haptic('medium');
    sfx('tick');
  }, []);

  const release = useCallback((index: number) => {
    updateCareer((d) => releaseYouth(d, index));
    haptic('warning');
    setOpen(null);
  }, []);

  if (!career) return null;

  return (
    <>
      <ModeScreen
        overline={`Academy level ${career.infra.academy}`}
        title="The academy"
        onBack={() => router.back()}
      >
        <View style={styles.lead}>
          <Shine radius={radius.lg} group="panel" />
          <Text style={styles.leadTitle}>
            {career.youth.length
              ? `${career.youth.length} coming through`
              : 'Nobody in the building'}
          </Text>
          <Text style={styles.leadBody}>
            An intake arrives every summer. Most of them will never play a
            game. A few will be better than anyone you could afford to buy,
            and you will not know which is which until it is too late to
            matter, so scout the ones you like.
          </Text>
          <Text style={styles.leadNote}>
            They are released at 24 if they have not made it. Promoting one
            into an empty place costs nothing and he counts as homegrown.
          </Text>
        </View>

        <View style={styles.list}>
          {career.youth.map((p, i) => (
            <Rise key={p.n} delay={Math.min(i, 5)}>
              <Prospect
                player={p}
                onPress={() => {
                  haptic('light');
                  setOpen(i);
                }}
                onScout={career.budget >= SCOUT_FEE ? () => scout(i) : undefined}
              />
            </Rise>
          ))}
        </View>

        {career.youth.length ? (
          <Press
            onPress={() => {
              haptic('medium');
              router.push('/dynasty/market');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>Promote one into the squad</Text>
          </Press>
        ) : null}

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      <PlayerSheet
        player={open !== null ? (career.youth[open] ?? null) : null}
        open={open !== null}
        onClose={() => setOpen(null)}
        youth
        onScout={
          open !== null && career.budget >= SCOUT_FEE
            ? () => {
                scout(open);
              }
            : undefined
        }
        scoutCost={SCOUT_FEE}
        onRelease={open !== null ? () => release(open) : undefined}
      />
    </>
  );
}

/**
 * One prospect, with the fog drawn as a band rather than a number.
 *
 * The bar shows where he is now and how far the doubt about his ceiling
 * still stretches. Each look narrows it by nearly half.
 */
function Prospect({
  player: p,
  onPress,
  onScout,
}: {
  player: DynastyPlayer;
  onPress: () => void;
  onScout?: () => void;
}) {
  const tint = positionColor[p.pos];
  const range = scoutRange(p);
  const low = (Math.max(40, range.low) - 40) / 59;
  const high = (Math.max(40, range.high) - 40) / 59;
  const now = (Math.max(40, p.rtg) - 40) / 59;

  return (
    <View style={styles.card}>
      <Shine radius={radius.md} group="card" rating={p.rtg} bevel={false} clip={false} />
      <Press onPress={onPress} feel="none" scaleTo={0.995} style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
          <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {p.n}
          </Text>
          <Text style={styles.cardMeta}>
            {p.age} {'·'} {p.scout === 0 ? 'never scouted' : `scouted ${p.scout}×`}
          </Text>
        </View>
        <Text style={styles.cardRtg} allowFontScaling={false}>
          {p.rtg}
        </Text>
      </Press>

      {/* now, and the band he might end up in */}
      <View style={styles.fogWrap}>
        <View style={styles.fogTrack}>
          <View
            style={[
              styles.fogBand,
              { left: `${low * 100}%`, width: `${Math.max(2, (high - low) * 100)}%` },
            ]}
          />
          <View style={[styles.fogNow, { left: `${now * 100}%` }]} />
        </View>
        <Text style={styles.fogText}>
          {range.exact
            ? `Certain: he tops out at ${range.high}`
            : `Ceiling somewhere between ${range.low} and ${range.high}`}
        </Text>
      </View>

      {onScout && !range.exact ? (
        <Press onPress={onScout} feel="none" scaleTo={0.98} style={styles.scout}>
          <Text style={styles.scoutText}>Scout him · £{SCOUT_FEE}m</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  leadTitle: { fontFamily: font.displayBold, fontSize: 21, lineHeight: 26, color: color.text1 },
  leadBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },
  leadNote: { ...text.small, fontSize: 11, lineHeight: 16, color: color.text3 },

  list: { gap: space.s3, marginTop: space.s5 },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s3 },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  cardMeta: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  cardRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },

  fogWrap: { paddingHorizontal: space.s3, paddingBottom: space.s3, gap: 5 },
  fogTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fogBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: alpha(hue.lime, 0.30),
    borderRadius: 4,
  },
  fogNow: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 2,
    backgroundColor: color.text1,
  },
  fogText: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },

  scout: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: alpha(hue.lime, 0.10),
  },
  scoutText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: hue.lime,
  },

  cta: {
    marginTop: space.s5,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.lime, 0.45),
    backgroundColor: alpha(hue.lime, 0.12),
  },
  ctaText: { ...text.button, fontSize: 15, color: hue.lime },
});
