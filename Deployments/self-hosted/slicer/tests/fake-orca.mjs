#!/usr/bin/env node
// Test double: verifies CLI inputs, never executes printer commands.
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const args = process.argv.slice(2)
const value = key => args[args.indexOf(key) + 1]
const [machinePath, processPath] = value('--load-settings').split(';')
const machine = JSON.parse(await readFile(machinePath, 'utf8'))
const preset = JSON.parse(await readFile(processPath, 'utf8'))
assert.equal(machine.inherits, 'Test machine')
assert.equal(machine.type, 'machine')
assert.equal(preset.layer_height, '0.16')
assert.equal(preset.inherits, 'Test process')
assert(!args.includes('--orient'))
assert(args.at(-1).endsWith('.3mf'))
for (const path of value('--load-filaments').split(';')) {
  const filament = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(filament.inherits, 'Test filament')
}
if (machine.name === 'Slow machine') await new Promise(resolve => setTimeout(resolve, 60000))
await writeFile(`${value('--outputdir')}/plate.gcode`, '; estimated printing time (normal mode) = 1m 2s\n; filament used [g] = 3.4\n; filament used [mm] = 120\nG1 X10 Y10\n')
