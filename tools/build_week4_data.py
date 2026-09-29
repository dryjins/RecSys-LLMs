#!/usr/bin/env python3
"""Build ``week4/data.js`` from the UCI Online Retail transaction log.

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
7. Write ``week4/data.js``.

Usage
-----
    python3 tools/build_week4_data.py [--csv PATH] [--out PATH]

The source CSV path defaults to ``/tmp/opencode/uci/Online Retail.csv`` and the
output to ``<repo>/week4/data.js``.
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
DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "week4", "data.js"
)

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


def write_data_js(path: str, baskets, n_rows: int, n_items: int) -> None:
    """Write the cleaned dataset as an ES module."""
    n_baskets = len(baskets)
    lines = [
        "// Generated from UCI Online Retail (dataset_id 352). License per source DOI.",
        "// Source: https://archive.ics.uci.edu/dataset/352/online+retail",
        "// SHA-256 of source xlsx: %s" % SOURCE_XLSX_SHA256,
        "// Rows after cleaning: %d (one row per (InvoiceNo, StockCode) pair)" % n_rows,
        "// Baskets after cleaning: %d" % n_baskets,
        "// Distinct items: %d" % n_items,
        "//",
        "// Source zip: %s" % SOURCE_ZIP_URL,
        "// Citation: %s" % SOURCE_CITATION,
        "//",
        "// Each basket is an array of { stock, description } objects. Baskets with",
        "// fewer than two distinct items are excluded because they cannot yield",
        "// association rules.",
        "",
        "export const TRANSACTIONS = [",
    ]
    for basket in baskets:
        lines.append("  %s," % json.dumps(basket, separators=(",", ":"), ensure_ascii=False))
    lines.append("];")
    lines.append("")
    lines.append("export const N_BASKETS = %d;" % n_baskets)
    lines.append("export const N_ITEMS = %d;" % n_items)
    lines.append("")
    provenance = (
        "UCI Online Retail (dataset_id 352). Daqing Chen, Sai Liang Sain, Kun Guo "
        "(2012). 541,909 raw rows cleaned to %d rows and %d baskets by removing "
        "cancellations, negative quantities/prices, blank descriptions, non-product "
        "codes, and single-item baskets."
    ) % (n_rows, n_baskets)
    lines.append(
        "export const dataset_provenance = %s;"
        % json.dumps(provenance, ensure_ascii=False)
    )
    lines.append("")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=DEFAULT_CSV, help="raw UCI CSV path")
    parser.add_argument("--out", default=DEFAULT_OUT, help="output data.js path")
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

    write_data_js(args.out, baskets, n_rows, n_items)

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
    print("top 10 items by basket count:")
    for rank, (stock, count) in enumerate(top_items, start=1):
        print("  %2d. %-8s %-45s %d baskets" % (rank, stock, canonical[stock], count))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
