<template>
  <v-window-item :value='solver.id' class='fill-height' eager>
    <v-tabs v-model='tab' color='deep-purple-accent-4'>
      <v-tab value='timelines'><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
      <v-tab value='graph'><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
    </v-tabs>
    <v-window :id='"slv-" + solver.id' v-model='tab' class='fill-height' show-arrows>
      <v-window-item :id='get_timelines_id(solver.id)' value='timelines' class='fill-height' eager />
      <v-window-item :id='get_graph_id(solver.id)' value='graph' class='fill-height' eager />
    </v-window>
  </v-window-item>
</template>

<script>
export default {
  data: () => ({
    tab: 'timelines'
  })
}
</script>

<script setup>
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

defineProps({
  solver: {
    type: Object,
    required: true,
  },
});

const { get_timelines_id, get_graph_id } = storeToRefs(useAppStore());
</script>