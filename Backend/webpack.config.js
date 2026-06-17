const { IgnorePlugin } = require('webpack');

// TypeORM includes optional drivers for many databases.
// We only use PostgreSQL — ignore all others to prevent webpack bundling failures.
const optionalDrivers = [
  /^(mssql|mysql|mysql2|oracledb|pg-native|pg-query-stream|react-native-sqlite-storage)$/,
  /^(redis|sqlite3|sql\.js|typeorm-aurora-data-api-driver|better-sqlite3)$/,
  /^(expo-sqlite|mongodb|hdb-pool|@sap\/hana-client|spanner|ioredis)$/,
];

module.exports = function (options) {
  return {
    ...options,
    // Exclude native-binding packages from the bundle — they must load from node_modules at runtime
    externals: {
      bcrypt: 'commonjs bcrypt',
      // pdfkit reads font .afm files from __dirname at runtime; bundling it moves
      // __dirname to dist/ where those files don't exist, causing ENOENT errors.
      pdfkit: 'commonjs pdfkit',
    },
    plugins: [
      ...options.plugins,
      ...optionalDrivers.map((resourceRegExp) => new IgnorePlugin({ resourceRegExp })),
    ],
  };
};
