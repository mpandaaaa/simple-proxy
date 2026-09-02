import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, ClubDisc, Confirm } from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  emptySlots,
  market,
  mulberry32,
  promote,
  sign,
  posFit,
  type Listing,
  type Position,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/**
 * The transfer market.
 *
 * Nine players worth signing and three free agents, redrawn each season
 * and fixed for it, so you cannot reroll the list until something good
 * turns up. There is always a keeper on it.
 *
 * The academy sits on the same screen, because promoting a seventeen year
 * old and paying £80m for a twenty seven year old are the same decision
 * made two different ways, and putting them on separate screens hides
 * that.
 */
export default function Market() {
  const career = useCareer();
  const [target, setTarget] = useState<{ listing: Listing } | null>(null);
  const [youthTarget, setYouthTarget] = useState<number | null>(null);

  // Drawn once per season and held, so the list cannot be rerolled.
  const listings = useMemo(() => {
    if (!career) return [];
    return market(career, mulberry32((career.seed ^ Math.imul(career.year, 0x85ebca6b)) >>> 0));
  }, [career?.seed, career?.year, career?.roster]);

  const holes = career ? emptySlots(career) : [];

  const doSign = useCallback(
    (listing: Listing, slot: number) => {
      updateCareer((d) => {
        const rnd = mulberry32((d.seed ^ Math.imul(d.year * 31 + slot, 0xc2b2ae35)) >>> 0);
        return sign(d, listing, slot, rnd) ?? d;
      });
      haptic('success');
      sfx('pick');
      setTarget(null);
    },
    [],
  );

  const doPromote = useCallback((youthIndex: number, slot: number) => {
    updateCareer((d) => promote(d, youthIndex, slot) ?? d);
    haptic('success');
    sfx('pick');
    setYouthTarget(null);
  }, []);

  if (!career) return null;

  return (
    <>
      <ModeScreen
        overline={`£${career.budget}m to spend`}
        title="Transfers"
        onBack={() => router.back()}
      >
        {holes.length ? (
          <View style={styles.holes}>
            <Text style={styles.holesKey}>
              {holes.length} place{holes.length === 1 ? '' : 's'} to fill
            </Text>
            <Text style={styles.holesBody}>
              {holes.map((h) => h.pos).join(', ')}. Sign someone or bring a
              youngster through. A place left empty is a player short on the
              day.
            </Text>
          </View>
        ) : (
          <Text style={styles.lead}>
            Your fourteen are all filled. Sell someone first if you want to
            sign, or take a look at what is out there anyway.
          </Text>
        )}

        {career.youth.length ? (
          <>
            <Text style={[text.label, styles.sect]}>From your own academy</Text>
            <Text style={styles.sectNote}>Free, and they count as homegrown.</Text>
            <View style={styles.list}>
              {career.youth.map((p, i) => (
                <Rise key={p.n} delay={Math.min(i, 4)}>
                  <Press
                    onPress={() => {
                      if (!holes.length) return;
                      haptic('light');
                      setYouthTarget(i);
                    }}
                    feel="none"
                    scaleTo={0.99}
                    style={[styles.card, !holes.length ? styles.cardOff : null]}
                  >
                    <Shine radius={radius.md} group="card" rating={p.rtg} bevel={false} clip={false} />
                    <Badge pos={p.pos} />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {p.n}
                      </Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {p.age} {'·'} academy {'·'} £{p.contract.wage}k a week
                      </Text>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={styles.cardRtg} allowFontScaling={false}>
                        {p.rtg}
                      </Text>
                      <Text style={styles.cardPrice}>free</Text>
                    </View>
                  </Press>
                </Rise>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[text.label, styles.sect]}>On the market</Text>
        <Text style={styles.sectNote}>
          This list is set for the season. It changes in the summer, not when
          you look again.
        </Text>
        <View style={styles.list}>
          {listings.map((l, i) => {
            const affordable = l.price <= career.budget;
            return (
              <Rise key={l.n} delay={Math.min(i, 6)}>
                <Press
                  onPress={() => {
                    if (!holes.length || !affordable) return;
                    haptic('light');
                    setTarget({ listing: l });
                  }}
                  feel="none"
                  scaleTo={0.99}
                  style={[
                    styles.card,
                    !holes.length || !affordable ? styles.cardOff : null,
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
                      {l.age} {'·'} {l.club} {'·'} £{l.wage}k a week
                    </Text>
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
                  </View>
                </Press>
              </Rise>
            );
          })}
        </View>

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      {/* Which place he goes into, with what it costs him spelled out. */}
      <SlotPicker
        open={target !== null}
        title={target ? `Where does ${target.listing.n} play?` : ''}
        holes={holes}
        playerPos={target?.listing.pos ?? 'MID'}
        onCancel={() => setTarget(null)}
        onPick={(slot) => target && doSign(target.listing, slot)}
      />
      <SlotPicker
        open={youthTarget !== null}
        title={
          youthTarget !== null ? `Where does ${career.youth[youthTarget]?.n} play?` : ''
        }
        holes={holes}
        playerPos={youthTarget !== null ? (career.youth[youthTarget]?.pos ?? 'MID') : 'MID'}
        onCancel={() => setYouthTarget(null)}
        onPick={(slot) => youthTarget !== null && doPromote(youthTarget, slot)}
      />
    </>
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

/**
 * Which place he fills.
 *
 * Every empty place is offered, with what it would cost him to play there.
 * Out of position is allowed, because sometimes it is the only option, and
 * the price is shown rather than hidden.
 */
function SlotPicker({
  open,
  title,
  holes,
  playerPos,
  onCancel,
  onPick,
}: {
  open: boolean;
  title: string;
  holes: { index: number; pos: Position }[];
  playerPos: Position;
  onCancel: () => void;
  onPick: (slot: number) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);

  if (!open) return null;
  return (
    <Confirm
      visible={open}
      title={title}
      body={holes
        .map((h) => {
          const fit = posFit(playerPos, h.pos);
          const where = h.index < 11 ? h.pos : `${h.pos} on the bench`;
          return fit === 1
            ? `${where}: his own position`
            : `${where}: ${Math.round((1 - fit) * 100)}% off his best`;
        })
        .join('\n')}
      confirmLabel={
        holes.length === 1
          ? `Put him at ${holes[0].pos.toLowerCase()}`
          : `Best fit: ${bestHole(holes, playerPos).pos.toLowerCase()}`
      }
      cancelLabel="Not now"
      onCancel={() => {
        setChosen(null);
        onCancel();
      }}
      onConfirm={() => {
        const pick = holes.length === 1 ? holes[0] : bestHole(holes, playerPos);
        setChosen(null);
        onPick(pick.index);
      }}
    />
  );
}

function bestHole(holes: { index: number; pos: Position }[], playerPos: Position) {
  return [...holes].sort(
    (a, b) => posFit(playerPos, b.pos) - posFit(playerPos, a.pos) || a.index - b.index,
  )[0];
}

const styles = StyleSheet.create({
  lead: { ...text.body, color: color.text2 },
  holes: {
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
  sectNote: { ...text.small, fontSize: 11.5, marginBottom: space.s3 },
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
  cardRight: { alignItems: 'flex-end', minWidth: 52 },
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

  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
});
