import { describe, expect, it } from 'vitest'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../money'

describe('مبلغ', () => {
  it('جداسازی سه‌رقمی با ارقام فارسی', () => {
    expect(formatNumber(12500000)).toBe('۱۲٬۵۰۰٬۰۰۰')
    expect(formatNumber(0)).toBe('۰')
    expect(formatNumber(-1500)).toBe('−۱٬۵۰۰')
  })
  it('پذیرش ارقام فارسی، عربی و لاتین', () => {
    expect(parseAmount('۱۲٬۵۰۰')).toEqual({ ok: true, value: 12500 })
    expect(parseAmount('١٢٣')).toEqual({ ok: true, value: 123 })
    expect(parseAmount('1,000')).toEqual({ ok: true, value: 1000 })
  })
  it('رد صفر، منفی، اعشار و متن', () => {
    expect(parseAmount('0').ok).toBe(false)
    expect(parseAmount('').ok).toBe(false)
    expect(parseAmount('-5').ok).toBe(false)
    expect(parseAmount('12.5').ok).toBe(false)
    expect(parseAmount('abc').ok).toBe(false)
    expect(parseAmount('99999999999999999999').ok).toBe(false)
  })
  it('قالب‌بندی حین تایپ', () => {
    expect(formatAmountInput('۱۲۳۴۵')).toBe('۱۲٬۳۴۵')
    expect(formatAmountInput('00012')).toBe('۱۲')
    expect(formatAmountInput('1a2')).toBe('۱۲')
    expect(formatAmountInput('')).toBe('')
  })
  it('مبلغ به حروف', () => {
    expect(amountInWords(12_500_000)).toBe('۱۲ میلیون و ۵۰۰ هزار تومان')
    expect(amountInWords(2_000_000_500)).toBe('۲ میلیارد و ۵۰۰ تومان')
  })
})
