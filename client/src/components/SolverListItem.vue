<template>
  <v-list-item :value="solver.id" :title="solver.name" :append-icon="useAppStore().solver_state_icon(solver.state)" />
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