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
    /**
     * 入口点文件
     * @type {string[]}
     */
    entryPoints: ['src/extension.ts'],

    /**
     * 是否将所有依赖打包到一个文件中
     * @type {boolean}
     */
    bundle: true,

    /**
     * 输出格式,这里是CommonJS
     * @type {'cjs' | 'esm' | 'iife'}
     */
    format: 'cjs',

    /**
     * 是否压缩代码,根据production变量决定
     * @type {boolean}
     */
    minify: production,

    /**
     * 是否生成sourcemap,非生产环境下生成
     * @type {boolean}
     */
    sourcemap: !production,

    /**
     * 是否在sourcemap中包含源代码内容
     * @type {boolean}
     */
    sourcesContent: false,

    /**
     * 目标平台
     * @type {'browser' | 'node' | 'neutral'}
     */
    platform: 'node',

    /**
     * 输出文件路径
     * @type {string}
     */
    outfile: 'dist/extension.js',

    /**
     * 外部依赖,不会被打包
     * @type {string[]}
     */
    external: ['vscode'],

    /**
     * 日志级别
     * @type {'verbose' | 'debug' | 'info' | 'warning' | 'error' | 'silent'}
     */
    logLevel: 'silent',

    /**
     * 使用的插件
     * @type {import('esbuild').Plugin[]}
     */
    plugins: [
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
