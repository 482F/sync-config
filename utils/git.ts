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
  async status(...options: string[]) {
    return await callGit(['status', ...options])
  },
} satisfies Record<string, () => Promise<Result<unknown>>>
