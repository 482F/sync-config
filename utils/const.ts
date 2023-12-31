export const configFileName = 'sync-config.json5'

export const mergeModes = ['cherry-pick-squash', 'cherry-pick'] as const
export type MergeMode = typeof mergeModes[number]

export const git = {
  branch: {
    remote: 'sync-config---remote',
  },
  remote: 'sync-config---template-remote',
} as const
