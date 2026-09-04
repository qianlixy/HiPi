import { describe, it, expect } from 'vitest'
import { adaptAgentSessionEvent } from '../event-adapter'

describe('adaptAgentSessionEvent', () => {
  it('should return null or non-object as is', () => {
    expect(adaptAgentSessionEvent(null)).toBeNull()
    expect(adaptAgentSessionEvent(undefined)).toBeUndefined()
    expect(adaptAgentSessionEvent('test')).toBe('test')
  })

  it('should adapt message_update with text_delta', () => {
    const rawEvent = {
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        contentIndex: 0,
        delta: 'Hello world'
      }
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.type).toBe('message_update')
    expect(adapted.delta).toBe('Hello world')
    expect(adapted.isThinking).toBe(false)
  })

  it('should adapt message_update with thinking_delta', () => {
    const rawEvent = {
      type: 'message_update',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'thinking_delta',
        contentIndex: 0,
        delta: 'Let me think about this...'
      }
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.type).toBe('message_update')
    expect(adapted.delta).toBe('Let me think about this...')
    expect(adapted.isThinking).toBe(true)
  })

  it('should preserve existing delta on message_update', () => {
    const rawEvent = {
      type: 'message_update',
      delta: 'Existing delta',
      message: { role: 'assistant' },
      assistantMessageEvent: {
        type: 'text_delta',
        delta: 'Another delta'
      }
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.delta).toBe('Existing delta')
  })

  it('should adapt tool_execution_update with output string', () => {
    const rawEvent = {
      type: 'tool_execution_update',
      toolCallId: 'call-1',
      partialResult: 'running...'
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.type).toBe('tool_execution_update')
    expect(adapted.output).toBe('running...')
  })

  it('should adapt tool_execution_update with object output', () => {
    const rawEvent = {
      type: 'tool_execution_update',
      toolCallId: 'call-2',
      partialResult: { output: 'result chunk' }
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.output).toBe('result chunk')
  })

  it('should adapt tool_execution_end with isError and result', () => {
    const rawEvent = {
      type: 'tool_execution_end',
      toolCallId: 'call-3',
      isError: true,
      result: { error: 'Command failed' }
    }

    const adapted = adaptAgentSessionEvent(rawEvent)
    expect(adapted.type).toBe('tool_execution_end')
    expect(adapted.toolCallId).toBe('call-3')
    expect(adapted.isError).toBe(true)
    expect(adapted.result).toEqual({ error: 'Command failed' })
  })

  it('should pass through lifecycle events unchanged', () => {
    const startEvent = { type: 'agent_start' }
    const endEvent = { type: 'agent_end' }
    const settledEvent = { type: 'agent_settled' }

    expect(adaptAgentSessionEvent(startEvent)).toEqual(startEvent)
    expect(adaptAgentSessionEvent(endEvent)).toEqual(endEvent)
    expect(adaptAgentSessionEvent(settledEvent)).toEqual(settledEvent)
  })
})
