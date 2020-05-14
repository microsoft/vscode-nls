import { setPseudo, localize, Options } from './common';

export { MessageFormat, BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from './common';

export function loadMessageBundle(_file?: string) {
	return localize;
}

export function config(options?: Options) {
	setPseudo(options?.locale.toLowerCase() === 'pseudo');
	return loadMessageBundle;
}
