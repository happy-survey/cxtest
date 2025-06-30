import nodeResolve from '@rollup/plugin-node-resolve';

export default {
  input: 'dist/esm/index.js',
  output: [
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorCXONEVoice',
      globals: {
        '@capacitor/core': 'capacitorExports',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  external: [
    '@capacitor/core',
    '@nice-devone/core-sdk',
    '@nice-devone/voice-sdk',
    '@nice-devone/common-sdk',
    '@nice-devone/i18n',
    '@nice-devone/shared-apps-lib'
  ],
  plugins: [
    nodeResolve({
      preferBuiltins: false,
    }),
  ],
};