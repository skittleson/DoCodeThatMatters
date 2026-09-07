# Expose OpenFang skills via Copyparty (bind mount)

**Date:** 2026-09-07
**Status:** Approved
**Target box:** homelab `192.168.4.198`

> **How to reach the box:** use the `home-lab` skill — it documents SSH access
> (`ssh 192.168.4.198`, port 22), the Dockge layout, and health checks for
> copyparty/openfang/syncthing. All commands below assume that SSH session.

## Goal

Browse and edit the live OpenFang skills directory through Copyparty at
`http://192.168.4.198:3923/openfang/skills/`, read-write, without touching the
openfang container.

## Context (verified 2026-09-07)

- **Copyparty** — Docker container `copyparty`, image `copyparty/ac:latest`,
  port `3923`. Compose file:
  `/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/copyparty/compose.yml`.
  Volumes: `./cfg:/cfg:z`, `./files:/w:z`. Serves `/w` as its share root.
  Same compose file also runs **syncthing** (shares `./files` at
  `/shared_files`).
- **OpenFang** — Docker container `openfang`. Skills live at host
  `/srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/openfang/data/skills/`
  (container path `/data/skills`). Current contents: `ga4-deep-analysis`,
  `ms365`, `netdata-health`, `skill-creator-agent`.
- Both stacks live under the same Dockge parent dir, so the relative source
  path from copyparty is `../openfang/data/skills`.

## Decisions (from brainstorm)

- **Access model:** read-write (live skill dir, no backup copy).
- **Path in Copyparty:** `/openfang/skills` (top-level of the share).
- **Mechanism:** bind mount (approach A) — canonical Docker, visible in
  `docker inspect`, self-documenting in the compose file. Rejected: symlink
  (invisible to Docker tooling), separate share root (overkill, changes URL
  structure).

## Change

Add one line to `copyparty/compose.yml` under `services.copyparty.volumes`:

```yaml
- ../openfang/data/skills:/w/openfang/skills:z
```

Then recreate the container:

```sh
cd /srv/dev-disk-by-uuid-491ac08b-a375-4331-8db3-18c16a7fa35c/Dockge/copyparty
docker compose up -d copyparty
```

Syncthing in the same file is untouched. One-time ~15s Copyparty blip.

## Data flow

Copyparty web UI serves `/w` → new subdir is a bind mount straight to
`openfang/data/skills`. Edits made through Copyparty land directly in the live
skill dir (rw). OpenFang picks up changes on its next skill reload
(`POST /api/skills/reload`).

## Permissions risk & fallback

`:z` SELinux label matches the existing mounts. Source dir is root-owned;
copyparty runs as a non-root user. Verify write access post-mount (create +
delete a scratch file via the HTTP API). If the uid mismatch blocks writes,
fallback: chown the skills dir to copyparty's runtime uid, or align the
container user.

## Syncthing watch item

`files/` is also a Syncthing folder. After the mount, confirm Syncthing is not
silently starting to replicate `openfang/skills` to other devices. If it is,
add an ignore pattern for that path in the Syncthing folder config.

## Rollback

Remove the added volume line, `docker compose up -d copyparty`. No data
changes; the openfang dir is never modified by this change itself.

## Verification (all must pass)

1. `curl http://192.168.4.198:3923/openfang/skills/` lists the 4 skill folders
   (ga4-deep-analysis, ms365, netdata-health, skill-creator-agent).
2. Create + delete a scratch file through the Copyparty HTTP API to prove rw
   works end-to-end.
3. `docker inspect copyparty` shows the new mount
   (`.../openfang/data/skills -> /w/openfang/skills`).
4. Syncthing folder view shows no new unexpected items, or an ignore rule is
   in place for `openfang/skills`.
