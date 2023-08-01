import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import  * as consts  from '../utils/const.ts'
import { git } from '../utils/git.ts'
import { ExpectedError, getConfig } from '../utils/misc.ts'
async function prepareLocalBranch() {
  unwrap(await git.createOrphanBranchIfNotExists(Git.branch.local))
}

async function prepareRemoteBranch() {
  const config = unwrap(await getConfig())
  unwrap(await git.addRemoteIfNotExists(consts.git.remote, config.repository.url))
  unwrap(await git.fetch(consts.git.remote))

  unwrap(await git.createOrphanBranchIfNotExists(consts.git.branch.remote))

}

async function syncAction() {
  const [hasUncommitedChanges, hasUncommitedChangesError] = await git
    .hasUncommitedChanges()
  if (hasUncommitedChanges || hasUncommitedChangesError) {
    throw (hasUncommitedChangesError ??
      new ExpectedError(
        '未コミットの変更が残っている状態で同期することはできません',
      ))
  }

  await prepareLocalBranch()
  await prepareRemoteBranch()

  /**
   * TODO:
   * リモートのディレクトリを読んで、js や ts を実行した結果を展開する用のブランチを作る必要がある
   * リモートブランチのコミット履歴から展開リモートブランチに一つずつコミットする
   * 展開リモートブランチのコミットメッセージには、リモートブランチのコミットハッシュを含める
   * - 過去のコミットについてハッシュが食い違った場合は rebase とかされているので戻ってそこから修正？
   * - でもローカルブランチにどうやってマージすればいいんだろうか。そのままマージするか
   */
}

export const syncCommand = new Command()
  .name('sync-config')
  .description('設定を同期します')
  .action(syncAction)
