# Core Membership — implementation specification

- Feature IDs: F-001, F-002, F-003, F-004, F-008A, F-009, F-010
- Decision: Approved for implementation
- Delivery target: Web App

## Outcome

Users can spend 250 Polite Coins for seven days of Core identity and music-order benefits. Core must feel premium in account and chat surfaces while remaining readable in light/dark themes.

## Requirements

- REQ-001: An authenticated user can buy seven days of Core for 250 PC.
- REQ-002: A successful purchase grants 30 PC exactly once and cannot be replayed.
- REQ-003: An active Core user receives +5 rank score on up to three songs added in one session.
- REQ-004: The playlist identifies the +5 as a Core boost, separate from paid bids.
- REQ-005: Core users choose one of four Politetech identity presets: Blue, Red, Yellow, or Green.
- REQ-006: The selected preset decorates avatar and name in User Menu, playlist, and chat.
- REQ-007: Users can disable animation and choose subtle or vivid intensity.
- REQ-008: Reduced-motion system preferences suppress Core animation.
- REQ-009: Expired members keep their saved preset but receive no styling or boost.
- REQ-010: A launch popup appears on every Home visit for non-Core users, records the first impression in a seven-day campaign cycle, hides while Core is active, and returns after expiry.

## Acceptance criteria

- AC-001: Purchase fails without changing balance when balance is below 250 PC.
- AC-002: Repeating a purchase request key cannot charge or reward twice.
- AC-003: Purchase returns an expiry seven days after activation and a net balance change of -220 PC.
- AC-004: The first three Core songs in a session start with `coreBoost=5`, `bidScore=5`, and `rankScore=5`; later songs start at zero.
- AC-005: Chat history and realtime messages carry the author's current Core profile.
- AC-006: Core customization is previewable and persists through expiry/reactivation.
- AC-007: Non-Core and expired users retain the existing visual treatment.
- AC-008: Closing the launch popup suppresses only the current page visit; purchasing Core suppresses it until membership expiry.

## Non-goals

- No real-money payment, automatic renewal, extra votes, boosted skip contribution, or increased game payout.
- No arbitrary user-supplied CSS or colors.

## Traceability

| Feature | Requirements | Implementation | Verification |
| --- | --- | --- | --- |
| F-008A/F-009 | REQ-001–REQ-003 | Core API, user fields, coin ledger, song creation | API/service checks and client tests |
| F-010 | REQ-005–REQ-009 | Core identity components and CSS presets | component tests, lint, production build |
| F-011 | REQ-010 | Core launch popup and per-user campaign marker | component tests, lint, production build |
