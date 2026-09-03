import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, gradient, line, positionColor, radius, space, hue } from '../tokens';
import { font, text } from '../type';
import { haptic } from '../feel';
import { Sheet } from './Sheet';
import { Press } from './Press';
import { ClubDisc } from './ClubDisc';
import {
  expectedRating,
  playerValue,
  renewalTerms,
  scoutRange,
  playerStyle,
  moraleWord,
  type DynastyPlayer,
} from '../../engine';

/**
 * One player, everything about him.
 *
 * Six numbers, what the club expects of him, why his rating moved last
 * summer, his career season by season, and the two decisions you can make
 * about him. A squad list can only ever be a list; this is where a player
 * becomes a person you have an opinion about.
 */
export function PlayerSheet({
  player,
  open,
  onClose,
  onSell,
  onBench,
  benchLabel,
  onSwap,
  swapLabel,
  youth,
  onScout,
  onRelease,
  onPromote,
  scoutCost,
}: {
  player: DynastyPlayer | null;
  open: boolean;
  onClose: () => void;
  onSell?: () => void;
  onBench?: () => void;
  benchLabel?: string;
  onSwap?: () => void;
  swapLabel?: string;
  youth?: boolean;
  onScout?: () => void;
  onRelease?: () => void;
  onPromote?: () => void;
  scoutCost?: number;
}) {
  const [tab, setTab] = useState<'now' | 'career'>('now');

  if (!player) return null;
  const p = player;
  const tint = positionColor[p.pos];
  const worth = playerValue(p);
  const terms = renewalTerms(p);
  const expected = expectedRating(p.rtg);
  const range = youth ? scoutRange(p) : null;
  const style = playerStyle(p);

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={styles.head}>
        <ClubDisc club={p.club} size={44} />
        <View style={styles.headBody}>
          <View style={styles.chips}>
            <View
              style={[styles.chip, { backgroundColor: tint + '26', borderColor: tint + '66' }]}
            >
              <Text style={[styles.chipText, { color: tint }]}>{p.pos}</Text>
            </View>
            <Text style={styles.headMeta}>
              {p.age} {'·'} {p.nat || 'unknown'} {'·'} {p.club}
              {p.youth ? ' academy' : ''}
            </Text>
          </View>
          <Text style={styles.headRtg} allowFontScaling={false}>
            {p.rtg}
            {p.delta !== 0 ? (
              <Text
                style={[
                  styles.headDelta,
                  { color: p.delta > 0 ? color.win : color.loss },
                ]}
              >
                {' '}
                {p.delta > 0 ? '+' : ''}
                {p.delta}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Tab label="This season" on={tab === 'now'} onPress={() => setTab('now')} />
        <Tab
          label={`Career (${p.hist.length})`}
          on={tab === 'career'}
          onPress={() => setTab('career')}
        />
      </View>

      {tab === 'now' ? (
        <>
          <View style={styles.grid}>
            <Tile label="Value" value={`£${worth}m`} tint={color.accent} />
            <Tile label="Wage" value={`£${p.contract.wage}k`} />
            <Tile
              label="Contract"
              value={p.contract.yrs === 0 ? 'Expired' : `${p.contract.yrs} yr`}
              tint={p.contract.yrs <= 1 ? color.warning : undefined}
            />
            <Tile label="Apps" value={String(p.apps)} />
            <Tile label="Goals" value={String(p.goals)} />
            <Tile
              label="Rating"
              value={p.avgR == null ? '–' : p.avgR.toFixed(2)}
              tint={
                p.avgR == null
                  ? undefined
                  : p.avgR >= expected + 0.3
                    ? color.win
                    : p.avgR <= expected - 0.3
                      ? color.loss
                      : undefined
              }
            />
          </View>

          {range ? (
            <View style={styles.note}>
              <Text style={styles.noteKey}>Potential</Text>
              <Text style={styles.noteBody}>
                {range.exact
                  ? `Your scouts are certain: he tops out at ${range.high}.`
                  : `Somewhere between ${range.low} and ${range.high}. Scout him again to narrow it.`}
              </Text>
            </View>
          ) : (
            <View style={styles.note}>
              <Text style={styles.noteKey}>Expected of him</Text>
              <Text style={styles.noteBody}>
                A {p.rtg} should average {expected.toFixed(2)} a game.{' '}
                {p.avgR == null
                  ? 'He did not play enough last season to judge.'
                  : p.avgR >= expected + 0.3
                    ? `He averaged ${p.avgR.toFixed(2)}, well above that.`
                    : p.avgR <= expected - 0.3
                      ? `He averaged ${p.avgR.toFixed(2)}, below it.`
                      : `He averaged ${p.avgR.toFixed(2)}, about right.`}
              </Text>
            </View>
          )}

          {p.why ? (
            <View style={styles.note}>
              <Text style={styles.noteKey}>Why his rating moved</Text>
              <Text style={styles.noteBody}>{p.why}</Text>
            </View>
          ) : null}

          {p.daysOut > 0 ? (
            <View style={[styles.note, styles.noteBad]}>
              <Text style={[styles.noteKey, { color: color.danger }]}>Injury</Text>
              <Text style={styles.noteBody}>
                {p.daysOut} days out last season
                {p.lastInj ? `, worst of them a ${p.lastInj.toLowerCase()}` : ''}.
                {p.injHist ? ` ${p.injHist} serious in his career.` : ''}
              </Text>
            </View>
          ) : null}

          {!youth && p.contract.yrs <= 1 ? (
            <View style={[styles.note, styles.noteWarn]}>
              <Text style={[styles.noteKey, { color: color.warning }]}>Running down</Text>
              <Text style={styles.noteBody}>
                Renewing adds {terms.add} year{terms.add === 1 ? '' : 's'} at £{terms.wage}k a
                week
                {terms.rise > 0 ? `, a rise of £${terms.rise}k` : ' on the same money'}. Let
                it run out and he leaves for nothing.
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.career}>
          {p.hist.length ? (
            <>
              <View style={styles.crHead}>
                <Text style={[styles.crKey, styles.crS]}>S</Text>
                <Text style={[styles.crKey, styles.crClub]}>Club</Text>
                <Text style={[styles.crKey, styles.crN]}>Ap</Text>
                <Text style={[styles.crKey, styles.crN]}>G</Text>
                <Text style={[styles.crKey, styles.crN]}>A</Text>
                <Text style={[styles.crKey, styles.crR]}>Rtg</Text>
              </View>
              {[...p.hist].reverse().map((h) => (
                <View key={h.s} style={styles.crRow}>
                  <Text style={[styles.crVal, styles.crS]} allowFontScaling={false}>
                    {h.s}
                  </Text>
                  <Text style={[styles.crVal, styles.crClub]} numberOfLines={1}>
                    {h.club}
                  </Text>
                  <Text style={[styles.crVal, styles.crN]} allowFontScaling={false}>
                    {h.apps}
                  </Text>
                  <Text style={[styles.crVal, styles.crN]} allowFontScaling={false}>
                    {h.g}
                  </Text>
                  <Text style={[styles.crVal, styles.crN]} allowFontScaling={false}>
                    {h.a}
                  </Text>
                  <Text style={[styles.crVal, styles.crR]} allowFontScaling={false}>
                    {h.r == null ? '–' : h.r.toFixed(2)}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.noteBody}>He has not played a season for you yet.</Text>
          )}
        </View>
      )}

      {/* what kind of player he is, and how he feels about being here */}
      <View style={styles.notes}>
        <View style={styles.note}>
          <Text style={styles.noteKey}>What kind of player</Text>
          <Text style={styles.noteTitle}>{style.name}</Text>
          <Text style={styles.noteBody}>{style.note}</Text>
        </View>
        <View style={styles.note}>
          <Text style={styles.noteKey}>How he feels</Text>
          <Text style={[styles.noteTitle, { color: moraleTint(p.morale ?? 70) }]}>
            {moraleWord(p.morale ?? 70)}
          </Text>
          <View style={styles.moraleTrack}>
            <View
              style={[
                styles.moraleFill,
                {
                  width: `${Math.max(3, p.morale ?? 70)}%`,
                  backgroundColor: moraleTint(p.morale ?? 70),
                },
              ]}
            />
          </View>
        </View>
        {p.cards || p.banned ? (
          <View style={styles.note}>
            <Text style={styles.noteKey}>Discipline</Text>
            <Text style={styles.noteBody}>
              {p.cards} booking{p.cards === 1 ? '' : 's'}
              {p.reds ? ` and a red card` : ''} last season
              {p.banned ? `, ${p.banned} game${p.banned === 1 ? '' : 's'} missed for it` : ''}.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {onScout ? (
          <Press
            onPress={() => {
              haptic('medium');
              onScout();
            }}
            feel="none"
            style={styles.action}
            scaleTo={0.98}
          >
            <Text style={styles.actionText}>
              Scout him{scoutCost ? ` · £${scoutCost}m` : ''}
            </Text>
          </Press>
        ) : null}
        {onSwap ? (
          <Press
            onPress={() => {
              haptic('medium');
              onSwap();
            }}
            feel="none"
            style={styles.action}
            scaleTo={0.98}
          >
            <Text style={styles.actionText}>{swapLabel ?? 'Swap him with somebody'}</Text>
          </Press>
        ) : null}
        {onBench ? (
          <Press
            onPress={() => {
              haptic('medium');
              onBench();
            }}
            feel="none"
            style={styles.action}
            scaleTo={0.98}
          >
            <Text style={styles.actionText}>{benchLabel ?? 'Move to the bench'}</Text>
          </Press>
        ) : null}
        {onSell ? (
          <Press
            onPress={() => {
              haptic('warning');
              onSell();
            }}
            feel="none"
            style={[styles.action, styles.sell]}
            scaleTo={0.98}
          >
            <Text style={[styles.actionText, { color: color.danger }]}>
              Sell for £{worth}m
            </Text>
          </Press>
        ) : null}
        {onPromote ? (
          <Press
            onPress={() => {
              haptic('medium');
              onPromote();
            }}
            feel="none"
            style={styles.action}
            scaleTo={0.98}
          >
            <Text style={styles.actionText}>Promote him into the squad</Text>
          </Press>
        ) : null}
        {onRelease ? (
          <Press
            onPress={() => {
              haptic('warning');
              onRelease();
            }}
            feel="none"
            style={[styles.action, styles.sell]}
            scaleTo={0.98}
          >
            <Text style={[styles.actionText, { color: color.danger }]}>Release him</Text>
          </Press>
        ) : null}
      </View>
    </Sheet>
  );
}

function moraleTint(m: number): string {
  return m >= 70 ? hue.emerald : m >= 50 ? hue.amber : hue.crimson;
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press
      onPress={() => {
        haptic('select');
        onPress();
      }}
      feel="none"
      style={[styles.tab, on ? styles.tabOn : null]}
      scaleTo={0.97}
    >
      <Text style={[styles.tabText, on ? { color: color.accent } : null]}>{label}</Text>
    </Press>
  );
}

function Tile({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.tile}>
      <Text
        style={[styles.tileValue, tint ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  headBody: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  chip: {
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: { ...text.key, fontSize: 8.5 },
  headMeta: { flex: 1, ...text.small, fontSize: 11 },
  headRtg: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 37,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  headDelta: { fontFamily: font.displayBold, fontSize: 15 },

  tabs: { flexDirection: 'row', gap: space.s2, marginTop: space.s4 },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.card,
  },
  tabOn: { borderColor: line.accent, backgroundColor: 'rgba(31,197,126,0.1)' },
  tabText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.4,
    color: color.text3,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  tileValue: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { ...text.key, fontSize: 8, color: color.text3, marginTop: 1 },

  note: {
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  noteBad: { borderColor: line.danger, backgroundColor: 'rgba(229,72,77,0.08)' },
  noteWarn: { borderColor: 'rgba(245,165,36,0.4)', backgroundColor: 'rgba(245,165,36,0.08)' },
  noteKey: { ...text.key, fontSize: 8.5, color: color.text3, marginBottom: 3 },
  noteTitle: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
    marginBottom: 1,
  },
  noteBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },

  career: { marginTop: space.s3 },
  crHead: {
    flexDirection: 'row',
    paddingBottom: space.s2,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
  },
  crRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  crKey: { ...text.key, fontSize: 8, color: color.text3 },
  crVal: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 16,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  crS: { width: 24 },
  crClub: { flex: 1, paddingRight: space.s2 },
  crN: { width: 28, textAlign: 'right' },
  crR: { width: 42, textAlign: 'right' },

  notes: { gap: space.s2, marginTop: space.s4 },
  moraleTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    marginTop: 5,
  },
  moraleFill: { height: 5, borderRadius: 3 },

  actions: { gap: space.s2, marginTop: space.s4, marginBottom: space.s2 },
  action: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sell: { borderColor: line.danger, backgroundColor: 'rgba(229,72,77,0.08)' },
  actionText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text1,
  },
});
