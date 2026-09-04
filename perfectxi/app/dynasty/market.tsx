import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { back } from '../../src/game/nav';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  ClubDisc,
  SlotSheet,
  PlayerSheet,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  clubWageBill,
  emptySlots,
  market,
  mulberry32,
  posFit,
  canFill,
  placeName,
  styleOf,
  playerValue,
  revenue,
  sell,
  sign,
  squadRating,
  starters,
  wage,
  type DynastyPlayer,
  type Listing,
  type Position,
  saleBlock,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/** Three looks at the market a season, then it is the list you have. */
const MAX_ROLLS = 3;

type Filter = 'all' | Position;

/**
 * The transfer market.
 *
 * Two questions a manager actually asks: can I afford him, and does he
 * make the team better. Every listing answers both before you tap it, and
 * the difference he would make to the eleven is worked out through the
 * same position fit the match engine uses, so a striker filling in at the
 * back reads as what it is.
 *
 * The list is fixed for the season and you get three fresh looks at it.
 * Without a limit a market is not a market, it is a slot machine you pull
 * until the right player appears.
 */
export default function Market() {
  const career = useCareer();
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<Listing | null>(null);
  const [selling, setSelling] = useState<{ p: DynastyPlayer; slot: number } | null>(null);

  /* Drawn from the career seed, the year and how many looks have been
     used, so the same list comes back until you spend a look on a new
     one. Signing somebody takes him off it and selling somebody does not
     touch it: every name keeps its place in the queue whatever else
     happens to the squad. */
  const listings = useMemo(() => {
    if (!career) return [];
    const seed =
      (career.seed ^ Math.imul(career.year * 41 + career.marketRolls, 0x85ebca6b)) >>> 0;
    return market(career, mulberry32(seed));
  }, [
    career?.seed,
    career?.year,
    career?.marketRolls,
    career?.roster,
    career?.sold?.length,
    career?.staff?.scout,
  ]);

  const holes = career ? emptySlots(career) : [];
  const rollsLeft = career ? MAX_ROLLS - career.marketRolls : 0;

  const reroll = useCallback(() => {
    updateCareer((d) =>
      d.marketRolls >= MAX_ROLLS ? d : { ...d, marketRolls: d.marketRolls + 1 },
    );
    haptic('medium');
    sfx('tick');
  }, []);

  const doSign = useCallback((listing: Listing, slot: number) => {
    updateCareer((d) => {
      const rnd = mulberry32((d.seed ^ Math.imul(d.year * 31 + slot, 0xc2b2ae35)) >>> 0);
      return sign(d, listing, slot, rnd) ?? d;
    });
    haptic('success');
    sfx('pick');
    setTarget(null);
  }, []);

  const doSell = useCallback((slot: number) => {
    updateCareer((d) => sell(d, slot) ?? d);
    haptic('warning');
    setSelling(null);
  }, []);

  if (!career) return null;

  const rating = squadRating(starters(career));
  const bill = clubWageBill(career);
  const last = career.seasons[career.seasons.length - 1];
  const rev = revenue(last ? last.fin : career.objective.target, career);
  const wageRoom = Math.round(rev * 0.75) - bill;

  const shown = listings.filter((l) => filter === 'all' || l.pos === filter);

  return (
    <>
      <ModeScreen
        overline={`£${career.budget}m to spend`}
        title="Transfers"
        onBack={() => back()}
      >
        {/* ---- what you have, and what it costs ---- */}
        <View style={styles.money}>
          <Shine radius={radius.lg} group="panel" />
          <View style={styles.moneyRow}>
            <Fig label="Budget" value={`£${career.budget}m`} tint={hue.sky} />
            <Fig
              label="Wage room"
              value={`£${Math.max(0, wageRoom)}m`}
              tint={wageRoom < 20 ? hue.crimson : hue.violet}
            />
            <Fig label="Squad" value={String(rating)} tint={hue.emerald} />
          </View>
          <Text style={styles.moneyNote}>
            Selling adds to the budget. Wage room is what is left before the
            bill reaches three quarters of what the club earns, which is
            where players stop signing new deals.
          </Text>
        </View>

        {holes.length ? (
          <View style={styles.holes}>
            <Text style={styles.holesKey}>
              {holes.length} place{holes.length === 1 ? '' : 's'} to fill
            </Text>
            <Text style={styles.holesBody}>
              {holes.map((h) => h.pos).join(', ')}. A place left empty is a
              player short on the day.
            </Text>
          </View>
        ) : (
          <Text style={styles.lead}>
            All fourteen filled. Sell someone to make room, or sign anyway and
            the new man takes an empty bench place.
          </Text>
        )}

        {/* ---- the market ---- */}
        <View style={styles.marketHead}>
          <Text style={[text.label, styles.sectTight]}>On the market</Text>
          <Press
            onPress={() => rollsLeft > 0 && reroll()}
            feel="none"
            scaleTo={0.96}
            style={[styles.reroll, rollsLeft === 0 ? styles.rerollOff : null]}
          >
            <Text
              style={[styles.rerollText, rollsLeft === 0 ? { color: color.text3 } : null]}
            >
              {rollsLeft > 0 ? `New list · ${rollsLeft} left` : 'No looks left'}
            </Text>
          </Press>
        </View>
        <Text style={styles.sectNote}>
          {rollsLeft > 0
            ? `The list is fixed until you spend a look. You get ${MAX_ROLLS} a season.`
            : 'This is the list until the summer.'}
        </Text>

        <View style={styles.filters}>
          {(['all', 'GK', 'DEF', 'MID', 'ATT'] as Filter[]).map((f) => (
            <Press
              key={f}
              onPress={() => {
                haptic('select');
                setFilter(f);
              }}
              feel="none"
              scaleTo={0.95}
              style={[
                styles.filter,
                filter === f
                  ? {
                      borderColor: alpha(filterHue(f), 0.45),
                      backgroundColor: alpha(filterHue(f), 0.13),
                    }
                  : null,
              ]}
            >
              <Text
                style={[styles.filterText, filter === f ? { color: filterHue(f) } : null]}
              >
                {f === 'all' ? 'All' : f}
              </Text>
            </Press>
          ))}
        </View>

        <View style={styles.list}>
          {shown.map((l, i) => {
            const affordable = l.price <= career.budget;
            /* What he would actually add, at the best place you have open.
               Only places he is allowed to fill count: a keeper cannot be
               offered a spot at centre back to make the number look better. */
            const legal = holes.filter((h) => h.index >= 11 || canFill(l.pos, h.pos));
            const best = legal.length
              ? legal.reduce(
                  (a, b) => (posFit(l.pos, a.pos) >= posFit(l.pos, b.pos) ? a : b),
                  legal[0],
                )
              : null;
            const fit = best ? posFit(l.pos, best.pos) : 1;
            const worth = Math.round(l.rtg * fit);
            const swing = worth - rating;
            const noRoom = holes.length > 0 && legal.length === 0;

            return (
              <Rise key={l.n} delay={Math.min(i, 6)}>
                <Press
                  onPress={() => {
                    if (!affordable || noRoom) return;
                    haptic('light');
                    setTarget(l);
                  }}
                  feel="none"
                  scaleTo={0.99}
                  style={[
                    styles.card,
                    !affordable || noRoom ? styles.cardOff : null,
                    l.free ? { borderColor: line.gold } : null,
                  ]}
                >
                  <Shine radius={radius.md} group="card" rating={l.rtg} bevel={false} clip={false} />
                  <Badge pos={l.pos} />
                  <ClubDisc club={l.club} size={26} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {l.n}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {l.age} {'·'} {styleOf(l.n, l.pos).name} {'·'} £{l.wage}k a week
                    </Text>
                    {noRoom ? (
                      <Text style={styles.cardFit} numberOfLines={1}>
                        {l.pos === 'GK'
                          ? 'no place in goal open'
                          : `nowhere open ${placeName(l.pos)}`}
                      </Text>
                    ) : best && fit < 1 ? (
                      <Text style={styles.cardFit} numberOfLines={1}>
                        would play {placeName(best.pos)}, {Math.round((1 - fit) * 100)}% off
                        his best
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardRtg} allowFontScaling={false}>
                      {l.rtg}
                    </Text>
                    <Text
                      style={[
                        styles.cardPrice,
                        l.free
                          ? { color: color.gold }
                          : affordable
                            ? { color: color.accent }
                            : { color: color.danger },
                      ]}
                      allowFontScaling={false}
                    >
                      {l.free ? 'free' : `£${l.price}m`}
                    </Text>
                    {legal.length ? (
                      <Text
                        style={[
                          styles.cardSwing,
                          { color: swing > 0 ? color.win : swing < 0 ? color.loss : color.text3 },
                        ]}
                        allowFontScaling={false}
                      >
                        {swing > 0 ? '+' : ''}
                        {swing} to the XI
                      </Text>
                    ) : null}
                  </View>
                </Press>
              </Rise>
            );
          })}
          {shown.length === 0 ? (
            <Text style={styles.none}>Nobody in that position on this list.</Text>
          ) : null}
        </View>

        {/* ---- raising money ---- */}
        <Text style={[text.label, styles.sect]}>Raise money</Text>
        <Text style={styles.sectNote}>
          Selling frees the wage and adds the fee to your budget. An academy
          player is almost pure profit, because he never cost anything.
        </Text>
        <View style={styles.list}>
          {career.roster.map((p, slot) => {
            if (!p) return null;
            /* A man who signed this summer is on the list, greyed, with the
               reason on the row. Hiding him would read as him having
               vanished from the squad. */
            const block = saleBlock(career, p);
            return (
              <Press
                key={p.n}
                onPress={() => {
                  haptic('light');
                  setSelling({ p, slot });
                }}
                feel="none"
                scaleTo={0.99}
                style={[styles.card, block ? styles.cardLocked : null]}
              >
                <Badge pos={p.pos} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {p.n}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {p.age} {'·'} £{p.contract.wage}k a week {'·'}{' '}
                    {slot < 11 ? 'starting' : 'bench'}
                    {p.youth ? ' · academy' : ''}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardRtg} allowFontScaling={false}>
                    {p.rtg}
                  </Text>
                  {block ? (
                    <Text style={styles.cardHeld} numberOfLines={1}>
                      just signed
                    </Text>
                  ) : (
                    <Text style={[styles.cardPrice, { color: color.accent }]}>
                      £{playerValue(p)}m
                    </Text>
                  )}
                </View>
              </Press>
            );
          })}
        </View>

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      {/* Which place he fills, with what it costs him spelled out. */}
      <SlotSheet
        open={target !== null}
        title={target ? `Sign ${target.n}` : ''}
        subtitle={
          target
            ? `${target.rtg} rated, ${target.age}, ${target.free ? 'free' : `£${target.price}m`}, £${target.wage}k a week`
            : ''
        }
        holes={holes}
        playerPos={target?.pos ?? 'MID'}
        onClose={() => setTarget(null)}
        onPick={(slot) => target && doSign(target, slot)}
      />

      <PlayerSheet
        player={selling?.p ?? null}
        open={selling !== null}
        onClose={() => setSelling(null)}
        onSell={selling ? () => doSell(selling.slot) : undefined}
        sellBlock={selling ? saleBlock(career, selling.p) : null}
      />
    </>
  );
}

