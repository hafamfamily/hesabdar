import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createApp } from '../src/app.js'
import { hashPassword, LoginLimiter, verifyPassword } from '../src/auth.js'
import { openDatabase } from '../src/db.js'
import { isPrivateIp } from '../src/net.js'
import { validateRecord } from '../src/validate.js'

const dir = mkdtempSync(join(tmpdir(), 'dk-test-'))
const db = openDatabase(join(dir, 'data'))
const config = { dataDir: join(dir, 'data'), clientDir: join(dir, 'no-client'), port: 0, setupPort: 0, hostname: 'dakhlkharj.local', mdns: false, allowAnyNetwork: false }
// برای شبیه‌سازی دستگاه‌های دیگر شبکه، نشانی فرستنده از سرآیند x-test-ip خوانده می‌شود (فقط در تست)
const server = createServer(createApp({ db, config, remoteAddress: (req) => req.get('x-test-ip') ?? req.socket.remoteAddress }))
let base = ''
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => {
  server.close()
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const IPHONE = '192.168.1.23'
const req = async (path, { method = 'GET', body, token, ip } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(ip ? { 'x-test-ip': ip } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) }
}

const tx = (id, amount = 1000) => ({
  id, type: 'expense', amount, date: '2026-10-14', categoryId: 'exp-food', note: '', createdAt: '2026-10-14T10:00:00.000Z', updatedAt: '2026-10-14T10:00:00.000Z',
})

describe('شبکه و رمز', () => {
  it('تشخیص نشانی خصوصی', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:192.168.1.20', '10.0.0.5', '172.20.1.1', '169.254.3.3', 'fe80::1', 'fd12::1']) assert.equal(isPrivateIp(ip), true, ip)
    for (const ip of ['8.8.8.8', '::ffff:5.200.1.1', '172.32.0.1', '2a01::1', '', undefined]) assert.equal(isPrivateIp(ip), false, String(ip))
  })
  it('هش گذرواژه با scrypt و نمک متفاوت', () => {
    const a = hashPassword('secret-pass')
    assert.notEqual(a, hashPassword('secret-pass'))
    assert.ok(!a.includes('secret-pass'))
    assert.equal(verifyPassword('secret-pass', a), true)
    assert.equal(verifyPassword('wrong-pass', a), false)
  })
  it('محدودیت تلاش ورود', () => {
    const l = new LoginLimiter(2, 1000)
    l.fail('x', 0); l.fail('x', 1)
    assert.equal(l.blocked('x', 2), true)
    assert.equal(l.blocked('x', 5000), false)
  })
})

