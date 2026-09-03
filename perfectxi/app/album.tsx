import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ModeScreen, Press, Rise, ClubDisc, Sheet } from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { albumFor, cosmeticById, type Card } from '../src/engine';
import { collectionStore, looksStore, owned } from '../src/save';
import { rarityColour } from './collection';

/**
 * One club's page.
 *
 * Every season it has, every footballer in it, and the ones you do not
 * have still drawn: dark, outlined, with the name on them. That is what
 * makes it an album rather than a list, and it is the reason somebody
 * looks at Arsenal 2003/04 with four of eleven and decides to keep
 * going.
 *
 * The season that is furthest along sits open at the top, because the one
 * you are closest to finishing is the one you came here about.
 */
export default function Album() {
  const { club } = useLocalSearchParams<{ club?: string }>();
  const [coll, setColl] = useState(() => collectionStore.read());
  const [look, setLook] = useState(() => looksStore.read());
  const [open, setOpen] = useState<Card | null>(null);
  const [showAll, setShowAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setColl(collectionStore.read());
      setLook(looksStore.read());
    }, []),
  );

  const have = useMemo(() => owned(coll), [coll]);
  const name = typeof club === 'string' ? club : '';
  const seasons = useMemo(() => (name ? albumFor(name, have) : []), [name, have]);
  const frame = cosmeticById(look.frame);

  const total = seasons.reduce((a, s) => a + s.cards.length, 0);
  const got = seasons.reduce((a, s) => a + s.owned, 0);

  /* The seasons you have started come first, best first, then the rest in
     order. A page of thirty five untouched seasons buries the two you are
     working on. */
  const ordered = useMemo(() => {
    const started = seasons.filter((s) => s.owned > 0).sort((a, b) => b.owned - a.owned);
    const rest = seasons.filter((s) => s.owned === 0);
    return showAll ? [...started, ...rest] : [...started, ...rest.slice(0, 4)];
  }, [seasons, showAll]);

  const hidden = seasons.filter((s) => s.owned === 0).length - 4;

  return (
    <>
      <ModeScreen
        overline="The album"
        title={name || 'Club'}
        scroll={false}
        onBack={() => router.back()}
        right={
          <View style={styles.chip}>
            <Text style={styles.chipText} allowFontScaling={false}>
              {got}
              <Text style={styles.chipOf}> / {total}</Text>
            </Text>
          </View>
        }
      >
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.crest}>
            <ClubDisc club={name} size={52} />
            <View style={styles.crestBody}>
              <Text style={styles.crestName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.crestMeta}>
                {seasons.length} seasons {'·'} {total} footballers
              </Text>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${total ? Math.max(got ? 2 : 0, (got / total) * 100) : 0}%`,
                      backgroundColor: got === total && total > 0 ? hue.emerald : hue.violet,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {ordered.map((s, i) => (
            <Rise key={s.year} delay={Math.min(i, 6)}>
              <View style={styles.season}>
                <View style={styles.seasonTop}>
                  <Text style={styles.seasonName} allowFontScaling={false}>
                    {s.season}
                  </Text>
                  <View style={styles.seasonLine} />
                  <Text
                    style={[
                      styles.seasonCount,
                      s.owned === s.cards.length ? { color: hue.emerald } : null,
                    ]}
                    allowFontScaling={false}
                  >
                    {s.owned} / {s.cards.length}
                  </Text>
                </View>

                <View style={styles.grid}>
                  {s.cards.map((c) => {
                    const mine = have.has(c.id);
                    const tint = rarityColour(c.rarity);
                    return (
                      <Press
                        key={c.id}
                        onPress={() => {
                          haptic('light');
                          setOpen(c);
                        }}
                        feel="none"
                        scaleTo={0.96}
                        style={[
                          styles.slot,
                          mine
                            ? {
                                borderColor: frame?.a ?? tint,
                                backgroundColor: frame?.b ?? alpha(tint, 0.12),
                              }
                            : styles.slotEmpty,
                        ]}
                      >
                        <Text
                          style={[styles.slotRtg, mine ? { color: tint } : null]}
                          allowFontScaling={false}
                        >
                          {mine ? c.rtg : '?'}
                        </Text>
                        <Text
                          style={[styles.slotName, mine ? { color: color.text1 } : null]}
                          numberOfLines={2}
                        >
                          {c.n}
                        </Text>
                      </Press>
                    );
                  })}
                </View>
              </View>
            </Rise>
          ))}

          {!showAll && hidden > 0 ? (
            <Press
              onPress={() => {
                haptic('light');
                setShowAll(true);
              }}
              feel="none"
              scaleTo={0.98}
              style={styles.more}
            >
              <Text style={styles.moreText}>
                Show {hidden} more {hidden === 1 ? 'season' : 'seasons'}
              </Text>
            </Press>
          ) : null}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      {/* one footballer, front and back */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.sheet}>
            <View
              style={[
                styles.big,
                {
                  borderColor: rarityColour(open.rarity),
                  backgroundColor: alpha(rarityColour(open.rarity), have.has(open.id) ? 0.12 : 0.04),
                },
              ]}
            >
              <Text style={[styles.bigRarity, { color: rarityColour(open.rarity) }]}>
                {open.rarity}
              </Text>
              <Text
                style={[styles.bigRtg, { color: rarityColour(open.rarity) }]}
                allowFontScaling={false}
              >
                {open.rtg}
              </Text>
              <Text style={styles.bigName}>{open.n}</Text>
              <Text style={styles.bigMeta}>
                {open.club} {'·'} {open.season}
              </Text>
              <View style={styles.bigRow}>
                {(Array.isArray(open.pos) ? open.pos : [open.pos]).map((p) => (
                  <Text
                    key={p}
                    style={[styles.bigPos, { color: positionColor[p as 'GK'] ?? color.text3 }]}
                  >
                    {p}
                  </Text>
                ))}
                {open.nat ? <Text style={styles.bigNat}>{open.nat}</Text> : null}
              </View>
            </View>
            <Text style={styles.sheetState}>
              {have.has(open.id)
                ? 'In your album.'
                : 'Not yours yet. Draft him into a finished XI, or find him in a pack.'}
            </Text>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  chip: {
    minWidth: 66,
    height: 34,
    paddingHorizontal: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: {
    fontFamily: font.displayBlack,
    fontSize: 14,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  chipOf: { fontSize: 11, color: color.text3 },

  crest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    marginBottom: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  crestBody: { flex: 1, minWidth: 0, gap: 4 },
  crestName: { fontFamily: font.displayBlack, fontSize: 20, lineHeight: 26, color: color.text1 },
  crestMeta: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  bar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 3 },

  season: { marginBottom: space.s4 },
  seasonTop: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s2 },
  seasonName: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  seasonLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  seasonCount: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 17,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: {
    width: '31.4%',
    minHeight: 78,
    paddingVertical: space.s2,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  slotEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  slotRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: 'rgba(110,126,116,0.55)',
    fontVariant: ['tabular-nums'],
  },
  slotName: {
    fontFamily: font.bodySemi,
    fontSize: 10.5,
    lineHeight: 14,
    color: 'rgba(110,126,116,0.7)',
    textAlign: 'center',
  },

  more: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moreText: { ...text.key, fontSize: 9, color: color.text2 },

  sheet: { paddingHorizontal: space.s4, paddingTop: space.s4, paddingBottom: space.s6, gap: space.s3 },
  big: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: 2,
  },
  bigRarity: { ...text.key, fontSize: 9 },
  bigRtg: {
    fontFamily: font.hero,
    fontSize: 62,
    lineHeight: 74,
    fontVariant: ['tabular-nums'],
  },
  bigName: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    textAlign: 'center',
  },
  bigMeta: { ...text.small, fontSize: 13, lineHeight: 18, color: color.text2 },
  bigRow: { flexDirection: 'row', gap: space.s3, marginTop: space.s3 },
  bigPos: { ...text.key, fontSize: 9 },
  bigNat: { ...text.key, fontSize: 9, color: color.text3 },
  sheetState: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text3, textAlign: 'center' },
});
