import { UAParser } from "ua-parser-js";
import { lazy } from "common/lazy";

const parser = lazy(() => new UAParser);

export function isMac(): boolean {
	return parser().getOS().name === "Mac OS";
}
