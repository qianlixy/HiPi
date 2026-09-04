import { describe, it, expect } from 'vitest'
import { shouldSubmitPrompt } from '../PromptInput'

describe('shouldSubmitPrompt', () => {
  it('should submit when Enter is pressed without Shift', () => {
    const event = {
      key: 'Enter',
      shiftKey: false,
      keyCode: 13,
      nativeEvent: { isComposing: false }
    }
    expect(shouldSubmitPrompt(event)).toBe(true)
  })

  it('should not submit when Shift + Enter is pressed', () => {
    const event = {
      key: 'Enter',
      shiftKey: true,
      keyCode: 13,
      nativeEvent: { isComposing: false }
    }
    expect(shouldSubmitPrompt(event)).toBe(false)
  })

  it('should not submit when Enter is pressed during IME composition (isComposing is true)', () => {
    const event = {
      key: 'Enter',
      shiftKey: false,
      keyCode: 13,
      nativeEvent: { isComposing: true }
    }
    expect(shouldSubmitPrompt(event)).toBe(false)
  })

  it('should not submit when Enter is pressed with IME keyCode 229', () => {
    const event = {
      key: 'Enter',
      shiftKey: false,
      keyCode: 229,
      nativeEvent: { isComposing: false }
    }
    expect(shouldSubmitPrompt(event)).toBe(false)
  })

  it('should not submit for non-Enter keys', () => {
    const event = {
      key: 'a',
      shiftKey: false,
      keyCode: 65,
      nativeEvent: { isComposing: false }
    }
    expect(shouldSubmitPrompt(event)).toBe(false)
  })
})
