import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { back } from '../../src/game/nav';
import { ModeScreen, Press, Shine, PlayerSheet } from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  saleBlock,
  clubWageBill,
  everyone,
  renewalTerms,
  revenue,
  sell,
  type DynastyPlayer,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/**
 * Contracts.
 *
 * A squad list sorted by how soon somebody walks out of the door. The
 * whole screen exists because of one rule that catches everybody the first
 * time: a contract running to zero means the player leaves for nothing.
 *
 * Renewing adds years to whatever is left rather than replacing them, and
 * the wage only rises to what he is worth, so keeping a squad together
 * does not spiral.
 */
export default function Squad() {
  const career = useCareer();
  const [open, setOpen] = useState<{ p: DynastyPlayer; slot: number } | null>(null);

  const rows = useMemo(() => {
    if (!career) return [];
    return career.roster
      .map((p, slot) => ({ p, slot }))
      .filter((r): r is { p: DynastyPlayer; slot: number } => r.p !== null)
      .sort((a, b) => a.p.contract.yrs - b.p.contract.yrs || b.p.rtg - a.p.rtg);
  }, [career]);

  const renew = useCallback((slot: number) => {
    updateCareer((d) => {
      const p = d.roster[slot];
      if (!p) return d;
      const terms = renewalTerms(p);
      const roster = [...d.roster];
      roster[slot] = { ...p, contract: { yrs: terms.yrs, wage: terms.wage } };
      return { ...d, roster, budget: Math.max(0, d.budget - terms.fee) };
    });
    haptic('success');
  }, []);

  const doSell = useCallback((slot: number) => {
    updateCareer((d) => sell(d, slot) ?? d);
    setOpen(null);
  }, []);

  if (!career) return null;

  const bill = clubWageBill(career);
  const last = career.seasons[career.seasons.length - 1];
  const rev = revenue(last ? last.fin : career.objective.target, career);
  const ratio = Math.round((bill / rev) * 100);
  const running = everyone(career).filter((p) => p.contract.yrs <= 1).length;

  return (
    <>
      <ModeScreen overline={career.club} title="Contracts" onBack={() => back()}>
        <View style={styles.bill}>
          <Shine radius={radius.lg} group="panel" />
          <View style={styles.billHead}>
            <Text style={styles.billKey}>Wage bill</Text>
            <Text
              style={[
                styles.billValue,
                { color: ratio >= 75 ? color.danger : ratio >= 65 ? color.warning : color.text1 },
              ]}
              allowFontScaling={false}
            >
              £{bill}m
            </Text>
          </View>
          <View style={styles.billTrack}>
            <View
              style={[
                styles.billFill,
                {
                  width: `${Math.min(100, ratio)}%`,
                  backgroundColor:
                    ratio >= 75 ? color.danger : ratio >= 65 ? color.warning : color.accent,
                },
              ]}
            />
            <View style={styles.billMark} />
          </View>
          <Text style={styles.billNote}>
            {ratio}% of what the club earns. Past 75% and the club stops
            offering new deals on its own, and players start leaving.
          </Text>
        </View>

        {running ? (
          <View style={styles.alert}>
            <Text style={styles.alertText}>
              {running} contract{running === 1 ? '' : 's'} in the last year. Renew
              them or they walk in the summer for nothing.
            </Text>
          </View>
        ) : (
          <Text style={styles.lead}>
            Nobody is running a contract down. Everything is settled for now.
          </Text>
        )}

        <View style={styles.list}>
          {rows.map(({ p, slot }) => {
            const terms = renewalTerms(p);
            const urgent = p.contract.yrs <= 1;
            const tint = positionColor[p.pos];
            return (
              <View
                key={p.n}
                style={[
                  styles.row,
                  urgent ? { borderColor: 'rgba(245,165,36,0.45)' } : null,
                ]}
              >
                <Press
                  onPress={() => {
                    haptic('light');
                    setOpen({ p, slot });
                  }}
                  feel="none"
                  scaleTo={0.995}
                  style={styles.rowTop}
                >
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: tint + '26', borderColor: tint + '66' },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {p.n}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {p.age} {'·'} £{p.contract.wage}k a week {'·'} rated {p.rtg}
                    </Text>
                  </View>
                  <View style={styles.yrs}>
                    <Text
                      style={[
                        styles.yrsValue,
                        {
                          color:
                            p.contract.yrs === 0
                              ? color.danger
                              : p.contract.yrs === 1
                                ? color.warning
                                : color.text1,
                        },
                      ]}
                      allowFontScaling={false}
                    >
                      {p.contract.yrs}
                    </Text>
                    <Text style={styles.yrsLabel}>
                      {p.contract.yrs === 1 ? 'year' : 'years'}
                    </Text>
                  </View>
                </Press>

                {urgent ? (
                  <Press
                    onPress={() => renew(slot)}
                    feel="none"
                    scaleTo={0.98}
                    style={styles.renew}
                  >
                    <Text style={styles.renewText}>
                      Add {terms.add} year{terms.add === 1 ? '' : 's'} at £{terms.wage}k
                      {terms.fee ? ` · £${terms.fee}m fee` : ''}
                    </Text>
                  </Press>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      <PlayerSheet
        player={open?.p ?? null}
        open={open !== null}
        onClose={() => setOpen(null)}
        onSell={open ? () => doSell(open.slot) : undefined}
        sellBlock={open ? saleBlock(career, open.p) : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bill: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  billHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  billKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  billValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },
  billTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  billFill: { height: 6, borderRadius: 3 },
  billMark: {
    position: 'absolute',
    left: '75%',
    top: -2,
    bottom: -2,
    width: 1.5,
    backgroundColor: 'rgba(229,72,77,0.8)',
  },
  billNote: { ...text.small, fontSize: 11.5, lineHeight: 16 },

  lead: { ...text.body, color: color.text2, marginTop: space.s4 },
  alert: {
    marginTop: space.s4,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.4)',
    backgroundColor: 'rgba(245,165,36,0.08)',
  },
  alertText: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },

  list: { gap: space.s2, marginTop: space.s4 },
  row: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s3 },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  rowMeta: {
    fontFamily: font.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  yrs: { alignItems: 'center', minWidth: 34 },
  yrsValue: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    fontVariant: ['tabular-nums'],
  },
  yrsLabel: { ...text.key, fontSize: 7.5, color: color.text3 },

  renew: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(31,197,126,0.09)',
  },
  renewText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: color.accent,
  },
});
