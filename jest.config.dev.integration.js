const baseConfig = require('./jest.config.dev.base');

module.exports = {
    ...baseConfig,
    testRegex: '/__tests__/integration/.*\\.tsx?$',
};
