# Starter update: two more provided baselines

The FAR-Trans starter now reports four provided baselines in every run:
`popularity`, `cbf`, `latest_buy` and `latest_buy_or_sell`. Nothing else about the
task changes.

- **Same data, same protocol.** The new rows use the same evaluated users, cutoff,
  horizon, eligible universe, candidate policy and truth as the existing baselines.
  `protocol.json` and its `protocol_hash` are unchanged, the input contexts are
  unchanged, and the demo/user selection is unchanged. Because the code changed, the
  numbers you get by re-running may differ from values quoted in older notes — use
  your own run.
- **Why add them.** This dataset repeats past purchases often, so popularity alone
  is a weak reference point. A ranking of the assets a user touched most recently is
  a stronger classical baseline on the same past-only inputs. It is a *baseline*,
  not a target: no baseline is claimed best under all conditions, and you are not
  required to beat any of them this week.
- **Fair comparison.** Put all four baselines and your `custom` method in the same
  results table, on the same cohort and hash. Report the all-user nDCG@10 as the
  primary metric and the nonempty-truth mean separately with its user count. The
  ~89 of 100 demo users with empty truth are kept, not dropped.
- **What you still do.** You implement one change in the encoder or ranker seam and
  report it as `custom`. Do not reimplement the provided baselines; re-run the
  provided code instead.
- **Sells are not dislikes.** `latest_buy` uses past `Buy` dates only.
  `latest_buy_or_sell` uses the date of the latest past `Buy` **or** `Sell` so an
  asset the user only sold does not silently vanish from a recency list. A `Sell`
  is an event date and nothing more: it is not read as a negative label, not a
  preference, and no profitability or return is computed.
- **No new workload.** No deadline, points, or performance requirement is added by
  this update.
