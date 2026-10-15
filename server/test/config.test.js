import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfig, readConfigFile } from '../src/config.js'

test('config.json با BOM (خروجی PowerShell 5.1) درست خوانده می‌شود', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dk-cfg-'))
  try {
    const file = join(dir, 'config.json')
    const json = JSON.stringify({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), port: 9443 })
    writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json, 'utf8')]))
    assert.equal(readConfigFile(file).port, 9443)
    const cfg = loadConfig({}, file)
    assert.equal(cfg.port, 9443)
    assert.equal(cfg.dataDir, join(dir, 'data'))
    assert.equal(cfg.backupDir, join(dir, 'backups'))
    // بدون BOM هم
    writeFileSync(file, json)
    assert.equal(readConfigFile(file).port, 9443)
    // فایل واقعاً خراب: پیام روشن
    writeFileSync(file, '{ bad')
    assert.throws(() => readConfigFile(file), /config\.json خراب است/)
    // نبودن فایل: پیش‌فرض‌ها
    assert.deepEqual(readConfigFile(join(dir, 'none.json')), {})
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
