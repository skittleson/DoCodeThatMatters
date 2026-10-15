---
title: "Strata on an RTX 3090 Ti: Research and Config Guide for Qwen3.8-Flash-Next"
keywords:
  - AI;DR
  - local llm
  - strata
  - qwen3.8-flash-next
  - mixture of experts
  - rtx 3090
  - opencode
  - omniroute
  - llama.cpp
  - quantization
  - systemd
  - homelab
date: 2026-10-15
description: The research and the exact config I used to run the 125B Qwen3.8-Flash-Next on one RTX 3090 Ti with Strata, as an OpenCode coding model. Which quant and why, the install fixes Pop!_OS 22.04 needed, the sampling block Strata does not write for you, calibration results, a one-command switch back to llama.cpp, and a side-by-side speed probe against my old Qwen3.8-27B.
image: /images/rtx-3090.jpg
alt: An NVIDIA GeForce RTX 3090 Ti Founders Edition 24GB graphics card, the GPU running both models in this post.
imageWidth: 1200
imageHeight: 800
draft: false
---

> **AI;DR** — This post was written with AI assistance, then edited by me. The research, commands, and numbers are from my own box.

TLDR; On the same RTX 3090 Ti, a 125B model now reads an 86K-token prompt in 32 seconds. My old 27B took 83. It generates at ~100 tok/s where the 27B did 49-70. The engine is [Strata](https://github.com/Niko1221/Strata) and the model is [Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next). This is the research I did to pick the settings and the config I ended up with, so you can copy it.

This follows [how I run local LLMs for coding](/running-local-llms-for-coding/). That setup (dense Qwen3.8-27B on llama.cpp) is still on disk and one command away. I'm giving Strata a week as my daily OpenCode model before I decide.

## My box

| Part | What I have |
|---|---|
| GPU | RTX 3090 Ti, 24GB, driver 580.173 |
| CPU | Ryzen 9 5950X (AVX2, no AVX-512) |
| RAM | 62GiB DDR4 (2x32GB, running at 2400 — more on that later) |
| Board | Gigabyte B450 AORUS M, so the GPU is on PCIe 3.0 x16 |
| Disk | Samsung 980 PRO 2TB |
| OS | Pop!_OS 22.04 |
| Network | Wi-Fi. This matters for an 82GB download. |

OpenCode runs on my laptop and talks to the box over the LAN through [OmniRoute](https://github.com/diegosouzapw/OmniRoute).

## Research

### How a 125B model fits on 24GB

Flash-Next is a Mixture-of-Experts model. It has 125B parameters, but only about 6B are active for each token. Most of the model is thousands of small experts, and each token uses only a few of them.

Strata keeps the experts you use most in VRAM. It keeps all of them in system RAM, and the CPU computes the ones the GPU does not have. A 29GB n-gram lookup table stays on the SSD. llama.cpp can run this model too, but it puts experts on the GPU by layer, not by how often they get used. That costs a lot.

The best comparison I found is from InsiderLLM: [Strata at 78 tok/s vs llama.cpp at 18](https://insiderllm.com/guides/strata-vs-llama-cpp-rtx-3090/), on a 3090 with 64GB of DDR4. With drafting on, Strata did ~119 tok/s and read a 32K prompt in ~12 seconds. In their run, 98.7% of expert lookups during decode hit the card. That box is close enough to mine that I stopped looking at other engines.

### Which size

Strata offers four sizes of the original model, from ISTA-DASLab's GSQ-RCO quants:

| Size | RAM + VRAM it needs | Notes |
|---|---|---|
| Q2_0 | 37.6GB | Fastest in Strata's tables |
| IQ2_XS | 39.2GB | Strata's general recommendation |
| IQ3_XXS | 47.0GB | What InsiderLLM benchmarked on a 3090 |
| IQ3_S | 54.8GB | "Matches the full model on the published tests" |

I started with Q2_0 and stopped the download at 20.7GB. Two things changed my mind.

- Part of Q2_0's speed comes from an AVX-512 CPU kernel. The 5950X does not have AVX-512.
- The people testing real coding tasks on [r/LocalLLM](https://www.reddit.com/r/LocalLLM/comments/1x1pvkt/benchmarked_some_strata_qwen38flashnext_quants/) rated the 3-bit sizes clearly above the 2-bit ones. One commenter daily-drove IQ3_XXS and IQ3_S and said IQ3_S is "noticeably better" for coding.

IQ3_S needs ~55GB for its experts, and I have 62GiB. Too tight. So I went with **IQ3_XXS**.

The second shard (the n-gram table) is the same file for all four sizes. Changing size only costs you the first shard.

### What I copied from Reddit, and what I didn't

The most detailed 3090 post is [this one on r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/comments/1wwamjw/strata_rtx_3090_128_ram_qwen_38_flash_next/): 1,650 t/s prompt read, 38-61 t/s decode, no tool-call errors in OpenCode. The author rebuilt Strata with MMQ, set `STRATA_PF_FUSED=0` to stop a crash, and repacked an Unsloth quant with `--compat-bf16`.

I skipped all of that. Those changes are for Unsloth's K-quants, and that person has 128GB of RAM. On the ISTA quants Strata ships, you don't need them. Two things from Reddit I did use: the sampling values (below), and a note that Strata maps the thinking level `high` to the model's `xhigh`, so you don't have to care about that mismatch.

### Sampling

The [Qwen model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) gives two profiles:

- **Thinking mode** (the default): `temperature=1.0, top_p=0.95, top_k=20, min_p=0, presence_penalty=0`
- **Non-thinking mode:** `temperature=0.7, top_p=0.8, top_k=20, min_p=0, presence_penalty=1.5`

I use thinking mode. The r/LocalLLM benchmarker recommends the same values.

## Configuration

### Install

On a clean Ubuntu box, Strata's `./setup.sh` is one command. Mine needed three fixes:

1. **No `python3-venv`.** Setup wants to `sudo apt install` it. I was running it over SSH without a terminal, so sudo could not ask for a password. Strata has a supported uv path. I installed uv for my user and set `STRATA_UV=1`.
2. **CMake too old.** Pop!_OS 22.04 has CMake 3.22. Strata needs 3.24 or newer. Setup had already pip-installed a newer CMake into its `.venv`, so I put `.venv/bin` first on `PATH`.
3. **No prebuilt engine.** The release download returned 404 for v0.1.44.1. Setup then compiled the engine for sm_86 with my CUDA 12.8 toolkit. That worked with no changes.

```sh
git clone https://github.com/Niko1221/Strata ~/src/Strata
cd ~/src/Strata
curl -LsSf https://astral.sh/uv/install.sh | sh

mkdir -p ~/.config/strata && (umask 077; openssl rand -hex 24 > ~/.config/strata/api-key)

PATH=$HOME/src/Strata/.venv/bin:$HOME/.local/bin:$PATH STRATA_UV=1 \
./setup.sh --family qwen --model IQ3_XXS --context 131072 --vision no \
  --host 0.0.0.0 --port 8080 --api-key "$(cat ~/.config/strata/api-key)" \
  --draft-vocab en --no-browser --no-start --yes
```

- `--family qwen` is the original model. Without it, setup can pick the Coder version (half the experts) depending on your RAM.
- `--host 0.0.0.0` needs `--api-key`. Don't expose it to your LAN without one.
- `--draft-vocab en` is English and code only for the draft layer. About 110MB less VRAM.
- `--no-start` because systemd starts it later.

The download is ~82GB. Mine ran at ~15MB/s. I assumed Hugging Face was slow and opened four extra range requests to test that. Strata's download dropped to half speed and the total stayed at 15MB/s. It was my Wi-Fi.

I also lost a night to my own `pkill -f "setup.py --family qwen"`. It matched its own command line and killed the shell that was supposed to start the next download. Use `pkill -f "setup[.]py"`. The brackets stop the pattern from matching itself.

### The sampling block Strata doesn't write

This one would have bitten me. Setup writes `strata-iq3_xxs.json` with no `sampling` block, and Strata's docs say:

> with no block at all a request without sampling keys decodes greedy.

So a client that does not send its own temperature always gets the single most likely token. Add the block yourself. I also added three opt-in keys from the same docs page:

```json
{
  "sampling": { "temperature": 1.0, "top_p": 0.95, "top_k": 20, "min_p": 0.0 },
  "expert_profile_save": "expert-profile-learned.bin",
  "fit_max_tokens": true,
  "reasoning_close_retry": true,
  "aliases": ["strata", "Qwen3.8-Flash-Next"]
}
```

| Key | What it does |
|---|---|
| `expert_profile_save` | Saves what the expert cache learned about your usage, so a restart doesn't start cold |
| `fit_max_tokens` | Shortens an agent's requested `max_tokens` to the room left in context, instead of a 400 error |
| `reasoning_close_retry` | Catches a reply that ends inside its thinking with no answer. Without it, the agent just stops. |
| `aliases` | Extra names in `/v1/models` |

Running `./setup.sh --setup` again rewrites this file, so I keep these keys in a small script and run it after every setup.

Setup also turned **KV streaming off** by itself. It estimated ~60GB of RAM for IQ3_XXS plus 1.8GB for streaming, and I have 63. So the KV cache stays in VRAM, and there is a bit less room for experts.

### Calibrate

```sh
./setup.sh --calibrate --yes --no-browser
```

This tests a few engine settings, three rounds each. It keeps a setting only if it beats the default by more than 3%. It took about 10 minutes and leaves the server running when it finishes.

- **PCIe share** (how much off-GPU expert work gets copied to the card vs computed on the CPU): best at 0.2 with 99.6 tok/s. It dropped hard after 0.75, down to 84 at 1.0. That fits my PCIe 3.0 slot. The engine measures 13.1GB/s host-to-device.
- **Draft floor:** 0.7 won its sweep (103.6 vs 96.6 at 0.5). Neither setting beat the defaults in the final head-to-head, so the config kept 0.5.
- **Kept:** `--pool-workers 4 --adapt-every 1 --adapt-swaps 80 --adapt-decay 0.97`, at **105.4 tok/s**.

It saves these per PC and model in `~/.config/strata/settings.json`, so updates keep them.

### Check for other servers on the port

When I stopped llama-server, `nvidia-smi` still showed 20GB in use. A different llama-server had started 18 seconds earlier. It was a Qwen3.6-35B from months ago.

It was a systemd **user** unit, enabled, with `Restart=on-failure`, bound to port 8080. While the system llama-server held the port, it failed and retried forever. When the port was free, it took it.

```sh
systemctl --user list-units --all | grep -iE "llama|qwen|strata"
systemctl --user disable --now qwen36-claude47
```

If you have been swapping models on one box, check the user units too.

### systemd and a one-command switch

Both servers need the whole GPU and port 8080, so only one runs at a time. `/etc/systemd/system/strata.service`:

```ini
[Unit]
Description=Strata (Qwen3.8-Flash-Next)
After=network-online.target
Wants=network-online.target
Conflicts=llama-server.service

[Service]
Type=simple
User=spencerkittleson
WorkingDirectory=/home/spencerkittleson/src/Strata
ExecStartPre=-/usr/bin/fuser -k 8080/tcp
ExecStart=/home/spencerkittleson/src/Strata/run-strata.sh
LimitMEMLOCK=infinity
KillSignal=SIGTERM
TimeoutStopSec=120
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- `run-strata.sh` is a symlink to the `run-iq3_xxs.sh` that setup wrote. If I change size, I only move the symlink.
- `LimitMEMLOCK=infinity` because Strata pins tens of GB of RAM for the GPU. I also set `memlock unlimited` for my user in `/etc/security/limits.d/90-strata.conf`. The default was ~8GB.
- `TimeoutStopSec=120` because releasing that pinned memory takes longer than llama-server's shutdown.
- I added `Conflicts=strata.service` to `llama-server.service` too.

On top of that is a small `llm-switch` script in `/usr/local/bin`:

```sh
llm-switch strata   # stop the 27B, start Strata, wait for /health
llm-switch qwen27   # the reverse
llm-switch off      # free the GPU and RAM
llm-switch          # which one is running
```

It disables one unit, waits for port 8080 to be free, enables the other, then polls `/health` until it's ready. A sudoers drop-in allows only those four `systemctl enable/disable --now` commands without a password. Whichever one I switched to last starts at boot. Strata takes 35-45 seconds to come up and the 27B takes about 15.

### OpenCode through OmniRoute

OmniRoute already had a `gpupc` provider for `http://<box>:8080/v1`. Strata accepts any model name, so `gpupc/strata` routed without re-syncing the model list. I added the Strata API key to that connection. llama-server ignores the header, so the 27B path kept working with no change. I tested both, plus a real tool call, before I changed the default.

In `opencode.json`, under the `omniroute` provider:

```json
"gpupc/strata": {
  "name": "Qwen3.8-Flash-Next IQ3_XXS (Strata, gaming pc)",
  "limit": { "context": 131072, "output": 32768 },
  "tool_call": true,
  "reasoning": true,
  "options": { "reasoningEffort": "high" },
  "variants": {
    "medium": { "reasoningEffort": "medium" },
    "low": { "reasoningEffort": "low" },
    "none": { "reasoningEffort": "none" }
  }
}
```

and `"model": "omniroute/gpupc/strata"` at the top level. The variants come from Strata's own OpenCode example. `none` answers immediately and is nice for small edits. If you point OpenCode at Strata directly, set `apiKey` on the provider. I used `"{file:~/.config/strata/api-key}"` so the key isn't in the config.

## Results

I ran the same script against both servers. Streamed, 512 output tokens, a random nonce at the start of every prompt so nothing came from a prompt cache, two runs each.

| Prompt | 27B first token | Strata first token | 27B prompt read | Strata prompt read | 27B generate | Strata generate |
|---|---|---|---|---|---|---|
| ~925 tokens | **1.2 s** | 2.0 s | **1,166 t/s** | 530 t/s | 70 t/s | **96 t/s** |
| ~27K tokens | 21.0 s | **11.5 s** | 1,332 t/s | **2,400 t/s** | 62 t/s | **102 t/s** |
| ~86K tokens | 83.1 s | **32.2 s** | 1,059 t/s | **2,724 t/s** | 49 t/s | **101 t/s** |

The 27B is Qwen3.8-27B-MTP-Q4_K_M on llama.cpp at 200K context, the command from the last post.

The 27B still wins on tiny prompts. What surprised me was the other end. Strata's own 3090 table shows ~500 t/s prompt reading, so I expected that to be its weak spot. Past a few thousand tokens it's about 2.5x faster than llama.cpp. And generation barely changes as context grows: ~100 t/s at 86K, where the 27B drops from 70 to 49. A coding agent resends a big prompt every turn, so the long rows are where I spend my time.

These are speed numbers only. I also started an agent benchmark (a refactor, a feature with tests, and a long-context question, all in a pinned more-itertools checkout). The 27B got the refactor right in 5.5 minutes, but the full set took too long, so I stopped it. Quality is what the trial week is for.

## My RAM has been running at 2400 the whole time

While I was deciding whether to buy more RAM, I ran `dmidecode`. Two 32GB TEAMGROUP DDR4-3600 sticks, two empty slots, and a configured speed of **2400 MT/s**. XMP is off.

I wanted to fix that over SSH. You can't. On Ryzen, the BIOS sets the memory clock at boot. The Linux tools I found (amdctl, ryzen_smu, RyzenAdj) only change CPU power and clocks. The closest you get is rebooting straight into the BIOS from SSH, then walking over with a keyboard:

```sh
llm-switch off && sudo systemctl reboot --firmware-setup
```

It probably doesn't matter much for Strata. Most expert lookups come from the GPU, and prompt reading is limited by the PCIe 3.0 slot. But it's free.

I ordered a matching [TEAMGROUP T-Force Vulcan Z 2x32GB DDR4-3600 CL18 kit](https://www.amazon.com/dp/B0924QGX1K) for 128GB total. With four dual-rank sticks I expect ~3200, not 3600, and that's fine. The point is IQ3_S, the size that didn't fit, with KV streaming back on. When it's in, I'll run the same probe again.

## What I'm watching this week

Loops, malformed tool calls, empty replies after thinking, first-token time on big prompts, and RAM pressure on the box, which sits at ~44GB of 62. Every issue goes in a log. On the 21st, I either keep Strata or run `llm-switch qwen27`.
