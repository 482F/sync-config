import { basename, dirname } from 'https://deno.land/std@0.196.0/path/mod.ts'
import { isJson } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/json.ts'
import { Result } from 'https://raw.githubusercontent.com/482F/482F-ts-utils/v2.x.x/src/result.ts'
import { ExpectedError } from './misc.ts'

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
    for await (const entry of Deno.readDir(dirPath)) {
      const child = {
        ...entry,
        path: `${dirPath}/${entry.name}`,
      }
      if (child.isFile) {
        const [body, err]: Result<string> = await (async () => {
          if (child.name.match(/\.gen\.(ts|js)$/)) {
            const value: unknown = await import(child.path).then((r) =>
              r.default
            )
            if (!isJson(value)) {
              return [
                undefined,
                new ExpectedError(
                  `${child.path} は JSON 形式の値を export default していません`,
                ),
              ]
            }
            return [JSON.stringify(value, null, '  '), undefined] as const
          }
          return await readTextFile(child.path)
        })()
        if (err) {
          return [undefined, err]
        }
        children[child.name] = {
          ...child,
          isFile: true,
          isDirectory: false,
          body,
          save: async () => await writeTextFile(child.path, body),
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
