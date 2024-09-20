const esbuild = require("esbuild");

/**
 * 是否为生产环境
 * @type {boolean}
 */
const production = process.argv.includes('--production');

/**
 * 是否启用监视模式
 * @type {boolean}
 */
const watch = process.argv.includes('--watch');

/**
 * esbuild插件,用于输出构建过程中的问题
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  /**
   * 设置插件
   * @param {import('esbuild').PluginBuild} build - esbuild构建对象
   */
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

/**
 * 主函数,执行esbuild构建过程
 */
async function main() {
  /**
   * esbuild上下文对象
   * @type {import('esbuild').Context}
   */
  const ctx = await esbuild.context({
    entryPoints: [
      'src/extension.ts'
    ],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

// 执行主函数
main().catch(e => {
  console.error(e);
  process.exit(1);
});
