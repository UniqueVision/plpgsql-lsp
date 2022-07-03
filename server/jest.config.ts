/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
  },

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  modulePathIgnorePatterns: ["out"],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ["/node_modules/", "__tests__/helpers"],

  // A map from regular expressions to paths to transformers
  transform: { "\\.ts$": ["ts-jest"] },

  testTimeout: 20000,
}
