module.exports = {
  root: true,
  extends: ['airbnb-base', 'prettier'],
  rules: {
    'import/extensions': 0,
    'no-console': 0, // We can remove this later
    'no-underscore-dangle': 0,
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
  },
  env: {
    browser: 1,
  },
};
