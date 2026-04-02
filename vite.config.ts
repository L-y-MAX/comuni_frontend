import { defineConfig, loadEnv } from 'vite'
import uni from "@dcloudio/vite-plugin-uni";
import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        charset: false // 解决编码警告
      }
    }
  },
  resolve: {
    // 配置路径别名
    alias: {
      '@': path.resolve(__dirname, './src') // @ 指向项目根目录的 src 文件夹
    }
  }
});
