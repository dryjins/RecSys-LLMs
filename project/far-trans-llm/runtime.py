"""Optional, local-only Transformers inference with immutable generation logs."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path


class LocalGenerator:
    def __init__(self, model, revision=None, device='auto', allow_download=False):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        torch.set_num_threads(4)
        self.torch = torch
        self.model_id = model
        self.revision = revision
        self.device = ('cuda' if torch.cuda.is_available() else 'cpu') if device == 'auto' else device
        if self.device == 'cuda' and not torch.cuda.is_available():
            raise ValueError('CUDA requested but unavailable')
        kwargs = {'local_files_only': not allow_download, 'trust_remote_code': False}
        if revision:
            kwargs['revision'] = revision
        self.tokenizer = AutoTokenizer.from_pretrained(model, **kwargs)
        dtype = torch.bfloat16 if self.device == 'cuda' else torch.float32
        self.model = AutoModelForCausalLM.from_pretrained(model, torch_dtype=dtype, **kwargs)
        self.model.to(self.device).eval()
        import transformers
        self.metadata = {'model': model, 'requested_revision': revision,
                         'resolved_revision': getattr(self.model.config, '_commit_hash', None),
                         'device': self.device, 'dtype': str(dtype),
                         'torch_version': torch.__version__,
                         'transformers_version': transformers.__version__,
                         'tokenizer_class': type(self.tokenizer).__name__,
                         'do_sample': False, 'thinking': False,
                         'context_limit': 8192}

    def generate(self, prompt, max_new_tokens=160):
        messages = [{'role': 'user', 'content': prompt}]
        text = self.tokenizer.apply_chat_template(messages, tokenize=False,
                                                  add_generation_prompt=True,
                                                  enable_thinking=False)
        inputs = self.tokenizer(text, return_tensors='pt').to(self.device)
        n = inputs['input_ids'].shape[1]
        if n + max_new_tokens > 8192:
            raise ValueError('Prompt exceeds the fixed context budget; reduce candidate/history count')
        if self.device == 'cuda':
            self.torch.cuda.synchronize()
        started = time.perf_counter()
        with self.torch.inference_mode():
            outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens,
                                          do_sample=False,
                                          pad_token_id=self.tokenizer.eos_token_id)
        if self.device == 'cuda':
            self.torch.cuda.synchronize()
        tokens = outputs[0, n:]
        return {'text': self.tokenizer.decode(tokens, skip_special_tokens=True),
                'input_tokens': n, 'output_tokens': len(tokens),
                'seconds': time.perf_counter() - started}


class LoggedGenerator:
    def __init__(self, backend, output_dir):
        self.backend = backend
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log = self.output_dir / 'generations.jsonl'
        self.cache = self.output_dir / 'generation_cache'
        self.cache.mkdir(exist_ok=True)
        self.hits = 0
        self.calls = 0

    @property
    def metadata(self):
        return dict(self.backend.metadata, cache_hits=self.hits, new_calls=self.calls)

    def generate(self, prompt, max_new_tokens=160):
        descriptor = {'prompt': prompt, 'settings': self.backend.metadata,
                      'max_new_tokens': max_new_tokens}
        key = hashlib.sha256(json.dumps(descriptor, sort_keys=True).encode()).hexdigest()
        target = self.cache / (key + '.json')
        if target.exists():
            result = json.loads(target.read_text())
            hit = True
            self.hits += 1
        else:
            result = self.backend.generate(prompt, max_new_tokens)
            target.write_text(json.dumps(result, ensure_ascii=False) + '\n', encoding='utf-8')
            hit = False
            self.calls += 1
        record = dict(descriptor, response=result, cache_hit=hit, cache_key=key)
        with self.log.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + '\n')
        return result
