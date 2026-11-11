// O Chromium do Playwright desliga o PaintHolding (issue 28023): sem ele a transição entre páginas trava a pintura da
// página nova (artefato do teste, o Chrome de verdade tem PaintHolding). Aqui: as mesmas opções, com o PaintHolding ligado.
const FEAT = ['AvoidUnnecessaryBeforeUnloadCheckSync', 'BoundaryEventDispatchTracksNodeRemoval', 'DestroyProfileOnBrowserClose', 'DialMediaRouteProvider',
  'GlobalMediaControls', 'HttpsUpgrades', 'LensOverlay', 'MediaRouter', 'PaintHolding', 'ThirdPartyStoragePartitioning', 'Translate', 'AutoDeElevate',
  'RenderDocument', 'OptimizationHints', 'msForceBrowserSignIn', 'msEdgeUpdateLaunchServicesPreferredVersion'];
module.exports = (extra = {}) => ({
  ...extra,
  ignoreDefaultArgs: ['--disable-features=' + FEAT.join(','), ...(extra.ignoreDefaultArgs || [])],
  args: ['--disable-features=' + FEAT.filter((f) => f !== 'PaintHolding' && f !== 'RenderDocument').join(','), ...(extra.args || [])],
});
