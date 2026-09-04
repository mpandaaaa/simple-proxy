import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { go } from '../src/game/nav';
import {
  commas,
  AlbumCard,
  Screen,
  ModeCard,
  Collapse,
  Row,
  Rise,
  Press,
  AchievementPanel,
} from '../src/ui/components';
import {
  IconTrophy,
  IconCalendar,
  IconSpark,
  IconSwords,
  IconKeypad,
  IconBank,
  IconCpu,
  IconStar,
  IconMedal,
  IconYou,
} from '../src/ui/icons';
import { color, space, radius, gradient, shadow, line } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import {
  progressStore,
  dynastySummary,
  historyStore,
  careerStore,
  ranked,
  dailyStore,
  weeklyStore,
  duelStore,
  collectionStore,
  worldCupStore,
} from '../src/save';
import {
  STAGE_NAME,
  wcTeam,
  bestOwned,
  bestThisWeek,
  levelProgress,
  totals,
  dailyNumber,
  liveStreak,
  ordinal,
  playedToday,
  resultFor,
  thisWeek,
  weekNumber,
  today as todaysPuzzle,
} from '../src/engine';
import { haptic } from '../src/ui/feel';
import { ACHIEVEMENTS, type Career } from '../src/game/achievements';
import { getCareer, reloadCareer } from '../src/game/career';
import type { Progress, DynastySummary } from '../src/save';

/**
 * Home is the only hub. Every mode is reachable from here and every mode
 * returns here. No tab bar, no drawer.
 *
 * Three modes carry the screen: the draft, the World Cup and Dynasty.
 * Everything else is real and one tap away, but it sits inside a disclosure
 * so the screen opens short instead of opening as a wall.
 *
 * Copy comes from the live site rather than being written fresh, so the app
 * and the website say the same things about the same modes.
 */
/**
 * What the two record rows say, read off what has actually been played.
 *
 * A row that promises "your greatest seasons" and leads to an empty page
 * is worse than one that admits there is nothing there yet.
 */
function readRecord(): { hall: string; cabinet: string } {
  const runs = historyStore.read().runs;
  const career = careerStore.read();
  const got = career.earned.length;

  const hall = runs.length
    ? `${runs.length} season${runs.length === 1 ? '' : 's'} kept · best ${ranked(runs)[0].pts} points`
    : 'Your greatest seasons, ranked';

  const cabinet = got
    ? `${got} of ${ACHIEVEMENTS.length} earned${career.titles ? ` · ${career.titles} title${career.titles === 1 ? '' : 's'}` : ''}`
    : 'Every achievement you have earned';

  return { hall, cabinet };
}

/** What the Daily row on the front door has to say. */
function readDaily() {
  const n = dailyNumber();
  const puzzle = todaysPuzzle();
  const rec = dailyStore.read();
  const mine = resultFor(rec, n);
  return {
    n,
    twist: puzzle.twist,
    done: playedToday(rec, n),
    position: mine?.position ?? 0,
    pts: mine?.pts ?? 0,
    streak: liveStreak(rec, n),
  };
}

/** What the Weekly and the duel rows have to say. */
function readWeek() {
  const n = weekNumber();
  return { week: thisWeek(), best: bestThisWeek(weeklyStore.read(), n) };
}

function readWorldCup() {
  const run = worldCupStore.read();
  if (!run) return null;
  const team = wcTeam(run.you);
  return {
    name: team?.n ?? '',
    flag: team?.f ?? '',
    over: run.over,
    where: run.over
      ? run.won
        ? 'champions of the world'
        : `out at the ${STAGE_NAME[run.outAt ?? 'group'].toLowerCase()}`
      : `${STAGE_NAME[run.stage].toLowerCase()}, ${run.played.length} played`,
  };
}

