import type { Node } from 'unist';
import type { VFile } from 'vfile';

/** Records an error that fails `check` and `build`. */
export function reportError(file: VFile, message: string, place?: Node): void {
	const diagnostic = file.message(message, place?.position);
	diagnostic.fatal = true;
}

export function reportWarning(file: VFile, message: string, place?: Node): void {
	file.message(message, place?.position);
}
