/**
 * Represents a filesystem error reported by the browser storage backend.
 */
export class FsError extends Error {
    code?: string;

    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
        Error.captureStackTrace(this, FsError);
        this.name = "FsError";

        // Browser APIs don't provide a common error type for missing files, so
        // retain the familiar POSIX code when it is included in the message.
        if (options?.cause && options.cause instanceof Error) {
            this.code = options.cause.message.match(/\bE[A-Z]+\b/)?.[0];
        }
    }

    isFileNotFound(): boolean {
        return this.code === "ENOENT";
    }
}
