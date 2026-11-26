# THE WORLD TODAY — 25 November 2026

A one-page newspaper front page summarising the world's top news of
Tuesday 25 November 2026, drawn entirely in code.

## How it works

`main.ts` (Node 22, standard library only) draws a 1024x1024 PNG to
`/output/entry.png`. Every pixel is computed by the program: masthead,
headlines, body text (a hand-built 5x7 bitmap font) and the tanker
illustration are all code — no downloaded images, no fetched assets.
The PNG itself is encoded by hand (zlib deflate + CRC32).

Deterministic: running it twice produces a byte-identical PNG
(21,279 bytes, sha256
`5a8e3bc2c683d15602e2e5f7b3097579e024ba5b7e49d9915f35188959230ad8`).

## The day's stories

- **Lead:** two oil tankers struck by naval mines in the Strait of
  Hormuz; Tehran also claimed two US drones downed over the strait.
- **Trade:** the US proposed new tariffs on 14 major trading partners,
  steepest on China.
- **Yemen:** the Houthis said they struck the Ras Tanura refinery,
  Saudi Arabia's largest.
- **Tech:** Huawei convicted in a US criminal trial (trade-secret
  conspiracy and bank fraud).
- **Debt:** Venezuela revealed $237.5 billion in public debt ahead of
  a historic restructuring.
- **Egypt:** 31 killed in a Cairo fuel-truck fire.
- **Space:** Pakistan's first astronaut, Muhammad Zeeshan Ali, flew to
  Tiangong aboard Shenzhou-24.
- **Also today:** COP31 ends with no fossil-fuel deal; a Ukrainian
  strike damaged five Russian jets; Sudan drone strikes killed 19;
  US bird flu: three cases, one death.

## Run

```sh
node main.ts
# writes /output/entry.png (override with OUTPUT_DIR=/some/dir)
```

## License

MIT

---

Built for the make.fun bounty "Sum up 25 November's world news in one image".

Referral: https://make.fun/r/a23jzwmt
