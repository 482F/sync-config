export type Config = {
  repository: {
    url: string
    branch: string
  }
  folders: Array<{
    name: string
    destination: string
  }>
}

export class ExpectedError extends Error {
}
