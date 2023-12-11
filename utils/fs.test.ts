import { assertEquals } from 'https://deno.land/std@0.83.0/testing/asserts.ts'
import { getAllFiles, getTree, modifyByConfig } from './fs.ts'
import { unwrap } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'

async function prepare(f: () => void | Promise<void>) {
  const finallies: (() => void | Promise<void>)[] = []
  try {
    finallies.push(() => Deno.remove('test', { recursive: true }))
    await Deno.mkdir('test/a', { recursive: true })
    await Deno.mkdir('test/u', { recursive: true })

    await Deno.writeTextFile('test/u/u.txt', 'uuu')
    await Deno.writeTextFile('test/a/c.txt', 'ccc')
    await Deno.writeTextFile(
      'test/a/j.json.gen.ts',
      'export default ({ key: \'value\' }) as const',
    )

    finallies.push(() => Deno.chdir('..'))
    Deno.chdir('test')
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
      const [tree, err] = await getTree(['a', 'u'])
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

      assertEquals(getAllFiles(tree).length, 3)

      const gen = a.children['j.json.gen.ts']
      if (!gen?.isFile || !gen.gened) {
        throw new Error('')
      }

      assertEquals(gen.body, 'export default ({ key: \'value\' }) as const')
      assertEquals(gen.gened.body, '{\n  "key": "value"\n}')
      assertEquals(gen.name, 'j.json.gen.ts')
      assertEquals(gen.gened.name, 'j.json')

      unwrap(await gen.gened.save())
      assertEquals(
        await Deno.readTextFile('a/j.json'),
        '{\n  "key": "value"\n}',
      )

      const modifiedFiles = modifyByConfig({
        repository: {
          url: '',
          branch: '',
        },
        folders: [{
          name: 'a',
          destination: '.',
        }],
        mergeMode: 'cherry-pick-squash',
      }, tree)

      const modifiedGen = modifiedFiles.find((file) => file.name === 'j.json')
      if (!modifiedGen?.isFile) {
        throw new Error('')
      }

      assertEquals(modifiedGen.body, '{\n  "key": "value"\n}')
      unwrap(await modifiedGen.save())
      assertEquals(await Deno.readTextFile('j.json'), '{\n  "key": "value"\n}')

      assertEquals(modifiedFiles.length, 2)
    })
  })
})
