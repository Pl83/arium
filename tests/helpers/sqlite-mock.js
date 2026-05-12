/**
 * Creates a minimal synchronous SQLite mock that mirrors the Cordova plugin API.
 * rows:   array of row objects returned by SELECT queries
 * failOn: if true, the transaction error callback fires instead of success
 */
function createSQLiteMock({ rows = [], failOn = false } = {}) {
  const mockTx = {
    executeSql: jest.fn((sql, args, successCb) => {
      if (!successCb) return;
      successCb(mockTx, {
        rows: { length: rows.length, item: (i) => rows[i] },
      });
    }),
  };

  const mockDb = {
    transaction: jest.fn((txCb, errCb, successCb) => {
      if (failOn) {
        errCb && errCb(new Error('mock DB error'));
        return;
      }
      txCb(mockTx);
      successCb && successCb();
    }),
  };

  window.sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
  return { mockDb, mockTx };
}

module.exports = { createSQLiteMock };
