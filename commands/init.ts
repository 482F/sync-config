import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

function initAction() {
  console.log('init')
}

export const initCommand = new Command()
  .description('sync-config.json を作成します')
  .action(initAction)
