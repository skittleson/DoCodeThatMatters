---
title: "Making Inkling 2 Mini faster with a draft model"
keywords:
  - AI;DR
  - speculative decoding
  - dspark
  - inkling 2 mini
  - llama.cpp
  - local llm
  - homelab
date: 2026-11-21
modified: 2026-11-21
description: Inkling 2 Mini ships with an official draft model, DSpark, that vLLM uses for speculative decoding from day 0. My llama.cpp server did not have it, so I ported it. How the speedup works, why it is free, the bugs found on the way, the GPU numbers (56 to 65 t/s on code, 89 on tool calls), and what it buys an agent stack once you also cut the prompt queue and the reasoning overhead.
draft: true
---

> **AI;DR** — This post was written with AI assistance, then edited by me. The logs, numbers, and commands are from my own box.

Inkling 2 Mini arrived on November 20 with something most new models don't: an official draft model from Thinking Machines, called DSpark. [vLLM supports it day-0](https://vllm.ai/blog/2026-11-20-inkling2-mini) with `num_speculative_tokens: 7`. My Inkling server runs llama.cpp on the homelab box, and llama.cpp had no Inkling draft path. So I ported one.

Here's where the speed comes from, and what it took.

## The speedup is free

Speculative decoding never changes your output. A small draft model proposes the next few tokens, and the real target model verifies all of them in one forward pass. Every accepted token costs nothing extra. The target still decides everything.

Same prompt at temperature 0, output identical with and without the draft. If a draft ever changes a single token, that's a bug, not a tradeoff.

So the only question is accept rate. A 7-token block where the target accepts most proposals means most decode steps produce several tokens for the price of one. That's why "lossless or it's broken" is the first gate, before any speed number gets said out loud.

## The draft model sees inside the target

DSpark isn't a generic small model. It's 3 layers, 636MB, and it reads the target's hidden states at four points during the target's forward pass. Once in the prelude. Once in each of the loop core's second and third passes. Once at the final output. Inkling 2 Mini is a looped model, so those taps are specific layer visits, not just "the last hidden state."

That's what the port needs. The target exports those four streams. A converter turns the official weights into a GGUF. A draft graph consumes them the way the reference forward does.

## The bugs, found the cheap way

The converter ran, the tensors loaded, and the first real number came back: **2.3% accept**. Lossless, and useless.

Before that, the loader and compiler had already caught a batch of cheap bugs that reading would never have settled:

- A norm tensor classified as a repeating layer weight needed an explicit layer number, or the loader asserted.
- The fuse math scaled bf16 device buffers with an f32 constant. One `ggml_cast`, but only the runtime would say so.
- The draft sampled token 200301, past the target's real vocab of 200058. The GGUF carries a padded vocab of 201024. Draft logits get masked now.

Then the bisection. One variable at a time, number posted before the next experiment:

| Experiment | First-token accept | Drafts |
|---|---|---|
| Baseline, full 7-token block | 2.3% (all positions) | 4/171 |
| Tap 48 fed by the per-token final-norm stream | 3.6% (all positions) | kept |
| Fuse transpose (wrong) | 2.98% | rejected, reverted |
| First token only (`--spec-draft-n-max 1`) | 15.5% | 34/220 |
| Anchor-only embedding norm | **31.6%** | 61/193 |

Averaging all seven positions buried the signal. Positions 2-7 depend on a markov head the port doesn't have yet, so of course they scored near zero. Isolated, the first draft token accepted 15.5% of the time. Then the vLLM diff found the real bug, and it more than doubled the metric.

Two more findings. One experiment rebuilt with context injection disabled, and the server segfaulted. Crash as proof: the injected KV rows are required and read. And the decisive reference came from fetching vLLM's own DSpark source from GitHub and diffing op-by-op. Most ops already matched. One didn't: vLLM normalizes only the anchor row of the embedding block; my graph normalized the whole concat. The reference also shows the first draft token is sampled from slot 1, a mask row, so that fix hits the first-token metric directly. 31.6% is past the bar where "the plumbing works" stops being a hope and starts being a measurement.

