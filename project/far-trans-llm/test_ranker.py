"""CPU-only contract tests with fake generators; these are not model experiments."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import ranker


IDS = [f'0000000000{i:02d}' for i in range(12)]


def fixture():
    assets = {i: {'assetName': 'Passive asset text', 'timestamp': '2021-01-01',
                  'sector': 'unknown'} for i in IDS}
    context = {'user_id': 'u', 'cutoff': '2021-06-01',
               'candidate_assets': [{'id': i} for i in IDS],
               'eligible_asset_ids': IDS + ['DO_NOT_LEAK_ELIGIBLE'],
               'profile': {'timestamp': '2021-01-01',
                           'riskLevel': {'value': 'Predicted_Low', 'status': 'estimated'}}}
    return assets, context


class FakeGenerator:
    metadata = {'backend': 'fake_test_not_model', 'new_calls': 0}

    def __init__(self, response):
        self.response = response
        self.prompts = []

    def generate(self, prompt, max_new_tokens):
        self.prompts.append(prompt)
        return {'text': self.response, 'input_tokens': 1, 'output_tokens': 1, 'seconds': 0}


class FakeStarter:
    @staticmethod
    def validate_ranking(ranking, allowed):
        if len(ranking) != 10 or len(set(ranking)) != 10 or not set(ranking) <= set(allowed):
            raise ValueError('invalid ranking')


class PromptTests(unittest.TestCase):
    def setUp(self):
        self.assets, self.context = fixture()

    def payload(self, events=(), **kwargs):
        return ranker.prompt_payload(self.context, self.assets, {IDS[0]: 3}, events, **kwargs)

    def test_chronology_and_most_recent(self):
        events = [('2021-05-20', IDS[1], 'Buy'), ('2021-01-01', IDS[0], 'Buy'),
                  ('2021-05-20', IDS[0], 'Buy')]
        p = self.payload(events)
        self.assertEqual([e['ISIN'] for e in p['recent_buy_events_oldest_to_newest']],
                         [IDS[0], IDS[0], IDS[1]])
        self.assertEqual(p['most_recent_buy'], {'date': '2021-05-20', 'ISIN': IDS[1]})
        self.assertIn('intraday order is unknown', p['chronology_note'])

    def test_recent_15_retains_repeated_events(self):
        events = [(f'2021-05-{i:02}', IDS[0], 'Buy') for i in range(1, 21)]
        p = self.payload(list(reversed(events)))
        self.assertEqual(len(p['recent_buy_events_oldest_to_newest']), 15)
        self.assertEqual(p['recent_buy_events_oldest_to_newest'][0]['date'], '2021-05-06')
        self.assertEqual(p['buy_history_counts'][0]['buy_count'], 3)

    def test_future_and_sell_excluded(self):
        p = self.payload([('2021-06-01', IDS[0], 'Buy'), ('2021-07-01', IDS[1], 'Buy'),
                          ('2021-05-31', IDS[2], 'Sell')])
        self.assertEqual(p['recent_buy_events_oldest_to_newest'], [])
        self.assertEqual(p['most_recent_buy'], 'unknown')

    def test_shuffle_membership_and_determinism(self):
        original = self.payload()['candidate_assets']
        a = self.payload(shuffle_seed=42)['candidate_assets']
        b = self.payload(shuffle_seed=42)['candidate_assets']
        self.assertEqual(a, b)
        self.assertEqual({r['ISIN'] for r in a}, {r['ISIN'] for r in original})
        self.assertNotEqual(a, original)
        self.assertEqual(ranker.candidate_ids(self.context), IDS)

    def test_prompt_only_selected_facts_and_original_string_ids(self):
        self.context.update(truth='SECRET_TRUTH', extraneous='SECRET_CONTEXT')
        before = copy.deepcopy(self.context)
        prompt = ranker.build_prompt(self.context, self.assets, {}, ())
        self.assertNotIn('SECRET', prompt)
        self.assertNotIn('DO_NOT_LEAK_ELIGIBLE', prompt)
        self.assertIn(json.dumps(IDS[0]), prompt)
        self.assertNotIn('A001', prompt)
        self.assertIn('estimated', prompt)
        self.assertIn('unknown', prompt)
        self.assertEqual(self.context, before)

    def test_future_metadata_profile_hidden(self):
        self.assets[IDS[0]].update(timestamp='2021-06-01', assetName='FUTURE_ASSET')
        self.context['profile'].update(timestamp='2021-06-02', riskLevel='FUTURE_PROFILE')
        p = self.payload()
        self.assertNotIn('FUTURE', json.dumps(p))
        self.assertEqual(p['candidate_assets'][0]['assetName'], 'unknown')

    def test_invalid_history_limit(self):
        with self.assertRaises(ValueError):
            self.payload(history_events=0)

    def test_candidates_require_unique_strings_eligible(self):
        for bad in ([IDS[0]] * 12, list(range(12)), IDS[:9], IDS[:11] + ['OUTSIDE']):
            with self.subTest(bad=bad):
                self.context['candidate_assets'] = [{'id': i} for i in bad]
                with self.assertRaises(ValueError):
                    ranker.candidate_ids(self.context)


class ParsingTests(unittest.TestCase):
    def test_native(self):
        self.assertEqual(ranker.parse_ranking(json.dumps(IDS[:10]), set(IDS)), (IDS[:10], False))

    def test_fence_repair(self):
        self.assertEqual(ranker.parse_ranking('```json\n' + json.dumps(IDS[:10]) + '\n```', set(IDS)),
                         (IDS[:10], True))

    def test_array_extraction_repair(self):
        self.assertEqual(ranker.parse_ranking('Answer: ' + json.dumps(IDS[:10]) + ' done', set(IDS)),
                         (IDS[:10], True))

    def test_invalid_outputs(self):
        bad = ['not json', '["broken",]', json.dumps(IDS[:9]), json.dumps([IDS[0]] * 10),
               json.dumps(IDS[:9] + ['OUTSIDE']), json.dumps(list(range(10))),
               json.dumps({'ranking': IDS[:10]}), json.dumps(IDS[:9] + [True]),
               json.dumps(IDS[:9] + [None]), json.dumps(IDS[:11])]
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                ranker.parse_ranking(raw, set(IDS))


class ExecutionTests(unittest.TestCase):
    def bundle(self):
        assets, context = fixture()
        contexts = {'u': context, 'v': dict(context, user_id='v')}
        baseline = {uid: {name: IDS[:10] for name in
                         ('popularity', 'cbf', 'latest_buy', 'latest_buy_or_sell')}
                    for uid in contexts}
        return (FakeStarter(), assets, {'u': {IDS[0]: 2}}, {'u': {'SECRET_TRUTH'}},
                contexts, baseline, {}, {}, {'users': ['u', 'v']})

    def args(self, directory, **kwargs):
        return SimpleNamespace(output_dir=Path(directory), history_events=15,
                               shuffle_seed=42, prepare_only=kwargs.get('prepare_only', False),
                               on_invalid=kwargs.get('on_invalid', 'error'))

    def test_fake_success_coverage_baselines_no_mutation(self):
        bundle = self.bundle()
        before = copy.deepcopy(bundle[1:])
        fake = FakeGenerator(json.dumps(list(reversed(IDS[:10]))))
        with tempfile.TemporaryDirectory() as directory, patch.object(ranker.data_adapter, 'save_results') as save:
            ranker.run(self.args(directory), bundle, fake)
            predictions = save.call_args.args[2]
            self.assertEqual(set(predictions), {'u', 'v'})
            self.assertEqual(predictions['u']['candidate_order_first10'], IDS[:10])
            self.assertEqual(predictions['u']['llmrank'], list(reversed(IDS[:10])))
            self.assertEqual(len(fake.prompts), 2)
            self.assertNotIn('SECRET_TRUTH', ''.join(fake.prompts))
            self.assertEqual(len(bundle[5]['u']), 4)
            history_path = Path(directory) / 'ranker_responses.jsonl'
            original = history_path.read_bytes()
            # A second pass replays the same two fixture users without truncating
            # the first pass; only the completed current pass is canonical.
            metadata = ranker.run(self.args(directory), bundle, FakeGenerator(json.dumps(IDS[:10])))
            final = [json.loads(line) for line in
                     (Path(directory) / 'final_responses.jsonl').read_text().splitlines()]
            self.assertEqual([record['user_id'] for record in final], ['u', 'v'])
            self.assertEqual([record['raw_response'] for record in final], [json.dumps(IDS[:10])] * 2)
            self.assertTrue(history_path.read_bytes().startswith(original))
            self.assertEqual(len(original.splitlines()), 2)
            self.assertEqual(len(history_path.read_bytes().splitlines()), 4)
            self.assertEqual(metadata['response_log'], 'final_responses.jsonl')
            self.assertEqual(metadata['history_log'], 'ranker_responses.jsonl')
        self.assertEqual(bundle[1:], before)

    def test_invalid_errors_once_and_logs(self):
        fake = FakeGenerator('invalid')
        with tempfile.TemporaryDirectory() as directory, patch.object(ranker.data_adapter, 'save_results') as save:
            with self.assertRaises(ValueError):
                ranker.run(self.args(directory), self.bundle(), fake)
            self.assertEqual(len(fake.prompts), 1)
            save.assert_not_called()
            record = json.loads((Path(directory) / 'ranker_responses.jsonl').read_text())
            self.assertEqual(record['raw_response'], 'invalid')
            self.assertEqual(record['raw_invalid_count'], 1)
            self.assertFalse(record['fallback'])

    def test_fallback_retains_all_users_original_order(self):
        fake = FakeGenerator(json.dumps(IDS[:9]))
        with tempfile.TemporaryDirectory() as directory, patch.object(ranker.data_adapter, 'save_results') as save:
            metadata = ranker.run(self.args(directory, on_invalid='fallback'), self.bundle(), fake)
            self.assertEqual(metadata['raw_invalid_count'], 2)
            self.assertEqual(metadata['parse_repair_count'], 0)
            self.assertEqual(len(fake.prompts), 2)
            for predictions in save.call_args.args[2].values():
                self.assertEqual(predictions['llmrank'], IDS[:10])
            self.assertEqual(len(save.call_args.args[3]), 2)

    def test_repaired_outputs_reported(self):
        fake = FakeGenerator('```json\n' + json.dumps(IDS[:10]) + '\n```')
        with tempfile.TemporaryDirectory() as directory, patch.object(ranker.data_adapter, 'save_results'):
            metadata = ranker.run(self.args(directory), self.bundle(), fake)
            self.assertEqual(metadata['parse_repair_count'], 2)
            self.assertEqual(metadata['raw_invalid_count'], 0)

    def test_prepare_only_no_generator_or_measured_results(self):
        fake = FakeGenerator('should not be used')
        with tempfile.TemporaryDirectory() as directory, patch.object(ranker.data_adapter, 'save_results') as save:
            result = ranker.run(self.args(directory, prepare_only=True), self.bundle(), fake)
            self.assertEqual(fake.prompts, [])
            save.assert_not_called()
            self.assertEqual(result['stage'], 'prepare_only_no_inference')
            self.assertEqual([p.name for p in Path(directory).iterdir()], ['ranker_prompts.jsonl'])
            self.assertEqual(len((Path(directory) / 'ranker_prompts.jsonl').read_text().splitlines()), 2)

    def test_help_without_torch_import(self):
        script = "import runpy,sys; sys.modules['torch']=None; sys.argv=['ranker.py','--help']; runpy.run_path('ranker.py',run_name='__main__')"
        result = subprocess.run([sys.executable, '-c', script], cwd=Path(__file__).parent,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--prepare-only', result.stdout)
        self.assertIn('--history-events', result.stdout)


if __name__ == '__main__':
    unittest.main()
