# Dreamback — Playtest Checklist (Phase 8)

Run with `http://localhost:8000/?playtest=1` (Cozy preset default). Target completion time: **8–12 minutes**.

## Silent Observation Rules
1. Do not explain controls beyond what is shown on screen.
2. Note where the tester hesitates for > 15 seconds.
3. Watch whether they notice the Giant's breathing terrain, fog, and breath ring within 30 seconds.
4. Note any unexpected falls, climb snags, or vine timing frustration.

## 6 Post-Play Questions
1. When did you first realize the world itself was breathing?
2. Which zone felt coziest or most memorable, and why?
3. Did you ever feel lost about where to go next?
4. How did the Forest vine swings and Caverns mushroom puzzle feel?
5. Did Restlessness feel like gentle pressure or stressful?
6. What moment made you smile?

## Export Telemetry
Open DevTools Console and run:
```js
copy(window.dumpPlaytest())
```
Paste the JSON into your notes with tester name and difficulty preset.
