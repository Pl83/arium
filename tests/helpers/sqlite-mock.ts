/**
 * Creates a minimal synchronous SQLite mock that mirrors the Cordova plugin API.
 * rows:      default rows returned by any SELECT
 * responses: optional map of SQL-substring → rows, checked before `rows`.
 *            First matching substring wins, so keep keys distinctive.
 * failOn:    if true, the transaction error callback fires instead of success
 */
function createSQLiteMock({ rows = [], failOn = false, responses = null } = {}) {
  const pick = (sql) => {
    if (responses) {
      for (const frag of Object.keys(responses)) {
        if (sql.indexOf(frag) !== -1) return responses[frag];
      }
    }
    return rows;
  };

  const mockTx = {
    executeSql: jest.fn((sql, args, successCb) => {
      if (!successCb) return;
      const r = pick(sql);
      successCb(mockTx, {
        rows: { length: r.length, item: (i) => r[i] },
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

  (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
  return { mockDb, mockTx };
}

module.exports = { createSQLiteMock };
