# Peeredge API: verified relationship and switch-admin contract

This contract was verified read-only against the authorized carrier and switch-admin portals on 2026-08-02. The API is internal and undocumented, so it can change without notice. Prefer an official 46 Labs API when one is available.

## Recommended production mode

EaseDial should use switch-admin `rest` mode for multiple customer relationships. The backend logs in once, lists carriers whose names start with the configured `ED` prefix, and applies the allocated carrier ID or its scoped trunk-group IDs to every read. The browser never receives the upstream credentials or token.

- API base: `https://api-dialphone.peeredge.com/api/v2`
- Login: `POST /login`
- Carrier list: `GET /carriers`
- Relationship filter: prefix-aware matching for `ED -`, `ED-`, and `ED ` formats

### Verified switch-admin reads

| Method | Path | Scope used by EaseDial |
|---|---|---|
| GET | `/carriers` | allocated carrier ID and live balance |
| GET | `/trunk_groups/by_type_and_location` | carrier/customer trunk groups only |
| GET | `/dashboard/graphs` | one request per allocated trunk group |
| GET | `/relationship_performance/level2` and `/level3` | allocated carrier and trunk groups |
| POST | `/cdr_diagnostics/search` | allocated trunk-group IDs in `columns` |
| GET | `/routeplan_numberings` | `carrier_id` |
| GET | `/rate_sheets` | `carrier_id` |
| GET | `/invoices` | `carrier_id` |
| GET | `/carrier_payments` | `carrier_id` |
| GET | `/live_calls` | location plus carrier-name filtering |

The verified CDR request includes `call_type`, `start_time`, `end_time`, `duration_min`, `duration_max`, `is_sanitize`, `location`, and scoped `columns`. EaseDial supports ANI, DNIS, SIP release code, SIP call ID, duration range, A/B-leg selection, completion state, customer trunk, vendor trunk, and GMT date/time range.

Customer and vendor trunk IDs are never inferred from display labels. For termination traffic, the allocated customer trunk maps to `orig_trunk_group_id` and the selected vendor trunk maps to `term_trunk_group_id`. For origination traffic, the mapping is reversed. The backend validates the selected customer trunk against the allocated carrier and the vendor trunk against the selected direction and location before querying CDRs.

## Authentication

- API base: `https://api-dialphone.peeredge.com/api/v2/relationship`
- Login: `POST /login`
- Login JSON: `{ "user_name": "...", "password": "..." }`
- Session token: returned in the login response `Authorization` header and sent in the same request header on later calls.
- Portal credentials stay on the EaseDial backend. They are never returned to the browser or committed to source control.

## Verified reads

| Method | Path | Important parameters | EaseDial feature |
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

The EaseDial `RelationshipRestClient` normalizes these responses into stable internal types. It accepts both a direct array and a `{ "data": [...] }` wrapper because the observed endpoints use both response shapes.

## Confirmed field mappings

- Dashboard statistics: `minutes`, `attempts`, `asr`, `aloc`, and top-level `present_balance`.
- Graph points: `{ "time": "...", "value": number }` grouped by series label.
- CDR request body: `call_type`, `start_time`, `end_time`, `location`, and selected `columns`.
- CDR rows: transaction time, ANI/from DID, DNIS/to DID, LRN, SIP code/reason, real duration, carrier/trunk names, jurisdiction, rate, and cost.

## Safety boundary

The audit did not kill calls, submit payments, change switch settings, modify numbering, download customer exports, or mutate Peeredge customer records. Switch-wide PayPal history and unverified export endpoints remain closed in switch-admin mode to prevent cross-customer exposure.
