import * as rimraf from 'rimraf';
import * as path from 'path';
const Task = require('ember-cli/lib/models/task');
import * as webpack from 'webpack';
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
import { BuildOptions } from '../commands/build';
import { NgCliWebpackConfig } from '../models/webpack-config';
import { webpackOutputOptions } from '../models/';
import { CliConfig } from '../models/config';

// Configure build and output;
let lastHash: any = null;

export default <any>Task.extend({
  run(runTaskOptions: BuildOptions) {
    const project = this.cliProject;

    const cliConfig = CliConfig.fromProject();
    const appConfig = cliConfig.config.apps[0];
    const outputDir = runTaskOptions.outputPath || appConfig.outDir;
    rimraf.sync(path.resolve(project.root, outputDir));

    return Promise.resolve()
      .then(() => runTaskOptions.dll ? this.buildDll(runTaskOptions, outputDir) : true)
      .then(() => this.startBuild(runTaskOptions, outputDir));
  },

  buildDll(runTaskOptions: BuildOptions, outputDir: string) {
    const project = this.cliProject;

    const dllConfig = new NgCliWebpackConfig(
      project,
      runTaskOptions.target,
      runTaskOptions.environment,
      outputDir,
      runTaskOptions.baseHref,
      runTaskOptions.aot,
      true
    ).config;

    // fail on build error
    dllConfig.bail = true;

    const dllCompiler: any = webpack(dllConfig);

    dllCompiler.apply(new ProgressPlugin({
      profile: true
    }));

    return new Promise((resolve, reject) => {
      dllCompiler.run((err: any, stats: any) => {
        if (err) {
          console.error(err.details || err);
          reject(err.details || err);
        }

        process.stdout.write(stats.toString(webpackOutputOptions) + '\n');
        resolve();
      });
    });
  },

  startBuild(runTaskOptions: BuildOptions, outputDir: string) {
    const project = this.cliProject;

    const config = new NgCliWebpackConfig(
      project,
      runTaskOptions.target,
      runTaskOptions.environment,
      outputDir,
      runTaskOptions.baseHref,
      runTaskOptions.aot,
      false,
      runTaskOptions.dll
    ).config;

    // fail on build error
    config.bail = true;

    const webpackCompiler: any = webpack(config);

    webpackCompiler.apply(new ProgressPlugin({
      profile: true
    }));

    return new Promise((resolve, reject) => {
      webpackCompiler.run((err: any, stats: any) => {
        // Don't keep cache
        // TODO: Make conditional if using --watch
        webpackCompiler.purgeInputFileSystem();

        if (err) {
          lastHash = null;
          console.error(err.details || err);
          reject(err.details || err);
        }

        if (stats.hash !== lastHash) {
          lastHash = stats.hash;
          process.stdout.write(stats.toString(webpackOutputOptions) + '\n');
        }
        resolve();
      });
    });
  }
});
