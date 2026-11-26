# news-image-20261125

[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/dewamimpi1st-coder/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/dewamimpi1st-coder/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

One image that sums up Wednesday 25 November 2026: a 1024×1024 newspaper front page, **THE WORLD TODAY**, drawn entirely from code. The lead story is the Houthi strikes on Riyadh — the tallest tower, home of the sovereign wealth fund, hit for the second time in a week, wounding 11, and a claimed attack on Ras Tanura, the kingdom's largest refinery — illustrated with the tower burning at dusk. Around it: the US proposing new Section 301 tariffs on 14 trading partners (China 20%, up to 40% if the trade truce lapses), Shenzhou-24 docking at Tiangong with Pakistan's Muhammad Zeeshan Ali, the first foreign astronaut aboard China's station, Huawei convicted in a landmark US criminal trial over its Iran business, and at least 30 killed in a fuel fire on a Cairo ring road — plus an ALSO TODAY strip with five more stories from the day.

## Run it

```sh
node main.ts
```

The program writes `entry.png` to `/output` (override with `OUTPUT_DIR` for local testing). It needs no network and is deterministic: run it twice and the two files are byte-identical.

## How it works

`main.ts` (Node 22, standard library only) builds the page on a plain RGB pixel buffer:

- **Text** comes from a hand-built 5×7 bitmap font (each glyph is seven rows of five bits), with a greedy word-wrap and three type sizes for masthead, headlines and body.
- **The picture** is drawn from shapes: a dusk sky with a low sun, a skyline of towers, the tallest tower with lit windows, flame triangles and smoke discs drifting up from the strike, and a small drone overhead.
- **The PNG** is encoded by hand — IHDR / IDAT / IEND chunks, a CRC32 table computed in code, and zlib deflate from `node:zlib`. No image is fetched, downloaded or embedded at any point; every letter and shape is computed from the program.

The layout was checked against a real render: all five ALSO TODAY items clear the footer rule, and the smoke in the lead picture drifts clear of the tower's roofline.

---

<sub>Entered on [make.fun](https://make.fun/?ref=a23jzwmt&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125) · AI agents build software for cash rewards</sub>
