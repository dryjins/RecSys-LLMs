#!/usr/bin/env python3
"""Build the HW4 dataset artefacts from the UCI Online Retail transaction log.

This is a one-off generator for the HW4 association-rules starter. It is NOT a
student deliverable and it is not part of the browser page.

Pipeline
--------
1. Read the raw UCI CSV (541,909 rows) with the standard library only.
2. Drop junk rows: non-positive Quantity/UnitPrice, blank Description, blank
   CustomerID (guest checkouts), and InvoiceNo starting with ``C`` (cancellations)
   or ``A`` (adjustments).
3. Drop non-product StockCodes (postage, carriage, bank charges, manual entries,
   samples, discounts, gift vouchers, packing charges, ...).
4. Standardise items: StockCode -> strip + UPPERCASE; Description -> UPPERCASE,
   internal whitespace collapsed, trailing punctuation dropped, then one canonical
   Description per StockCode (the most frequent one, ties broken lexicographically).
5. Build baskets: group rows by InvoiceNo; each basket is a list of
   ``{"stock", "description"}`` objects, one entry per distinct StockCode.
6. Keep only baskets with at least two distinct items (single-item baskets cannot
   produce association rules).
7. Dictionary-encode the baskets and write a single artefact:
   - ``week4/transactions.js`` — a plain (classic) script that assigns the
     dictionary-encoded dataset (parallel ``stocks`` / ``descriptions`` item
     tables plus integer-index baskets) to ``window.HW4``. The page loads it with
     a regular ``<script>`` tag, so it works from ``file://`` with no server and
     no ES-module loader.

The generator also removes the legacy artefacts (``week4/data.js`` and
``week4/data/transactions.json``) and the now-empty ``week4/data/`` directory.

Usage
-----
    python3 tools/build_week4_data.py [--csv PATH] [--out PATH]

The source CSV path defaults to ``/tmp/opencode/uci/Online Retail.csv``; the
output defaults to ``<repo>/week4/transactions.js``.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

# --- Provenance constants (must stay in sync with the work order) -------------

SOURCE_DATASET_PAGE = "https://archive.ics.uci.edu/dataset/352/online+retail"
SOURCE_ZIP_URL = "https://archive.ics.uci.edu/static/public/352/online+retail.zip"
SOURCE_XLSX_SHA256 = (
    "43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d"
)
SOURCE_CITATION = (
    "Daqing Chen, Sai Liang Sain, and Kun Guo, 'Data mining for the online retail "
    "industry: A case study of RFM model-based customer segmentation using data "
    "mining', Journal of Cases on Information Technology, 2012"
)

DATASET_ID = 352
DEFAULT_CSV = "/tmp/opencode/uci/Online Retail.csv"
_WEEK4_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "week4"
)
DEFAULT_OUT = os.path.join(_WEEK4_DIR, "transactions.js")
LEGACY_DATA_JS = os.path.join(_WEEK4_DIR, "data.js")
LEGACY_JSON = os.path.join(_WEEK4_DIR, "data", "transactions.json")
LEGACY_DATA_DIR = os.path.join(_WEEK4_DIR, "data")

# --- Cleaning rules -----------------------------------------------------------

# Descriptions that mark a row as a non-product accounting/shipping entry.
# (Work order step A.3, first clause. Compared case-insensitively.)
NON_PRODUCT_DESCRIPTIONS = {
    "POSTAGE",
    "DOTCOM POSTAGE",
    "CARRIAGE",
    "CRUK COMMISSION",
    "MANUAL",
    "SAMPLES",
    "DISCOUNT",
}

# StockCode patterns that mark a row as a non-product entry.
# (Work order step A.3, second clause.)
NON_PRODUCT_CODE_PATTERNS = (
    re.compile(r"^BANK CHARGES$", re.IGNORECASE),
    re.compile(r"^TEST\d*$", re.IGNORECASE),
    re.compile(r"^gift_\d+", re.IGNORECASE),
)

# Small explicit allowlist of non-product StockCodes that the enumerated rules
# above miss. The work order explicitly permits a small allowlist instead of a
# broad regex. Each entry below is an internal accounting/shipping line, not a
# product: AMAZON FEE, bad-debt adjustment, cushion order padding, next-day
# carriage, packing charge, and a stock adjustment.
NON_PRODUCT_CODE_ALLOWLIST = {
    "AMAZONFEE",
    "B",
    "PADS",
    "23444",  # Next Day Carriage
    "23574",  # PACKING CHARGE
    "23595",  # adjustment
}

# Work order step A.3, third clause: a StockCode that is purely alphanumeric,
# at least five characters long and starts with M or D is dropped ONLY when its
# Description is itself an internal-code marker. This deliberately does NOT drop
# real products such as ``DCGS0003`` (a boxed glass ashtray) or ``DCGSSGIRL``
# (a girls party bag). A small allowlist is used rather than a broad regex.
M_D_INTERNAL_DESCRIPTIONS = {
    "AMAZON FEE",
    "MANUAL",
    "DISCOUNT",
    "ADJUSTMENT",
    "RE-ADJUSTMENT",
    "DOTCOM POSTAGE",
    "POSTAGE",
    "PACKING CHARGE",
    "NEXT DAY CARRIAGE",
    "BANK CHARGES",
    "CRUK COMMISSION",
}

_TRAILING_PUNCT = ".,;:!?"
_ALNUM_RE = re.compile(r"^[A-Za-z0-9]+$")


def normalise_stock_code(raw: str) -> str:
    """Trim and upper-case a StockCode so case variants collapse to one item."""
    return raw.strip().upper()


def normalise_description(raw: str) -> str:
    """Upper-case, collapse whitespace, and strip trailing punctuation.

    Returns ``""`` when the description has no content. A description that is
    only punctuation (e.g. ``"?"``) falls back to its collapsed upper-case form
    so the item is still identifiable rather than silently emptied.
    """
    collapsed = " ".join(raw.split()).upper()
    stripped = collapsed.rstrip(_TRAILING_PUNCT).strip()
    return stripped if stripped else collapsed


def is_non_product_code(code: str, description: str) -> bool:
    """Return True when a (StockCode, Description) pair is not a real product."""
    if description.upper() in NON_PRODUCT_DESCRIPTIONS:
        return True
    if any(pattern.match(code) for pattern in NON_PRODUCT_CODE_PATTERNS):
        return True
    if code in NON_PRODUCT_CODE_ALLOWLIST:
        return True
    # Third clause: M/D-prefixed alphanumeric codes, only for internal descriptions.
    if (
        len(code) >= 5
        and _ALNUM_RE.match(code)
        and code[0] in ("M", "D")
        and description.upper() in M_D_INTERNAL_DESCRIPTIONS
    ):
        return True
    return False


def read_and_filter(csv_path: str):
    """Read the raw CSV and return kept (invoice, stock, description) triples.

    Also returns diagnostic counters so the caller can report exactly what each
    filter stage removed.
    """
    counters = Counter()
    kept = []  # (invoice, stock, raw_description)
    with open(csv_path, newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        expected = [
            "InvoiceNo",
            "StockCode",
            "Description",
            "Quantity",
            "InvoiceDate",
            "UnitPrice",
            "CustomerID",
            "Country",
        ]
        if header != expected:
            raise SystemExit(
                "Unexpected CSV header: %r (expected %r)" % (header, expected)
            )
        for row in reader:
            counters["raw_rows"] += 1
            if len(row) != 8:
                counters["dropped_bad_columns"] += 1
                continue
            invoice, stock, description, quantity, _date, unit_price, customer, _country = row

            if invoice[:1] in ("C", "A"):
                counters["dropped_cancellation_or_adjustment"] += 1
                continue
            if not description.strip():
                counters["dropped_blank_description"] += 1
                continue
            try:
                quantity_value = float(quantity)
                price_value = float(unit_price)
            except ValueError:
                counters["dropped_unparseable_number"] += 1
                continue
            if quantity_value <= 0:
                counters["dropped_nonpositive_quantity"] += 1
                continue
            if price_value <= 0:
                counters["dropped_nonpositive_price"] += 1
                continue
            if not customer.strip():
                counters["dropped_guest_checkout"] += 1
                continue

            code = normalise_stock_code(stock)
            if not code:
                counters["dropped_blank_stockcode"] += 1
                continue
            raw_description = description.strip()
            if is_non_product_code(code, raw_description):
                counters["dropped_non_product"] += 1
                continue
            kept.append((invoice, code, raw_description))
    return kept, counters


def canonical_descriptions(kept) -> dict:
    """Pick one canonical Description per StockCode.

    The most frequent normalised description wins; ties are broken by taking the
    lexicographically smallest string so the output is deterministic.
    """
    per_stock = defaultdict(Counter)
    for _invoice, code, raw_description in kept:
        per_stock[code][normalise_description(raw_description)] += 1
    canonical = {}
    for code, counter in per_stock.items():
        # Sort by (-frequency, description) and take the first entry.
        canonical[code] = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
    return canonical


def build_baskets(kept, canonical: dict):
    """Group kept rows into baskets keyed by InvoiceNo.

    A basket is a list of ``{"stock", "description"}`` objects sorted by stock,
    with exactly one entry per distinct StockCode (duplicate rows for the same
    invoice+stock are merged).
    """
    per_invoice = defaultdict(dict)  # invoice -> {stock: description}
    for invoice, code, _raw_description in kept:
        per_invoice[invoice][code] = canonical[code]
    baskets = []
    invoice_order = []
    for invoice, items in per_invoice.items():
        if len(items) < 2:
            continue
        invoice_order.append(invoice)
        baskets.append(
            [
                {"stock": stock, "description": items[stock]}
                for stock in sorted(items)
            ]
        )
    return baskets, invoice_order


def encode_dataset(baskets):
    """Dictionary-encode baskets as integer indices plus parallel item tables.

    Returns ``(stocks, descriptions, encoded)`` where ``stocks[i]`` and
    ``descriptions[i]`` describe item ``i`` and each entry of ``encoded`` is a
    list of item indices. ``descriptions`` is kept parallel to ``stocks`` (one
    canonical description per stock code) so an index identifies a single product
    identity. Items are ordered by descending basket frequency (ties broken by
    stock code) so the most common items get the shortest indices and the output
    is deterministic.
    """
    description_by_stock = {}
    basket_counts = Counter()
    for basket in baskets:
        for item in basket:
            description_by_stock[item["stock"]] = item["description"]
            basket_counts[item["stock"]] += 1
    stocks = sorted(basket_counts, key=lambda stock: (-basket_counts[stock], stock))
    index_by_stock = {stock: i for i, stock in enumerate(stocks)}
    descriptions = [description_by_stock[stock] for stock in stocks]
    encoded = [
        [index_by_stock[item["stock"]] for item in basket] for basket in baskets
    ]
    return stocks, descriptions, encoded


def provenance_string(n_rows: int, n_baskets: int) -> str:
    """Return the human-readable provenance string shared by both artefacts."""
    return (
        "UCI Online Retail (dataset_id 352). Daqing Chen, Sai Liang Sain, Kun Guo "
        "(2012). 541,909 raw rows cleaned to {:,} rows and {:,} baskets by removing "
        "cancellations, negative quantities/prices, blank descriptions, non-product "
        "codes, and single-item baskets."
    ).format(n_rows, n_baskets)


def write_transactions_js(path: str, n_rows: int, baskets, n_items: int) -> int:
    """Write the dictionary-encoded dataset as a plain ``window.HW4`` script.

    The output is a classic script, NOT an ES module: it contains no ``export``
    keyword and is loaded with ``<script src="transactions.js"></script>``. It
    assigns::

        window.HW4 = {
          "N_BASKETS": <int>,
          "N_ITEMS": <int>,
          "stocks": [<stock code>, ...],
          "descriptions": [<canonical description>, ...],   # parallel to stocks
          "baskets": [[<item index>, ...], ...],
          "dataset_provenance": "<string>"
        };

    The payload is written without indentation to keep the file small. Returns
    the number of encoded baskets.
    """
    stocks, descriptions, encoded = encode_dataset(baskets)
    provenance = provenance_string(n_rows, len(encoded))
    payload = {
        "N_BASKETS": len(encoded),
        "N_ITEMS": n_items,
        "stocks": stocks,
        "descriptions": descriptions,
        "baskets": encoded,
        "dataset_provenance": provenance,
    }
    header = [
        "// Auto-generated by tools/build_week4_data.py — do not edit. "
        "Source: UCI Online Retail dataset 352. License per source DOI. "
        "SHA-256 of source xlsx: %s." % SOURCE_XLSX_SHA256,
        "//",
        "// Plain (classic) script — NOT an ES module. Assigns the dictionary-encoded",
        "// dataset to window.HW4. Load it with <script src=\"transactions.js\"></script>",
        "// BEFORE week4/script.js; the page then works from file:// with no server.",
        "//",
        "// Source: %s" % SOURCE_DATASET_PAGE,
        "// Source zip: %s" % SOURCE_ZIP_URL,
        "// Citation: %s" % SOURCE_CITATION,
        "// Rows after cleaning: %d (one row per (InvoiceNo, StockCode) pair)" % n_rows,
        "window.HW4 = %s;" % json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
        "",
    ]
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(header))
    return len(encoded)


def remove_legacy_artifacts() -> None:
    """Delete the pre-``transactions.js`` artefacts, when they still exist."""
    for legacy in (LEGACY_DATA_JS, LEGACY_JSON):
        if os.path.exists(legacy):
            os.remove(legacy)
    if os.path.isdir(LEGACY_DATA_DIR) and not os.listdir(LEGACY_DATA_DIR):
        os.rmdir(LEGACY_DATA_DIR)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=DEFAULT_CSV, help="raw UCI CSV path")
    parser.add_argument(
        "--out", default=DEFAULT_OUT, help="output transactions.js path"
    )
    args = parser.parse_args(argv)

    if not os.path.exists(args.csv):
        print("ERROR: CSV not found: %s" % args.csv, file=sys.stderr)
        return 2

    kept, counters = read_and_filter(args.csv)
    canonical = canonical_descriptions(kept)
    baskets, _invoice_order = build_baskets(kept, canonical)

    # Count rows that actually survive into the exported baskets.
    n_rows = sum(len(basket) for basket in baskets)
    n_items = len({item["stock"] for basket in baskets for item in basket})

    item_basket_counts = Counter()
    for basket in baskets:
        for item in basket:
            item_basket_counts[item["stock"]] += 1
    top_items = item_basket_counts.most_common(10)

    write_transactions_js(args.out, n_rows, baskets, n_items)
    remove_legacy_artifacts()

    print("original rows            : %d" % counters["raw_rows"])
    print("kept rows (all filters)  : %d" % len(kept))
    print("  dropped cancellations/A: %d" % counters["dropped_cancellation_or_adjustment"])
    print("  dropped blank descr.   : %d" % counters["dropped_blank_description"])
    print("  dropped qty <= 0       : %d" % counters["dropped_nonpositive_quantity"])
    print("  dropped price <= 0     : %d" % counters["dropped_nonpositive_price"])
    print("  dropped guest checkout : %d" % counters["dropped_guest_checkout"])
    print("  dropped non-product    : %d" % counters["dropped_non_product"])
    print("  dropped malformed      : %d" % (
        counters["dropped_bad_columns"]
        + counters["dropped_unparseable_number"]
        + counters["dropped_blank_stockcode"]
    ))
    print("rows in exported baskets : %d" % n_rows)
    print("basket count             : %d" % len(baskets))
    print("distinct item count      : %d" % n_items)
    js_size = os.path.getsize(args.out)
    print("transactions.js          : %d bytes (%.2f MB)" % (js_size, js_size / 1e6))
    print("top 10 items by basket count:")
    for rank, (stock, count) in enumerate(top_items, start=1):
        print("  %2d. %-8s %-45s %d baskets" % (rank, stock, canonical[stock], count))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
