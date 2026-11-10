"""Student extension seam. This identity encoder is NOT an LLM experiment.

Replace encode(context), or remove it and define rerank(context, candidate_ids).
Keep this module free of access to future purchases or evaluation artifacts.
"""


def encode(context):
    """Return nonnegative weights for observed historical asset IDs."""
    return {asset['id']: asset['buy_count'] for asset in context['history']}


# A ranker-only extension instead defines:
# def rerank(context, candidate_ids):
#     return ten_unique_candidate_ids_in_your_chosen_order
