import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Press } from './Press';
import { Shine } from './Shine';
import { Coin, commas } from './Coin';
import { color, hue, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import { haptic } from '../feel';
import { clubColour, lastName, type Card, type Rarity } from '../../engine';

/**
 * The album, on the front door.
 *
 * It was a row in a collapsed list under three other things, which is
 * where you put a settings screen, not the second half of the game. This
 * is the other reason to open the app: the draft is the thing you play
 * and the album is the thing you keep, and a front door that only shows
 * one of them is showing half of it.
 *
 * So it earns a card the size of a mode, and it carries the four best
 * footballers you own rather than a number. A count says how far along
 * you are; four shirts say what it is you are collecting.
 */

const RARITY_TINT: Record<Rarity, string> = {
  icon: hue.violet,
  gold: hue.gold,
  silver: '#B9C6CE',
  bronze: '#B87333',
};

const SHIRT =
  'M 33 15 L 43 11 L 50 21 L 57 11 L 67 15 L 89 28 L 78 48 L 70 42 L 70 90 ' +
  'Q 50 94 30 90 L 30 42 L 22 48 L 11 28 Z';

export function AlbumCard({
  owned,
  total,
  best,
  coins,
  packsWaiting,
  onAlbum,
  onPacks,
}: {
  owned: number;
  total: number;
  /** your best few, newest thinking first */
  best: Card[];
  coins: number;
  packsWaiting: number;
  onAlbum: () => void;
  onPacks: () => void;
}) {
  const pct = total ? Math.max(owned ? 1.5 : 0, (owned / total) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <Press
        onPress={() => {
          haptic('light');
          onAlbum();
        }}
        feel="none"
        scaleTo={0.99}
        style={styles.card}
      >
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <View style={styles.head}>
          <View style={styles.headBody}>
            <Text style={styles.kicker}>Collect</Text>
            <Text style={styles.title}>THE ALBUM</Text>
            <Text style={styles.sub}>
              {owned
                ? `${commas(owned)} of ${commas(total)} footballers kept`
                : 'Every XI you finish is yours to keep'}
            </Text>
          </View>
          <View style={styles.countBox}>
            <Text style={styles.count} allowFontScaling={false}>
              {commas(owned)}
            </Text>
            <Text style={styles.countWord}>cards</Text>
          </View>
        </View>

        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        {/* four shirts, which is what an album is actually full of */}
        <View style={styles.shelf}>
          {[0, 1, 2, 3].map((i) => {
            const c = best[i];
            return c ? <Shirt key={c.id} card={c} /> : <Empty key={`e${i}`} />;
          })}
        </View>
      </Press>

      <Press
        onPress={() => {
          haptic('medium');
          onPacks();
        }}
        feel="none"
        scaleTo={0.98}
        style={[styles.packs, packsWaiting ? styles.packsWaiting : null]}
      >
        <Text style={[styles.packsText, packsWaiting ? { color: hue.sky } : null]}>
          {packsWaiting
            ? packsWaiting === 1
              ? 'A pack is waiting to be opened'
              : `${packsWaiting} packs are waiting`
            : 'Open packs'}
        </Text>
        <Coin size={15} />
        <Text style={styles.packsCoins} allowFontScaling={false}>
          {commas(coins)}
        </Text>
      </Press>
    </View>
  );
}

function Shirt({ card }: { card: Card }) {
  const kit = clubColour(card.club);
  const tint = RARITY_TINT[card.rarity];
  const id = `a${card.id.replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <View style={[styles.slot, { borderColor: alpha(tint, 0.55) }]}>
      {/* The art is a flex child with the text below it, never a layer on
          top of it. Absolutely positioning the shirt and guessing how much
          room the two lines under it needed put a ninety five straight
          through the middle of a red shirt. */}
      <View style={styles.slotArt}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`${id}g`} cx="50%" cy="45%" r="60%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.28} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}k`} x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={lift(kit, 0.3)} />
              <Stop offset="1" stopColor={darken(kit, 0.35)} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}g)`} />
          <Path d={SHIRT} fill={`url(#${id}k)`} stroke={lift(kit, 0.45)} strokeWidth={1.4} />
        </Svg>
      </View>
      <View style={styles.slotFoot}>
        <Text style={[styles.slotRtg, { color: tint }]} allowFontScaling={false}>
          {card.rtg}
        </Text>
        <Text style={styles.slotName} numberOfLines={1}>
          {lastName(card.n)}
        </Text>
      </View>
    </View>
  );
}

function Empty() {
  return (
    <View style={[styles.slot, styles.slotEmpty]}>
      <Text style={styles.slotQ}>?</Text>
    </View>
  );
}

function lift(hex: string, by: number): string {
  return mix(hex, 255, by);
}
function darken(hex: string, by: number): string {
  return mix(hex, 0, by);
}
function mix(hex: string, to: number, by: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.round(c + (to - c) * by);
  return (
    '#' +
    ((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255))
      .toString(16)
      .padStart(6, '0')
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s2 },
  card: {
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.violet, 0.34),
    backgroundColor: '#120E1C',
    experimental_backgroundImage:
      'radial-gradient(120% 100% at 20% 0%, rgba(185,140,242,0.2) 0%, rgba(18,14,28,0.7) 52%, #0A080F 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  headBody: { flex: 1, minWidth: 0 },
  kicker: { ...text.key, fontSize: 8.5, color: hue.violet, marginBottom: 3 },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 27,
    lineHeight: 34,
    color: color.text1,
    letterSpacing: 0.4,
  },
  sub: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text3, marginTop: 2 },
  countBox: { alignItems: 'flex-end' },
  count: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 38,
    color: hue.violet,
    fontVariant: ['tabular-nums'],
  },
  countWord: { ...text.key, fontSize: 7, color: color.text3, marginTop: -3 },

  bar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 3, backgroundColor: hue.violet, minWidth: 5 },

  shelf: { flexDirection: 'row', gap: space.s2 },
  slot: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  slotEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  slotArt: { flex: 1, alignSelf: 'stretch' },
  slotFoot: { alignItems: 'center' },
  slotRtg: {
    fontFamily: font.displayBlack,
    fontSize: 15,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  slotName: { ...text.small, fontSize: 9, lineHeight: 12, color: color.text2 },
  slotQ: { fontFamily: font.displayBlack, fontSize: 20, color: 'rgba(255,255,255,0.16)' },

  packs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.4),
    backgroundColor: alpha(hue.gold, 0.1),
  },
  packsWaiting: { borderColor: alpha(hue.sky, 0.55), backgroundColor: alpha(hue.sky, 0.12) },
  packsText: { ...text.button, fontSize: 14, color: hue.gold, flex: 1 },
  packsCoins: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },
});