function readAlbum() {
  const coll = collectionStore.read();
  return {
    owned: coll.cards.length,
    total: totals().all,
    best: bestOwned(new Set(coll.cards), 4),
    owed: coll.owed.length,
  };
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>(() => progressStore.read());
  const [dynasty, setDynasty] = useState<DynastySummary | null>(() =>
    dynastySummary(getCareer()),
  );
  const [record, setRecord] = useState(() => readRecord());
  const [career, setCareer] = useState<Career>(() => careerStore.read());
  /* Today's puzzle, so the row on the front door says what today is and
     whether it has been played rather than the same sentence forever. */
  const [daily, setDaily] = useState(() => readDaily());
  /* This week's rule and how you have done at it, and the duel record, so
     the two rows underneath the Daily say something true as well. */
  const [weekly, setWeekly] = useState(() => readWeek());
  const [duels, setDuels] = useState(() => duelStore.read());
  /* The level, and how much of the collection is in. Read here rather
     than worked out in the row, so the front door says something true
     about both without either of them owning the sums. */
  /* The album, as the front door needs it: how far along it is, the four
     best footballers in it, and whether a pack is waiting. */
  const [album, setAlbum] = useState(() => readAlbum());
  /* The World Cup on the go, if there is one, so the card says where you
     are in it rather than what the mode is. */
  const [worldCup, setWorldCup] = useState(() => readWorldCup());

  // Saves change while you are inside a mode, so the status lines are read
  // again every time Home comes back to the front rather than once on mount.
  useFocusEffect(
    useCallback(() => {
      setProgress(progressStore.read());
      reloadCareer();
      setDynasty(dynastySummary(getCareer()));
      setRecord(readRecord());
      setCareer(careerStore.read());
      setDaily(readDaily());
      setWeekly(readWeek());
      setDuels(duelStore.read());
      setAlbum(readAlbum());
      setWorldCup(readWorldCup());
    }, []),
  );

  const lvl = levelProgress(progress.xp);

  return (
    <Screen>
      <Rise delay={0}>
        <View style={styles.brand}>
          <View style={styles.brandTop}>
            <Text style={styles.wordmark}>
              PERFECT <Text style={styles.wordmarkXI}>XI</Text>
            </Text>
            <View style={styles.seasonChip}>
              <Text style={styles.seasonChipText}>Season 26/27</Text>
            </View>
          </View>
          <Text style={styles.tagline}>
            Unofficial fan draft game · free to play
          </Text>
        </View>
      </Rise>

      <Rise delay={1}>
        <ModeCard
          tone="accent"
          big
          kicker="All-Time Premier League"
          title="START A DRAFT"
          subtitle="Spin real club-seasons · build your XI · simulate 38 games"
          onPress={() => go('/draft')}
        />
      </Rise>

      <Rise delay={2}>
        <ModeCard
          tone="gold"
          kicker="Tournament"
          title="World Cup 2026"
          subtitle={
            worldCup
              ? `${worldCup.flag} ${worldCup.name} · ${worldCup.where}`
              : '48 nations · one match at a time · win the cup'
          }
          icon={IconTrophy}
          onPress={() => {
            haptic('light');
            go(worldCup && !worldCup.over ? '/worldcup/hub' : '/worldcup');
          }}
        />
      </Rise>

      <Rise delay={3}>
        <ModeCard
          tone="purple"
          kicker="Career"
          title="Dynasty"
          subtitle="A career across seasons · ages, transfers, the board"
          status={dynastyStatus(dynasty)}
          icon={IconBank}
          onPress={() => go(dynasty ? '/dynasty' : '/dynasty/start')}
        />
      </Rise>

      <Rise delay={4}>
        <AlbumCard
          owned={album.owned}
          total={album.total}
          best={album.best}
          coins={progress.coins}
          packsWaiting={album.owed}
          onAlbum={() => go('/collection')}
          onPacks={() => go('/shop')}
        />
      </Rise>

      <Rise delay={5}>
        <View style={styles.achievements}>
          <AchievementPanel career={career} />
        </View>
      </Rise>

      <Rise delay={4} style={styles.groups}>
        <Collapse
          label="Play today"
          count={4}
          tone="blue"
          hint={`${daily.done ? 'Daily played' : `Daily #${daily.n}`} · ${
            weekly.week.twist.name
          }${duels.played ? ` · ${duels.won} duels won` : ''}`}
        >
          <Row
            icon={IconCalendar}
            tone="blue"
            tag="Daily"
            title={`Daily #${daily.n}`}
            subtitle={
              daily.done
                ? `Played · ${ordinal(daily.position)} on ${daily.pts} points`
                : `${daily.twist} · one attempt`
            }
            onPress={() => {
              haptic('light');
              go('/daily');
            }}
          />
          <Row
            icon={IconSpark}
            tone="gold"
            tag="Event"
            title={weekly.week.twist.name}
            subtitle={
              weekly.best
                ? `Your best ${weekly.best.pts} points · ${weekly.best.attempts} ${weekly.best.attempts === 1 ? 'go' : 'goes'}`
                : `${weekly.week.twist.rule} · as many goes as you like`
            }
            onPress={() => {
              haptic('light');
              go('/weekly');
            }}
          />
          <Row
            icon={IconSwords}
            tone="danger"
            tag="Duel"
            title="Start a duel"
            subtitle={
              duels.played
                ? `${duels.won} won · ${duels.drew} drawn · ${duels.lost} lost`
                : 'Live · the same spins at the same time'
            }
            onPress={() => {
              haptic('light');
              go('/duel');
            }}
          />
          <Row
            icon={IconKeypad}
            tone="neutral"
            tag="Code"
            title="Enter a code"
            subtitle="Same spins · beat their points"
            onPress={() => {
              haptic('light');
              go('/duel?mode=enter');
            }}
          />
        </Collapse>

        <Collapse
          label="Your game"
          count={1}
          tone="purple"
          hint={`Level ${lvl.level} · ${commas(progress.coins)} coins · ${
            progress.seasons
          } seasons`}
        >
          <Row
            icon={IconStar}
            tone="purple"
            title={`Progress · Level ${lvl.level}`}
            subtitle={
              lvl.maxed
                ? `${commas(progress.coins)} coins · level fifty`
                : `${commas(progress.coins)} coins · ${commas(lvl.toNext)} to level ${
                    lvl.level + 1
                  }`
            }
            onPress={() => {
              haptic('light');
              go('/progress');
            }}
          />
        </Collapse>

        <Collapse
          label="Records"
          count={3}
          tone="gold"
          hint={`${record.cabinet} · ${record.hall}`}
        >
          <Row
            icon={IconTrophy}
            tone="gold"
            title="Trophy cabinet"
            subtitle={record.cabinet}
            onPress={() => go('/cabinet')}
          />
          <Row
            icon={IconMedal}
            tone="accent"
            title="Hall of Fame"
            subtitle={record.hall}
            onPress={() => go('/hall')}
          />
          <Row
            icon={IconYou}
            tone="blue"
            title="Player index"
            subtitle="Search every footballer in the database"
            onPress={() => {
              haptic('light');
              go('/players');
            }}
          />
        </Collapse>
      </Rise>

      <Rise delay={5}>
        <Text style={styles.dbLine}>
          51 clubs · 712 squad-seasons · 1992 to 2026
        </Text>

        <View style={styles.footer}>
          <Press
            onPress={() => {
              haptic('light');
              go('/privacy');
            }}
            feel="select"
            scaleTo={0.94}
            style={styles.footerChip}
          >
            <Text style={styles.footerText}>Privacy</Text>
          </Press>
        </View>

        <Text style={styles.legal}>
          Perfect XI is an unofficial fan game. Not affiliated with the Premier
          League, any football club, or any player.
        </Text>
      </Rise>
    </Screen>
  );
}

