/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Components
import App from './App.vue';

// Composables
import { createApp } from 'vue';

// Plugins
import { registerPlugins } from '@/plugins';
import { useAppStore } from './store/app';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

useAppStore().connect('ws://' + location.hostname + ':' + 8080 + '/solver');