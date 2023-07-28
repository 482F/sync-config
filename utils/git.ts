import { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/master/src/common.ts'

async function callGit(args: string[]): Promise<Result<string>> {
  const output = await new Deno.Command('git', { args }).output()
  if (output.success) {
    return [new TextDecoder().decode(output.stdout), undefined]
  } else {
    return [undefined, new Error(new TextDecoder().decode(output.stderr))]
  }
}

export const git = {
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
  async createBranchIfNotExists(branchName: string) {
    let r: Result<string>
    r = await callGit(['branch'])
    if (r[1]) {
      return [undefined, r[1]]
    }

    const [branches] = r
    if (branches.match(new RegExp(`^. ${branchName}$`, 'm'))) {
      return [false, undefined]
    }
    r = await callGit(['branch', branchName])

    if (r[1]) {
      return [undefined, r[1]]
    }
    return [true, undefined]
  },
} as const satisfies Record<
  string,
  // deno-lint-ignore no-explicit-any
  (...args: any[]) => Promise<Result<unknown>>
>