const FOOTER = [
  {
    label: 'Guides',
    blurb:
      'How to play, the match engine, squad chemistry, formations and the ratings database, written from the game’s own numbers.',
  },
  { label: 'Changelog', blurb: 'What changed in each update.' },
  {
    label: 'Privacy',
    blurb:
      'Perfect XI needs no account and stores your saves on this device rather than on a server.',
  },
  { label: 'Contact', blurb: 'Feedback, bug reports, or an argument about a rating.' },
];

/**
 * One honest screen for anything not built yet, rather than a dead tap or a
 * badge on the home screen. Each entry carries its own real description from
 * the live site, so the screen says something true about the mode.
 */
function soon(overline: string, title: string, blurb: string) {
  go({ pathname: '/soon', params: { overline, title, blurb } });
}

/** No career yet is a real state, so the card keeps its description. */
function dynastyStatus(d: DynastySummary | null): string | null {
  if (!d) return null;
  const titles = d.titles === 1 ? '1 title' : `${d.titles} titles`;
  return `${d.club} · season ${d.season} · rated ${d.rating} · ${titles}`;
}

const styles = StyleSheet.create({
  brand: { marginBottom: space.s5 },
  brandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  wordmark: {
    fontFamily: font.displayBlack,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: 1.3,
    color: color.text1,
  },
  wordmarkXI: { color: color.accent },
  seasonChip: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1 + 2,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  seasonChipText: {
    fontFamily: font.displayBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#06130C',
  },
  tagline: {
    ...text.key,
    fontSize: 10.5,
    color: color.text3,
    marginTop: space.s2,
  },

  achievements: { marginTop: space.s4 },
  groups: { marginTop: space.s4 },

  dbLine: {
    ...text.key,
    fontSize: 10.5,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s6,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.s2,
    marginTop: space.s4,
  },
  footerChip: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2 + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
  },
  footerText: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    color: color.text2,
  },
  legal: {
    ...text.small,
    fontSize: 11,
    lineHeight: 16,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s5,
  },
});
