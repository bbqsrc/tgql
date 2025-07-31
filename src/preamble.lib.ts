import preambleTpl from './templates/preamble.tpl' with { type: "text" };
import exactArgNamesTpl from './templates/exact-arg-names.tpl' with { type: "text" };

export const Preamble = preambleTpl.split('/* BEGIN PREAMBLE */')[1]!;
export const ExactArgNames = exactArgNamesTpl
