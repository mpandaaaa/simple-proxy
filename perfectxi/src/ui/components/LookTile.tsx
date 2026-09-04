import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Press } from './Press';
import { color, hue, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import type { Cosmetic } from '../../engine';

/**
 * One thing you can wear, shown as itself.
 *
 * The first version was a coloured square and three words, and the three
 * words in the corner meant three different things depending on the row:
 * WEAR, LVL 22 and 700 all sat in the same place with nothing to say
 * which was which. Thirty of those in one column is a spreadsheet.
 *
 * So a tile shows the actual thing. A frame is drawn as a small card with
 * that frame on it. A pitch is drawn as turf with its mowing bands. A
 * title is drawn as the word, in its colour, next to a name. You can tell
 * what you are buying by looking at it, which is the only reason any of
 * this is worth coins.
 */

export type LookState = 'worn' | 'owned' | 'buy' | 'locked';

export function LookTile({
  item,
  state,
  onPress,
}: {
  item: Cosmetic;
  state: LookState;
  onPress: () => void;
}) {
  const dim = state === 'locked';

  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={0.97}
      style={[
        styles.tile,
        state === 'worn'
          ? { borderColor: hue.emerald, backgroundColor: alpha(hue.emerald, 0.09) }
          : null,
        dim ? styles.dim : null,
      ]}
    >
      <View style={styles.preview}>
        {item.kind === 'frame' ? <FramePreview item={item} /> : null}
        {item.kind === 'pitch' ? <PitchPreview item={item} /> : null}
        {item.kind === 'title' ? <TitlePreview item={item} /> : null}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.blurb} numberOfLines={2}>
        {item.blurb}
      </Text>

      <View
        style={[
          styles.tag,
          state === 'worn'
            ? { borderColor: hue.emerald, backgroundColor: alpha(hue.emerald, 0.16) }
            : state === 'buy'
              ? { borderColor: alpha(hue.gold, 0.6), backgroundColor: alpha(hue.gold, 0.14) }
              : null,
        ]}
      >
        <Text
          style={[
            styles.tagText,
            state === 'worn'
              ? { color: hue.emerald }
              : state === 'buy'
                ? { color: hue.gold }
                : { color: color.text3 },
          ]}
          allowFontScaling={false}
        >
          {state === 'worn'
            ? 'WEARING'
            : state === 'owned'
              ? 'TAP TO WEAR'
              : state === 'buy'
                ? `${item.price} COINS`
                : `LEVEL ${item.level}`}
        </Text>
      </View>
    </Press>
  );
}

/** A card with that frame on it, which is exactly what the frame does. */
function FramePreview({ item }: { item: Cosmetic }) {
  return (
    <View style={[styles.frame, { borderColor: item.a, backgroundColor: item.b }]}>
      <Text style={[styles.frameRtg, { color: item.a }]} allowFontScaling={false}>
        91
      </Text>
      <View style={[styles.frameRule, { backgroundColor: alpha(item.a, 0.6) }]} />
      <Text style={styles.frameName}>Name</Text>
    </View>
  );
}

/** Turf, with the mowing bands it actually draws. */
function PitchPreview({ item }: { item: Cosmetic }) {
  const band = readBand(item.b);
  return (
    <View style={styles.pitch}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`t${item.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lift(item.a, 0.24)} />
            <Stop offset="1" stopColor={item.a} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#t${item.id})`} />
        {[0, 2, 4].map((n) => (
          <Rect
            key={n}
            x="0"
            y={`${n * 16.6}%`}
            width="100%"
            height="16.6%"
            fill={band.colour}
            opacity={band.alpha}
          />
        ))}
        <Rect
          x="6%"
          y="10%"
          width="88%"
          height="80%"
          stroke="#FFFFFF"
          strokeOpacity={0.26}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** The word, beside a name, which is where it appears. */
function TitlePreview({ item }: { item: Cosmetic }) {
  return (
    <View style={styles.title}>
      <Text style={styles.titleWho} numberOfLines={1}>
        You
      </Text>
      {item.id === 'title.none' ? null : (
        <Text style={[styles.titleWord, { color: item.a }]} numberOfLines={1}>
          {'·'} {item.name}
        </Text>
      )}
    </View>
  );
}

function readBand(band: string): { colour: string; alpha: number } {
  const m = /^rgba?\(([^)]+)\)$/.exec(band.trim());
  if (m) {
    const parts = m[1].split(',').map((x) => x.trim());
    if (parts.length >= 3) {
      return {
        colour: `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`,
        alpha: parts.length > 3 ? Number(parts[3]) || 0.04 : 1,
      };
    }
  }
  return { colour: '#FFFFFF', alpha: 0.05 };
}

function lift(hex: string, by: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * by);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 4,
  },
  dim: { opacity: 0.5 },

  preview: {
    height: 92,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s2,
  },

  frame: {
    width: 62,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  frameRtg: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },
  frameRule: { width: 22, height: 2, borderRadius: 1 },
  frameName: { ...text.key, fontSize: 6.5, color: color.text3 },

  pitch: { width: '100%', height: '100%', borderRadius: radius.md, overflow: 'hidden' },

  title: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: space.s2,
  },
  titleWho: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  titleWord: { fontFamily: font.bodySemi, fontSize: 12.5, lineHeight: 17 },

  name: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text1 },
  blurb: { ...text.small, fontSize: 10.5, lineHeight: 14, color: color.text3, minHeight: 28 },

  tag: {
    marginTop: 2,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagText: { ...text.key, fontSize: 7.5, fontVariant: ['tabular-nums'] },
});
