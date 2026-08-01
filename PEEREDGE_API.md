# Peeredge relationship API: observed contract

This contract was verified read-only against the authorized carrier portal on 2026-08-01. The relationship API is an internal, undocumented interface and can change without notice. Prefer an official 46 Labs API when one is available.

## Authentication

- API base: `https://api-dialphone.peeredge.com/api/v2/relationship`
- Login: `POST /login`
- Login JSON: `{ "user_name": "...", "password": "..." }`
- Session token: returned in the login response `Authorization` header and sent in the same request header on later calls.
- Portal credentials stay on the EasDial backend. They are never returned to the browser or committed to source control.

## Verified reads

| Method | Path | Important parameters | EasDial feature |
|---|---|---|---|
| GET | `/me` | none | relationship identity and feature flags |
| GET | `/dashboard/cps_ports` | none | ports and CPS header |
| GET | `/dashboard/statistics` | none | balance, minutes, attempts, ASR, ALOC |
| GET | `/dashboard/graphs` | `traffic_type`, `traffic_direction`, `duration` | overview chart |
| GET | `/relationship_performance/level1` | relationship type, traffic direction, start/end | performance report |
| GET | `/relationship_performance/graph_level{n}` | report filters | drill-down graphs |
| GET | `/routeplan_numberings` | page, per page | numbering report |
| GET | `/reporting_columns` | `mapping_type=cdr_diagnostic` | CDR column configuration |
| GET | `/trunk_groups/complete_names` | trunk group type, carrier ID | diagnostic filters |
| GET | `/locations/server_locations` | none | switch locations |
| POST | `/cdr_diagnostics/search` | call type, time range, location, columns | CDR search |
| GET | `/live_calls` | none | live calls |
| GET | `/live_calls/trunk_groups` | none | live-call filters |
| GET | `/cdr_diagnostics/export_list` | carrier ID | export history |
| GET | `/rate_sheets` | none | available decks |
| GET | `/rate_sheets/rates` | selected deck/date filters | deck rates |
| GET | `/invoices` | none | invoice history |
| GET | `/carrier_payments` | carrier ID | transaction history |
| GET | `/carrier_payments/suspension_limit` | none | payment limit |
| GET | `/paypal_registrations` | none | PayPal history |
| GET | `/portal_template_settings/by_carrier` | none | portal feature flags |

The EasDial `RelationshipRestClient` normalizes these responses into stable internal types. It accepts both a direct array and a `{ "data": [...] }` wrapper because the observed endpoints use both response shapes.

## Confirmed field mappings

- Dashboard statistics: `minutes`, `attempts`, `asr`, `aloc`, and top-level `present_balance`.
- Graph points: `{ "time": "...", "value": number }` grouped by series label.
- CDR request body: `call_type`, `start_time`, `end_time`, `location`, and selected `columns`.
- CDR rows: transaction time, ANI/from DID, DNIS/to DID, LRN, SIP code/reason, real duration, carrier/trunk names, jurisdiction, rate, and cost.

## Safety boundary

The audit did not submit payments, change settings, modify numbering, download customer exports, or mutate customer records. Payment dialogs were inspected and closed without submission.
