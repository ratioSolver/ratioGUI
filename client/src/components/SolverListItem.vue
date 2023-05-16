<template>
  <v-list-item :value="solver.id" :title="solver.name">
    <v-icon :icon="useAppStore().solver_state_icon(solver.state)"></v-icon>
  </v-list-item>
</template>

<script setup>
import { useAppStore } from '@/store/app';

defineProps({
  solver: {
    type: Object,
    required: true,
  },
});
</script>