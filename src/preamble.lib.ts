import { dirname, join } from "@std/path";

const currentDir = dirname(new URL(import.meta.url).pathname);
const preambleContent = Deno.readTextFileSync(join(currentDir, 'templates/preamble.tpl'));

export const Preamble = preambleContent.split('/* BEGIN PREAMBLE */')[1]!;

export const ExactArgNames = Deno.readTextFileSync(join(currentDir, 'templates/exact-arg-names.tpl'));
