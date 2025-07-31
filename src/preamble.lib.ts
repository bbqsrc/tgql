import * as fs from 'fs'

const preambleContent = fs.readFileSync(__dirname + '/preamble.src.ts', 'utf8')

export const Preamble = preambleContent.split('/* BEGIN PREAMBLE */')[1]!.split('/* BEGIN EXACTARGNAMES */')[0]!

export const ExactArgNames = preambleContent.split('/* BEGIN EXACTARGNAMES */')[1]!.split('/* END EXACTARGNAMES */')[0]!
