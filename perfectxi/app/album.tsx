import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { back } from '../src/game/nav';
import {
  ModeScreen,
  Press,
  Rise,
  ClubDisc,
  Sheet,
  Confirm,
  CardFace,
  Coin,
  commas,
} from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { useLayout, cellWidth } from '../src/ui/layout';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import { sellCard } from '../src/game/progress';
import { albumFor, cardById, cardId, cardValue, cosmeticById, type Card } from '../src/engine';
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
  const { club, year, who } = useLocalSearchParams<{
    club?: string;
    year?: string;
    who?: string;
  }>();
  const [coll, setColl] = useState(() => collectionStore.read());
  const [look, setLook] = useState(() => looksStore.read());
  const [open, setOpen] = useState<Card | null>(null);

  /*
   * How wide one slot in the wall is.
   *
   * Three across on a phone, which is what it has always been, and as
   * many as fit at 96 points on anything wider. The album is the screen
   * a tablet flatters most: a wall of cards is exactly the thing a big
   * screen is for, and three of them stretched across it is exactly the
   * thing that makes an app look like a blown up phone.
   */
  const L = useLayout();
  const perRow = L.wide ? L.cols(96, 10) : 3;
  const slotWidth = cellWidth(
    Math.min(L.width, L.wide ? L.wideCap : L.readCap) - space.s4 * 2,
    perRow,
    6,
  );
  const [selling, setSelling] = useState<Card | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setColl(collectionStore.read());
      setLook(looksStore.read());
    }, []),
  );

  const have = useMemo(() => owned(coll), [coll]);
  const name = typeof club === 'string' ? club : '';

  /* Arriving with a footballer named opens straight onto him. Tapping a
     card and landing on a list of thirty five seasons to hunt through is
     not what tapping a card should do.
     
     The three parts are passed separately rather than as the card's own
     id, because that id has pipes and spaces in it and does not survive
     being a parameter in a URL. */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    if (typeof club !== 'string' || typeof year !== 'string' || typeof who !== 'string') return;
    const found = cardById(cardId(club, Number(year), who));
    if (found) {
      asked.current = true;
      setOpen(found);
    }
  }, [club, year, who]);
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
        wide
        overline="The album"
        title={name || 'Club'}
        scroll={false}
        onBack={() => back()}
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
          {said ? <Text style={styles.said}>{said}</Text> : null}
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
                          { width: slotWidth },
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

      {/* one footballer, as the card he is */}
      <Sheet visible={open !== null} onClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.sheet}>
            <View style={styles.cardBox}>
              <CardFace card={open} ghost={!have.has(open.id)} edge={frame?.a} />
            </View>

            {have.has(open.id) ? (
              <>
                <Text style={styles.sheetState}>
                  In your album. Worth {commas(cardValue(open))} coins if you let him go.
                </Text>
                <Press
                  onPress={() => {
                    haptic('warning');
                    setSelling(open);
                  }}
                  feel="none"
                  scaleTo={0.98}
                  style={styles.sell}
                >
                  <Coin size={15} />
                  <Text style={styles.sellText}>Sell for {commas(cardValue(open))}</Text>
                </Press>
              </>
            ) : (
              <Text style={styles.sheetState}>
                Not yours yet. Draft him into a finished XI, or find him in a pack.
              </Text>
            )}
          </View>
        ) : null}
      </Sheet>

      <Confirm
        visible={selling !== null}
        title={selling ? `Sell ${selling.n}?` : ''}
        body={
          selling
            ? `He leaves the album for ${commas(cardValue(selling))} coins. You can find him again, but only by drafting him or opening a pack.`
            : ''
        }
        confirmLabel="Sell"
        cancelLabel="Keep him"
        onCancel={() => setSelling(null)}
        onConfirm={() => {
          if (!selling) return;
          const got = sellCard(selling.id);
          setSelling(null);
          setOpen(null);
          if (got.ok) {
            haptic('success');
            sfx('tick');
            setSaid(`${commas(got.coins)} coins.`);
            setColl(collectionStore.read());
          }
        }}
      />
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
    /* width comes from the window: three across on a phone, more on a
       tablet, because the same three stretched over a big screen turn
       a wall of cards into three enormous rectangles */
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
  cardBox: { width: '100%', aspectRatio: 0.72, alignSelf: 'center', maxWidth: 300 },
  sheetState: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    textAlign: 'center',
  },
  sell: {
    flexDirection: 'row',
    gap: space.s2,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.12),
  },
  sellText: { ...text.button, fontSize: 14, color: hue.gold },
  said: {
    ...text.small,
    fontSize: 12.5,
    color: hue.emerald,
    marginBottom: space.s2,
    textAlign: 'center',
  },
});
