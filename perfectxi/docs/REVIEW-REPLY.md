# The reply to Apple

Paste into the Resolution Center in App Store Connect, on submission
d956b10e-fd21-44e5-869d-b6bada87072c, once the new build is uploaded. Put the
real build number in. This is the wording from
`docs/perfect-xi/REVIEW-2026-09.md`, and it replaces the earlier reply that
promised a recording of the tracking prompt.

---

Hello, thank you for the review. We have resolved both issues in build
[NEW BUILD NUMBER]:

Guideline 2.5.4: Perfect XI has no feature that needs background audio.
We have removed "audio" from the UIBackgroundModes key. Sound effects play
only while the app is in use.

Guideline 2.1: Perfect XI does not track users. We have removed the
AppTrackingTransparency framework from the app and updated our app privacy
information to declare that no data is used for tracking.

Thank you.
