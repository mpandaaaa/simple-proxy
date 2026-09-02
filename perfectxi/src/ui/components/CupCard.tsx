import { View, Text, StyleSheet } from 'react-native';
import { color, line, radius, space } from '../tokens';
import { font, text } from '../type';
import { ClubDisc } from './ClubDisc';
import { Shine } from './Shine';
import type { CupRun } from '../../engine';

/**
 * A cup run, as a road rather than a list.
 *
 * A cup is not a table, it is a path with an end: you go out somewhere, or
 * you do not go out at all. The stage line across the top says how far the
 * run got before anything is read, and the ties underneath say who stopped
 * it.
 */
export function CupCard({
  run,
  mark,
  tint,
}: {
  run: CupRun;
  mark: string;
  /** the competition's own colour, gold for the domestic cup, blue for Europe */
  tint: string;
}) {
  const status = !run.qualified
    ? { label: 'Did not qualify', tone: color.text3 }
    : run.won
      ? { label: 'Winners', tone: tint }
      : { label: `Out: ${run.elim}`, tone: color.danger };

  return (
    <View style={[styles.card, run.won ? { borderColor: tint + '80' } : null]}>
      <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />

      <View style={styles.head}>
        <Text style={styles.mark} allowFontScaling={false}>
          {mark}
        </Text>
        <Text style={styles.name}>{run.name}</Text>
        <View
          style={[
            styles.pill,
            { borderColor: status.tone + '59', backgroundColor: status.tone + '1A' },
          ]}
        >
          <Text style={[styles.pillText, { color: status.tone }]}>{status.label}</Text>
        </View>
      </View>

      {run.qualified ? (
        <>
          {/* how far the run got, before a single score is read */}
          <View style={styles.path}>
            {run.stages.map((stage, i) => {
              const done = i < run.reached;
              const out = !run.won && i === run.reached;
              return (
                <View key={stage} style={styles.node}>
                  {i > 0 ? (
                    <View
                      style={[
                        styles.link,
                        { backgroundColor: done ? tint : 'rgba(255,255,255,0.10)' },
                      ]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.dot,
                      done
                        ? { backgroundColor: tint, borderColor: tint }
                        : out
                          ? {
                              backgroundColor: color.danger + '2E',
                              borderColor: color.danger,
                            }
                          : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dotText,
                        done
                          ? { color: '#0B0F0A' }
                          : out
                            ? { color: color.danger }
                            : null,
                      ]}
                      allowFontScaling={false}
                    >
                      {short(stage)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.ties}>
            {run.ties.map((tie) => (
              <View key={tie.round} style={styles.tie}>
                {tie.opp ? (
                  <ClubDisc club={tie.opp} size={26} />
                ) : (
                  <View style={styles.groupDisc}>
                    <Text style={styles.groupDiscText} allowFontScaling={false}>
                      LP
                    </Text>
                  </View>
                )}
                <View style={styles.tieBody}>
                  <Text style={styles.tieRound}>{tie.round}</Text>
                  <Text style={styles.tieOpp} numberOfLines={1}>
                    {tie.opp ?? 'Eight games against the seeded pots'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tieScore,
                    { color: tie.won ? color.win : color.loss },
                  ]}
                  allowFontScaling={false}
                >
                  {tie.detail ?? `${tie.gf}–${tie.ga}`}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.none}>
          Only the top four qualify. Finish higher and this is the competition
          the season is really about.
        </Text>
      )}
    </View>
  );
}

/** Two or three letters, because six stage names will not fit across a phone. */
function short(stage: string): string {
  switch (stage) {
    case 'League Phase':
      return 'LP';
    case 'Playoff':
      return 'PO';
    case 'Last 16':
      return 'R16';
    case 'Quarter-Final':
      return 'QF';
    case 'Semi-Final':
      return 'SF';
    case 'Final':
      return 'F';
    case 'Round 3':
      return 'R3';
    case 'Round 4':
      return 'R4';
    case 'Round 5':
      return 'R5';
    default:
      return stage.slice(0, 2).toUpperCase();
  }
}

const styles = StyleSheet.create({
  card: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: 'linear-gradient(180deg, #16241C 0%, #0C130F 100%)',
    boxShadow: '0px 8px 22px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    gap: space.s3,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  mark: { fontSize: 19, lineHeight: 24 },
  name: {
    flex: 1,
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
  },
  pill: {
    paddingHorizontal: space.s3,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: { ...text.key, fontSize: 9 },

  path: { flexDirection: 'row', alignItems: 'center' },
  node: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  link: { flex: 1, height: 2, borderRadius: 1 },
  dot: {
    width: 30,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: font.displayBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.4,
    color: color.text3,
  },

  ties: { gap: 2 },
  tie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  groupDisc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  groupDiscText: {
    fontFamily: font.displayBold,
    fontSize: 9,
    lineHeight: 12,
    color: color.text3,
  },
  tieBody: { flex: 1, minWidth: 0 },
  tieRound: { ...text.key, fontSize: 8.5, color: color.text3 },
  tieOpp: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  tieScore: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },

  none: { ...text.small, lineHeight: 20 },
});
