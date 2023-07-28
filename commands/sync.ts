import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import { git } from '../utils/git.ts'
import { ExpectedError } from '../utils/misc.ts'
import { Git } from '../utils/const.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'

async function prepareRemoteBranch() {
  unwrap(await git.createBranchIfNotExists(Git.branch.remote))
  unwrap(await git.checkoutBranch(Git.branch.remote))
}

async function syncAction() {
  const isGitDir = unwrap(await git.isGitDir())
  if (!isGitDir) {
    throw new ExpectedError('git ディレクトリ内でのみ実行可能です')
  }

  const [hasUncommitedChanges, hasUncommitedChangesError] = await git
    .hasUncommitedChanges()
  if (hasUncommitedChanges || hasUncommitedChangesError) {
    throw (hasUncommitedChangesError ??
      new ExpectedError(
        '未コミットの変更が残っている状態で同期することはできません',
      ))
  }

  await prepareRemoteBranch()
}

export const syncCommand = new Command()
  .name('sync-config')
  .description('設定を同期します')
  .action(syncAction)
