#!/usr/bin/env node
// Sets the Herdr tab label to the session's name.
//
// WHY THIS WAY: a tab strip that reads "2", "3", "18" makes it easy to hand work
// to the wrong pane. The first idea was "name the tab after the task number",
// but the task number is not a reliable source: it does not exist when the
// session starts, and one session can open a task for another. So the source
// is the session's OWN NAME: you set it with /rename, Claude Code writes it to
// the terminal title, Herdr already reads that title. The only job here is to
// copy that title onto the tab label. No guessing; when the work changes, the
// label follows.
//
// Runs as a Stop hook at the end of every turn. It can also be run by hand:
//   node hooks/herdrTabLabel.mjs
// It never breaks the session: without Herdr, or on any error, it exits quietly.

import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Drop leading symbols (status glyphs such as "✳ " or "● ") and trim. */
export function cleanTitle(title) {
  return String(title ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/**
 * Tab label from the terminal title. The strip is narrow, so it stays short.
 * - A task id such as `TASK-0136` or `PROJ-42` wins: shortest and most recognizable.
 * - The repo folder name alone carries no information (the session was never
 *   renamed) -> null.
 * - Otherwise the title, cut at a word boundary.
 * `null` means "leave the current label alone".
 */
export function makeLabel(title, { maxLength = 22, repoName = '' } = {}) {
  const clean = cleanTitle(title);
  if (!clean) return null;
  const task = clean.match(/\b[A-Z][A-Z0-9]+-\d+\b/);
  if (task) return task[0];
  if (repoName && clean.toLowerCase() === repoName.toLowerCase()) return null;
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const space = cut.lastIndexOf(' ');
  return (space > maxLength / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '');
}

function herdr(...args) {
  return JSON.parse(execFileSync('herdr', args, { encoding: 'utf8', timeout: 5000 })).result;
}

function main() {
  const { HERDR_ENV, HERDR_PANE_ID, HERDR_TAB_ID, HERDR_WORKSPACE_ID } = process.env;
  if (HERDR_ENV !== '1' || !HERDR_PANE_ID || !HERDR_TAB_ID) return;

  const me = herdr('agent', 'list').agents.find((a) => a.pane_id === HERDR_PANE_ID);
  if (!me) return;

  const label = makeLabel(me.terminal_title_stripped || me.terminal_title, { repoName: basename(process.cwd()) });
  if (!label) return;

  // Writing the same label again only makes the tab flicker.
  const tab = HERDR_WORKSPACE_ID
    ? herdr('tab', 'list', '--workspace', HERDR_WORKSPACE_ID).tabs.find((t) => t.tab_id === HERDR_TAB_ID)
    : null;
  if (tab && tab.label === label) return;

  herdr('tab', 'rename', HERDR_TAB_ID, label);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // As a hook, no error may reach the session.
  try { main(); } catch { /* no Herdr, or an unexpected reply: exit quietly */ }
}
