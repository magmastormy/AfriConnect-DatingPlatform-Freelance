/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // `scripts` holds the one-off migration entrypoints. It used to live at the
  // repo root with its own jest config that `turbo run test` never invoked, so
  // its suite silently never ran in CI.
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@africonnect/shared$': '<rootDir>/../shared/src/index.ts',
    '^@africonnect/shared/errors$': '<rootDir>/../shared/src/errors/AppError.ts',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    // pnpm strict mode does not hoist these shared-only deps into packages/api,
    // but providers.test.ts mocks them; point the resolver at the pnpm store copies.
    '^@aws-sdk/client-s3$':
      '<rootDir>/../../node_modules/.pnpm/@aws-sdk+client-s3@3.1108.0/node_modules/@aws-sdk/client-s3',
    '^cloudinary$':
      '<rootDir>/../../node_modules/.pnpm/cloudinary@2.10.0/node_modules/cloudinary',
  },
};
