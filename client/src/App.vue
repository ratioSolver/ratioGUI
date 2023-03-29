<template>
  <v-app>
    <v-navigation-drawer v-model='drawer'>
      <v-tabs v-model='solver' direction='vertical' color='deep-purple-accent-4'>
        <v-tab v-for='[key, value] in solvers'>
          <v-col class='text-left'>
            <v-icon>mdi-brain</v-icon>{{ value.name }}
          </v-col>
          <v-col class='text-right'>
            <v-progress-circular v-if="solvers.get(key).state == 'reasoning'" :size="20" indeterminate
              color="primary"></v-progress-circular>
            <v-progress-circular v-if="solvers.get(key).state == 'adapting'" :size="20" indeterminate
              color="primary"></v-progress-circular>
            <v-icon v-if="solvers.get(key).state == 'idle'">mdi-pause-circle</v-icon>
            <v-icon v-if="solvers.get(key).state == 'failed'">mdi-alert-circle</v-icon>
            <v-icon v-if="solvers.get(key).state == 'executing'">mdi-play-circle</v-icon>
            <v-icon v-if="solvers.get(key).state == 'finished'">mdi-check-circle</v-icon>
          </v-col>
        </v-tab>
      </v-tabs>
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
      <v-window id='main-window' v-model='solver' direction='vertical' class='fill-height' show-arrows>
        <v-window-item v-for='[key, value] of solvers' class='fill-height' :eager='true'>
          <v-window v-model='tab' class='fill-height'>
            <v-window-item :id='getTimelinesId(key)' value='timelines' class='fill-height' :eager='true' />
            <v-window-item :id='getGraphId(key)' value='graph' class='fill-height' :eager='true' />
          </v-window>
        </v-window-item>
      </v-window>
    </v-main>
  </v-app>
</template>

<script>
export default {
  data: () => ({
    tab: 'timelines',
    drawer: false,
    solver: 0
  })
}
</script>

<script setup>
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

const { connected, solvers, reasoning, idle, inconsistent, getTimelinesId, getGraphId } = storeToRefs(useAppStore());
</script>
