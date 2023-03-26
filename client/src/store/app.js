// Utilities
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    tab: null
  }),
  methods: {
    tick() {
      console.log('tick');
    }
  }
})
