#!/usr/bin/env -S deno run --allow-run=git --allow-write=. --allow-read=. --ext ts
import {
  CompletionsCommand,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

import { initCommand } from './commands/init.ts'
import { syncCommand } from './commands/sync.ts'
import { ExpectedError } from './utils/misc.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { git } from './utils/git.ts'

try {
  const isGitDir = unwrap(await git.isGitDirRoot())
  if (!isGitDir) {
    throw new ExpectedError('git ディレクトリのルートでのみ実行可能です')
  }

  await syncCommand
    .name('sync-config')
    .command('init', initCommand)
    .command('completions', new CompletionsCommand())
    .hidden()
    .parse(Deno.args)
} catch (e) {
  if (e instanceof ExpectedError) {
    console.error('[ERROR]', e.message)
  } else {
    console.error(e)
  }
  Deno.exit(1)
}
