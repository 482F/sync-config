import {
  basename,
  dirname,
  resolve,
} from 'https://deno.land/std@0.196.0/path/mod.ts'
import { isJson } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/json.ts'
import { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { Config } from './misc.ts'

type EntryIntersection = {
  isFile: boolean
  isDirectory: boolean
  path: string
  name: string
}
type File = EntryIntersection & {
  isFile: true
  isDirectory: false
  body: string
  gened?: {
    name: string
    body: string
    path: string
    save: () => Promise<Result<undefined>>
  }
  save: () => Promise<Result<undefined>>
}

export type Dir = EntryIntersection & {
  isFile: false
  isDirectory: true
  children: {
    [name in string]: Entry
  }
}

export function getAllFiles(dir: Dir): File[] {
  return Object.values(dir.children).flatMap((child) =>
    child.isFile ? child : getAllFiles(child)
  )
}

type Entry = Dir | File

let i = 0

async function readTextFile(path: string): Promise<Result<string>> {
  return await Deno.readTextFile(path)
    .then((r) => [r, undefined] as const)
    .catch((e) => [undefined, e])
}

async function writeTextFile(
  path: string,
  body: string,
): Promise<Result<undefined>> {
  await Deno.mkdir(dirname(path), { recursive: true })
  return await Deno.writeTextFile(path, body, { create: true })
    .then(() => [undefined, undefined] as const)
    .catch((e) => [undefined, e])
}

export function modifyByConfig(config: Config, dir: Dir): File[] {
  const resolvedRules = config.folders.map((folder) => ({
    name: resolve(folder.name),
    destination: resolve(folder.destination),
  }))
  const pathConverter = (path: string) =>
    resolvedRules.map((rule) => {
      if (!path.includes(rule.name)) {
        return
      }
      return path.replace(rule.name, rule.destination)
    })
      .filter((path: string | undefined): path is string => Boolean(path))
  // TODO: 本当は file.path に基づいて Dir の木構造を変更したものを返したい。面倒なので一旦 getAllFiles
  return getAllFiles(_modifyByConfig(pathConverter, dir))
}

function _modifyByConfig(
  pathConverter: (path: string) => string[],
  dir: Dir,
): Dir {
  const modifiedDir: Dir = {
    isFile: false,
    isDirectory: true,
    path: dir.path,
    name: dir.name,
    children: {},
  }

  for (const child of Object.values(dir.children)) {
    const modifiedChild = (() => {
      if (child.isFile) {
        const mc = {
          ...child,
          ...(child.gened ?? {}),
        }
        delete mc.gened
        return mc
      } else {
        return _modifyByConfig(pathConverter, child)
      }
    })()
    const modifiedPaths = pathConverter(modifiedChild.path)
    if (modifiedPaths.length <= 0) {
      continue
    }

    // TODO: 展開先が複数あるルールの場合は children 下で name がユニークではなくなる
    // そもそもパスが変わっているのに木構造を変えていないことが原因なので修正する
    let i = 0
    for (const modifiedPath of modifiedPaths) {
      const newChild = {
        ...modifiedChild,
      }
      newChild.path = modifiedPath
      if (newChild.isFile) {
        newChild.save = async () =>
          await writeTextFile(modifiedPath, newChild.body)
      }
      modifiedDir.children[`${newChild.name}-${i++}`] = newChild
    }
  }

  return modifiedDir
}

async function walk(dirPath: string): Promise<Result<Dir>> {
  const dir: Dir = {
    name: basename(dirPath),
    path: dirPath,
    isFile: false,
    isDirectory: true,
    children: {},
  }
  const { children } = dir
  try {
    const dirEnts = await (async () => {
      try {
        const ai = Deno.readDir(dirPath)
        const result = []
        for await (const entry of ai) {
          result.push(entry)
        }
        return result
      } catch (e) {
        if (e.code === 'ENOENT') {
          throw new Error(`ディレクトリが見つかりませんでした: ${dirPath}`)
        }
        throw e
      }
    })()
    for (const entry of dirEnts) {
      const child = {
        ...entry,
        path: resolve(`${dirPath}/${entry.name}`),
      }
      if (child.isFile) {
        const isGen = child.name.match(/\.gen\.(ts|js)$/)
        const [body, bodyErr] = await readTextFile(child.path)
        if (bodyErr) {
          return [undefined, bodyErr]
        }
        const [gened, genedErr] = await (async () => {
          if (!isGen) {
            return [undefined, undefined]
          }
          const value: unknown = await import(`${child.path}?i=${i++}`).then((
            r,
          ) => r.default)
          if (!isJson(value)) {
            return [undefined, undefined]
          }

          const genedPath = child.path.replace(/\.gen\.(ts|js)$/, '')
          const genedBody = JSON.stringify(value, null, '  ')
          return [
            {
              name: child.name.replace(/\.gen\.(ts|js)$/, ''),
              path: genedPath,
              body: genedBody,
              save: async () => await writeTextFile(genedPath, genedBody),
            },
            undefined,
          ] as const
        })()
        if (genedErr) {
          return [undefined, genedErr]
        }
        children[child.name] = {
          ...child,
          isFile: true,
          isDirectory: false,
          body,
          gened,
          save: async () =>
            await writeTextFile(
              child.path,
              body,
            ),
        }
      } else {
        const [walkedChild, err] = await walk(child.path)
        if (err) {
          return [undefined, err]
        }
        children[child.name] = walkedChild
      }
    }
    return [dir, undefined]
  } catch (e) {
    return [undefined, e]
  }
}

export async function getTree(
  dirNames: string[],
  cwd = '.',
): Promise<Result<Dir>> {
  if (cwd === '.') {
    cwd = Deno.cwd()
  }
  const dir: Dir = {
    name: basename(cwd),
    path: cwd,
    isFile: false,
    isDirectory: true,
    children: {},
  }
  const childArray = await Promise.all(
    dirNames.map((dirName) => walk(`${cwd}/${dirName}`)),
  )
  const [, err] = childArray.find(([, err]) => err) ?? []
  if (err) {
    return [undefined, err]
  }
  dir.children = Object.fromEntries(
    childArray.map(([child]) => [child?.name, child] as const),
  )
  return [dir, undefined]
}
