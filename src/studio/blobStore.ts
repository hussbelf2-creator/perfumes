// تخزين ملفات النماذج في المتصفح (IndexedDB) للوضع التجريبي — localStorage لا يتسع لملفات GLB

const DB = "pp_studio_blobs";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(key: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBlob(key: string): Promise<Blob | null> {
  const db = await open();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

/** يحوّل idb:<مفتاح> إلى رابط blob قابل للتحميل؛ والروابط العادية تمر كما هي */
export async function resolveModelUrl(url: string): Promise<string> {
  if (!url.startsWith("idb:")) return url;
  const blob = await getBlob(url.slice(4));
  if (!blob) throw new Error("model_missing");
  return URL.createObjectURL(blob);
}
