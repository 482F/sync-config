import {
  assertEquals,
  assertNotEquals,
  assertStrictEquals,
  assertThrowsAsync,
} from 'https://deno.land/std@0.83.0/testing/asserts.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { git } from './git.ts'

async function prepare(f: () => void | Promise<void>) {
  const finallies: (() => void | Promise<void>)[] = []
  try {
    finallies.push(() => Deno.remove('test', { recursive: true }))
    await Deno.mkdir('test', { recursive: true })

    finallies.push(() => Deno.chdir('..'))
    Deno.chdir('test')

    await new Deno.Command('git', { args: ['init'] }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.name', 'user-name'],
    }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.email', 'user-email@example.com'],
    }).output()
    await new Deno.Command('git', {
      args: ['commit', '--allow-empty', '-m', 'master initial commit'],
    }).output()

    await f()
  } finally {
    for (const fin of finallies.toReversed()) {
      await fin()
    }
  }
}

Deno.test('git', async (t) => {
  await t.step('normal', async () => {
    await prepare(async () => {
      const commits = unwrap(await git.log('HEAD'))
      const [commit] = commits
      assertEquals(commits.length, 1)
      assertEquals(commit?.message, 'master initial commit')

      assertEquals(unwrap(await git.isGitDirRoot()), true)

      await Deno.mkdir('nest')
      Deno.chdir('nest')
      assertEquals(unwrap(await git.isGitDirRoot()), false)
      Deno.chdir('..')
      await Deno.remove('nest', { recursive: true })

      assertEquals(unwrap(await git.hasUncommitedChanges()), false)
      await Deno.writeTextFile('a.txt', 'aaa')
      assertEquals(unwrap(await git.hasUncommitedChanges()), true)

      assertEquals(
        unwrap(await git.commitAll('add a.txt\n\ntest commit\ncommit all'))
          .message,
        'add a.txt\n\ntest commit\ncommit all',
      )
      assertEquals(unwrap(await git.hasUncommitedChanges()), false)
      assertEquals(
        unwrap(await git.log('HEAD')).at(-1)?.message,
        'add a.txt\n\ntest commit\ncommit all',
      )

      assertEquals(
        unwrap(await git.createOrphanBranchIfNotExists('orphan')),
        true,
      )
      assertEquals(
        unwrap(await git.createOrphanBranchIfNotExists('orphan')),
        false,
      )
      assertStrictEquals(
        unwrap(await git.log('orphan')).at(-1)?.message,
        'initial commit',
      )

      assertEquals(
        unwrap(
          await git.addRemoteIfNotExists(
            'rem',
            'https://github.com/482F/alt-osciroi.git',
          ),
        ),
        true,
      )
      assertEquals(
        unwrap(
          await git.addRemoteIfNotExists(
            'rem',
            'https://github.com/482F/alt-osciroi.git',
          ),
        ),
        false,
      )
      unwrap(await git.fetch('rem'))
      assertEquals(unwrap(await git.log('rem/master')).length, 3)

      const result = await Promise.all(unwrap(
        await git.execInBranches(
          ['rem/master', 'master'],
          async () => {
            const r: Deno.DirEntry[] = []
            for await (const e of Deno.readDir('.')) {
              r.push(e)
            }
            return r
          },
        ),
      ))
      assertEquals(result.length, 2)
      assertNotEquals(result[0]?.length, result[1]?.length)

      const remCommits = unwrap(
        await git.checkout('rem/master', () => git.log('HEAD')),
      )
      assertNotEquals(remCommits.length, 1)

      assertEquals(unwrap(await git.getCurrentBranchName()), 'master')

      assertEquals(
        unwrap(await git.cherryPick(['remotes/rem/master~2'])),
        undefined,
      )

      assertThrowsAsync(async () =>
        unwrap(await git.cherryPick(['remotes/rem/master~0']))
      )
    })
  })
})
