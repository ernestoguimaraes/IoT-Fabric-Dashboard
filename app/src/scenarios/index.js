import { createMachines } from '../shared/machines.js';
import { factoryProfile } from './factory.js';
import { farmProfile } from './farm.js';

const KEY = 'iot-scenario';

export function readScenarioId() {
  try {
    return localStorage.getItem(KEY) === 'farm' ? 'farm' : 'factory';
  } catch {
    return 'factory';
  }
}

export function saveScenarioId(id) {
  try { localStorage.setItem(KEY, id === 'farm' ? 'farm' : 'factory'); } catch { /* demonstração sem storage */ }
}

const profiles = {
  factory: { ...factoryProfile, createAssets: createMachines },
  farm: farmProfile,
};

let activeId = 'factory';

export function setActiveScenario(id) {
  activeId = id === 'farm' ? 'farm' : 'factory';
  return profiles[activeId];
}

export function activeScenario() {
  return profiles[activeId] || profiles.factory;
}

export function getScenario(id) {
  return profiles[id === 'farm' ? 'farm' : 'factory'];
}
