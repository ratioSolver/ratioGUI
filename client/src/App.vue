<template>
  <v-app>
    <v-navigation-drawer v-model="drawer">
      <v-tabs v-model="solver" direction="vertical" color="deep-purple-accent-4">
        <v-tab v-for="[key, value] in solvers">
          <v-icon>mdi-chart-timeline</v-icon>{{ value.id }}
        </v-tab>
      </v-tabs>
    </v-navigation-drawer>

    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>oRatio</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-btn icon @click="useAppStore().tick()">
        <v-icon>mdi-metronome-tick</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-window v-model="solver" direction="vertical">
        <v-window-item v-for="[key, value] of solvers">
          <Solver :solver_id="key"></Solver>
        </v-window-item>
      </v-window>
    </v-main>
  </v-app>
</template>

<script>
export default {
  data: () => ({
    drawer: false,
    solver: 0
  })
}
</script>

<script setup>
import Solver from './components/Solver.vue';
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

const { connected, solvers } = storeToRefs(useAppStore());
</script>
