"""Share the teaching starter's data policy without passing truth to models."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path


def arguments(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument('--starter-dir', type=Path,
                        default=Path(__file__).resolve().parent.parent / 'far-trans')
    parser.add_argument('--data-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--cutoff', default='2021-06-01')
    parser.add_argument('--horizon-days', type=int, default=30)
    parser.add_argument('--max-users', type=int, default=100)
    parser.add_argument('--candidate-count', type=int, default=50)
    parser.add_argument('--model', required=True, help='Local model directory or cached HF model ID')
    parser.add_argument('--revision', help='Pinned Hugging Face revision; use with a model ID')
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    parser.add_argument('--allow-download', action='store_true')
    parser.add_argument('--on-invalid', choices=['error', 'fallback'], default='error')
    return parser


def load(args):
    if args.max_users < 1 or args.horizon_days < 1 or args.candidate_count < 10:
        raise ValueError('Require max-users > 0, horizon-days > 0 and candidate-count >= 10')
    path = args.starter_dir / 'starter.py'
    spec = importlib.util.spec_from_file_location('provided_far_trans_starter', path)
    starter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(starter)
    assets, profiles, history, truth, end, excluded = starter.load_data(
        args.data_dir, args.cutoff, args.horizon_days)
    users = starter.select_users(profiles, history, 'warm', args.max_users, None)
    features = {isin: starter.tokens(asset) for isin, asset in assets.items()}
    pop = starter.popularity_scores(history, assets)
    contexts, baseline = starter.contexts_for(users, assets, profiles, history, features,
                                             pop, args.cutoff, args.candidate_count, False)
    events = starter.scan_recent_events(args.data_dir, args.cutoff, assets)
    recent = starter.recency_rankings(contexts, pop, events, k=10)
    for uid in users:
        baseline[uid].update(recent[uid])
    manifest = {
        'teaching_settings_not_official_test': True,
        'cutoff': args.cutoff, 'end_exclusive': end, 'users': users,
        'repeat_allowed': True, 'candidate_count': args.candidate_count,
        'empty_truth_policy': 'zero in all-user mean; nonempty mean also reported',
        'excluded_rows': excluded,
        'data_sha256': {name: hashlib.sha256((args.data_dir / name).read_bytes()).hexdigest()
                        for name in ('transactions.csv', 'asset_information.csv',
                                     'customer_information.csv', 'close_prices.csv')},
    }
    return starter, assets, history, truth, contexts, baseline, events, pop, manifest


def save_results(args, bundle, predictions, failures, method, runtime_metadata):
    import csv
    starter, assets, history, truth, contexts, baseline, events, pop, manifest = bundle
    records = []
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with (args.output_dir / 'predictions.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow(['method', 'user_id', 'rank', 'ISIN'])
        for uid in manifest['users']:
            combined = dict(baseline[uid])
            combined.update(predictions[uid])
            for name, ranking in combined.items():
                starter.validate_ranking(ranking, contexts[uid]['eligible_asset_ids'])
                relevant = truth.get(uid, set()) & set(contexts[uid]['eligible_asset_ids'])
                records.append({'user_id': uid, 'method': name,
                                'relevant_count': len(relevant),
                                'ndcg_at_10': starter.ndcg10(ranking, relevant)})
                writer.writerows((name, uid, rank, isin)
                                 for rank, isin in enumerate(ranking, 1))
    names = sorted({r['method'] for r in records})
    metrics = {name: starter.aggregate([r for r in records if r['method'] == name])
               for name in names}
    for name, data in (('metrics.json', metrics), ('per_user.json', records),
                       ('run_manifest.json', dict(manifest, method=method,
                                                 runtime=runtime_metadata,
                                                 failures=failures))):
        (args.output_dir / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                                            encoding='utf-8')
    for name, metric in metrics.items():
        value = metric['ndcg_at_10']
        print(f'{name}: nDCG@10={value:.4f}' if value is not None else f'{name}: no users')
