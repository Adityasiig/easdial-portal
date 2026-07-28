# PeerEdge Relationship API — observed contract

Captured from the live carrier portal network traffic (HAR). This is 46 Labs'
**internal** relationship API — undocumented and unsupported. Prefer the official
API if/when 46 Labs provides one.

- **API host:** `https://api-dialphone.peeredge.com`
- **Base path:** `/api/v2/relationship`
- **Origin/Referer expected:** `https://carrier-dialphone.peeredge.com`
- **Auth:** httpOnly **session cookie** set at login. No `Authorization` header, no
  API key, no bearer token appears in any request. (Cookie is stripped from HAR
  exports, but its absence from every request header confirms cookie-based auth.)

## Endpoints used by the dashboard/reporting pages

| Method | Path | Query params (confirmed) | Purpose |
|---|---|---|---|
| GET | `/me` | — | Current relationship user + settings |
| GET | `/dashboard/cps_ports` | — | Active ports + CPS |
| GET | `/dashboard/statistics` | — | KPI stats + present balance |
| GET | `/dashboard/graphs` | `traffic_type=minutes`, `traffic_direction=T`, `duration=Today` | Overview time-series (per trunk) |
| GET | `/relationship_performance/level1` | `relationship_type=C`, `traffic_direction=T`, `start_datetime`, `end_datetime` | Termination performance table |
| GET | `/routeplan_numberings` | `page`, `per_page` | Route plan numbering |
| GET | `/reporting_columns` | `mapping_type=cdr_diagnostic` | Report column config |
| GET | `/trunk_groups/complete_names` | `trunk_group_type=0`, `carrier_id` | Trunk group names |
| GET | `/locations/server_locations` | — | Server locations |
| GET | `/portal_template_settings/by_carrier` | — | Branding/feature flags |
| POST | `/auth/cable_ticket` | — | WebSocket (ActionCable) ticket for live updates |

## Sample responses (as captured — data arrays empty at low-traffic capture time)

> Values below are anonymised placeholders — real ids/emails/balances scrubbed.

```jsonc
// GET /me
{ "user": { "id": 0, "user_name": "<carrier>", "carrier_id": 0,
            "is_activated": true, "is_admin": false },
  "settings": { "enable_rates": true, "enable_balance": true, /* ... */ } }

// GET /dashboard/cps_ports        → { "ports": 0, "cps": 0 }
// GET /dashboard/statistics       → { "data": [], "present_balance": "0.000" }
// GET /dashboard/graphs           → [ { "<trunk name>": [] },
//                                      { "<trunk name> STATIC": [] } ]
// GET /relationship_performance/level1 → []
// GET /routeplan_numberings       → { "data": [], "total": 0 }
```

## Still to confirm (needs one capture during active traffic, **Disable cache ON**)

- Inner shape of a `dashboard/graphs` point (array `[t, v]` vs object `{time, value}`).
- Row shape inside `dashboard/statistics.data` (which fields map to Daily Minutes /
  Attempts / PRV).
- Exact `duration` values for Yesterday / Last week, and `traffic_type` value for attempts.
- The login endpoint + payload (log out → record → log in), if we use runtime login.

`RestPeeredgeClient.ts` marks every assumed value with `// ASSUMED` vs `// CONFIRMED`.
