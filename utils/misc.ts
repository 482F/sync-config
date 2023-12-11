import { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { doExtends } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/json.ts'
import { configFileName, MergeMode } from './const.ts'
import JSON5 from 'https://deno.land/x/json5@v1.0.0/mod.ts'

const configModel = {
  repository: {
    url: '',
    branch: '',
  },
  folders: [
    {
      name: '',
      destination: '',
    },
  ],
  mergeMode: 'cherry-pick-squash' satisfies MergeMode as MergeMode,
}

export type Config = typeof configModel

export async function isExists(filePath: string) {
  return await Deno.stat(filePath).catch(() => null).then(
    Boolean,
  )
}

export const getConfig: () => Promise<Result<Config>> = (() => {
  const configPromise = (async (): Promise<Result<Config>> => {
    const configFilePath = `./${configFileName}`
    const isExistsConfig = await isExists(configFilePath)
    if (!isExistsConfig) {
      return [
        undefined,
        new ExpectedError(
          'カレントディレクトリに sync-config.json5 が存在しません',
        ),
      ]
    }

    const config: unknown = JSON5.parse(await Deno.readTextFile(configFilePath))
    const [extendedConfig, e] = doExtends(config, configModel)
    if (e) {
      return [undefined, e]
    }

    return [extendedConfig, undefined]
  })()
  return () => configPromise
})()

export class ExpectedError extends Error {
}
