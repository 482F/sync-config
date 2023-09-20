#!/usr/bin/env -S deno run --allow-run=git --allow-write=. --allow-read=. --ext ts
import {
  CompletionsCommand,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

import { initCommand } from './commands/init.ts'
import { syncCommand } from './commands/sync.ts'
import { ExpectedError } from './utils/misc.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { git } from './utils/git.ts'

/**
 * ブランチ名
 * - テンプレートブランチ
 *   - `remotes/${consts.git.remote}/${config.repository.branch}`
 *   - テンプレートリポジトリの config で指定されたブランチが upstream になっているリモートブランチ
 *   - 参照側から変更を加えることがないため、リモートブランチしか存在しない
 * - メインブランチ
 *   - sync-config を実行しているリポジトリの本来のブランチ群。面倒であるため sync-config からは区別をせず、実行時のブランチがメインブランチとして認識される
 * - リモート用ブランチ
 *   - `${consts.branch.remote}`
 *   - テンプレートブランチのファイル群から設定に基づいてファイルを展開するためのブランチ
 */

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
