import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import { git } from '../utils/git.ts'
import { ExpectedError } from '../utils/misc.ts'

async function syncAction() {
  const [shortStatus, shortStatusError] = await git.shortStatus()
  if (shortStatus !== '') {
    throw (shortStatusError ??
      new ExpectedError(
        '未コミットの変更が残っている状態で同期することはできません',
      ))
  }

  const [, createBranchError] = await git.createBranchIfNotExists(
    'sync-config-remote',
  )
  if (createBranchError) {
    throw createBranchError
  }
}

export const syncCommand = new Command()
  .name('sync-config')
  .description('設定を同期します')
  .action(syncAction)
