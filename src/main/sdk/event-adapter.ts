/**
 * Pure JSON serializer for assistant events matching official pi-coding-agent toJsonEvent
 */
function toJsonAssistantMessageEvent(event: any) {
  if (event?.type === 'toolcall_start') {
    const toolCall = event.partial?.content?.[event.contentIndex]
    const { partial: _partial, ...deltaEvent } = event
    return { ...deltaEvent, id: toolCall?.id, toolName: toolCall?.name }
  }
  if (!event || !('partial' in event)) {
    return event
  }
  const { partial: _partial, ...deltaEvent } = event
  return deltaEvent
}

export function toJsonEvent(event: any) {
  if (!event || event.type !== 'message_update') {
    return event
  }
  if (event.message?.role !== 'assistant') {
    return event
  }
  return {
    type: 'message_update',
    usage: event.message.usage,
    assistantMessageEvent: toJsonAssistantMessageEvent(event.assistantMessageEvent)
  }
}

/**
 * Adapts events emitted by @earendil-works/pi-coding-agent to match the format
 * expected by the HiPi React renderer.
 */
export function adaptAgentSessionEvent(event: any): any {
  if (!event || typeof event !== 'object') {
    return event
  }

  let jsonEvent: any = event
  try {
    jsonEvent = toJsonEvent(event)
  } catch {
    jsonEvent = event
  }

  const evType = jsonEvent.type

  if (evType === 'message_update') {
    const assistantEv = jsonEvent.assistantMessageEvent
    let delta = (event && event.delta) || jsonEvent.delta || ''
    const isThinking = assistantEv?.type === 'thinking_delta'

    if (!delta && assistantEv) {
      if (assistantEv.type === 'text_delta' && typeof assistantEv.delta === 'string') {
        delta = assistantEv.delta
      } else if (assistantEv.type === 'thinking_delta' && typeof assistantEv.delta === 'string') {
        delta = assistantEv.delta
      }
    }

    return {
      ...jsonEvent,
      delta,
      isThinking
    }
  }

  if (evType === 'tool_execution_update') {
    let output = jsonEvent.output || jsonEvent.text || ''
    if (!output && jsonEvent.partialResult) {
      if (typeof jsonEvent.partialResult === 'string') {
        output = jsonEvent.partialResult
      } else if (typeof jsonEvent.partialResult.output === 'string') {
        output = jsonEvent.partialResult.output
      } else if (typeof jsonEvent.partialResult.text === 'string') {
        output = jsonEvent.partialResult.text
      }
    }
    return {
      ...jsonEvent,
      output
    }
  }

  if (evType === 'tool_execution_end') {
    return {
      ...jsonEvent,
      toolCallId: jsonEvent.toolCallId,
      isError: !!jsonEvent.isError,
      result: jsonEvent.result
    }
  }

  return jsonEvent
}
