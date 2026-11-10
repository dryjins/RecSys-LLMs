"""Frozen test vectors TV1-TV23 plus a temporal fixture for the FAR-Trans starter.

Standard library only. Run from this package folder:

    python3 -m unittest discover -s . -p 'test_*.py' -v

The temporal fixture is a temporary CSV directory; nothing here reads the real
FAR-Trans archive and nothing calls a model. Prompt/response files used by the
tests are synthesised identity answers, not LLM output.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
STARTER = HERE / 'starter.py'
SPEC = importlib.util.spec_from_file_location('starter', STARTER)
st = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(st)

ATOL = 1e-12
RTOL = 1e-12
CUTOFF = '2021-06-01'
ENV = {k: v for k, v in os.environ.items() if k != 'PYTHONPATH'}
ENV['PYTHONDONTWRITEBYTECODE'] = '1'


def assert_close(test, actual, expected):
    test.assertTrue(math.isclose(actual, expected, abs_tol=ATOL, rel_tol=RTOL),
                    f'{actual!r} != {expected!r}')


def write_csv(path, header, rows):
    with path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        writer.writerows(rows)


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()
            if line.strip()]


ASSET_HEADER = ['ISIN', 'assetName', 'assetShortName', 'assetCategory', 'assetSubCategory',
                'marketID', 'sector', 'industry', 'timestamp']
CUSTOMER_HEADER = ['customerID', 'customerType', 'riskLevel', 'investmentCapacity',
                   'lastQuestionnaireDate', 'timestamp']
PRICE_HEADER = ['ISIN', 'timestamp', 'closePrice']
TRANSACTION_HEADER = ['customerID', 'ISIN', 'transactionID', 'transactionType', 'timestamp',
                      'totalValue', 'units', 'channel', 'marketID']

FAMILIES = {
    'A': ('Stock', 'Equity', 'Technology', 'Software'),
    'B': ('Bond', 'Government', 'Sovereign', 'Government'),
    'C': ('Stock', 'Equity', 'Technology', 'Software'),
    'D': ('Stock', 'Large Cap', 'Financials', 'Banks'),
    'E': ('MTF', 'Fund', 'Diversified', 'Asset Management'),
    'F': ('MTF', 'Fund', 'Diversified', 'Asset Management'),
    'G': ('Stock', 'Small Cap', 'Industrials', 'Machinery'),
    'H': ('Bond', 'Corporate', 'Utilities', 'Electricity'),
    'I': ('Stock', 'Large Cap', 'Health Care', 'Pharmaceuticals'),
    'J': ('MTF', 'Fund', 'Real Estate', 'REITs'),
    'K': ('Bond', 'Corporate', 'Energy', 'Oil & Gas'),
    'L': ('Stock', 'Mid Cap', 'Consumer', 'Retail'),
    # Ineligible: metadata appears only at or after the cutoff.
    'M': ('Stock', 'Equity', 'Technology', 'Software'),
    # Ineligible: only a post-cutoff price row exists.
    'N': ('Stock', 'Equity', 'Technology', 'Software'),
}


def write_fixture(root, future_variant='base'):
    """Write the temporal fixture. ``future_variant`` mutates only future rows."""
    assets = []
    for isin, (category, sub, sector, industry) in FAMILIES.items():
        stamp = '2021-06-02' if isin == 'M' else '2021-01-01'
        assets.append([isin, f'Asset {isin}', isin, category, sub, 'XATH',
                       sector, industry, stamp])
    assets.append(['A', 'Asset A', 'A', 'Stock', 'Equity', 'XATH',
                   'Technology', 'Software', '2021-05-20'])
    write_csv(root / 'asset_information.csv', ASSET_HEADER, assets)

    prices = [['A', '2021-05-01', '10'], ['B', '2021-03-01', '5'],
              ['C', '2021-05-20', '7'], ['D', '2021-05-01', '9'],
              ['M', '2021-05-01', '3'], ['N', '2021-06-02', '3']]
    prices += [[isin, '2021-01-01', '4'] for isin in 'EFGHIJKL']
    write_csv(root / 'close_prices.csv', PRICE_HEADER, prices)

    customers = [
        ['U1', 'Mass', 'Conservative', 'CAP_LT30K', '2021-01-01', '2021-01-01'],
        ['U1', 'Mass', 'Aggressive', 'CAP_GT300K', '2021-05-25', '2021-05-25'],
        ['U1', 'Mass', 'Professional', 'CAP_GT300K', '2021-06-15', '2021-06-15'],
        ['U2', 'Mass', 'Balanced', 'CAP_LT30K', '2021-01-01', '2021-01-01'],
        ['U3', 'Mass', 'Balanced', 'CAP_LT30K', '2021-01-01', '2021-01-01'],
        ['U4', 'Mass', 'Balanced', 'CAP_LT30K', '2021-06-15', '2021-06-15'],
    ]
    write_csv(root / 'customer_information.csv', CUSTOMER_HEADER, customers)

    base = [
        ['U1', 'A', '1', 'Buy', '2021-04-01', '100', '1', 'Branch', 'XATH'],
        ['U1', 'B', '2', 'Buy', '2021-04-02', '100', '1', 'Branch', 'XATH'],
        ['U1', 'C', '3', 'Buy', '2021-05-01', '100', '1', 'Branch', 'XATH'],
        ['U2', 'A', '1', 'Buy', '2021-04-01', '100', '1', 'Branch', 'XATH'],
        ['U2', 'D', '7', 'Buy', '2021-04-05', '100', '1', 'Branch', 'XATH'],
        ['U2', 'B', '10', 'Sell', '2021-05-05', '100', '1', 'Branch', 'XATH'],
        ['U1', 'M', '8', 'Buy', '2021-04-01', '100', '1', 'Branch', 'XATH'],
        ['U1', 'N', '9', 'Buy', '2021-04-02', '100', '1', 'Branch', 'XATH'],
    ]
    duplicate = list(base[2])
    negative = ['U1', 'C', '-1', 'Buy', '2021-05-02', '100', '1', 'Branch', 'XATH']
    if future_variant == 'mutated':
        future = [['U1', 'E', '4', 'Sell', '2021-06-05', '100', '1', 'Branch', 'XATH'],
                  ['U1', 'A', '5', 'Buy', '2021-06-10', '100', '1', 'Branch', 'XATH'],
                  ['U1', 'A', '6', 'Buy', '2021-06-20', '100', '1', 'Branch', 'XATH'],
                  ['U2', 'F', '11', 'Buy', '2021-06-10', '100', '1', 'Branch', 'XATH']]
    else:
        future = [['U1', 'E', '4', 'Buy', '2021-06-05', '100', '1', 'Branch', 'XATH'],
                  ['U1', 'A', '5', 'Buy', '2021-06-10', '100', '1', 'Branch', 'XATH'],
                  ['U1', 'A', '6', 'Buy', '2021-06-20', '100', '1', 'Branch', 'XATH']]
    write_csv(root / 'transactions.csv', TRANSACTION_HEADER,
              base + [duplicate, negative] + future)


class FrozenVectors(unittest.TestCase):
    """TV1-TV13 are the running-example vectors; TV14-TV16 pin E5."""

    def test_tv1_content_profile_cosine(self):
        got = st.content_scores({'A': 2, 'B': 1}, {'A': ['A'], 'B': ['B']})
        assert_close(self, got['A'], 2 / math.sqrt(5))
        assert_close(self, got['B'], 1 / math.sqrt(5))

    def test_tv2_asset_without_tokens_scores_zero(self):
        got = st.content_scores({'A': 3}, {'A': ['A'], 'C': []})
        assert_close(self, got['A'], 1.0)
        assert_close(self, got['C'], 0.0)

    def test_tv3_empty_history_scores_zero(self):
        got = st.content_scores({}, {'A': ['A']})
        assert_close(self, got['A'], 0.0)

    def test_tv4_unit_vectors(self):
        got = st.content_scores({'A': 1}, {'A': ['A', 'B'], 'B': ['B']})
        assert_close(self, got['A'], 1.0)
        assert_close(self, got['B'], 1 / math.sqrt(2))

    def test_tv5_popularity_distinct_buyers(self):
        counts = st.popularity_scores({'u1': {'A': 2, 'B': 1}, 'u2': {'A': 1}},
                                      {'A', 'B'})
        self.assertEqual(counts, {'A': 2, 'B': 1})
        self.assertEqual(st.order(counts)[:2], ['A', 'B'])

    def test_tv6_zero_popularity_still_rankable(self):
        counts = st.popularity_scores({'u2': {'A': 1}}, {'C', 'B', 'A'})
        self.assertEqual(st.order(counts), ['A', 'B', 'C'])

    def test_tv7_ineligible_asset_never_ranked(self):
        counts = st.popularity_scores({'u1': {'Z': 1}, 'u2': {'Z': 1}}, {'A', 'B'})
        self.assertEqual(st.order(counts), ['A', 'B'])

    def test_tv8_ndcg_partial_hit(self):
        assert_close(self, st.ndcg10(['A', 'C', 'B'], ['A', 'B']), 0.9197207891481876)

    def test_tv9_ndcg_perfect(self):
        assert_close(self, st.ndcg10(['A', 'B'], ['A', 'B']), 1.0)

    def test_tv10_empty_truth_is_zero(self):
        self.assertEqual(st.ndcg10(['A', 'B'], set()), 0.0)

    def test_tv11_ndcg_ideal_caps_at_ten(self):
        assert_close(self, st.ndcg10(list('ABCDEFGHIJ'), set('ABCDEFGHIJKL')), 1.0)

    def test_tv12_stable_tie_break(self):
        self.assertEqual(st.order({'B': 1.0, 'A': 1.0, 'C': 0.0}), ['A', 'B', 'C'])

    def test_tv13_short_list_not_padded(self):
        self.assertEqual(st.order({'A': 0.5, 'B': 0.25}), ['A', 'B'])

    def test_tv14_aggregate_macro_counts_empty_as_zero(self):
        got = st.aggregate([{'ndcg_at_10': 1.0, 'relevant_count': 2},
                            {'ndcg_at_10': 0.0, 'relevant_count': 0}])
        self.assertEqual(got, {'users': 2, 'nonempty_truth_users': 1,
                              'empty_truth_users': 1, 'ndcg_at_10': 0.5,
                              'ndcg_at_10_nonempty': 1.0})

    def test_tv15_aggregate_four_users(self):
        got = st.aggregate([{'ndcg_at_10': 1.0, 'relevant_count': 1},
                            {'ndcg_at_10': 0.25, 'relevant_count': 3},
                            {'ndcg_at_10': 0.0, 'relevant_count': 0},
                            {'ndcg_at_10': 0.0, 'relevant_count': 0}])
        self.assertEqual(got['users'], 4)
        self.assertEqual(got['nonempty_truth_users'], 2)
        self.assertEqual(got['empty_truth_users'], 2)
        assert_close(self, got['ndcg_at_10'], 0.3125)
        assert_close(self, got['ndcg_at_10_nonempty'], 0.625)

    def test_tv16_aggregate_empty_is_none(self):
        got = st.aggregate([])
        self.assertEqual(got['users'], 0)
        self.assertIsNone(got['ndcg_at_10'])
        self.assertIsNone(got['ndcg_at_10_nonempty'])


class RecencyVectors(unittest.TestCase):
    """TV17-TV22 pin E6 on hand-written past-only events."""

    @staticmethod
    def context(*eligible):
        return {'eligible_asset_ids': list(eligible)}

    @staticmethod
    def pop(universe):
        # Every eligible asset has popularity 0, so the fill order is ISIN ascending.
        return {isin: 0 for isin in universe}

    def rank(self, events, universe):
        contexts = {'U1': self.context(*universe)}
        return st.recency_rankings(contexts, self.pop(universe), events)['U1']

    def test_tv17_latest_buy_and_buy_or_sell_differ_on_sell_only_asset(self):
        events = {'U1': [('2021-01-01', 'A', 'Buy'), ('2021-01-02', 'B', 'Buy'),
                         ('2021-01-03', 'A', 'Sell')]}
        got = self.rank(events, 'ABCDEFGHIJKL')
        # Buy A 2021-01-01, Buy B 2021-01-02, Sell A 2021-01-03.
        self.assertEqual(got['latest_buy'][:2], ['B', 'A'])
        self.assertEqual(got['latest_buy_or_sell'][:2], ['A', 'B'])

    def test_tv18_short_prefix_is_filled_from_popularity(self):
        events = {'U1': [('2021-01-01', 'A', 'Buy'), ('2021-01-02', 'B', 'Buy')]}
        got = self.rank(events, 'ABCDEFGHIJKL')
        self.assertEqual(got['latest_buy'][:3], ['B', 'A', 'C'])
        self.assertEqual(len(got['latest_buy']), 10)
        self.assertEqual(len(set(got['latest_buy'])), 10)
        self.assertNotIn('A', got['latest_buy'][2:])

    def test_tv23_cold_user_gets_popularity_list(self):
        got = self.rank({'U1': []}, 'ABCDEFGHIJKL')
        self.assertEqual(got['latest_buy'], list('ABCDEFGHIJ'))
        self.assertEqual(got['latest_buy_or_sell'], list('ABCDEFGHIJ'))

    def test_tv19_scan_keeps_only_retained_past_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            duplicate = ['U1', 'A', '2', 'Buy', '2021-04-02', '100', '1', 'Branch', 'XATH']
            write_csv(root / 'transactions.csv', TRANSACTION_HEADER, [
                ['U1', 'A', '1', 'Buy', '2021-04-01', '100', '1', 'Branch', 'XATH'],
                duplicate,
                duplicate,
                ['U1', 'B', '-1', 'Buy', '2021-04-03', '100', '1', 'Branch', 'XATH'],
                ['U1', 'C', '3', 'Buy', '2021-06-05', '100', '1', 'Branch', 'XATH'],
                ['U1', 'D', '4', 'Sell', '2021-06-01', '100', '1', 'Branch', 'XATH'],
                ['U1', 'Z', '5', 'Buy', '2021-04-04', '100', '1', 'Branch', 'XATH'],
            ])
            events = st.scan_recent_events(root, CUTOFF, set('ABCDEFGHIJKL'))
        self.assertEqual(events, {'U1': [('2021-04-01', 'A', 'Buy'),
                                         ('2021-04-02', 'A', 'Buy')]})

    def test_tv20_same_date_tie_breaks_by_isin(self):
        events = {'U1': [('2021-01-01', 'C', 'Buy'), ('2021-01-01', 'A', 'Buy'),
                         ('2021-01-01', 'B', 'Buy')]}
        got = self.rank(events, 'ABCDEFGHIJKL')
        self.assertEqual(got['latest_buy'][:3], ['A', 'B', 'C'])

    def test_tv21_assets_outside_the_eligible_set_are_dropped(self):
        events = {'U1': [('2021-01-01', 'Z', 'Buy'), ('2021-01-02', 'A', 'Buy')]}
        got = self.rank(events, 'ABCDEFGHIJKL')
        self.assertNotIn('Z', got['latest_buy'])
        self.assertEqual(got['latest_buy'][0], 'A')

    def test_tv22_latest_event_wins_per_asset(self):
        events = {'U1': [('2021-01-01', 'A', 'Buy'), ('2021-01-05', 'B', 'Buy'),
                         ('2021-01-09', 'A', 'Sell'), ('2021-01-03', 'C', 'Buy')]}
        got = self.rank(events, 'ABCDEFGHIJKL')
        self.assertEqual(got['latest_buy'][:3], ['B', 'C', 'A'])
        self.assertEqual(got['latest_buy_or_sell'][0], 'A')


class RankingValidation(unittest.TestCase):
    def test_valid_ten_unique(self):
        allowed = [f'I{i:02d}' for i in range(12)]
        ranking = allowed[:10]
        self.assertEqual(st.validate_ranking(ranking, allowed), ranking)

    def test_duplicate_rejected(self):
        allowed = [f'I{i:02d}' for i in range(12)]
        with self.assertRaises(ValueError):
            st.validate_ranking([allowed[0]] * 10, allowed)

    def test_outside_ids_rejected(self):
        allowed = [f'I{i:02d}' for i in range(12)]
        with self.assertRaises(ValueError):
            st.validate_ranking(allowed[:9] + ['NOT-A-CANDIDATE'], allowed)

    def test_short_or_long_list_rejected(self):
        allowed = [f'I{i:02d}' for i in range(12)]
        with self.assertRaises(ValueError):
            st.validate_ranking(allowed[:9], allowed)
        with self.assertRaises(ValueError):
            st.validate_ranking(allowed[:11], allowed)

    def test_non_string_id_rejected(self):
        allowed = [f'I{i:02d}' for i in range(12)]
        with self.assertRaises(ValueError):
            st.validate_ranking([1] + allowed[1:10], allowed)

    def test_encoder_rejects_nan_negative_and_unobserved(self):
        context = {'history': [{'id': 'A', 'buy_count': 1}],
                   'eligible_asset_ids': ['A', 'B']}
        features = {'A': ['t=1'], 'B': ['t=2']}
        for weights in ({'A': float('nan')}, {'A': -1.0}, {'Z': 1.0},
                        {'A': float('inf')}, {'A': True}, 'not-a-dict'):
            with self.assertRaises(ValueError):
                st.encode_ranking(weights, context, features, {'A': 1, 'B': 0})

    def test_order_rejects_non_finite_scores(self):
        with self.assertRaises(ValueError):
            st.order({'A': float('nan')})
        with self.assertRaises(ValueError):
            st.order({'A': float('inf')})


class TemporalFixture(unittest.TestCase):
    cutoff = CUTOFF

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.data = cls.root / 'data'
        cls.data.mkdir()
        write_fixture(cls.data)
        cls.out = cls.root / 'out'
        cls.proc, cls.metrics = cls.cli('run', '--output-dir', cls.out)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    @classmethod
    def cli(cls, command, *args, data=None, env=None, isolated=False):
        argv = [sys.executable] + (['-I'] if isolated else []) + [
            str(STARTER), command, '--data-dir', str(data or cls.data)] + [str(a) for a in args]
        proc = subprocess.run(argv, cwd=cls.root, capture_output=True, text=True,
                              env=env or ENV)
        metrics = None
        if proc.returncode == 0 and command == 'run':
            out = Path(args[args.index('--output-dir') + 1]) if '--output-dir' in args else None
            if out and (out / 'metrics.json').exists():
                metrics = json.loads((out / 'metrics.json').read_text(encoding='utf-8'))
        return proc, metrics

    def run_cli(self, name, *args, **kwargs):
        return self.cli('run', '--output-dir', self.root / name, *args, **kwargs)

    def contexts(self, out):
        return {c['user_id']: c for c in read_jsonl(out / 'contexts.jsonl')}

    # --- data loading rules -------------------------------------------------

    def test_asof_profiles_assets_prices(self):
        self.assertEqual(self.proc.returncode, 0, self.proc.stderr)
        context = self.contexts(self.out)['U1']
        self.assertEqual(context['profile']['timestamp'], '2021-05-25')
        self.assertEqual(context['profile']['riskLevel'],
                         {'value': 'Aggressive', 'status': 'observed'})
        self.assertIs(context['profile']['timestamp_is_placeholder'], False)
        eligible = set(context['eligible_asset_ids'])
        self.assertEqual(eligible, set('ABCDEFGHIJKL'))
        self.assertNotIn('M', eligible)  # metadata only after the cutoff
        self.assertNotIn('N', eligible)  # no price before the cutoff
        names = {a['id']: a for a in context['candidate_assets']}
        self.assertEqual(names['A']['metadata_timestamp'], '2021-05-20')
        self.assertEqual(self.metrics['excluded_rows'],
                         {'exact_duplicate_rows': 1,
                          'reconstructed_initial_position_rows': 1})

    def test_negative_rows_and_exact_duplicates(self):
        context = self.contexts(self.out)['U1']
        counts = {row['id']: row['buy_count'] for row in context['history']}
        self.assertEqual(counts, {'A': 1, 'B': 1, 'C': 1})
        self.assertEqual([row['id'] for row in context['history']], ['A', 'B', 'C'])

    def test_no_future_truth_in_context(self):
        for context in self.contexts(self.out).values():
            self.assertNotIn('truth', context)
            for row in context['history']:
                self.assertLess(row['metadata_timestamp'], self.cutoff)
            self.assertNotIn('E', {row['id'] for row in context['history']})

    def test_users_and_contexts_stable_after_future_mutation(self):
        mutated = self.root / 'mutated'
        mutated.mkdir()
        write_fixture(mutated, future_variant='mutated')
        proc, _ = self.cli('run', '--output-dir', self.root / 'mutated_out', data=mutated)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        base_protocol = json.loads((self.out / 'protocol.json').read_text())
        mutated_protocol = json.loads((self.root / 'mutated_out' / 'protocol.json').read_text())
        self.assertEqual(base_protocol['users'], mutated_protocol['users'])
        self.assertNotEqual(base_protocol['protocol_hash'],
                            mutated_protocol['protocol_hash'])
        self.assertEqual(self.contexts(self.out),
                         self.contexts(self.root / 'mutated_out'))

    # --- recency baselines (E6) ---------------------------------------------

    def methods(self, out, method):
        result = {}
        for row in self.prediction_rows(out):
            if row['method'] == method:
                result.setdefault(row['user_id'], []).append((int(row['rank']), row['ISIN']))
        return {uid: [isin for _, isin in sorted(rows)] for uid, rows in result.items()}

    def test_recency_methods_are_present_and_full_ten(self):
        for method in ('latest_buy', 'latest_buy_or_sell'):
            rankings = self.methods(self.out, method)
            self.assertEqual(set(rankings), {'U1', 'U2'})
            for uid, ranking in rankings.items():
                self.assertEqual(len(ranking), 10)
                self.assertEqual(len(set(ranking)), 10)
                self.assertLessEqual(set(ranking),
                                     set(self.contexts(self.out)[uid]['eligible_asset_ids']))

    def test_recency_latest_buy_uses_past_buy_dates_only(self):
        # U1 buys A 2021-04-01, B 2021-04-02, C 2021-05-01; future rows are ignored.
        self.assertEqual(self.methods(self.out, 'latest_buy')['U1'][:3], ['C', 'B', 'A'])

    def test_recency_buy_or_sell_includes_sell_only_asset(self):
        # U2 bought A and D, then sold B on 2021-05-05: B is Sell-only.
        buy = self.methods(self.out, 'latest_buy')['U2']
        either = self.methods(self.out, 'latest_buy_or_sell')['U2']
        self.assertEqual(buy[:2], ['D', 'A'])
        self.assertEqual(either[0], 'B')
        self.assertEqual(either[1:3], ['D', 'A'])

    def test_recency_shortlist_is_filled_from_popularity(self):
        # U1 has three retained past buys, so the tail is the popularity order.
        ranking = self.methods(self.out, 'latest_buy')['U1']
        self.assertEqual(ranking[3:], ['D', 'E', 'F', 'G', 'H', 'I', 'J'])

    def test_recency_cold_user_equals_popularity(self):
        users = self.root / 'cold_e6_users.txt'
        users.write_text('U3\n', encoding='utf-8')
        proc, _ = self.run_cli('cold_e6', '--users-file', users)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        for method in ('popularity', 'latest_buy', 'latest_buy_or_sell'):
            self.assertEqual(self.methods(self.root / 'cold_e6', method)['U3'],
                             ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], method)

    def test_recency_respects_exclude_seen(self):
        users = self.root / 'one_seen_user.txt'
        users.write_text('U2\n', encoding='utf-8')
        proc, _ = self.run_cli('seen', '--users-file', users, '--exclude-seen')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        for method in ('latest_buy', 'latest_buy_or_sell'):
            ranking = self.methods(self.root / 'seen', method)['U2']
            self.assertNotIn('A', ranking, method)  # own past Buy
            self.assertNotIn('D', ranking, method)  # own past Buy
            self.assertEqual(len(ranking), 10, method)

    def test_recency_lists_unchanged_by_future_mutation(self):
        mutated = self.root / 'mutated_e6'
        mutated.mkdir()
        write_fixture(mutated, future_variant='mutated')
        proc, _ = self.cli('run', '--output-dir', self.root / 'mutated_e6_out', data=mutated)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        for method in ('latest_buy', 'latest_buy_or_sell'):
            self.assertEqual(self.methods(self.out, method),
                             self.methods(self.root / 'mutated_e6_out', method), method)

    def test_recency_helpers_have_no_truth_input(self):
        import inspect
        for function in (st.scan_recent_events, st.recency_rankings):
            self.assertNotIn('truth', inspect.signature(function).parameters)
        # The helper output depends only on contexts/events/popularity: passing the
        # same inputs twice is deterministic and never consults the loader truth.
        assets, profiles, history, truth, end, excluded = st.load_data(self.data, CUTOFF, 30)
        events = st.scan_recent_events(self.data, CUTOFF, assets)
        pop = st.popularity_scores(history, assets)
        contexts = self.contexts(self.out)
        first = st.recency_rankings(contexts, pop, events)
        second = st.recency_rankings(contexts, pop, dict(events))
        self.assertEqual(first, second)

    def test_raw_scan_matches_loader_history(self):
        assets, profiles, history, truth, end, excluded = st.load_data(self.data, CUTOFF, 30)
        self.assertEqual(len((assets, profiles, history, truth, end, excluded)), 6)
        events = st.scan_recent_events(self.data, CUTOFF, assets)
        self.assertEqual(events['U1'], [('2021-04-01', 'A', 'Buy'),
                                        ('2021-04-02', 'B', 'Buy'),
                                        ('2021-05-01', 'C', 'Buy')])
        # Negative row, exact duplicate and ineligible assets (M, N) are dropped.
        self.assertEqual(excluded, {'exact_duplicate_rows': 1,
                                    'reconstructed_initial_position_rows': 1})
        self.assertNotIn('MUTATED_FUTURE_ASSET', {isin for _, isin, _ in events.get('U1', [])})

    # --- ranking behaviour --------------------------------------------------

    def test_cold_user_falls_back_to_popularity(self):
        users = self.root / 'cold_users.txt'
        users.write_text('U3\n', encoding='utf-8')
        proc, _ = self.run_cli('cold', '--users-file', users)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        context = self.contexts(self.root / 'cold')['U3']
        self.assertTrue(context['cold_start'])
        ranking = sorted((int(row['rank']), row['ISIN']) for row in
                         self.prediction_rows(self.root / 'cold')
                         if row['method'] == 'cbf')
        self.assertEqual(ranking[0][1], 'A')  # two distinct buyers
        self.assertEqual(len(ranking), 10)

    def test_short_eligible_pool_raises(self):
        proc, _ = self.run_cli('short', '--exclude-seen')
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('fewer than ten eligible assets', proc.stderr)

    def test_identity_plugin_custom_equals_cbf(self):
        proc, _ = self.run_cli('plugin', '--plugin', HERE / 'extensions.py')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assert_custom_equals_cbf(self.root / 'plugin')

    def test_simulated_identity_responses_equal_cbf_both_stages(self):
        contexts = self.contexts(self.out)
        predictions = self.predictions(self.out)
        digest = json.loads((self.out / 'protocol.json').read_text())['protocol_hash']
        for stage in ('encoder', 'ranker'):
            responses = self.root / f'responses_{stage}.jsonl'
            with responses.open('w', encoding='utf-8') as stream:
                for uid, context in contexts.items():
                    if stage == 'encoder':
                        row = {'user_id': uid, 'stage': 'encoder', 'protocol_hash': digest,
                               'history_weights': {a['id']: a['buy_count']
                                                   for a in context['history']}}
                    else:
                        row = {'user_id': uid, 'stage': 'ranker', 'protocol_hash': digest,
                               'ranked_ids': predictions[uid]}
                    stream.write(json.dumps(row) + '\n')
            proc, _ = self.run_cli(f'response_{stage}', '--stage', stage,
                                   '--responses', responses)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assert_custom_equals_cbf(self.root / f'response_{stage}')

    @staticmethod
    def prediction_rows(out):
        with (out / 'predictions.csv').open(encoding='utf-8', newline='') as stream:
            return list(csv.DictReader(stream))

    @classmethod
    def predictions(cls, out):
        result = {}
        for row in cls.prediction_rows(out):
            if row['method'] != 'cbf':
                continue
            result.setdefault(row['user_id'], []).append((int(row['rank']), row['ISIN']))
        return {uid: [isin for _, isin in sorted(rows)] for uid, rows in result.items()}

    def assert_custom_equals_cbf(self, out):
        custom, cbf = {}, {}
        for row in self.prediction_rows(out):
            bucket = {'custom': custom, 'cbf': cbf}.get(row['method'])
            if bucket is not None:
                bucket.setdefault(row['user_id'], []).append((int(row['rank']), row['ISIN']))
        self.assertEqual(set(custom), set(cbf))
        for uid in cbf:
            self.assertEqual([i for _, i in sorted(custom[uid])],
                             [i for _, i in sorted(cbf[uid])], uid)

    # --- response protocol errors ------------------------------------------

    def test_missing_response_raises(self):
        users = self.root / 'two_users.txt'
        users.write_text('U1\nU2\n', encoding='utf-8')
        proc, _ = self.cli('export-prompts', '--output-dir', self.root / 'missing_protocol',
                           '--users-file', users)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        digest = json.loads(
            (self.root / 'missing_protocol' / 'protocol.json').read_text())['protocol_hash']
        responses = self.root / 'missing.jsonl'
        responses.write_text(json.dumps({'user_id': 'U1', 'stage': 'ranker',
                                         'protocol_hash': digest,
                                         'ranked_ids': list('ABCDEFGHIJ')}) + '\n',
                             encoding='utf-8')
        proc, _ = self.run_cli('missing', '--users-file', users, '--responses', responses)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('U2', proc.stderr)

    def test_protocol_hash_mismatch_raises(self):
        responses = self.root / 'bad_hash.jsonl'
        with responses.open('w', encoding='utf-8') as stream:
            for uid in ('U1', 'U2'):
                stream.write(json.dumps({'user_id': uid, 'stage': 'ranker',
                                         'protocol_hash': '0' * 64,
                                         'ranked_ids': list('ABCDEFGHIJ')}) + '\n')
        proc, _ = self.run_cli('bad_hash', '--responses', responses)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('protocol_hash', proc.stderr)

    def test_stage_mismatch_raises(self):
        digest = json.loads((self.out / 'protocol.json').read_text())['protocol_hash']
        responses = self.root / 'bad_stage.jsonl'
        with responses.open('w', encoding='utf-8') as stream:
            for uid in ('U1', 'U2'):
                stream.write(json.dumps({'user_id': uid, 'stage': 'ranker',
                                         'protocol_hash': digest,
                                         'ranked_ids': list('ABCDEFGHIJ')}) + '\n')
        proc, _ = self.run_cli('bad_stage', '--stage', 'encoder', '--responses', responses)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('stage', proc.stderr)

    # --- prompts and plugins ------------------------------------------------

    def test_export_prompts_both_stages(self):
        for stage in ('encoder', 'ranker'):
            out = self.root / f'prompts_{stage}'
            proc, _ = self.cli('export-prompts', '--output-dir', out, '--stage', stage)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            prompts = read_jsonl(out / 'prompts.jsonl')
            digest = json.loads((out / 'protocol.json').read_text())['protocol_hash']
            self.assertEqual({p['user_id'] for p in prompts}, {'U1', 'U2'})
            for prompt in prompts:
                self.assertEqual(prompt['stage'], stage)
                self.assertEqual(prompt['protocol_hash'], digest)
                payload = json.loads(prompt['prompt'].split('\n')[-1])
                self.assertNotIn('eligible_asset_ids', payload['current_input'])
                self.assertLessEqual(len(payload['current_input']['history']), 20)

    def test_few_shot_invalid_date_and_collision(self):
        users = self.root / 'one_user.txt'
        users.write_text('U1\n', encoding='utf-8')
        for name, shot in (
                ('late', {'user_id': 'S1', 'available_before': '2021-06-01'}),
                ('collision', {'user_id': 'U1', 'available_before': '2021-01-01'})):
            shots = self.root / f'shots_{name}.json'
            shots.write_text(json.dumps([shot]), encoding='utf-8')
            proc, _ = self.cli('export-prompts', '--output-dir', self.root / f'shots_{name}',
                               '--users-file', users, '--shots-file', shots)
            self.assertNotEqual(proc.returncode, 0, name)
            self.assertIn('Demonstrations', proc.stderr, name)

    def test_plugin_rerank_candidates_come_from_encoder(self):
        plugin = self.root / 'trace_plugin.py'
        plugin.write_text(
            'import json, os\n'
            'def encode(context):\n'
            "    return {os.environ['PLUGIN_ENCODE_ISIN']: 1.0}\n"
            'def rerank(context, candidate_ids):\n'
            "    with open(os.environ['PLUGIN_TRACE'], 'a', encoding='utf-8') as f:\n"
            "        f.write(json.dumps({'user': context['user_id'],\n"
            "                            'candidates': list(candidate_ids)}) + '\\n')\n"
            '    return list(candidate_ids)[:10]\n', encoding='utf-8')
        users = self.root / 'one_user.txt'
        users.write_text('U1\n', encoding='utf-8')
        traces = {}
        for isin in ('A', 'B'):
            trace = self.root / f'trace_{isin}.jsonl'
            env = dict(ENV, PLUGIN_ENCODE_ISIN=isin, PLUGIN_TRACE=str(trace))
            proc, _ = self.run_cli(f'trace_{isin}', '--users-file', users,
                                   '--plugin', plugin, env=env)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            traces[isin] = read_jsonl(trace)[0]['candidates']
        self.assertEqual(traces['A'][:2], ['A', 'C'])
        self.assertEqual(traces['B'][0], 'B')
        self.assertNotEqual(traces['A'], traces['B'])

    def test_plugin_without_hooks_raises(self):
        plugin = self.root / 'empty_plugin.py'
        plugin.write_text('VALUE = 1\n', encoding='utf-8')
        proc, _ = self.run_cli('empty_plugin', '--plugin', plugin)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('encode(context) or rerank', proc.stderr)

    # --- determinism and portability ---------------------------------------

    def test_two_cli_runs_byte_identical(self):
        names = ('protocol.json', 'contexts.jsonl', 'predictions.csv', 'per_user.csv',
                 'metrics.json')
        first = {name: hashlib.sha256((self.out / name).read_bytes()).hexdigest()
                 for name in names}
        proc, _ = self.run_cli('again')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        second = {name: hashlib.sha256((self.root / 'again' / name).read_bytes()).hexdigest()
                  for name in names}
        self.assertEqual(first, second)

    def test_portable_cli_outside_workspace(self):
        proc, metrics = self.cli('run', '--output-dir', self.root / 'portable', isolated=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(set(metrics['methods']),
                         {'cbf', 'popularity', 'latest_buy', 'latest_buy_or_sell'})
        self.assertEqual(metrics['methods']['cbf']['users'], 2)
        self.assertTrue((self.root / 'portable' / 'metrics.json').exists())

    def test_aggregate_labels_match_run(self):
        methods = self.metrics['methods']
        for method in methods.values():
            self.assertEqual(method['users'],
                             method['nonempty_truth_users'] + method['empty_truth_users'])
        cbf = methods['cbf']
        self.assertEqual(cbf['users'], 2)
        self.assertEqual(cbf['nonempty_truth_users'], 1)
        self.assertEqual(cbf['empty_truth_users'], 1)
        # Empty-truth users contribute 0 to the macro mean, so the two means
        # differ by exactly the empty-user share.
        assert_close(self, cbf['ndcg_at_10'] * cbf['users'],
                     cbf['ndcg_at_10_nonempty'] * cbf['nonempty_truth_users'])

    def test_console_summary_rounds_only_the_display(self):
        proc, metrics = self.cli('run', '--output-dir', self.root / 'console')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        stdout = proc.stdout
        self.assertIn('Run summary', stdout)
        self.assertIn('rounded to 4 decimals', stdout)
        for method, row in metrics['methods'].items():
            self.assertIn(method, stdout)
            self.assertIn(f"{row['ndcg_at_10']:.4f}", stdout)
            self.assertIn(f"{row['ndcg_at_10_nonempty']:.4f}", stdout)
            # The full-precision value stays in metrics.json, not on the console.
            for value in (row['ndcg_at_10'], row['ndcg_at_10_nonempty']):
                if value is not None and len(str(value)) > 6:
                    self.assertNotIn(str(value), stdout)
        # The console shows a short hash prefix, never the whole 64-char digest.
        digest = metrics['protocol_hash']
        self.assertEqual(len(digest), 64)
        self.assertIn(digest[:12], stdout)
        self.assertNotIn(digest, stdout)
        written = json.loads((self.root / 'console' / 'metrics.json').read_text(encoding='utf-8'))
        self.assertEqual(written['protocol_hash'], digest)
        self.assertEqual(written['methods'], metrics['methods'])


if __name__ == '__main__':
    unittest.main()
