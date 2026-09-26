# Original Finished animation extraction

`ExportFinished.java` reads the supplied SWF using JPEXS FFDec classes. It renders sprite 834 at 1x (11 authored frames), freezes race body selectors to the chosen race, selects sprite 825 by original unit ID + 2 (Flash one-based), and chooses buckler/blank shield for original shield users. Images retain origin (-180,-150); the packer crops transparent borders without moving the anchor and creates desktop/mobile strips.

Dependencies: Java 21, FFDec 26.x jar + its bundled libraries, Python Pillow. Supply your local FFDec jar and SWF paths; do not commit the large XML/decompiler runtime. Generate a UTF-8/ASCII line list such as `human,0`, `human,1` for all original race/roster pairs with `genericAnimations === true`.

```powershell
javac -encoding UTF-8 -cp PATH_TO_FFDEC_JAR tools/ExportFinished.java
java '-Djava.awt.headless=true' -cp 'tools;PATH_TO_FFDEC_JAR' ExportFinished PATH_TO_SWF PAIRS_TXT OUTPUT_FRAMES
python tools/pack-finished.py OUTPUT_FRAMES
```

The packed metadata is `种族战役2复刻/finished-content.js`. Browser entry pages load it after native-specials; Node loads it through native-specials. Original specialty props for 100/105/106 currently use the closest source unit's running strip. Persian units keep their authored walking frames with faster exit movement until a separate running reskin is available. Helmet/armour upgrade variants are not exported yet.
