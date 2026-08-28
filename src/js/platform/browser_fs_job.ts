// Browser counterpart of electron/src/fsjob.ts's FsJobHandler. Mirrors the same
// job contract (see Storage#invokeFsJob) but persists to IndexedDB instead of disk,
// and uses native file pickers for the "external" (import/export) jobs.

interface BrowserFsJob {
    id: string;
    type: string;
    filename?: string;
    contents?: Uint8Array;
    extension?: string;
}

const DB_NAME = "origamiz_fs";
const STORE_NAME = "files";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function keyFor(job: BrowserFsJob): string {
    return `${job.id}/${job.filename}`;
}

// FsError parses the error code out of `message.split(":")[2]`, matching the shape
// of Electron's real IPC error messages. Mimicking that string keeps FsError/
// isFileNotFound() working unmodified for both platforms.
function notFoundError(filename: string): Error {
    return new Error(`Error invoking remote method 'fs-job': Error: ENOENT: no such file or directory, open '${filename}'`);
}

async function readFile(job: BrowserFsJob): Promise<Uint8Array> {
    const db = await openDatabase();
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    const result = await runRequest<Uint8Array | undefined>(store.get(keyFor(job)));
    if (result === undefined) {
        throw notFoundError(job.filename ?? "");
    }
    return result;
}

async function writeFile(job: BrowserFsJob): Promise<void> {
    const db = await openDatabase();
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    await runRequest(store.put(job.contents, keyFor(job)));
}

async function deleteFile(job: BrowserFsJob): Promise<void> {
    const db = await openDatabase();
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    await runRequest(store.delete(keyFor(job)));
}

// ponytail: relies on the "cancel" event (Chrome 113+/Firefox 106+) to resolve
// undefined when the user dismisses the picker; on older browsers the promise
// just never settles. Upgrade path: track focus-return as a cancel heuristic.
function openExternal(job: BrowserFsJob): Promise<Uint8Array | undefined> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        if (job.extension && job.extension !== "*") {
            input.accept = "." + job.extension;
        }
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            resolve(file ? new Uint8Array(await file.arrayBuffer()) : undefined);
        });
        input.addEventListener("cancel", () => resolve(undefined));
        input.click();
    });
}

function saveExternal(job: BrowserFsJob): Promise<void> {
    const blob = new Blob([job.contents ?? new Uint8Array()]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = job.filename ?? "download";
    link.click();
    URL.revokeObjectURL(url);
    return Promise.resolve();
}

export function handleBrowserFsJob(job: BrowserFsJob): Promise<Uint8Array | void> {
    switch (job.type) {
        case "initialize":
            return openDatabase().then(() => undefined);
        case "read":
            return readFile(job);
        case "write":
            return writeFile(job);
        case "delete":
            return deleteFile(job);
        case "open-external":
            return openExternal(job);
        case "save-external":
            return saveExternal(job);
        default:
            return Promise.reject(new Error(`Unknown FS job type: ${job.type}`));
    }
}
