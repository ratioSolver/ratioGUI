<template>
  <v-app>
    <v-navigation-drawer v-model='drawer'>
      <v-list dense v-model:selected="current_solver">
        <SolverListItem v-for="[id, solver] in solvers" :key="id" :solver="solver" />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar>
      <v-app-bar-nav-icon @click='drawer = !drawer'></v-app-bar-nav-icon>
      <v-toolbar-title>oRatio</v-toolbar-title>

      <v-tabs v-model='tab' color='deep-purple-accent-4'>
        <v-tab value='timelines'><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
        <v-tab value='graph'><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
      </v-tabs>

      <v-spacer></v-spacer>

      <v-icon v-if='!connected' color='red'>mdi-wifi-off</v-icon>
      <v-btn icon @click='useAppStore().tick()'>
        <v-icon>mdi-metronome-tick</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-window id='main-window' v-model='current_solver' direction='vertical' class='fill-height' show-arrows>
        <Solver v-for="[id, solver] in solvers" :key="id" :solver="solver" />
      </v-window>
    </v-main>
  </v-app>
</template>

<script>
export default {
  data: () => ({
    tab: 'timelines',
    drawer: false,
    current_solver: null
  })
}
</script>

<script setup>
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';
import SolverListItem from '@/components/SolverListItem.vue';
import Solver from '@/components/Solver.vue';

const { connected, solvers, get_timelines_id, get_graph_id } = storeToRefs(useAppStore());
</script>
