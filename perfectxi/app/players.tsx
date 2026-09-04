import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { go, back } from '../src/game/nav';
import { ModeScreen, Press, ClubDisc, commas } from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { allCards, type Card } from '../src/engine';
import { collectionStore, owned } from '../src/save';

/**
 * Every footballer in the game.
 *
 * Eleven thousand cards across three thousand people, and the useful
 * question is never "list them all", it is "which seasons of him are
 * there and which have I got". So a search returns the person, with a
 * row per season he appears in, newest first, and each row says whether
 * it is in your album. Tapping one opens the card.
 *
 * The whole list is built once by the engine and this filters it, which
 * is a string compare over eleven thousand short strings: fast enough to
 * run on every keystroke, and capped so a single letter never tries to
 * draw four thousand rows.
 */
export default function Players() {
  const [coll, setColl] = useState(() => collectionStore.read());
  const [q, setQ] = useState('');

  useFocusEffect(
    useCallback(() => {
      setColl(collectionStore.read());
    }, []),
  );

  const have = useMemo(() => owned(coll), [coll]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    /* Grouped by person, because six rows of Alan Shearer one after
       another is a worse answer than one Alan Shearer with six seasons
       under him. */
    const by = new Map<string, Card[]>();
    for (const c of allCards()) {
      if (!c.n.toLowerCase().includes(term)) continue;
      const list = by.get(c.n);
      if (list) list.push(c);
      else by.set(c.n, [c]);
      if (by.size > 60) break;
    }
    return [...by.entries()]
      .map(([n, cards]) => ({
        n,
        cards: [...cards].sort((a, b) => b.year - a.year),
        best: Math.max(...cards.map((c) => c.rtg)),
        mine: cards.filter((c) => have.has(c.id)).length,
      }))
      .sort((a, b) => b.best - a.best || a.n.localeCompare(b.n));
  }, [q, have]);

  const total = allCards().length;

  return (
    <ModeScreen
      overline="Records"
      title="Player index"
      scroll={false}
      onBack={() => back()}
    >
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search a footballer"
        placeholderTextColor={color.text3}
        autoCorrect={false}
        autoCapitalize="words"
        style={styles.search}
      />

      {q.trim().length < 2 ? (
        <View style={styles.blank}>
          <Text style={styles.blankBig}>
            {commas(total)} cards, {commas(3003)} footballers
          </Text>
          <Text style={styles.blankText}>
            Thirty five seasons of the Premier League, 1992 to 2026. Type two
            letters and every season of him comes back, with the ones in your
            album marked.
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.none}>Nobody by that name.</Text>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => r.n}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.person}>
              <View style={styles.personTop}>
                <Text style={styles.personName} numberOfLines={1}>
                  {item.n}
                </Text>
                <Text
                  style={[
                    styles.personHave,
                    item.mine === item.cards.length ? { color: hue.emerald } : null,
                  ]}
                  allowFontScaling={false}
                >
                  {item.mine} / {item.cards.length}
                </Text>
              </View>

              {item.cards.map((c) => {
                const mine = have.has(c.id);
                const pos = (Array.isArray(c.pos) ? c.pos[0] : c.pos) as 'GK';
                return (
                  <Press
                    key={c.id}
                    onPress={() => {
                      haptic('light');
                      go({
                        pathname: '/album',
                        params: { club: c.club, year: String(c.year), who: c.n },
                      });
                    }}
                    feel="none"
                    scaleTo={0.99}
                    style={[
                      styles.row,
                      mine ? { borderColor: alpha(rarityColour(c.rtg), 0.5) } : null,
                    ]}
                  >
                    <ClubDisc club={c.club} size={28} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowClub} numberOfLines={1}>
                        {c.club}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        <Text style={{ color: positionColor[pos] ?? color.text3 }}>
                          {Array.isArray(c.pos) ? c.pos.join(' ') : c.pos}
                        </Text>
                        {`  ${c.season}`}
                      </Text>
                    </View>
                    <Text
                      style={[styles.rowRtg, { color: rarityColour(c.rtg) }]}
                      allowFontScaling={false}
                    >
                      {c.rtg}
                    </Text>
                    <Text style={[styles.rowMine, mine ? { color: hue.emerald } : null]}>
                      {mine ? 'YOURS' : ''}
                    </Text>
                  </Press>
                );
              })}
            </View>
          )}
        />
      )}
    </ModeScreen>
  );
}

function rarityColour(rtg: number): string {
  return rtg >= 90 ? hue.violet : rtg >= 85 ? hue.gold : rtg >= 78 ? '#B9C6CE' : '#B87333';
}

const styles = StyleSheet.create({
  search: {
    minHeight: 52,
    paddingHorizontal: space.s3,
    marginBottom: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: color.text1,
    fontFamily: font.bodySemi,
    fontSize: 16,
  },

  blank: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    gap: space.s2,
  },
  blankBig: { fontFamily: font.displayBlack, fontSize: 20, lineHeight: 26, color: color.text1 },
  blankText: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text3 },
  none: { ...text.small, fontSize: 13, color: color.text3, paddingTop: space.s4 },

  person: { marginBottom: space.s4 },
  personTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s3,
    marginBottom: space.s2,
  },
  personName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 24,
    color: color.text1,
  },
  personHave: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 54,
    marginBottom: 5,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowClub: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text1 },
  rowMeta: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  rowRtg: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  rowMine: { ...text.key, fontSize: 7.5, color: color.text3, width: 38, textAlign: 'right' },
});
