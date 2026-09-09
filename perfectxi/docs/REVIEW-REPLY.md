# The reply to Apple

Paste into the Resolution Center in App Store Connect, on submission
d956b10e-fd21-44e5-869d-b6bada87072c, once the new build is uploaded.
Attach the screen recording to the same reply.

---

Hello,

Thank you for the detail, both issues are fixed in the new build.

Guideline 2.5.4, background audio. The audio background mode was declared
by a dependency's default configuration rather than by any feature of the
app. Perfect XI plays short sound cues during gameplay only and has no
background audio feature, so the capability was never needed. The audio
setting has been removed from the UIBackgroundModes key entirely, and the
key is no longer present in the Info.plist.

Guideline 2.1, App Tracking Transparency. The permission request was
being made too early in the launch sequence, while the splash screen was
still presented, so the system did not display it. The request is now
made after the app is fully active and visible, and it appears before any
data that could be used for tracking is collected. A screen recording is
attached showing a launch with tracking permissions reset, the permission
request appearing, and the app continuing afterwards. The same recording
has been added to the Notes field in App Review Information.

Thank you,
Mo

---

## The recording

Four things have to be visible, in this order:

1. Tracking reset first. Settings, Privacy and Security, Tracking, turn
   "Allow Apps to Request to Track" off and back on. Or delete the app
   and install it again from TestFlight.
2. The app launching from the home screen.
3. The tracking sheet appearing on its own.
4. Tapping either button, and the game working afterwards.

Record it with the iPad's own screen recorder, keep it under a minute,
and attach it to the reply. Then paste the same file, or a link to it,
into App Review Information so future submissions have it.
