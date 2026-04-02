import { createSSRApp } from 'vue';
import App from './App.vue';
import { createPinia } from "pinia";
import pinia from './stores/index';
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

export function createApp() {
  const app = createSSRApp(App);
  pinia.use(piniaPluginPersistedstate);
  app.use(pinia);
  app.mount('#app');
  return {
    app,
    pinia
  };
}
