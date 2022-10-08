module.exports = {
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig-cjs.json'
        }
    },
    roots: ['<rootDir>/src'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