describe('API', () => {
  let token = ''
  it('سرآیندهای امنیتی و وضعیت', async () => {
    const r = await req('/api/health')
    assert.equal(r.status, 200)
    assert.equal(r.json.needsSetup, true)
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/)
    assert.equal(r.headers.get('x-powered-by'), null)
    assert.equal(r.headers.get('access-control-allow-origin'), null)
  })
  it('درخواست از اینترنت (نشانی عمومی) رد می‌شود', async () => {
    assert.equal((await req('/api/health', { ip: '5.200.10.10' })).status, 403)
    assert.equal((await req('/api/health', { ip: IPHONE })).status, 200)
  })
  it('تعیین گذرواژه فقط از خود لپ‌تاپ و فقط یک بار', async () => {
    const remote = await req('/api/auth/setup', { method: 'POST', body: { password: '12345678' }, ip: IPHONE })
    assert.equal(remote.status, 403)
  })
  it('گذرواژهٔ کوتاه پذیرفته نمی‌شود؛ سپس تعیین و بار دوم رد می‌شود', async () => {
    assert.equal((await req('/api/auth/setup', { method: 'POST', body: { password: '123' } })).status, 400)
    assert.equal((await req('/api/auth/setup', { method: 'POST', body: { password: 'رمز-خیلی-امن' } })).status, 200)
    assert.equal((await req('/api/auth/setup', { method: 'POST', body: { password: 'another-pass' } })).status, 409)
  })
  it('بدون توکن دسترسی نیست', async () => {
    assert.equal((await req('/api/changes')).status, 401)
    assert.equal((await req('/api/changes', { token: 'fake' })).status, 401)
  })
  it('جفت کردن دستگاه و محدودیت تلاش', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await req('/api/auth/pair', { method: 'POST', body: { password: 'x' } })).status, 401)
    assert.equal((await req('/api/auth/pair', { method: 'POST', body: { password: 'رمز-خیلی-امن' } })).status, 429)
  })
  it('جفت کردن از نشانی دیگر', async () => {
    const r = await req('/api/auth/pair', { method: 'POST', body: { password: 'رمز-خیلی-امن', deviceName: 'آیفون' }, ip: IPHONE })
    assert.equal(r.status, 200)
    assert.ok(r.json.token.length >= 40)
    token = r.json.token
    const row = db.prepare('SELECT token_hash FROM devices').get()
    assert.notEqual(row.token_hash, token, 'توکن نباید خام ذخیره شود')
  })
  it('ثبت تغییر، جلوگیری از تکرار، و تشخیص تعارض', async () => {
    const op = { opId: 'op-1', collection: 'transactions', id: 't1', baseVersion: 0, data: tx('t1') }
    const a = await req('/api/changes', { method: 'POST', token, body: { ops: [op] } })
    assert.equal(a.json.results[0].status, 'ok')
    assert.equal(a.json.results[0].version, 1)
    const again = await req('/api/changes', { method: 'POST', token, body: { ops: [op] } })
    assert.equal(again.json.results[0].status, 'duplicate')
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 1)
    // دستگاه دیگری روی نسخهٔ قدیمی تغییر می‌دهد ← تعارض، بدون بازنویسی
    const stale = await req('/api/changes', { method: 'POST', token, body: { ops: [{ ...op, opId: 'op-2', data: tx('t1', 5000) }] } })
    assert.equal(stale.json.results[0].status, 'conflict')
    assert.equal(stale.json.results[0].server.data.amount, 1000)
    const upd = await req('/api/changes', { method: 'POST', token, body: { ops: [{ ...op, opId: 'op-3', baseVersion: 1, data: tx('t1', 7000) }] } })
    assert.equal(upd.json.results[0].version, 2)
    const del = await req('/api/changes', { method: 'POST', token, body: { ops: [{ opId: 'op-4', collection: 'transactions', id: 't1', baseVersion: 2, deleted: true }] } })
    assert.equal(del.json.results[0].status, 'ok')
    const pull = await req('/api/changes?since=0', { token })
    assert.equal(pull.json.changes.length, 1)
    assert.equal(pull.json.changes[0].deleted, true)
    assert.equal(pull.json.cursor, 3)
    const none = await req('/api/changes?since=3', { token })
    assert.equal(none.json.changes.length, 0)
  })
  it('دادهٔ نامعتبر رد می‌شود و بقیهٔ عملیات اعمال می‌شوند', async () => {
    const r = await req('/api/changes', {
      method: 'POST', token,
      body: { ops: [
        { opId: 'bad-1', collection: 'transactions', id: 't2', baseVersion: 0, data: { ...tx('t2'), amount: -5 } },
        { opId: 'bad-2', collection: 'users', id: 'x', baseVersion: 0, data: {} },
        { opId: 'good-1', collection: 'transactions', id: 't3', baseVersion: 0, data: tx('t3') },
      ] },
    })
    assert.deepEqual(r.json.results.map((x) => x.status), ['invalid', 'invalid', 'ok'])
  })
  it('مدیریت دستگاه‌ها و ابطال', async () => {
    const list = await req('/api/devices', { token })
    assert.equal(list.json.devices.length, 1)
    await req(`/api/devices/${list.json.current}`, { method: 'DELETE', token })
    assert.equal((await req('/api/status', { token })).status, 401)
  })
  it('JSON خراب یا بزرگ با پیام کلی رد می‌شود', async () => {
    const res = await fetch(base + '/api/auth/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })
    assert.equal(res.status, 400)
    const body = await res.json()
    assert.ok(!JSON.stringify(body).includes('SyntaxError'))
  })
})

describe('اعتبارسنجی', () => {
  it('تراکنش، بدهی و تنظیمات', () => {
    assert.equal(validateRecord('transactions', 't', tx('t')), null)
    assert.notEqual(validateRecord('transactions', 't', { ...tx('t'), date: '2026-02-30' }), null)
    assert.notEqual(validateRecord('transactions', 'other', tx('t')), null)
    assert.notEqual(validateRecord('transactions', '../x', tx('../x')), null)
    assert.equal(validateRecord('settings', 'settings', { openingBalance: 0, reminders: {}, fonts: {} }), null)
    const debt = {
      id: 'd', direction: 'borrowed', kind: 'loan', counterparty: 'بانک', startDate: '2026-01-01', note: '',
      installments: [{ id: 'i1', index: 1, amount: 100, dueDate: '2026-02-01' }], reminder: { enabled: true, daysBefore: 3 },
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    }
    assert.equal(validateRecord('debts', 'd', debt), null)
    assert.notEqual(validateRecord('debts', 'd', { ...debt, installments: [] }), null)
  })
})
