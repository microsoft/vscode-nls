import { setPseudo, localize, Options } from '../common/common';

export { MessageFormat, BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from '../common/common';

export function loadMessageBundle(_file?: string) {
	return localize;
}

export function config(options?: Options) {
	setPseudo(options?.locale.toLowerCase() === 'pseudo');
	return loadMessageBundle;
}
