const baseConfig = require('./jest.config.prod.base');

module.exports = {
    ...baseConfig,
    testRegex: '/__tests__/unit/.*\\.js$',
};
