export const workbenchEmbedded =
  window.parent !== window && new URLSearchParams(window.location.search).get('embed') === 'workbench'

export const workbenchSidebarKey = 'wu-workbench:sidebar'
