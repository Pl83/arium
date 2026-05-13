interface SQLiteTransaction {
  executeSql(
    sql: string,
    args?: (string | number)[],
    success?: (tx: SQLiteTransaction, result: SQLiteResultSet) => void,
    error?: (tx: SQLiteTransaction, err: Error) => boolean | void
  ): void;
}

interface SQLiteResultSet {
  rows: {
    length: number;
    item(index: number): Record<string, unknown>;
  };
}

interface SQLiteDatabase {
  transaction(
    fn: (tx: SQLiteTransaction) => void,
    error?: (err: Error) => void,
    success?: () => void
  ): void;
}

interface SQLitePlugin {
  openDatabase(options: { name: string; location: string }): SQLiteDatabase;
}

interface Window {
  sqlitePlugin: SQLitePlugin;
}
