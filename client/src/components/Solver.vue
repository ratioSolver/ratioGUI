<template>
    <v-navigation-drawer v-model="drawer">
        <v-list>
            <v-list-item v-for="[key, value] in solvers" :key="key" @click="solvers_tab = value.id">
                <v-list-item-title>{{ value.id }}</v-list-item-title>
            </v-list-item>
        </v-list>
    </v-navigation-drawer>

    <v-app-bar>
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>

        <v-toolbar-title>oRatio</v-toolbar-title>

        <v-tabs v-model="solver_tab" color="deep-purple-accent-4">
            <v-tab value="timelines"><v-icon>mdi-chart-timeline</v-icon>Timelines</v-tab>
            <v-tab value="graph"><v-icon>mdi-graph-outline</v-icon>Graph</v-tab>
        </v-tabs>

        <v-spacer></v-spacer>

        <v-btn icon @click="useAppStore().tick()">
            <v-icon>mdi-metronome-tick</v-icon>
        </v-btn>
    </v-app-bar>

    <v-card class="fill-height">
        <v-window v-model="solver_tab">
            <Timelines></Timelines>
            <Graph></Graph>
        </v-window>
    </v-card>
</template>

<script setup>
import Timelines from './Timelines.vue';
import Graph from './Graph.vue';
import { useAppStore } from '@/store/app';
import { storeToRefs } from 'pinia';

const { drawer, solver_tab, solvers_tab, solvers } = storeToRefs(useAppStore());
</script>