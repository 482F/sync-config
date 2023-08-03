import type { IsNever } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/common.ts'
import type { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { ExpectedError } from './misc.ts'

async function callGit(args: string[]): Promise<Result<string>> {
  const output = await new Deno.Command('git', { args }).output()
  if (output.success) {
    return [new TextDecoder().decode(output.stdout), undefined]
  } else {
    return [undefined, new Error(new TextDecoder().decode(output.stderr))]
  }
}

const sequentialCheckout = (() => {
  function getObj<
    const PrevCallbackReturnType,
    const AllArgs extends readonly {
      target: string
      options: string[]
      // deno-lint-ignore no-explicit-any
      callback: (arg?: any) => OR
    }[],
    OR = unknown,
  >(allArgs: AllArgs) {
    return {
      async do<
        const RR extends {
          [i in keyof AllArgs]: Awaited<ReturnType<AllArgs[i]['callback']>>
        },
        const R extends [RR, IsNever<OR>] extends [[], false] ? OR[] : RR,
      >(): Promise<Result<R>> {
        let r: Result<string>
        r = await callGit(['branch', '--contains'])
        if (r[1]) {
          return [undefined, r[1]]
        }

        const originalName = r[0].match(
          /^\* (\(HEAD detached at )?(.+?)\)?$/m,
        )?.[2]

        if (!originalName) {
          return [
            undefined,
            new ExpectedError('現在のブランチ名の取得に失敗しました'),
          ]
        }

        try {
          const results: OR[] = []
          for (const args of allArgs) {
            r = await callGit([
              'checkout',
              ...(args.options ?? []),
              args.target,
            ])
            if (r[1]) {
              return [undefined, r[1]]
            }

            results.push(await args.callback(results.at(-1)))
          }
          return [results as R, undefined]
        } catch (e) {
          return [undefined, e]
        } finally {
          await callGit(['checkout', originalName])
        }
      },
      add<const R extends OR>(
        target: string,
        options: string[],
        callback: (arg: PrevCallbackReturnType) => R,
      ) {
        const nextAllArgs = [...allArgs, { target, options, callback }] as const
        return getObj<R, typeof nextAllArgs>(nextAllArgs)
      },
    }
  }
  return <IR, OR = unknown>() => getObj<IR, [], OR>([])
})()

async function checkout<R>(
  target: string,
  options: string[],
  callback: () => R,
): Promise<Result<Awaited<R>>>
async function checkout<R>(
  target: string,
  options?: string[],
): Promise<Result<undefined>>
async function checkout<R>(
  target: string,
  options?: string[],
  callback?: () => R,
): Promise<Result<undefined | Awaited<R>>> {
  const seq = sequentialCheckout()
  const [value, err] = await (() => {
    if (callback) {
      return seq.add(target, options ?? [], callback).do()
    } else {
      return seq.add(target, options ?? [], () => undefined).do()
    }
  })()
  if (err) {
    return [undefined, err]
  }

  return [value[0], undefined]
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
  async execInBranches<R>(branches: string[], callback: () => R) {
    return await branches
      .reduce(
        (seq, branch) => seq.add(branch, [], callback),
        sequentialCheckout<unknown, R>(),
      )
      .do()
  },
  checkout: async <R>(target: string, callback: () => R) =>
    await checkout(target, [], callback),
} as const satisfies {
  [key: string]: (
    // deno-lint-ignore no-explicit-any
    ...args: any[]
  ) => Promise<Result<unknown>>
}
