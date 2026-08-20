> **AI;DR** — This post was written with AI assistance from my own local model, then edited by me. The setup, tests, and numbers are all real.

TLDR; I run a coding assistant entirely on my own hardware — a single RTX 3090 Ti with 24GB of VRAM, serving a 27B model to OpenCode over the LAN. No API bills, no data leaving the house. This post is about the two things that actually bit me: the quantization *type* silently corrupting output, and a single missing sampler flag causing repetition loops. Both had non-obvious fixes.

I have written before about keeping things local — the [Rust proxy](/building-custom-http-proxy-rust-mixed-os-workflows/), the self-hosted everything. Local LLMs are the same instinct. If the model runs on my desk, I control it, and I can leave it running.

## How I Got Here

I did not land on the current setup on day one. It took a couple of months of swapping models and tuning knobs, and most of the interesting lessons came from the dead ends.

I started with a Claude-distilled reasoning model — a Qwen3.6-35B-A3B distilled from Claude 4.7 Opus. It was fine, but it refused things a coding assistant should not refuse, so I moved to an [uncensored variant](https://huggingface.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive), and then to a cleaner Wasserstein-abliterated build, which is still my fast fallback at ~174 tok/s.

The turning point was understanding **MoE versus dense**. Those 35B-A3B models are Mixture-of-Experts: 35B total parameters but only ~3B active per token, so they are fast. I tested a true dense 27B alongside them. The dense model was measurably smarter on benchmarks — but about **3.5x slower** because it activates roughly nine times more parameters per token. For an interactive coding agent, speed is a feature, so the fast model usually wins. The exception is when accuracy really matters, and that is where I landed on a dense 27B coder fine-tune ([Jackrong's Qwopus](https://huggingface.co/Jackrong/Qwopus3.6-27B-Coder-MTP-GGUF), and later a Qwen3.8 build) as the daily driver, keeping the fast MoE around for when I want throughput.

Two rabbit holes were worth the time:

- **Should I switch off llama.cpp to [vLLM](https://docs.vllm.ai/)?** vLLM has better speculative decoding and concurrency. But on my RTX 3090 Ti — an Ampere card — the FP8 weight path that makes long context cheap is [not supported](https://docs.vllm.ai/en/latest/features/quantization/) (it needs Ada or Hopper). Switching would have crushed my context window from 200K down to ~32-64K. Not worth it. Long context matters more to me than raw latency on this hardware, so I stayed on llama.cpp.
- **Speculative decoding (MTP).** This is the trick that gets me ~70 tok/s on a dense 27B. The model drafts several tokens ahead and the main pass verifies them in one shot. It was fiddly to get working — most Qwen GGUFs ship their MTP heads for vLLM only, not llama.cpp — so finding a build with a working `mtp-*.gguf` sibling was half the battle.

I also spent an afternoon overclocking the VRAM (+1500 MHz via [LACT](https://github.com/ilya-zlobintsev/LACT), the Wayland-friendly NVIDIA tool) and measured a whole ~2% speedup. That tiny number was actually useful data: it proved this workload is not purely memory-bandwidth bound, so there was no point chasing more.

If there is one meta-lesson from all of that: measure on your own box. Nearly every "best model" or "best setting" claim I read turned out to be conditional on hardware I do not have.

## The Setup

The rig is a Pop!_OS box with an RTX 3090 Ti (24GB, Ampere). It runs [llama.cpp](https://github.com/ggml-org/llama.cpp) as a systemd service, exposing an OpenAI-compatible API on port 8080. My editor (OpenCode) points a provider at `http://<box>:8080/v1` and never knows the difference.

The model is a 27B Qwen3.8 coder variant, quantized to `Q4_K_M` (about 16GB on disk). That leaves just enough VRAM for a 200K token context window with a q4_0 KV cache and MTP speculative decoding turned on. It runs around 70 tokens/second. On a coding agent that fires a lot of tool calls, that is plenty.

Here is the actual command, pulled straight from the systemd unit that runs it:

```sh
llama-server \
  -m ~/models/qwen3.8-27b-jackrong/Qwen3.8-27B-MTP-Q4_K_M.gguf \
  -c 200000 \
  --parallel 1 \
  -ngl 99 \
  --cache-type-k q4_0 \
  --cache-type-v q4_0 \
  --flash-attn on \
  --no-context-shift \
  --cache-ram 32768 \
  --ctx-checkpoints 8 \
  --jinja \
  --spec-type draft-mtp \
  --spec-draft-n-max 4 \
  --reasoning off \
  --temperature 0.7 \
  --top-p 0.8 \
  --top-k 20 \
  --min-p 0 \
  --presence-penalty 1.0 \
  --alias Qwen3.8-27B \
  --host 0.0.0.0 \
  --port 8080
```

Every one of those flags is doing something specific:

- **`-m`** — path to the GGUF model file on disk (Jackrong's `Q4_K_M` quant, ~16GB).
- **`-c 200000`** — the context window, in tokens. This is the ceiling for prompt + tool output + reply combined, and it is the number everything else below is tuned around, to make it fit in 24GB of VRAM.
- **`--parallel 1`** — one request slot, not the default of several. I'm the only client (OpenCode, over the LAN), so reserving KV cache for concurrent requests I'll never make would just waste VRAM I need for context.
- **`-ngl 99`** — the one that matters most. It offloads every layer to the GPU ("number of GPU layers"). Get this wrong and llama.cpp falls back to CPU for the rest — the difference between ~170 tok/s and ~2 tok/s.
- **`--cache-type-k q4_0` / `--cache-type-v q4_0`** — quantizes the KV cache itself, not just the model weights, down to 4-bit. This is the flag that actually makes a 200K context window possible at all; at full-precision KV it would run out of VRAM long before 200K.
- **`--flash-attn on`** — the fused flash-attention kernel instead of the naive implementation. Faster, lower memory, no downside on Ampere.
- **`--no-context-shift`** — turns off llama.cpp's default behavior of silently sliding old tokens out of the context window once you hit the limit. For a coding agent that depends on everything it has read and decided so far, I want a hard error at 200K, not a session that quietly forgets its first half.
- **`--cache-ram 32768` / `--ctx-checkpoints 8`** — these two work together. llama.cpp can checkpoint prompt-cache state to host RAM so a long agentic session doesn't have to re-process the entire prompt on every turn. `--cache-ram` caps that at 32GB of RAM; `--ctx-checkpoints 8` is how many checkpoint slots it keeps around.
- **`--jinja`** — use the chat template baked into the GGUF's metadata (a real Jinja2 template) instead of a hardcoded one. Needed for tool-calling to format correctly.
- **`--spec-type draft-mtp` / `--spec-draft-n-max 4`** — turns on speculative decoding using the model's own Multi-Token Prediction head as the draft model, drafting up to 4 tokens ahead per step. This is what gets a dense 27B to ~70 tok/s instead of ~20-25.
- **`--reasoning off`** — Qwen3.8 defaults to an aggressive "xhigh" thinking mode that burns tokens overthinking simple requests. A coding agent just needs the answer.
- **`--temperature 0.7 --top-p 0.8 --top-k 20 --min-p 0`** — the sampler settings straight from Qwen's own model card for non-thinking/instruct mode.
- **`--presence-penalty 1.0`** — the repetition fix from the next section. Penalizes tokens that have already shown up, so long sessions can't loop forever.
- **`--alias Qwen3.8-27B`** — the model name the OpenAI-compatible `/v1/models` endpoint reports, so OpenCode's model picker shows something readable instead of the raw GGUF filename.
- **`--host 0.0.0.0 --port 8080`** — bind every interface, not just localhost, so other machines on the LAN (my editor) can reach it.

## The Quant Type Quietly Broke Things

When [Unsloth](https://unsloth.ai/docs/basics/dynamic-3.0-ggufs) shipped their Dynamic 3.0 quants for Qwen3.8, the pitch was great: more accuracy at the same file size. So I downloaded their `IQ4_XS` build and tested it.

It produced garbage. Not random garbage — subtle garbage. My username came out as `spencerkittlesson` (extra 's'). Paths came back with a Cyrillic `е` swapped in for the Latin `e`. `MindTouch` became `MMindTouch`. The kind of corruption you would miss on a quick glance and then spend an hour debugging in a generated script.

The isolation test told the story: run it CPU-only (`-ngl 0`) and it was perfect. Run any part of it on the GPU and it corrupted. That pointed straight at a CUDA kernel bug for that model's linear-attention layers on Ampere cards — not something I could fix.

Here is the part that took a second round to figure out: **it was the quant *type*, not the build.** `IQ4_XS` is an "i-quant." When I tested a `Q4_K_M` "k-quant" of the same model, on the same GPU, it ran completely clean. Same 27B model, same 4-bit target, wildly different result — because the i-quant path hit the broken kernel and the k-quant path did not.

The lesson: on an Ampere GPU, stick to **k-quants** (`Q4_K_M`, `Q5_K_M`, and friends). The i-quants (`IQ*`) squeeze into less VRAM, which is tempting, but they lean on kernels that are not always solid. I verify every new model with a dumb little test now — ask it to echo an exact path ten times and check the characters are right before I trust it with real work.

## One Flag Fixed My Looping Problem

The other issue was repetition. In long agentic sessions the model would occasionally get stuck repeating itself. Short prompts were fine; long ones would eventually self-reinforce a pattern with nothing to break it.

When I checked the live server config, the cause was plain: I had no repetition control turned on at all. No presence penalty, no DRY sampler. With zero guard, short generations rarely hit a repeating loop, but a long session would find one and never climb out.

Unsloth's model card recommends a `presence_penalty` of 1.5 for this model in non-thinking mode. Before changing my daily driver, I tested it — five loop-prone prompt types (long enumerations, repetitive code, the classic "continue this list" trap) at 1200 tokens each, across `presence_penalty` values of 0.6, 1.0, and 1.5.

The results were clear enough to act on:

- **0.6** — 4 of 5 clean. Only the nastiest "keep going without restarting" prompt degraded.
- **1.0** — 5 of 5 clean, balanced, no side effects.
- **1.5** — also 5 of 5, but it started stopping early and wandering off-format on structured tasks.

Speed was identical across all three, so there was no performance cost either way. I landed on **1.0**, not the recommended 1.5 — it fixed the failure without the format-drift. One flag:

```sh
--presence-penalty 1.0
```

Unsloth's number was a good starting point, but the right value for my workload was milder. Test it against the thing you actually do, not the thing the docs assume you do.

## Would I Do It Again?

Yes. Once it is dialed in, a local coding model is genuinely useful and costs nothing per token. But it is not plug-and-play. The two things that cost me the most time were not "which model is best" — they were the quant type interacting badly with my specific GPU, and a sampler default I never set.

Both are the kind of thing you only find by testing on your own hardware with your own prompts. Which, honestly, is half the fun.