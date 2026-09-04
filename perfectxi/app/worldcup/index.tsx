import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, go, swap } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import { STAGE_NAME, wcExpected, wcNations, wcSquad } from '../../src/engine';
import { getWorldCup, startWorldCup, useWorldCup } from '../../src/game/worldcup';

/**
 * Picking a nation.
 *
 * Forty eight of them, and the only two things that matter about one
 * before you take it are how good it is and how far a nation that good
 * is meant to get. Both are on every row, because "Spain, 86" means
 * nothing on its own and "expected to reach the last four" is the whole
 * bet you are making.
 *
 * Sorted by rating, because that is the order somebody is actually
 * choosing along, with a search for the person who came here to take
 * Haiti.
 */
export default function WorldCupPick() {
  const run = useWorldCup();
  const [q, setQ] = useState('');
  const [taking, setTaking] = useState<string | null>(null);

  useFocusEffect(useCallback(() => setQ(''), []));

  const nations = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = wcNations();
    return term ? all.filter((n) => n.name.toLowerCase().includes(term)) : all;
  }, [q]);

  const begin = useCallback((code: string) => {
    haptic('success');
    sfx('pick');
    startWorldCup(code);
    swap('/worldcup/hub');
  }, []);

  return (
    <>
      <ModeScreen
        overline="Tournament"
        title="World Cup 2026"
        scroll={false}
        onBack={() => back()}
      >
        {run && !run.over ? (
          <Rise delay={0}>
            <Press
              onPress={() => {
                haptic('light');
                go('/worldcup/hub');
              }}
              feel="none"
              scaleTo={0.98}
              style={styles.resume}
            >
              <Shine radius={radius.lg} group="panel" />
              <Text style={styles.resumeKey}>Carry on</Text>
              <Text style={styles.resumeName}>
                {wcNations().find((n) => n.code === run.you)?.flag}{' '}
                {wcNations().find((n) => n.code === run.you)?.name}
              </Text>
              <Text style={styles.resumeNote}>
                {STAGE_NAME[run.stage]} {'·'} {run.played.length} played
              </Text>
            </Press>
          </Rise>
        ) : null}

        <Text style={styles.lead}>
          Take a nation through the whole thing. Twelve groups of four, the top
          two and the eight best thirds go through, and from there it is one
          match at a time until somebody knocks you out.
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search a nation"
          placeholderTextColor={color.text3}
          autoCorrect={false}
          style={styles.search}
        />

        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          {nations.map((n, i) => {
            const squad = wcSquad(n.code);
            const expect = wcExpected(n.rating);
            return (
              <Rise key={n.code} delay={Math.min(i, 8)}>
                <Press
                  onPress={() => {
                    haptic('light');
                    if (getWorldCup() && !getWorldCup()?.over) setTaking(n.code);
                    else begin(n.code);
                  }}
                  feel="none"
                  scaleTo={0.99}
                  style={styles.row}
                >
                  <Text style={styles.flag} allowFontScaling={false}>
                    {n.flag}
                  </Text>
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>
                      {n.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      Group {n.group} {'·'} {n.conf} {'·'} {squad.length} players
                    </Text>
                    <Text style={[styles.expect, { color: tintFor(n.rating) }]} numberOfLines={1}>
                      Expected: {STAGE_NAME[expect]}
                    </Text>
                  </View>
                  <View style={[styles.rating, { borderColor: alpha(tintFor(n.rating), 0.5) }]}>
                    <Text
                      style={[styles.ratingText, { color: tintFor(n.rating) }]}
                      allowFontScaling={false}
                    >
                      {n.rating}
                    </Text>
                  </View>
                </Press>
              </Rise>
            );
          })}
          {nations.length === 0 ? (
            <Text style={styles.none}>No nation by that name.</Text>
          ) : null}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      <Confirm
        visible={taking !== null}
        title="Start again?"
        body="You have a World Cup on the go. Taking another nation throws it away."
        confirmLabel="Start again"
        cancelLabel="Keep it"
        onCancel={() => setTaking(null)}
        onConfirm={() => {
          const code = taking;
          setTaking(null);
          if (code) begin(code);
        }}
      />
    </>
  );
}

/** Good, decent or hopeful, in a colour. */
function tintFor(rating: number): string {
  return rating >= 84 ? hue.gold : rating >= 78 ? hue.emerald : rating >= 72 ? hue.sky : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  lead: { ...text.small, fontSize: 13, lineHeight: 19, color: color.text3, marginBottom: space.s3 },

  resume: {
    padding: space.s4,
    marginBottom: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.45),
    backgroundColor: alpha(hue.gold, 0.1),
    overflow: 'hidden',
    gap: 2,
  },
  resumeKey: { ...text.key, fontSize: 9, color: hue.gold },
  resumeName: { fontFamily: font.displayBlack, fontSize: 22, lineHeight: 29, color: color.text1 },
  resumeNote: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },

  search: {
    minHeight: 50,
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 74,
    marginBottom: 6,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  flag: { fontSize: 30, lineHeight: 38 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  meta: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  expect: { ...text.key, fontSize: 7.5 },
  rating: {
    minWidth: 46,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  ratingText: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  none: { ...text.small, fontSize: 13, color: color.text3, paddingTop: space.s4 },
});
