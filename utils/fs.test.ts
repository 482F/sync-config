import { assertEquals } from 'https://deno.land/std@0.83.0/testing/asserts.ts'
import { getAllFiles, getTree } from './fs.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'

async function prepare(f: () => void | Promise<void>) {
  const finallies: (() => void | Promise<void>)[] = []
  try {
    finallies.push(() => Deno.remove('test', { recursive: true }))
    await Deno.mkdir('test/a', { recursive: true })

    await Deno.writeTextFile('test/a/c.txt', 'ccc')

    finallies.push(() => Deno.chdir('..'))
    await Deno.chdir('test')
    await f()
  } finally {
    for (const fin of finallies.toReversed()) {
      await fin()
    }
  }
}

Deno.test('tree', async (t) => {
  await t.step('normal', async () => {
    await prepare(async () => {
      const [tree, err] = await getTree(['a'])
      assertEquals(err, undefined)
      if (err !== undefined) {
        throw err
      }

      const a = tree.children['a']
      if (!a?.isDirectory) {
        throw new Error('')
      }

      assertEquals(a.isDirectory, true)
      assertEquals(a.children['c.txt']?.isFile, true)

      const ctxt = a.children['c.txt']
      if (!ctxt?.isFile) {
        throw new Error('')
      }

      assertEquals(ctxt.body, 'ccc')

      await Deno.remove('a', { recursive: true })
      unwrap(await ctxt.save())
      assertEquals(await Deno.readTextFile('a/c.txt'), 'ccc')

      assertEquals(getAllFiles(tree).length, 1)
    })
  })
})
