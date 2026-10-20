# Grace Ledger

Elden Ring and Shadow of the Erdtree boss checklist for iPhone. 216 bosses in playthrough order, with locations, nearest grace, drops, tips, a death counter and notes. Works offline after the first visit.

## Put it on GitHub Pages

1. Create a new public repository on github.com, for example `grace-ledger`.
2. Click **Add file > Upload files** and drag in everything from this folder, keeping the `data` and `icons` folders.
3. Click **Commit changes**.
4. Open **Settings > Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**. Click **Save**.
5. Wait one or two minutes. Your app lives at `https://YOUR-USERNAME.github.io/grace-ledger/`.

## Install on iPhone

1. Open the link in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open Grace Ledger from the home screen. It runs full screen and works offline.

## Use it

- **Bosses**: tap the circle to mark a boss felled. Tap the name for details, deaths, notes and a **View on wiki** button with pictures and videos. Tap a region title to fold it.
- **Next**: the next boss in order. Set your rune level in Settings to skip areas above your level.
- **Stats**: totals, deaths, hardest bosses, kills per day, progress per region.
- **Settings**: playthroughs for NG+ or new characters, hide DLC, hide felled bosses, export and import a backup.

Progress saves on the phone only. Export a backup before you clear Safari data.

## Edit the boss list

All boss data sits in `data/bosses.js`. Each region and boss is a plain object, in playthrough order. Change text, fix a location or add a boss there.

After any change, open `sw.js` and bump `VERSION` (for example `grace-ledger-v2`). Without that, phones keep the old cached copy.

## Data notes

Boss names, locations and nearest graces come from community checklists. Drops are listed only where checked. Some DLC entries show the nearest area rather than an exact grace. Fan-made, not affiliated with FromSoftware or Bandai Namco.
