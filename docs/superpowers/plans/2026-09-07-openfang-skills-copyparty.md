# Expose OpenFang skills via Copyparty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live OpenFang skills directory browsable and editable at `http://192.168.4.198:3923/openfang/skills/` by bind-mounting it into the copyparty container.

**Architecture:** One new bind-mount line in the copyparty compose file, pointing at the sibling openfang skills dir. Recreate the copyparty container to apply. No code changes; the change is pure Docker volume config. Verification is live HTTP + `docker inspect` + a Syncthing side-effect check.

**Tech Stack:** Docker Compose, the homelab box `192.168.4.198`, copyparty (port 3923), syncthing (port 8384, same compose file), openfang (sibling container).

## Global Constraints

- **Access the box via the `home-lab` skill** — SSH is `ssh 192.168.4.198` (port 22, user `root`, dedicated key in `~/.ssh/config`). All remote commands below run over that SSH session.
- **Compose file (single source of truth):** `/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/copyparty/compose.yml`
- **OpenFang skills dir (host path):** `/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/openfang/data/skills/`
- **Relative source path from copyparty:** `../openfang/data/skills` (both stacks under the same Dockge parent).
- **Access model:** read-write (live dir, no backup copy) — user's explicit choice.
- **Target URL in Copyparty:** `/openfang/skills` (top-level of the share).
- **Do not touch the syncthing service** in the compose file; only add a volume to the `copyparty` service.
- **`:z` SELinux label** must be on the new mount (matches existing mounts).
- **Rollback is lossless:** removing the line + `docker compose up -d copyparty` restores prior state; the openfang dir is never modified by this change itself.

---

### Task 1: Add the bind mount and apply it

**Files:**
- Modify: `/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/copyparty/compose.yml` (under `services.copyparty.volumes`)

**Interfaces:**
- Consumes: existing copyparty compose service; openfang skills dir on the same host volume.
- Produces: a new container mount `.../openfang/data/skills -> /w/openfang/skills`, served by copyparty at `/openfang/skills/`.

- [ ] **Step 1: Back up the compose file**

```sh
ssh 192.168.4.198 'DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; cp "$DK/copyparty/compose.yml" "$DK/copyparty/compose.yml.bak-$(date +%Y%m%d)" && ls -la "$DK/copyparty/"'
```
Expected: a `compose.yml.bak-YYYYMMDD` file appears next to `compose.yml`.

- [ ] **Step 2: Add the volume line**

Insert this one line into the `services.copyparty.volumes` list, immediately after the existing `- ./files:/w:z` line (keep the two-dot relative source; do NOT use an absolute path):

```yaml
      - ../openfang/data/skills:/w/openfang/skills:z
```

Resulting block should read:

```yaml
    volumes:
      - ./cfg:/cfg:z
      - ./files:/w:z # This is the shared data volume
      - ../openfang/data/skills:/w/openfang/skills:z
```

Apply with a targeted edit (e.g. `sed` insert after the `./files` line, or an editor over SSH). Verify the file still parses:

```sh
ssh 192.168.4.198 'DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; docker compose -f "$DK/copyparty/compose.yml" config >/dev/null && echo COMPOSE_OK'
```
Expected: `COMPOSE_OK` (no YAML/parse error).

- [ ] **Step 3: Recreate the copyparty container**

```sh
ssh 192.168.4.198 'DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; cd "$DK/copyparty" && docker compose up -d copyparty'
```
Expected: `copyparty` is recreated (syncthing untouched). ~15s blip.

- [ ] **Step 4: Verify the mount is live**

```sh
ssh 192.168.4.198 "docker inspect copyparty --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' | grep openfang"
```
Expected: one line `.../Dockge/openfang/data/skills -> /w/openfang/skills`.

- [ ] **Step 5: Verify Copyparty serves the skill folders**

```sh
curl -s http://192.168.4.198:3923/openfang/skills/ | grep -oE 'ga4-deep-analysis|ms365|netdata-health|skill-creator-agent' | sort -u
```
Expected: all four names appear (Copyparty renders a directory listing).

---

### Task 2: Prove read-write works end-to-end

**Files:** none (runtime verification only)

**Interfaces:**
- Consumes: the mount from Task 1.
- Produces: confirmed rw capability (or a documented permission fallback).

- [ ] **Step 1: Create a scratch file through Copyparty**

Copyparty's HTTP API: `PUT /<path>` with a body creates/overwrites a file. Use a throwaway name inside the skills dir:

```sh
curl -s -X PUT --data-binary 'rw-test' http://192.168.4.198:3923/openfang/skills/.rw-test -w '\nHTTP %{http_code}\n'
```
Expected: `HTTP 200` (or 201). If you get `403`/`500`, the uid mismatch fallback in Step 3 applies.

- [ ] **Step 2: Confirm it landed in the live openfang dir**

