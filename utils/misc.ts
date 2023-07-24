export type Config = {
  repository: string
  folders: Array<{
    name: string
    destination: string
  }>
}
