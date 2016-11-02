import {
  getWebpackAotConfigPartial,
  getWebpackNonAotConfigPartial
} from './webpack-build-typescript';
const webpackMerge = require('webpack-merge');
import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';
import { GlobCopyWebpackPlugin } from '../plugins/glob-copy-webpack-plugin';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin');
import { CliConfig } from './config';
import {
  getWebpackCommonConfig,
  getWebpackDevConfigPartial,
  getWebpackProdConfigPartial,
  getWebpackMobileConfigPartial,
  getWebpackMobileProdConfigPartial
} from './';

export class NgCliWebpackConfig {
  // TODO: When webpack2 types are finished lets replace all these any types
  // so this is more maintainable in the future for devs
  public config: any;

  constructor(
    public ngCliProject: any,
    public target: string,
    public environment: string,
    outputDir?: string,
    baseHref?: string,
    isAoT = false,
    isDllLib = false,
    useDll = false
  ) {
    const config: CliConfig = CliConfig.fromProject();
    const appConfig = config.config.apps[0];

    appConfig.outDir = outputDir || appConfig.outDir;

    let baseConfig = getWebpackCommonConfig(
      this.ngCliProject.root,
      environment,
      appConfig,
      baseHref
    );
    let targetConfigPartial = this.getTargetConfig(this.ngCliProject.root, appConfig);
    const typescriptConfigPartial = isAoT
      ? getWebpackAotConfigPartial(this.ngCliProject.root, appConfig)
      : getWebpackNonAotConfigPartial(this.ngCliProject.root, appConfig);

    if (appConfig.mobile) {
      let mobileConfigPartial = getWebpackMobileConfigPartial(this.ngCliProject.root, appConfig);
      let mobileProdConfigPartial = getWebpackMobileProdConfigPartial(this.ngCliProject.root,
                                                                      appConfig);
      baseConfig = webpackMerge(baseConfig, mobileConfigPartial);
      if (this.target == 'production') {
        targetConfigPartial = webpackMerge(targetConfigPartial, mobileProdConfigPartial);
      }
    }

    this.config = webpackMerge(
      baseConfig,
      targetConfigPartial,
      typescriptConfigPartial
    );

    if (isDllLib) {
      const dll = [
        '@angular/common',
        '@angular/compiler',
        '@angular/core',
        '@angular/forms',
        '@angular/http',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
        '@angular/router'
      ];
      const appRoot = path.resolve(this.ngCliProject.root, appConfig.root);
      dll.push(path.resolve(appRoot, 'polyfills'));

      this.config.entry = { dll };
      this.config.output.library = 'angular_cli_[name]_lib';

      this.config.plugins = this.config.plugins.filter((plugin: any) => {
        if (plugin instanceof webpack.optimize.CommonsChunkPlugin) {
          return false;
        }
        if (plugin instanceof GlobCopyWebpackPlugin) {
          return false;
        }
        if (plugin instanceof HtmlWebpackPlugin) {
          return false;
        }
        return true;
      });

      const distDir = path.resolve(this.ngCliProject.root, outputDir);
      const manifestPath = path.resolve(distDir, 'dll.manifest.json');

      this.config.plugins.push(new (webpack as any).DllPlugin({
        path: manifestPath,
        name: this.config.output.library,
        context: distDir
      }));
    }

    if (useDll) {
      const distDir = path.resolve(this.ngCliProject.root, outputDir);
      const manifestBuffer = fs.readFileSync(path.resolve(distDir, 'dll.manifest.json'));
      const manifest = JSON.parse(manifestBuffer.toString());

      this.config.plugins.push(
        new (webpack as any).DllReferencePlugin({
          context: distDir,
          manifest
        })
      );

      this.config.plugins.push(
        new AddAssetHtmlPlugin({
          filepath: require.resolve(path.resolve(distDir, 'dll.bundle.js')),
          includeSourcemap: false
        })
      );
    }
  }

  getTargetConfig(projectRoot: string, appConfig: any): any {
    switch (this.target) {
      case 'development':
        return getWebpackDevConfigPartial(projectRoot, appConfig);
      case 'production':
        return getWebpackProdConfigPartial(projectRoot, appConfig);
      default:
        throw new Error("Invalid build target. Only 'development' and 'production' are available.");
    }
  }
}
