import type { HierarchicalNSW } from 'hnswlib-node'

export function createHnswIndex(space: 'cosine' | 'l2', dimensions: number): HierarchicalNSW {
  const { HierarchicalNSW: HnswClass } = require('hnswlib-node') as typeof import('hnswlib-node')
  const index = new HnswClass(space, dimensions)
  index.initIndex(1000)
  index.setEf(64)
  return index
}

export function loadHnswIndex(
  filePath: string,
  space: 'cosine' | 'l2',
  dimensions: number
): HierarchicalNSW {
  const { HierarchicalNSW: HnswClass } = require('hnswlib-node') as typeof import('hnswlib-node')
  const index = new HnswClass(space, dimensions)
  index.readIndexSync(filePath)
  return index
}
