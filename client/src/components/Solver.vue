<template>
    <v-tabs v-model="tab" color="deep-purple-accent-4">
        <v-tab value="timelines"><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
        <v-tab value="graph"><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
    </v-tabs>

    <v-window v-model="tab">
        <v-window-item value="timelines">
            <Timelines :solver_id="solver_id"></Timelines>
        </v-window-item>
        <v-window-item value="graph">
            <Graph :solver_id="solver_id"></Graph>
        </v-window-item>
    </v-window>
</template>

<script>
export default {
    props: {
        solver_id: String
    },
    data: () => ({
        tab: 'timelines'
    })
}
</script>

<script setup>
import Timelines from './Timelines.vue';
import Graph from './Graph.vue';
</script>