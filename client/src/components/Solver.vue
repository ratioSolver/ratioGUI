<template>
  <v-window-item :value='props.solver.id' class='fill-height' eager>
    <v-tabs v-if='show_tabs' v-model='props.tab' color='deep-purple-accent-4'>
      <v-tab value='timelines'><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
      <v-tab value='graph'><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
    </v-tabs>
    <v-window :id='"slv-" + props.solver.id' v-model='props.tab' class='fill-height' show-arrows>
      <v-window-item :id='get_timelines_id(props.solver.id)' value='timelines' class='fill-height' eager />
      <v-window-item :id='get_graph_id(props.solver.id)' value='graph' class='fill-height' eager />
    </v-window>
  </v-window-item>
</template>

<script setup>
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

const props = defineProps({
  solver: {
    type: Object,
    required: true,
  },
  show_tabs: {
    type: Boolean,
    required: false,
    default: true,
  },
  tab: {
    type: String,
    required: false,
    default: 'timelines',
  },
});

const { get_timelines_id, get_graph_id } = storeToRefs(useAppStore());
</script>