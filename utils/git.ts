import { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { ExpectedError } from './misc.ts'

async function callGit(args: string[]): Promise<Result<string>> {
  const output = await new Deno.Command('git', { args }).output()
  if (output.success) {
    return [new TextDecoder().decode(output.stdout), undefined]
  } else {
    return [undefined, new Error(new TextDecoder().decode(output.stderr))]
  }
}
async function checkout(
  target: string,
  options?: string[],
  callback?: () => unknown,
): Promise<Result<undefined>> {
  let r: Result<string>
  r = await callGit(['branch'])
  if (r[1]) {
    return [undefined, r[1]]
  }

  const originalBranchName = r[0].match(/^\* (.+)$/m)?.[1]
  if (!originalBranchName) {
    return [
      undefined,
      new ExpectedError('現在のブランチ名の取得に失敗しました'),
    ]
  }

  r = await callGit(['checkout', ...(options ?? []), target])
  if (r[1]) {
    return [undefined, r[1]]
  }

  try {
    await callback?.()
    return [undefined, undefined]
  } catch (e) {
    return [undefined, e]
  } finally {
    await callGit(['checkout', originalBranchName])
  }
}

export const git = {
  /**
   * @return { Result<boolean> } isGitDir
   */
  async isGitDirRoot() {
    const [, statusError] = await callGit(['status'])
    if (statusError) {
      if (
        statusError.message.includes(
          'fatal: not a git repository (or any of the parent directories): .git',
        )
      ) {
        return [false, undefined]
      } else {
        return [undefined, statusError]
      }
    }

    const [result, revParseError] = await callGit(['rev-parse', '--show-cdup'])

    if (revParseError) {
      return [undefined, revParseError]
    }

    return [Boolean(result.match(/^\s+$/)), undefined]
  },
  /**
   * @return { Result<boolean> } isRemoteAdded
   */
  async addRemoteIfNotExists(remoteName: string, remoteUrl: string) {
    const [remotes, getRemoteError] = await callGit(['remote'])
    if (getRemoteError) {
      return [undefined, getRemoteError]
    }

    if (remotes.split('\n').includes(remoteName)) {
      return [false, undefined]
    }

    const [, addRemoteError] = await callGit([
      'remote',
      'add',
      remoteName,
      remoteUrl,
    ])
    if (addRemoteError) {
      return [undefined, addRemoteError]
    }

    return [true, undefined]
  },
  async fetch(remoteName: string) {
    return await callGit(['fetch', remoteName])
  },
  /**
   * @return { Result<boolean> } hasUncommitedChanges
   */
  async hasUncommitedChanges() {
    const [result, e] = await callGit(['status', '-s'])
    if (e) {
      return [undefined, e]
    }

    return [result !== '', undefined]
  },
  /**
   * @returns { Result<boolean> } isBranchCreated
   */
  async createOrphanBranchIfNotExists(branchName: string) {
    let r: Result<string>
    r = await callGit(['branch', '-a'])
    if (r[1]) {
      return [undefined, r[1]]
    }

    const [branches] = r
    if (branches.match(new RegExp(`^. ${branchName}$`, 'm'))) {
      return [false, undefined]
    } else if (
      branches.match(new RegExp(`^. remotes/[^/]+/${branchName}`, 'm'))
    ) {
      const [, e] = await checkout(branchName)
      if (e) {
        return [undefined, e]
      }
      return [false, undefined]
    }

    const [, e] = await checkout(branchName, ['--orphan'], async () => {
      r = await callGit(['reset', '--hard'])
      if (r[1]) {
        return [undefined, r[1]]
      }

      r = await callGit(['commit', '--allow-empty', '-m', 'initial commit'])
      if (r[1]) {
        return [undefined, r[1]]
      }
    })
    if (e) {
      return [undefined, e]
    }

    return [true, undefined]
  },
  checkout: async (target: string, callback?: () => unknown) =>
    await checkout(target, [], callback),
} as const satisfies Record<
  string,
  // deno-lint-ignore no-explicit-any
  (...args: any[]) => Promise<Result<unknown>>
>
