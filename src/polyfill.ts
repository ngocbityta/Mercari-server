import { File } from 'buffer';

if (typeof globalThis.File === 'undefined') {
    Object.defineProperty(globalThis, 'File', {
        value: File,
        writable: true,
        configurable: true,
        enumerable: true,
    });
}
