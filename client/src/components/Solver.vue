<template>
    <v-tabs v-model="tab" color="deep-purple-accent-4">
        <v-tab value="timelines"><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
        <v-tab value="graph"><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
    </v-tabs>

    <v-card>
        <v-card-text>
            <v-window v-model="tab">
                <Timelines></Timelines>
                <Graph></Graph>
            </v-window>
        </v-card-text>
    </v-card>
</template>

<script setup>
import Timelines from './Timelines.vue';
import Graph from './Graph.vue';
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

const { tab } = storeToRefs(useAppStore());
</script>