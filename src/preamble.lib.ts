import * as fs from 'fs'

const preambleContent = fs.readFileSync(__dirname + '/templates/preamble.tpl', 'utf8')

export const Preamble = preambleContent.split('/* BEGIN PREAMBLE */')[1]!

export const ExactArgNames = fs.readFileSync(__dirname + '/templates/exact-arg-names.tpl', 'utf8')
