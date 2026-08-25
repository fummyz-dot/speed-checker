# Worker Agent Guide

Scope: everything under `worker/`.

Read the repository-level `AGENTS.md` first. This directory is a privacy-sensitive system boundary.

## Current responsibility

The Worker serves API routes before static assets and currently exposes connection metadata derived from Cloudflare `request.cf`.

The frontend uses:

- ASN owner/organization;
- AS number;
- country/region/city when available;
- Cloudflare colo;
- HTTP protocol.

## Privacy constraints

Do not return, log, persist, or copy into application-visible responses:

- client IP address;
- latitude/longitude;
- postal code;
- unique user identifiers.

Do not add an external IP/geolocation service unless explicitly required and reviewed.

The connection information identifies ASN/network ownership, not necessarily the user's retail ISP brand. Keep that distinction intact.

## API behavior

Preserve deliberate HTTP behavior unless a task changes the contract:

- supported endpoint: `GET /api/connection`;
- unsupported methods return an appropriate method error;
- unknown `/api/*` routes return not found;
- static assets are handled through the configured Workers Static Assets binding.

Keep mapping logic testable as pure code where possible.

## Changes requiring extra care

Treat these as contract/privacy changes:

- adding response fields;
- adding storage or analytics;
- forwarding request headers;
- adding third-party API calls;
- changing CORS/cache behavior;
- adding secrets/bindings.

Update tests and relevant documentation when the API contract changes.
