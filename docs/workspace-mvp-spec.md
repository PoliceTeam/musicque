# Workspace MVP

- Feature: F-001–F-005 — Workspace 2.5D
- Decision: Approved for implementation
- Delivery target: Web App
- Milestone: MVP validation

## Context

Musicque currently exposes music, games and news as separate UI areas. The workspace
adds a protected, playful entry point where teammates can move through a shared pixel
world, see one another and approach a zone to open the existing feature.

## Goals and non-goals

Goals: provide a separate `/workspace` route, keyboard movement, three discoverable
zones, transient realtime presence and chat bubbles. Existing feature logic remains in
React components.

Non-goals: meetings, audio/video, proximity voice, persistent world position, avatar
customization, a map editor, mobile-first controls, or replacing Home.

## User flows

1. An authenticated user opens `/workspace`, joins the shared room and spawns in the plaza.
2. The user moves with arrow keys, approaches a zone and presses Enter/E to interact.
3. Music opens ordering and the queue; News opens the existing reader; Game exposes the
   available lightweight games and the Xiangqi route.
4. A user sends a short message; it appears above their avatar for a limited time.
5. Leaving, disconnecting or logging out removes the avatar from peers.

## Requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| REQ-001 | `/workspace` requires an authenticated session and preserves the return URL through login. | Must | Confirmed |
| REQ-002 | The world supports arrow keys, collision, camera follow and Enter/E interaction. | Must | Confirmed |
| REQ-003 | Music, Game and News zones reuse existing React features. | Must | Confirmed |
| REQ-004 | Presence uses the existing Socket.IO client and does not persist positions. | Must | Confirmed |
| REQ-005 | Workspace identity is resolved server-side from the JWT. | Must | Confirmed |
| REQ-006 | Chat is text-only, trimmed, limited to 120 characters and transient. | Must | Inference |
| REQ-007 | Disconnect/reconnect restores presence without reloading the route. | Must | Inference |
| REQ-008 | Controls and interaction targets have visible text equivalents. | Should | Confirmed |

## Acceptance criteria

- AC-001: Given a guest opens `/workspace`, they are redirected to `/login`; after login
  they return to `/workspace`.
- AC-002: Given a logged-in user, movement stays inside world bounds and solid objects.
- AC-003: When a user enters a zone, its prompt appears; Enter/E opens the matching UI.
- AC-004: Two connected users see join, movement, message and leave updates without a
  second Socket.IO connection.
- AC-005: A forged username in a socket payload cannot change displayed identity.
- AC-006: Blank or oversized messages are rejected; accepted bubbles disappear locally.
- AC-007: If the connection is interrupted, the page remains usable and rejoins after
  Socket.IO reconnects.

## Data and integrations

Presence is process-local ephemeral state keyed by socket ID. Payloads contain socket ID,
user ID, display name, avatar ID, Core status, position and direction. The server validates the token on
join and bounds/rate-limits movement and chat. No Mongo migration is required.

## Web delivery contract

The route is lazy-loaded from the existing React router. Phaser owns the canvas and world;
React owns headers, prompts, chat input and feature overlays. Desktop keyboard operation is
the primary interaction. Reduced-motion users receive stationary decorative elements.

## Risks and rollout

The main risks are noisy position traffic, overlapping bubbles and process-local presence
when multiple API replicas are introduced. The MVP throttles traffic and deliberately
targets the current single-process deployment. Rollback is removing the route/navigation
entry and workspace socket registration; no data migration is involved.