function Fig({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.fig}>
      <Text style={[styles.figValue, tint ? { color: tint } : null]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.figLabel}>{label}</Text>
    </View>
  );
}

function Badge({ pos }: { pos: Position }) {
  const tint = positionColor[pos];
  return (
    <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
      <Text style={[styles.badgeText, { color: tint }]}>{pos}</Text>
    </View>
  );
}

/** A filter wears the colour its position already has everywhere else. */
function filterHue(f: Filter): string {
  return f === 'all' ? hue.emerald : positionColor[f];
}

const styles = StyleSheet.create({
  cardLocked: { opacity: 0.5 },
  cardHeld: {
    ...text.small,
    fontSize: 11,
    lineHeight: 15,
    color: color.text3,
  },
  money: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.26),
    backgroundColor: '#0C1219',
    experimental_backgroundImage:
      'linear-gradient(180deg, #14212F 0%, #0D1319 62%, #080B0E 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  moneyRow: { flexDirection: 'row' },
  fig: { flex: 1, alignItems: 'center', gap: 1 },
  figValue: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  figLabel: { ...text.key, fontSize: 8, color: color.text3 },
  moneyNote: { ...text.small, fontSize: 11, lineHeight: 15 },

  lead: { ...text.body, color: color.text2, marginTop: space.s4 },
  holes: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.09)',
    gap: 4,
  },
  holesKey: { ...text.key, fontSize: 10, color: color.danger },
  holesBody: { ...text.small, lineHeight: 18 },

  sect: { marginTop: space.s6, marginBottom: space.s2 },
  sectTight: { marginBottom: 0 },
  sectNote: { ...text.small, fontSize: 11.5, marginBottom: space.s3 },
  none: { ...text.small, fontSize: 12.5, textAlign: 'center', paddingVertical: space.s4 },

  marketHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s6,
    marginBottom: space.s2,
  },
  reroll: {
    paddingHorizontal: space.s3,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.10)',
  },
  rerollOff: { borderColor: line.card, backgroundColor: 'rgba(255,255,255,0.03)' },
  rerollText: { ...text.key, fontSize: 9, color: color.accent },

  filters: { flexDirection: 'row', gap: 5, marginBottom: space.s3 },
  filter: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.card,
  },
  filterOn: { borderColor: line.accent, backgroundColor: 'rgba(31,197,126,0.1)' },
  filterText: {
    fontFamily: font.displaySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: color.text3,
  },

  list: { gap: space.s2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  cardOff: { opacity: 0.45 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  cardMeta: {
    fontFamily: font.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  cardFit: { fontFamily: font.body, fontSize: 10, lineHeight: 14, color: color.warning },
  cardRight: { alignItems: 'flex-end', minWidth: 62 },
  cardRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  cardPrice: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 15,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  cardSwing: { fontFamily: font.body, fontSize: 9, lineHeight: 12 },

  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },

  sheetTitle: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
  },
  sheetSub: { ...text.small, fontSize: 12.5, marginTop: 2 },
  sheetKey: { ...text.key, fontSize: 9, color: color.text3, marginTop: space.s4, marginBottom: space.s2 },
  sheetNone: { ...text.body, color: color.text2, marginTop: space.s4 },
  slots: { gap: space.s2, marginBottom: space.s3 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  slotBody: { flex: 1, minWidth: 0 },
  slotWhere: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  slotFit: { fontFamily: font.body, fontSize: 11, lineHeight: 15 },
  slotArrow: { fontSize: 18, color: color.text3 },
});
