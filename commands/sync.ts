import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

function syncAction() {
  console.log('sync')
}

export const syncCommand = new Command()
  .name('sync-config')
  .description('設定を同期します')
  .action(syncAction)
