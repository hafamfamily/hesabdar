import assert from 'node:assert/strict'
import { test } from 'node:test'
import makeMdns from 'multicast-dns'
import { answersFor, startMdns } from '../src/mdns.js'
import { lanAddresses } from '../src/net.js'

// در برخی محیط‌ها (کانتینر بدون multicast) این تست اجرا نمی‌شود
test('پاسخ به پرسش نام dakhlkharj.local', { timeout: 8000 }, async (t) => {
  const responder = startMdns('dakhlkharj.local')
  const client = makeMdns({ reuseAddr: true, loopback: true })
  try {
    const answer = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000)
      client.on('response', (r) => {
        const a = r.answers.find((x) => x.name === 'dakhlkharj.local' && x.type === 'A')
        if (a) {
          clearTimeout(timer)
          resolve(a)
        }
      })
      client.on('ready', () => client.query({ questions: [{ name: 'dakhlkharj.local', type: 'A' }] }))
    })
    if (!answer && lanAddresses().length === 0) return t.skip('این محیط نشانی شبکهٔ خصوصی ندارد')
    assert.ok(answer, 'پاسخی دریافت نشد')
    assert.ok(lanAddresses().some((l) => l.address === answer.data))
  } finally {
    client.destroy()
    responder.stop()
  }
})

test('ساخت پاسخ فقط برای نام خودمان', () => {
  const q = (name, type = 'A') => [{ name, type }]
  assert.deepEqual(answersFor('dakhlkharj.local', q('DakhlKharj.local'), ['192.168.1.5']).map((a) => a.data), ['192.168.1.5'])
  assert.equal(answersFor('dakhlkharj.local', q('other.local'), ['192.168.1.5']).length, 0)
  assert.equal(answersFor('dakhlkharj.local', q('dakhlkharj.local', 'AAAA'), ['192.168.1.5']).length, 0)
})
