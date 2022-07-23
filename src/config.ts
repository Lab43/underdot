export interface Config {
  source?: string,
  destination?: string,
  concurrency?: number,
}

const defaultConfig: Config = {
  source: 'source',
  destination: 'destination',
  concurrency: 50,
}

export default defaultConfig;