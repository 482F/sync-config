#!/usr/bin/env -S deno run --allow-run --ext ts
import {
  CompletionsCommand,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

import { initCommand } from './commands/init.ts'
import { syncCommand } from './commands/sync.ts'

syncCommand
  .name('sync-config')
  .command('init', initCommand)
  .command('completions', new CompletionsCommand())
  .hidden()
  .parse(Deno.args)
