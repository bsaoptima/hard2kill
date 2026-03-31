#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, '../platform/src/index.tsx')],
  bundle: true,
  outfile: path.join(__dirname, '../platform/public/script.js'),
  sourcemap: true,
  platform: 'browser',
  target: 'es2015',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'jsx',
    '.css': 'css',
    '.png': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.ico': 'file',
    '.ogg': 'file',
    '.mp3': 'file',
    '.wav': 'file',
  },
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    'process.env.SUPABASE_URL': `"${process.env.SUPABASE_URL || ''}"`,
    'process.env.SUPABASE_ANON_KEY': `"${process.env.SUPABASE_ANON_KEY || ''}"`,
  },
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      await esbuild.build({
        ...buildOptions,
        watch: {
          onRebuild(error, result) {
            if (error) {
              console.error('❌ Rebuild failed:', error);
            } else {
              console.log('✅ Rebuilt successfully');
            }
          },
        },
      });
      console.log('✅ Initial build complete!');
      console.log('👀 Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build complete!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
