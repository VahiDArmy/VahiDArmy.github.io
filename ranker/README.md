# PEPPER · Multidimensional ranking SPA

## Files
- `index.html`: single-file vanilla JavaScript SPA.
- `setup.sql`: isolated Supabase schema, RLS policies, indexes and starter dimensions.

## Setup
1. Open the Supabase SQL Editor for the project configured in `index.html`.
2. Run all of `setup.sql`.
3. In Supabase Authentication settings, choose whether email confirmation is required.
4. Host `index.html` on any static host (or open it locally for a quick test). It loads Supabase JS and Chart.js from CDNs.

## First use
1. Create an account and sign in.
2. Each participant creates their own person profile in People, then links that profile to their account in Settings & data. A person can create their profile before the other participant signs up.
3. Open Evaluate, choose the other person and submit scores.
4. The other person signs in with their own account, links their own profile, and submits their perspective back.

## Security model
- The publishable key is intended for browser use. Never put a Supabase `service_role` key in this file.
- RLS is enabled on every `pepper_` table.
- People and dimensions are shared across authenticated users. A user can only create evaluations attributed to their linked person profile; evaluation edits are restricted to their author account.
- Shared evaluations are readable by authenticated users. Private evaluation support is represented in the schema but the current UI saves shared evaluations.

## Notes
- The overall score is a weighted average convenience metric. Per-dimension values remain available and are not collapsed in the comparison view.
- This is a client-side SPA. For a production deployment with strict workspace boundaries, add workspace/organization membership tables and scope every RLS policy to that membership.
