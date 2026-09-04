import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, swap } from '../../src/game/nav';
import { alpha, color, hue, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  clearSlot,
  slotSummaries,
  switchSlot,
  type SlotSummary,
} from '../../src/game/career';

/**
 * Three careers, and which one you are playing.
 *
 * A Dynasty is a long thing. Somebody twenty seasons into a club they
 * love should be able to try a season at Hull without throwing it away,
 * and before this there was one save and starting a second meant deleting
 * the first.
 *
 * Three, not unlimited. A list of nine half started careers is not a
 * feature, and three is enough for the club you are attached to, the one
 * you are experimenting with, and the one you have not decided about yet.
 */
export default function Slots() {
  const [slots, setSlots] = useState<SlotSummary[]>(() => slotSummaries());
  const [deleting, setDeleting] = useState<number | null>(null);

  useFocusEffect(useCallback(() => setSlots(slotSummaries()), []));

  const open = useCallback((slot: SlotSummary) => {
    haptic('medium');
    sfx('pick');
    switchSlot(slot.n);
    /* An empty slot is a career that has not been started rather than a
       career you cannot open, so it goes to the place that starts one. */
    swap(slot.career ? '/dynasty' : '/dynasty/start');
  }, []);

  const wipe = useCallback(() => {
    const n = deleting;
    setDeleting(null);
    if (n === null) return;
    haptic('warning');
    clearSlot(n);
    setSlots(slotSummaries());
  }, [deleting]);

  const target = deleting === null ? null : slots[deleting];

  return (
    <>
      <ModeScreen overline="A career, not a run" title="Your careers" onBack={() => back()}>
        <Text style={styles.lead}>
          Three careers, kept apart. The one with a ring round it is the one
          the Dynasty screens are showing.
        </Text>

        {slots.map((slot, i) => (
          <Rise key={slot.n} delay={Math.min(i, 4)}>
            <Slot
              slot={slot}
              onOpen={() => open(slot)}
              onDelete={() => {
                haptic('light');
                setDeleting(slot.n);
              }}
            />
          </Rise>
        ))}

        <Text style={styles.note}>
          Deleting one leaves the other two alone. There is no way to get a
          deleted career back, so if you want to keep it, Settings can write
          the whole lot to a file first.
        </Text>

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      <Confirm
        visible={deleting !== null}
        title={target?.career ? `Delete ${target.career.club}?` : 'Delete this career?'}
        body={
          target?.career
            ? `${target.seasons} season${target.seasons === 1 ? '' : 's'} in the dugout, gone for good. The other two are untouched.`
            : 'There is nothing in this slot.'
        }
        confirmLabel="Delete it"
        cancelLabel="Keep it"
        onCancel={() => setDeleting(null)}
        onConfirm={wipe}
      />
    </>
  );
}

/** One of the three. */
function Slot({
  slot,
  onOpen,
  onDelete,
}: {
  slot: SlotSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const has = slot.career !== null;
  const tint = slot.active ? hue.violet : has ? color.text2 : color.text3;

  return (
    <View style={[styles.card, slot.active ? styles.cardOn : null]}>
      {slot.active ? <Shine radius={radius.lg} group="feature" bevel={false} clip={false} /> : null}

      <Press onPress={onOpen} feel="none" scaleTo={0.99} style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.slotKey, { color: tint }]}>CAREER {slot.n + 1}</Text>
          {slot.active ? <Text style={styles.now}>PLAYING</Text> : null}
        </View>

        {has && slot.career ? (
          <>
            <Text style={styles.club} numberOfLines={1}>
              {slot.career.club}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              Season {slot.career.season} {'·'} rated {slot.career.rating} {'·'}{' '}
              {slot.career.titles === 1 ? '1 title' : `${slot.career.titles} titles`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.empty}>Empty</Text>
            <Text style={styles.meta}>Take a club and start a career here</Text>
          </>
        )}

        <View style={[styles.go, has ? null : styles.goNew]}>
          <Text style={[styles.goText, has ? null : styles.goTextNew]}>
            {slot.active ? 'Carry on' : has ? 'Play this one' : 'Start a career'}
          </Text>
        </View>
      </Press>

      {has ? (
        <Press
          onPress={onDelete}
          feel="none"
          scaleTo={0.92}
          style={styles.bin}
          accessibilityLabel={`Delete career ${slot.n + 1}`}
        >
          <Text style={styles.binText}>Delete</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginBottom: space.s3,
  },
  card: {
    marginBottom: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  cardOn: {
    borderColor: alpha(hue.violet, 0.5),
    backgroundColor: alpha(hue.violet, 0.09),
  },
  body: { padding: space.s3, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotKey: { ...text.key, fontSize: 8 },
  now: { ...text.key, fontSize: 7.5, color: hue.violet },
  club: { fontFamily: font.displayBlack, fontSize: 22, lineHeight: 29, color: color.text1 },
  empty: { fontFamily: font.displayBold, fontSize: 20, lineHeight: 27, color: color.text3 },
  meta: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text3 },

  go: {
    marginTop: space.s3,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.violet, 0.45),
    backgroundColor: alpha(hue.violet, 0.13),
  },
  goNew: {
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  goText: { ...text.button, fontSize: 14, color: hue.violet },
  goTextNew: { color: color.text3 },

  bin: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  binText: { ...text.key, fontSize: 8, color: alpha(hue.crimson, 0.85) },

  note: {
    ...text.small,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.text3,
    marginTop: space.s3,
  },
});
