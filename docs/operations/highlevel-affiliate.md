# HighLevel affiliate operations

## Canonical identity

Use only the HighLevel affiliate identity that owns Radom UG's historical recurring-commission ledger. Do not accept
terms or publish links from a duplicate or test identity. Store the confirmed portal login and payout identity in the
company password manager, not in this repository.

## Link activation

Set `HIGHLEVEL_AFFILIATE_LINKS_JSON` in the production environment only after HighLevel support confirms the recovered
ledger. The value is a JSON object keyed by `<destination>:<subId>`. Every value must be the exact portal-generated
HTTPS URL, use an official `gohighlevel.com` hostname, contain `fp_ref` or `fpr`, and contain the matching `fp_sid`.

Destinations:

- `starter`
- `unlimited`
- `pro`

Approved SubIDs:

- `paymatch_content`
- `inboxguard_content`
- `accesslens_content`
- `organic_search`
- `email`
- `direct_cross_sell`

Configure only the combinations that are actively published. Missing or malformed entries fail closed: the public
guide has no referral button and the redirect endpoint returns HTTP 503.

## Monthly reconciliation

1. Export affiliate performance by SubID from HighLevel or FirstPromoter.
2. Compare clicks with `paymatch_affiliate_clicks`, grouped by `sub_id` and `destination`.
3. Compare referred trials, paid customers, reversals, and commissions with the payout statement.
4. Investigate a click-to-trial or trial-to-paid change before changing campaign placement.
5. Keep commissions and Marketplace app revenue as separate revenue lines.

The local click table intentionally contains only destination, approved SubID, and timestamp. Do not add email, IP,
HighLevel installation, or customer identifiers.
