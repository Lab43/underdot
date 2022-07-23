export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverage: true,
  snapshotSerializers: [
    '<rootDir>/tests/utils/buffer-serializer',
  ]
};