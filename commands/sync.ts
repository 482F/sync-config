import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import {
  unwrap,
} from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import * as consts from '../utils/const.ts'
import { CommitLog, git } from '../utils/git.ts'
import { ExpectedError, getConfig, isExists } from '../utils/misc.ts'
import {
  matchGroupsAll,
} from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/regex.ts'
import { Dir, getAllFiles, getTree, modifyByConfig } from '../utils/fs.ts'
import { dirname, relative } from 'https://deno.land/std@0.196.0/path/posix.ts'

const templateCommitHashPrefix = 'sync-config template commit hash: '

/**
 * テンプレートブランチの初期化
 * - リモートの追加
 * - リモートの fetch
 */
async function prepareTemplateBranch() {
  const config = unwrap(await getConfig())
  unwrap(
    await git.addRemoteIfNotExists(consts.git.remote, config.repository.url),
  )
  unwrap(await git.fetch(consts.git.remote))
}

/**
 * リモート用ブランチの初期化
 * - 空ブランチの作成
 */
async function prepareForRemoteBranch() {
  unwrap(await git.createOrphanBranchIfNotExists(consts.git.branch.remote))
}

function extractTemplateCommitHashes(commit: CommitLog): string[] {
  return matchGroupsAll(
    commit.message,
    new RegExp(
      `^(    )?${templateCommitHashPrefix}(?<templateCommitHash>.+)$`,
      'gm',
    ),
    ['templateCommitHash'],
  )[0]?.map((group) => group.templateCommitHash) ?? []
}

/**
 * テンプレートブランチのファイル群をリモート用ブランチに適用
 */
async function syncForRemote() {
  const forRemoteCommits = unwrap(await git.log(consts.git.branch.remote))
  const templateHashesInForRemote = new Set(
    forRemoteCommits.flatMap(
      extractTemplateCommitHashes,
    ).filter(Boolean),
  )

  const config = unwrap(await getConfig())
  const templateCommits = unwrap(
    await git.log(`${consts.git.remote}/${config.repository.branch}`),
  )

  const needToSyncCommits = templateCommits.filter((templateCommit) =>
    !templateHashesInForRemote.has(templateCommit.commitHash)
  )

  const commitAndTrees: {
    tree: Dir
    commit: typeof needToSyncCommits[number]
  }[] = []
  for (const needToSyncCommit of needToSyncCommits) {
    commitAndTrees.push({
      tree: unwrap(
        await git.checkout(
          needToSyncCommit.commitHash,
          async () =>
            unwrap(
              await getTree(
                (await Promise.all(
                  config
                    .folders
                    .map(({ name }) => name)
                    .map(async (name) =>
                      await isExists(name) ? name : undefined
                    ),
                ))
                  .filter((name: string | undefined): name is string =>
                    Boolean(name)
                  ),
              ),
            ),
        ),
      ),
      commit: needToSyncCommit,
    })
  }

  unwrap(
    await git.checkout(
      consts.git.branch.remote,
      async () => {
        const newCommits: CommitLog[] = []
        for (const { commit, tree } of commitAndTrees) {
          const modifiedFiles = modifyByConfig(config, tree)

          await Promise.all(modifiedFiles.map((file) => file.save()))

          const requiredFilePathSet = new Set(
            modifiedFiles.map((file) => file.path),
          )
          const currentDir = unwrap(await getTree(['.'])).children['.']
          if (!currentDir?.isDirectory) {
            throw new Error('ディレクトリの取得に失敗しました')
          }
          delete currentDir.children['.git']
          await Promise.all(
            getAllFiles(currentDir)
              .filter((file) => !requiredFilePathSet.has(file.path))
              .map(async (file) => {
                await Deno.remove(file.path)
                let parentDir = dirname(file.path)
                while (true) {
                  if (relative('.', parentDir).match(/^\.\.\//)) {
                    break
                  }
                  try {
                    await Deno.remove(parentDir, { recursive: false })
                  } catch (e) {
                    if (e.code === 'ENOTEMPTY') {
                      break
                    }
                    throw e
                  }
                  parentDir = dirname(parentDir)
                }
              }),
          )

          newCommits.push(unwrap(
            await git.commitAll(
              `${commit.message}\n\n${templateCommitHashPrefix}${commit.commitHash}`,
            ),
          ))
        }
        return newCommits
      },
    ),
  )
}

/**
 * メインブランチにコミットを適用する
 */
async function applyToMain() {
  const config = unwrap(await getConfig())

  const mainBranchName = unwrap(await git.getCurrentBranchName())
  const mainCommits = unwrap(await git.log(mainBranchName))
  const templateHashesInMain = new Set(
    mainCommits.flatMap(extractTemplateCommitHashes).filter(Boolean),
  )

  const forRemoteCommits = unwrap(await git.log(consts.git.branch.remote))
  const targetCommits = forRemoteCommits.filter((commit) => {
    const hash = extractTemplateCommitHashes(commit)[0]
    return hash && !templateHashesInMain.has(hash)
  })
  if (targetCommits.length <= 0) {
    return
  }

  if (config.mergeMode === 'cherry-pick') {
    unwrap(
      await git.cherryPick(targetCommits.map((commit) => commit.commitHash)),
    )
  } else if (config.mergeMode === 'cherry-pick-squash') {
    unwrap(
      await git.cherryPick(targetCommits.map((commit) => commit.commitHash)),
    )
    unwrap(await git.squash(0, targetCommits.length))
  } else {
    return ((mode: never) => {
      throw new ExpectedError(`mergeMode が不正な値です: ${mode}`)
    })(config.mergeMode)
  }
}

async function syncAction() {
  const hasUncommitedChanges = unwrap(await git.hasUncommitedChanges())
  if (hasUncommitedChanges) {
    throw new ExpectedError(
      '未コミットの変更が残っている状態で同期することはできません',
    )
  }

  await prepareTemplateBranch()
  await prepareForRemoteBranch()

  await syncForRemote()

  await applyToMain()

}

export const syncCommand = new Command()
  .name('sync-config')
  .description('設定を同期します')
  .action(syncAction)
