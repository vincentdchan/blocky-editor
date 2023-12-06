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

    let snapshotCursor = await snapshotStore.openCursor();
    while (snapshotCursor) {
      if (snapshotCursor.value.userId === userId) {
        await snapshotCursor.delete();
      }
      snapshotCursor = await snapshotCursor.continue();
    }

    await snapshotStore.add("snapshot", {
      data: snapshot,
      userId,
      createdAt: new Date(),
    });

    await tx.objectStore("versions").clear();

    await tx.done;
  }

  async wipeAllDataByUserId(userId: string) {
    const tx = this.db.transaction(["snapshot", "versions"], "readwrite");

    let snapshotCursor = await tx.objectStore("snapshot").openCursor();

    while (snapshotCursor) {
      if (snapshotCursor.value.userId === userId) {
        await snapshotCursor.delete();
      }

      snapshotCursor = await snapshotCursor.continue();
    }

    let versionsCursor = await tx.objectStore("versions").openCursor();

    while (versionsCursor) {
      if (versionsCursor.value.userId === userId) {
        await versionsCursor.delete();
      }

      versionsCursor = await versionsCursor.continue();
    }

    await tx.done;
  }
}
