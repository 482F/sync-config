#!/usr/bin/env -S deno run --allow-run=git --allow-write=. --allow-read=. --ext ts
import {
  CompletionsCommand,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

import { initCommand } from './commands/init.ts'
import { syncCommand } from './commands/sync.ts'
import { ExpectedError } from './utils/misc.ts'

try {
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
