import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanTitle, makeLabel } from '../hooks/herdrTabLabel.mjs';

test('cleanTitle drops leading glyphs and whitespace', () => {
  assert.equal(cleanTitle('✳ Fix login redirect bug '), 'Fix login redirect bug');
  assert.equal(cleanTitle(undefined), '');
});

test('a task id wins over the rest of the title', () => {
  assert.equal(makeLabel('● TASK-0136 Fix login redirect bug'), 'TASK-0136');
  assert.equal(makeLabel('PROJ-42: auth middleware cleanup'), 'PROJ-42');
});

test('the bare repo name means "not renamed" and gives null', () => {
  assert.equal(makeLabel('my-repo', { repoName: 'my-repo' }), null);
  assert.equal(makeLabel('My-Repo', { repoName: 'my-repo' }), null);
  assert.equal(makeLabel('', { repoName: 'my-repo' }), null);
});

test('a short title is kept as is', () => {
  assert.equal(makeLabel('Fix login redirect bug'), 'Fix login redirect bug');
});

test('a long title is cut at a word boundary without trailing punctuation', () => {
  assert.equal(makeLabel('Session cookie and redirect fixes for OAuth'), 'Session cookie and');
  assert.equal(makeLabel('Fix login redirect - bug in callback handler'), 'Fix login redirect');
});

test('a long single word is cut hard', () => {
  assert.equal(makeLabel('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnopqrstuv');
});
