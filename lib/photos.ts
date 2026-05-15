// Local-only photo storage keyed by destination id. Uses IndexedDB so we can
// hold full-resolution image blobs without the 5MB localStorage ceiling.
// Photos never leave the browser.

const DB_NAME = "trip-planner-photos";
const DB_VERSION = 1;
const STORE = "photos";

export type StoredPhoto = {
  id: number;
  destinationId: string;
  blob: Blob;
  createdAt: number;
};

export type GalleryPhoto = {
  id: number;
  destinationId: string;
  url: string;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("destinationId", "destinationId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function addPhoto(
  destinationId: string,
  file: File,
): Promise<GalleryPhoto> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record = {
      destinationId,
      blob: file,
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => {
      const id = req.result as number;
      resolve({
        id,
        destinationId,
        url: URL.createObjectURL(file),
        createdAt: record.createdAt,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listPhotos(
  destinationId: string,
): Promise<GalleryPhoto[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index("destinationId");
    const req = index.getAll(destinationId);
    req.onsuccess = () => {
      const records = req.result as StoredPhoto[];
      const out = records
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({
          id: r.id,
          destinationId: r.destinationId,
          url: URL.createObjectURL(r.blob),
          createdAt: r.createdAt,
        }));
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
