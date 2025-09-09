const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'First Aid Kit Lite',
    executableName: 'first-aid-kit-lite',
    icon: './src/assets/icons/icon',
    protocols: [
      {
        name: 'First Aid Kit Protocol',
        schemes: ['first-aid-kit', 'fak']
      }
    ],
    win32metadata: {
      ProductName: 'First Aid Kit Lite',
      CompanyName: 'First Aid Kit Lite',
      FileDescription: 'Secure PowerShell maintenance scripts',
      OriginalFilename: 'first-aid-kit-lite.exe'
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'first-aid-kit-lite',
        setupExe: 'FirstAidKitLite-Setup.exe',
        setupIcon: './src/assets/icons/icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        devContentSecurityPolicy: "connect-src 'self' 'unsafe-eval'",
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.tsx',
              name: 'main_window',
              preload: {
                js: './src/preload/preload.ts',
              },
            },
          ],
        },
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};