import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ClubDisc } from './ClubDisc';
import { color, hue, radius, space, alpha, positionColor } from '../tokens';
import { font, text } from '../type';
import { clubColour, lastName, type Card, type Rarity } from '../../engine';

/**
 * A footballer, as a card.
 *
 * Two goes at this. The first was a rectangle with four lines floating
 * in the middle of it, which is what a card looks like when it is laid
 * out as a paragraph. The second put the club badge in the middle, and
 * that was worse in a more interesting way: the badge became the subject,
 * so an Icon Ryan Giggs card was mostly a red circle with MU on it.
 *
 * The subject of a footballer's card is the footballer. There are no
 * photographs in this game and there never will be, so the thing in the
 * middle is his shirt, in his club's colours, with his name across the
 * back of it. That is a picture of a player rather than a logo, it is
 * made entirely from data the game already has, and it is different for
 * every one of eleven thousand cards.
 *
 * Everything else is anchored to an edge, the way a card has always done
 * it: what he is rated top left, how rare he is top right, who he is
 * along the foot. Nothing floats and nothing overlaps.
 */

export const RARITY_TINT: Record<Rarity, string> = {
  icon: hue.violet,
  gold: hue.gold,
  silver: '#B9C6CE',
  bronze: '#B87333',
};

export function rarityTint(r: Rarity): string {
  return RARITY_TINT[r];
}

/**
 * The shirt.
 *
 * Shoulders, two sleeves, a collar and a body, drawn once and filled
 * with whatever the club plays in. Deliberately plain: it has to read at
 * ninety pixels on a tile and at three hundred on an opened pack, and
 * anything fussier turns to mush at the small end.
 */
const SHIRT =
  'M 33 15 L 43 11 L 50 21 L 57 11 L 67 15 L 89 28 L 78 48 L 70 42 L 70 90 ' +
  'Q 50 94 30 90 L 30 42 L 22 48 L 11 28 Z';

export function CardFace({
  card,
  /** dim everything, for a footballer who is not yours yet */
  ghost,
  /** the frame that is being worn, when there is one */
  edge,
}: {
  card: Card;
  ghost?: boolean;
  edge?: string | null;
}) {
  const tint = RARITY_TINT[card.rarity];
  const rim = edge ?? tint;
  const posList = Array.isArray(card.pos) ? card.pos : [card.pos];
  const main = (posList[0] ?? 'MID') as 'GK' | 'DEF' | 'MID' | 'ATT';
  const kit = clubColour(card.club);
  const surname = lastName(card.n).toUpperCase();
  const id = `c${card.id.replace(/[^A-Za-z0-9]/g, '')}`;

  return (
    <View
      style={[
        styles.card,
        { borderColor: ghost ? 'rgba(255,255,255,0.14)' : rim },
        ghost ? styles.ghost : null,
      ]}
    >
      {/* the face: a wash of the rarity, lit from behind the shirt */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity={ghost ? 0.05 : 0.22} />
              <Stop offset="0.55" stopColor="#080C09" stopOpacity={0.94} />
              <Stop offset="1" stopColor={tint} stopOpacity={ghost ? 0.04 : 0.16} />
            </LinearGradient>
            <RadialGradient id={`${id}h`} cx="50%" cy="44%" r="52%">
              <Stop offset="0" stopColor={tint} stopOpacity={ghost ? 0.05 : 0.3} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}f)`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}h)`} />
        </Svg>
      </View>

      {/* ---- top left: what he is ---- */}
      <View style={styles.corner}>
        <Text
          style={[styles.rating, { color: ghost ? color.text3 : tint }]}
          allowFontScaling={false}
        >
          {ghost ? '?' : card.rtg}
        </Text>
        <Text style={[styles.pos, { color: ghost ? color.text3 : positionColor[main] }]}>
          {posList.join(' ')}
        </Text>
        {card.nat ? (
          <Text style={styles.nat} numberOfLines={1}>
            {card.nat}
          </Text>
        ) : null}
      </View>

      {/* ---- top right: how rare he is ---- */}
      <View
        style={[
          styles.rarity,
          {
            borderColor: alpha(ghost ? '#6E7E74' : tint, 0.6),
            backgroundColor: alpha(ghost ? '#6E7E74' : tint, 0.14),
          },
        ]}
      >
        <Text style={[styles.rarityText, { color: ghost ? color.text3 : tint }]}>
          {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
        </Text>
      </View>

      {/* ---- the middle: him ---- */}
      <View style={styles.kit}>
        <View style={[styles.shirtBox, ghost ? styles.ghostKit : null]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`${id}k`} x1="0.2" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={lift(kit, 0.3)} />
                <Stop offset="0.55" stopColor={kit} />
                <Stop offset="1" stopColor={darken(kit, 0.4)} />
              </LinearGradient>
            </Defs>
            <Path d={SHIRT} fill={`url(#${id}k)`} stroke={lift(kit, 0.5)} strokeWidth={1.2} />
            {/* the collar, so the shape reads as a shirt and not a bag */}
            <Path
              d="M 43 11 L 50 21 L 57 11"
              fill="none"
              stroke={lift(kit, 0.55)}
              strokeWidth={2}
            />
          </Svg>

          {/* his name across the back of it */}
          <View style={styles.shirtName} pointerEvents="none">
            <Text
              style={[styles.surname, { color: readable(kit) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
              allowFontScaling={false}
            >
              {surname}
            </Text>
          </View>
        </View>

        {/* the badge, small, where a badge goes */}
        <View style={[styles.crest, ghost ? styles.ghostKit : null]}>
          <ClubDisc club={card.club} size={26} />
        </View>
      </View>

      {/* ---- the foot: who he is ---- */}
      <View style={styles.foot}>
        <View style={[styles.rule, { backgroundColor: alpha(ghost ? '#6E7E74' : tint, 0.55) }]} />
        <Text
          style={[styles.name, ghost ? { color: 'rgba(169,183,175,0.75)' } : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {card.n}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {card.club} {'·'} {card.season}
        </Text>
      </View>
    </View>
  );
}

/* ---------- colour helpers, kept here so a card draws itself ---------- */

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
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Black or white, whichever can be read on that kit. */
function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lum =
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#101713' : '#FFFFFF';
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#080C09',
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
    paddingBottom: space.s4,
  },
  ghost: { borderStyle: 'dashed' },

  corner: { position: 'absolute', top: space.s4, left: space.s4, maxWidth: '46%' },
  rating: {
    fontFamily: font.hero,
    fontSize: 50,
    lineHeight: 60,
    fontVariant: ['tabular-nums'],
  },
  pos: { ...text.key, fontSize: 10, marginTop: -6 },
  nat: { ...text.key, fontSize: 8, color: color.text3, marginTop: 3 },

  rarity: {
    position: 'absolute',
    top: space.s4,
    right: space.s4,
    paddingHorizontal: space.s2,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rarityText: { ...text.key, fontSize: 8 },

  kit: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: space.s4 },
  shirtBox: { width: '78%', aspectRatio: 1 },
  ghostKit: { opacity: 0.18 },
  shirtName: {
    position: 'absolute',
    left: '24%',
    right: '24%',
    top: '46%',
    alignItems: 'center',
  },
  surname: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  crest: { position: 'absolute', bottom: 0, alignSelf: 'center' },

  foot: { alignItems: 'center', gap: 3, marginTop: space.s3 },
  rule: { height: 2, width: 46, borderRadius: 1, marginBottom: space.s2 },
  name: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    textAlign: 'center',
  },
  meta: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2, textAlign: 'center' },
});
