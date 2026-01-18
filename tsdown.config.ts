import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['./src/main.ts'],
    // outDir: './dist',
    format: 'cjs',
    outputOptions:{
        file: 'main.js',
    },
    clean: false,
    external: ['obsidian'],
})
