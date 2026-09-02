import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Shine, OptionGroup } from '../../src/ui/components';
import { color, gradient, line, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  FORMATION_NAMES,
  FORMATIONS,
  MENTALITIES,
  STYLES,
  changeShape,
  effectiveRating,
  misfits,
  setPieceShare,
  strFromAvg,
  tacticDeltas,
  type StyleId,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/**
 * Tactics.
 *
 * Three controls in Simple, five more in Immersive, and the screen says
 * what each one is actually doing to the maths rather than leaving you to
 * guess. Attacking raises the goals at both ends, which is the whole
 * point, so the two numbers move together in front of you.
 */
export default function Tactics() {
  const career = useCareer();
  if (!career) return null;

  const t = career.tactic;
  const strength = strFromAvg(effectiveRating(career));
  const deltas = tacticDeltas(t, strength);
  const wrong = misfits(career);
  const immersive = career.mode === 'immersive';

  const set = (patch: Partial<typeof t>) => {
    haptic('select');
    updateCareer((d) => ({ ...d, tactic: { ...d.tactic, ...patch } }));
  };

  return (
    <ModeScreen overline={career.club} title="Tactics" onBack={() => router.back()}>
      {/* ---- what it adds up to ---- */}
      <View style={styles.readout}>
        <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
        <Text style={styles.readKey}>What this shape does</Text>
        <View style={styles.readRow}>
          <Read
            label="You score"
            value={deltas.att}
            good
          />
          <Read label="They score" value={deltas.oppAtt - deltas.def} good={false} />
        </View>
        <Text style={styles.readNote}>
          {t.mentality > 0
            ? 'Attacking raises the goals at both ends. It pays when your squad is better than theirs and costs you when it is not.'
            : t.mentality < 0
              ? 'Sitting back lowers the goals at both ends. It protects a weaker squad and wastes a stronger one.'
              : 'Balanced. Nothing added at either end.'}
        </Text>
        <View style={styles.famRow}>
          <Text style={styles.famKey}>Squad knows this shape</Text>
          <Text style={styles.famValue} allowFontScaling={false}>
            {Math.round(t.fam * 100)}%
          </Text>
        </View>
        <View style={styles.famTrack}>
          <View
            style={[
              styles.famFill,
              {
                width: `${Math.max(2, (t.fam - 0.8) * 500)}%`,
                backgroundColor: t.fam >= 0.99 ? hue.mint : hue.amber,
              },
            ]}
          />
        </View>
        {t.fam < 0.99 ? (
          <Text style={styles.readNote}>
            A new shape costs you until they learn it. It climbs a little
            every season you keep it.
          </Text>
        ) : null}
      </View>

      {/* ---- shape ---- */}
      <Text style={[text.label, styles.sect]}>Formation</Text>
      <OptionGroup
        label=""
        options={FORMATION_NAMES.map((n) => ({ value: n, label: n }))}
        value={t.form}
        onChange={(v) => {
          haptic('medium');
          updateCareer((d) => ({ ...d, tactic: changeShape(d.tactic, v) }));
        }}
      />
      <Text style={styles.hint}>{FORMATIONS[t.form]?.desc}</Text>
      {wrong.length ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            {wrong.length} player{wrong.length === 1 ? '' : 's'} out of position in
            this shape: {wrong.map((m) => `${m.name} at ${m.to.toLowerCase()}`).join(', ')}.
            Each of them plays below himself.
          </Text>
        </View>
      ) : null}

      {/* ---- mentality ---- */}
      <Text style={[text.label, styles.sect]}>Mentality</Text>
      <View style={styles.segs}>
        {MENTALITIES.map((m, i) => {
          const v = i - 2;
          const on = t.mentality === v;
          return (
            <Press
              key={m}
              onPress={() => set({ mentality: v })}
              feel="none"
              style={[styles.seg, on ? styles.segOn : null]}
              scaleTo={0.96}
            >
              <Text style={[styles.segText, on ? { color: hue.indigo } : null]}>{m}</Text>
            </Press>
          );
        })}
      </View>

      {/* ---- style ---- */}
      <Text style={[text.label, styles.sect]}>Style</Text>
      <View style={styles.styles}>
        {(Object.keys(STYLES) as StyleId[]).map((id) => {
          const s = STYLES[id];
          const on = t.style === id;
          const worth = tacticDeltas({ ...t, style: id }, strength);
          return (
            <Press
              key={id}
              onPress={() => set({ style: id })}
              feel="none"
              style={[styles.style, on ? styles.styleOn : null]}
              scaleTo={0.985}
            >
              <View style={styles.styleHead}>
                <Text style={[styles.styleTitle, on ? { color: hue.indigo } : null]}>
                  {s.title}
                </Text>
                <Text
                  style={[
                    styles.styleWorth,
                    {
                      color:
                        worth.att > deltas.att + 0.001
                          ? color.win
                          : worth.att < deltas.att - 0.001
                            ? color.loss
                            : color.text3,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {on ? 'current' : worth.att > deltas.att ? 'better here' : 'worse here'}
                </Text>
              </View>
              <Text style={styles.styleDesc}>{s.desc}</Text>
            </Press>
          );
        })}
      </View>

      {immersive ? (
        <>
          <Text style={[text.label, styles.sect]}>The finer controls</Text>
          <Slider
            label="Pressing"
            value={t.press}
            note="Wins the ball higher up. Tires the legs and leaves space behind."
            onChange={(v) => set({ press: v })}
          />
          <Slider
            label="Defensive line"
            value={t.line}
            note="A high line squeezes the pitch and gets caught by pace."
            onChange={(v) => set({ line: v })}
          />
          <Slider
            label="Tempo"
            value={t.tempo}
            note="Faster football is less predictable, either way."
            onChange={(v) => set({ tempo: v })}
          />
          <View style={styles.setpiece}>
            <Text style={styles.spKey}>Set pieces</Text>
            <Text style={styles.spValue} allowFontScaling={false}>
              {Math.round(setPieceShare(career) * 100)}%
            </Text>
            <Text style={styles.spNote}>
              of goals come from them, and your set-piece coach moves that.
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.simpleNote}>
          Pressing, the defensive line and tempo are handled for you on
          Simple. They are all in Immersive.
        </Text>
      )}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Read({ label, value, good }: { label: string; value: number; good: boolean }) {
  // Log space back into something a person can read: roughly a percentage.
  const pct = Math.round((Math.exp(value) - 1) * 100);
  const tint =
    pct === 0 ? color.text2 : good === pct > 0 ? color.win : color.loss;
  return (
    <View style={styles.read}>
      <Text style={[styles.readValue, { color: tint }]} allowFontScaling={false}>
        {pct > 0 ? '+' : ''}
        {pct}%
      </Text>
      <Text style={styles.readLabel}>{label}</Text>
    </View>
  );
}

function Slider({
  label,
  value,
  note,
  onChange,
}: {
  label: string;
  value: number;
  note: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderHead}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue} allowFontScaling={false}>
          {value > 0 ? '+' : ''}
          {value}
        </Text>
      </View>
      <View style={styles.segs}>
        {[-2, -1, 0, 1, 2].map((v) => (
          <Press
            key={v}
            onPress={() => onChange(v)}
            feel="none"
            style={[styles.seg, value === v ? styles.segOn : null]}
            scaleTo={0.96}
          >
            <Text style={[styles.segText, value === v ? { color: hue.indigo } : null]}>
              {v === -2 ? 'Low' : v === -1 ? '' : v === 0 ? 'Normal' : v === 1 ? '' : 'High'}
              {v === -1 || v === 1 ? (v > 0 ? '+' : '−') : ''}
            </Text>
          </Press>
        ))}
      </View>
      <Text style={styles.hint}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  readKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  readRow: { flexDirection: 'row' },
  read: { flex: 1, alignItems: 'center', gap: 1 },
  readValue: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  readLabel: { ...text.key, fontSize: 8.5, color: color.text3 },
  readNote: { ...text.small, fontSize: 11.5, lineHeight: 16 },

  famRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.s2,
  },
  famKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  famValue: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  famTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  famFill: { height: 4, borderRadius: 2 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  hint: { ...text.small, fontSize: 11.5, lineHeight: 16, marginTop: space.s2 },

  warn: {
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.4)',
    backgroundColor: 'rgba(245,165,36,0.08)',
  },
  warnText: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },

  segs: { flexDirection: 'row', gap: 5 },
  seg: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
  },
  segOn: { borderColor: alpha(hue.indigo, 0.45), backgroundColor: alpha(hue.indigo, 0.14) },
  segText: {
    fontFamily: font.displaySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: color.text3,
    textAlign: 'center',
  },

  styles: { gap: space.s2 },
  style: {
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: 3,
  },
  styleOn: { borderColor: alpha(hue.indigo, 0.45), backgroundColor: alpha(hue.indigo, 0.11) },
  styleHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  styleTitle: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
  },
  styleWorth: { ...text.key, fontSize: 8 },
  styleDesc: { ...text.small, fontSize: 11.5, lineHeight: 16 },

  sliderWrap: { marginBottom: space.s4 },
  sliderHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.s2,
  },
  sliderLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  sliderValue: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },

  setpiece: {
    alignItems: 'center',
    padding: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  spKey: { ...text.key, fontSize: 9, color: color.text3 },
  spValue: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 37,
    color: color.gold,
    fontVariant: ['tabular-nums'],
  },
  spNote: { ...text.small, fontSize: 11.5, textAlign: 'center' },

  simpleNote: { ...text.small, fontSize: 12, lineHeight: 18 },
});