```sh
ssh 192.168.4.198 'DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; ls -la "$DK/openfang/data/skills/.rw-test" && cat "$DK/openfang/data/skills/.rw-test"'
```
Expected: file exists with content `rw-test`. This proves the write went through the mount into the real skill dir.

- [ ] **Step 3: (Only if Step 1/2 failed) Fix the permission mismatch**

Identify copyparty's runtime uid and chown the skills dir to match:

```sh
ssh 192.168.4.198 'UID_CP=$(docker exec copyparty id -u); echo "copyparty uid=$UID_CP"; DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; chown -R "$UID_CP" "$DK/openfang/data/skills" && echo CHOWN_OK'
```
Then re-run Steps 1–2. Expected: `HTTP 200` and the file present.

- [ ] **Step 4: Clean up the scratch file**

```sh
curl -s -X DELETE http://192.168.4.198:3923/openfang/skills/.rw-test -w '\nHTTP %{http_code}\n'
ssh 192.168.4.198 'DK=/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge; ls "$DK/openfang/data/skills/.rw-test" 2>&1 || echo GONE'
```
Expected: `HTTP 200` and `GONE` (the scratch file is removed from the live dir).

---

### Task 3: Confirm Syncthing is not replicating the skills dir

**Files:** none (config check; possible ignore-rule add)

**Interfaces:**
- Consumes: the mount from Task 1 (which now places `openfang/skills` inside syncthing's shared `files/` tree).
- Produces: either confirmation that Syncthing ignores it, or an ignore rule in place.

- [ ] **Step 1: List Syncthing folders and check for the skills path**

```sh
ssh 192.168.4.198 'curl -s http://127.0.0.1:8384/rest/system/ping && echo; curl -s http://127.0.0.1:8384/rest/config/ | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f[\"id\"], f[\"label\"], f[\"path\"]) for f in d[\"folders\"]]"'
```
Expected: the shared folder's `path` is `.../copyparty/files`. The skills dir sits *under* that path as a bind mount, so Syncthing may or may not see it.

- [ ] **Step 2: Check whether Syncthing sees new items in the shared folder**

```sh
ssh 192.168.4.198 'FID=$(curl -s http://127.0.0.1:8384/rest/config/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[\"folders\"][0][\"id\"])"); curl -s "http://127.0.0.1:8384/rest/db/progress?folder=$FID" | head -c 400'
```
Expected: inspect the output — if `openfang/skills/...` entries appear, Syncthing is tracking them and we need an ignore rule (Step 3). If nothing references `openfang/skills`, it's not being replicated and this task is done.

- [ ] **Step 3: (Only if Step 2 shows skills being tracked) Add an ignore pattern**

Add `/openfang/` to the folder's `ignorePatterns` via the Syncthing REST config API, then re-save:

```sh
ssh 192.168.4.198 'FID=$(curl -s http://127.0.0.1:8384/rest/config/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[\"folders\"][0][\"id\"])"); CFG=$(curl -s http://127.0.0.1:8384/rest/config/); NEWCFG=$(echo "$CFG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for f in d[\"folders\"]:
    if f[\"id\"] == \"$FID\":
        f.setdefault(\"ignorePatterns\", \"\")
        if \"/openfang/\" not in f[\"ignorePatterns\"]:
            f[\"ignorePatterns\"] = (f[\"ignorePatterns\"] + chr(10) + \"/openfang/\").strip()
print(json.dumps(d))
"); curl -s -X PUT -H "Content-Type: application/json" --data "$NEWCFG" http://127.0.0.1:8384/rest/config/ && echo IGNORE_ADDED'
```
Expected: `IGNORE_ADDED`. Re-run Step 2 to confirm the skills entries are gone from progress.

> Note: Syncthing's REST config API requires an `X-API-Key` header on most installs. If the calls above return `403`, fetch the key first: `ssh 192.168.4.198 'curl -s http://127.0.0.1:8384/rest/system/status'` and add `-H "X-API-Key: <key>"` to each call. (The skill documents the key location; do not hardcode it.)

---

## Self-Review

**1. Spec coverage:**
- Goal (browse+edit at `/openfang/skills/`) → Task 1 Step 5 + Task 2. ✓
- Change (one compose line + recreate) → Task 1 Steps 2–3. ✓
- Permissions risk & fallback → Task 2 Step 3. ✓
- Syncthing watch item → Task 3. ✓
- Rollback → covered by Global Constraints + Task 1 Step 1 backup. ✓
- Verification items 1–4 from spec → Task 1 Step 5 (list), Task 2 Steps 1–2 (rw), Task 1 Step 4 (docker inspect), Task 3 (syncthing). ✓

**2. Placeholder scan:** No TBD/TODO. The Syncthing API-key note explicitly says to fetch the key rather than hardcode it (correct — secrets must not be committed). All steps show concrete commands.

**3. Type/consistency:** Path strings are consistent (`.../openfang/data/skills` host, `/w/openfang/skills` container, `/openfang/skills/` URL) across all tasks. FID variable is defined before use in Task 3. No cross-task name drift.
