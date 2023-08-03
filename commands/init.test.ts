import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.83.0/testing/asserts.ts'
import JSON5 from 'https://deno.land/x/json5@v1.0.0/mod.ts'
import { configFileName } from '../utils/const.ts'
import { initAction } from './init.ts'

Deno.test('init', async (t) => {
  const configFilePath = `./${configFileName}`
  await t.step('normal', async () => {
    await initAction()
    const config = JSON5.parse(await Deno.readTextFile(configFilePath))
    assert(config)
    await Deno.remove(configFilePath)
  })

  await t.step('existing', async () => {
    await initAction()
    await Deno.writeTextFile(configFilePath, JSON5.stringify(null))
    await initAction() // 既存ファイルが上書きされないことを確認
    const existingConfig = JSON5.parse(await Deno.readTextFile(configFilePath))
    assertEquals(existingConfig, null)
    await Deno.remove(configFilePath)
  })
})
