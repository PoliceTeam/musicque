# Third-party notices

## Xiangqi board and pieces

The assets in `client/public/xiangqi/gmchess-wood/` are the **gmchess style wood
piece set and board** from
[`Kadagaden/chess-pieces`](https://github.com/Kadagaden/chess-pieces), licensed
under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. A copy of
the license is included beside the assets as `LICENSE.txt`.

## Xiangqi rules library

The API uses [`lengyanyu258/xiangqi.js`](https://github.com/lengyanyu258/xiangqi.js)
at commit `f9019ac2303d4b80ef0b82fd0515bfb55a80a62b`, licensed under the
**BSD 2-Clause License**. The package and its license are installed through the
locked API dependency.

## Endgame positions

The initial MVP catalog was selected from `endgames_all.json` in
[`dffge552/xiangqi-pwa-offline`](https://github.com/dffge552/xiangqi-pwa-offline).
The imported records retain their source classification and first suggested
move; gameplay after that move is generated dynamically by the NPC engine.
The source project is licensed under the **MIT License**; its license is kept
at `api/data/xiangqi/LICENSE-source.txt`.
