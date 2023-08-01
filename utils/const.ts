export const configFileName = 'sync-config.json5'

export const git = {
  branch: {
    local: 'sync-config---local',
    remote: 'sync-config---remote',
  },
  remote: 'sync-config---template-remote',
} as const
