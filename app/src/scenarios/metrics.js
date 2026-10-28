// Métricas exibidas no painel. A fábrica usa o trio clássico quando o ativo não declara as suas.

export const FACTORY_METRICS = [
  { key: 'temp', label: 'Temperatura', unit: '°C', digits: 0, limit: 'tempLimit' },
  { key: 'vib', label: 'Vibração', unit: 'mm/s', digits: 1, limit: 'vibLimit' },
  { key: 'usage', label: 'Uso', unit: '%', digits: 0, scale: 100 },
];

export function metricsOf(asset) {
  return asset?.metrics || FACTORY_METRICS;
}

export function metricOver(asset, metric) {
  if (!asset || asset.commLost || !metric?.limit) return false;
  const value = asset[metric.key];
  const limit = asset.params?.[metric.limit];
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return false;
  return metric.invert ? value <= limit : value >= limit;
}

export function metricRatio(asset, metric) {
  const value = asset?.[metric.key];
  if (!Number.isFinite(value)) return 0;
  if (metric.invert || metric.scale) return value / (metric.scale || 100);
  const limit = asset.params?.[metric.limit];
  return limit ? value / limit : 0;
}