## What it took to keep a 14-hour session on the rails

The port ran as one long agent session with SSH to the box. The interesting failure mode wasn't capability, it was drift. Around hour fourteen it had 225 lines, no draft file, nothing built, and ten turns of "now checking X." Reading feels like progress to an agent and is usually the opposite.

Five rules kept it moving, and I'd reuse all of them:

1. **Name the cheapest failure and force it first.** A converter that has never been run is unverified.
2. **When reading beats compiling, stop reading.** Write the best guess with a `// TODO verify` comment and let the compiler answer. Every bug above cost one build to find.
3. **Isolate the signal.** A number averaged over seven positions where six are known-bad measures nothing. Split the metric before you trust or despair at it.
4. **Guardrails for shared infrastructure.** The test server and production are the same binary with the same process name on the same box. Kill by PID file, never by name. `pkill llama-server` also kills the model serving the session doing the killing.
5. **Put a watchdog on it, because drift comes back.** A separate session watched the worker on a timer: no new commit and no rebuild by the deadline, send the "write the code now" message. Drift returned twice, including once after a written goal. Both times the worker wrote, built, and committed the markov head within ten minutes of the push. The capability was always there.

## The speed, measured

Time to put a real GPU on it. Baseline with no draft at production settings (two slots, 204.8K context each): 60.6 t/s on a coding prompt at temperature 0, 57.2 at temperature 1.0.

The draft didn't fit at first. DSpark runs attention without flash attention, so its working memory grows with context size times batch size. At the default batch it wanted 1.3 GB with about 1.1 GB free. Capping the draft's batch at 16 shrank the buffer about 4x, and the shipping config still traded context for speed: slots went from 204.8K down to 131K.

The numbers on the live server: about 65 t/s on a coding request and 89 t/s on a tool call, against roughly 56 without the draft. Two guesses per step beat three and four, which is a lot less than vLLM's seven. Prose doesn't benefit. Upstream's own follow-up PR measured prose slower with a draft, and the gain lives in code. No help at all when both slots are busy.

The identity check earned its keep one more time. At the 31.6% accept rate, output drifted from the no-draft text at character 588. A clean pre-M3 build in its own worktree drifted at exactly the same place, so the bug predates the markov head. Still open.

And the honest kicker: by the time this finished, llama.cpp already had [PR #32218](https://github.com/ggml-org/llama.cpp/pull/32218), an Inkling DSpark implementation in review since November 13. The GPU benchmarks ran on that build with Unsloth's 402 MB draft, and production ships theirs, not a duplicate of my port. The port wasn't wasted. It's how I knew what working was supposed to look like, and what to measure when someone else's implementation landed.

## What it buys an agent stack

Inkling runs my local agent stack. An orchestrator session dispatches micro-ticket subagents, each one reading files and making small edits on a tight tool list. Every subagent turn ends with the model generating tokens, which is what the draft made faster.

But profiling the agent runs showed drafting only attacks one of two bottlenecks.

The other is reading prompts. Two subagents starting together both want their ~40K-token system prompt read at a combined 430-460 t/s, so the second one waited 258 seconds, past its timeout, before doing anything. The fix had nothing to do with the model. The subagent config denied the bundled MCP `execute` tool, which had the side effect of exposing all 140 underlying MCP tools to every prompt, 86K characters of schema. Matching the deny patterns to the real tool names cut first prompts to about 4.6K tokens. Two subagents starting together: 7.9 and 18.4 seconds to first token, down from 88 and 258.

Then the reasoning. Over 45 agent turns, 93% of generated characters were reasoning. Inkling's chat template defaults to effort 0.9 when the client sends none, so a two-line rename came with 4K characters of thinking. One config change, `reasoning_effort: low` on the model entry, and a smoke test's final turn answered in one second with 95 characters of reasoning. For a micro-ticket agent whose orchestrator already spelled out the exact change, thinking hard before every edit is waste.

So the stack got fast in three places: the draft model multiplies decode tokens, the prompt diet kills the prefill queue, and low reasoning stops the model writing an essay before a one-line edit. Speculative decoding was the headline feature. These two were free.
