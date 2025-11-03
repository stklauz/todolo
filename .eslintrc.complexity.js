// ESLint config for complexity checking (can be run separately)
module.exports = {
  extends: './.eslintrc.js',
  rules: {
    // Cognitive complexity - warns if function is too complex
    complexity: ['warn', { max: 15 }],

    // Max function length
    'max-lines-per-function': [
      'warn',
      {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      },
    ],

    // Max nesting depth
    'max-depth': ['warn', 4],

    // Max parameters
    'max-params': ['warn', 6],

    // Max statements in a function
    'max-statements': ['warn', 30],
  },
};
