import { IDBPDatabase, openDB } from "idb";

interface SnapshotAndVersions {
  snapshot?: any;
  versions: any[];
}

export class IdbDao {
  static async open(dbName: string): Promise<IdbDao> {
    const db = await openDB(dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore("versions", {
          // The 'id' property of the object will be the key.
          keyPath: "id",
          // If it isn't explicitly set, create a value by auto incrementing.
          autoIncrement: true,
        });
        store.createIndex("loroId", "loroId");
        const snapshotStore = db.createObjectStore("snapshot", {
          // The 'id' property of the object will be the key.
          keyPath: "id",
          // If it isn't explicitly set, create a value by auto incrementing.
          autoIncrement: true,
        });
        snapshotStore.createIndex("createdAt", "createdAt");
      },
    });

    return new IdbDao(db);
  }

  constructor(readonly db: IDBPDatabase<any>) {}

  async tryReadLoroFromIdb(): Promise<SnapshotAndVersions> {
    let snapshot: any;
    {
      const tx = this.db.transaction("snapshot", "readonly");

      // find latest snapshot with creatAt
      const snapshotCursor = await tx
        .objectStore("snapshot")
        .index("createdAt")
        .openCursor(null, "prev");

      snapshot = snapshotCursor?.value;

      tx.commit();
    }

    const tx = this.db.transaction("versions", "readonly");

    const versions = await tx.objectStore("versions").index("loroId").getAll();

    tx.commit();

    return {
      snapshot,
      versions,
    };
  }

  async flushFullSnapshot(userId: string, snapshot: Uint8Array) {
    const tx = this.db.transaction(["snapshot", "versions"], "readwrite");

    const snapshotStore = tx.objectStore("snapshot");
    await snapshotStore.clear();

    await snapshotStore.add({
      data: snapshot,
      userId,
      createdAt: new Date(),
    });

    await tx.objectStore("versions").clear();

    await tx.done;
  }

  async wipeAllData() {
    const tx = this.db.transaction(["snapshot", "versions"], "readwrite");

    await tx.objectStore("snapshot").clear();

    await tx.objectStore("versions").clear();

    await tx.done;
  }
}
