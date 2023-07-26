import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import JSON5 from 'https://deno.land/x/json5@v1.0.0/mod.ts'
import { ConfigFileName } from '../utils/const.ts'
import { type Config } from '../utils/misc.ts'

export async function initAction() {
  const configFilePath = `./${ConfigFileName}`
  const isExistsConfig = await Deno.stat(configFilePath).catch(() => null).then(
    Boolean,
  )
  if (isExistsConfig) {
    return
  }

  const defaultConfig = {
    repository: {
      url: '',
      branch: 'master',
    },
    folders: [
      {
        name: '',
        destination: '.',
      },
    ],
  } satisfies Config
  await Deno.writeTextFile(
    configFilePath,
    JSON5.stringify(defaultConfig, null, 2) + '\n',
  )
}

export const initCommand = new Command()
  .description('sync-config.json を作成します')
  .action(initAction)
