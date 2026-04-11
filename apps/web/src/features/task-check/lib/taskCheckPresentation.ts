import type { TaskCheckResponse } from '@/shared/api/catalog'

export type ParsedErrorLine = {
  line: number
  /** Короткая подсказка (фрагмент строки из лога). */
  hint?: string
}

function uniqLines(refs: ParsedErrorLine[]): ParsedErrorLine[] {
  const seen = new Set<number>()
  const out: ParsedErrorLine[] = []
  for (const r of refs) {
    if (!Number.isFinite(r.line) || r.line < 1) continue
    if (seen.has(r.line)) continue
    seen.add(r.line)
    out.push(r)
  }
  return out
}

/** Ищет номера строк в выводе компилятора / traceback (Python, Go, JS и т.д.). */
export function extractErrorLinesFromLog(text: string): ParsedErrorLine[] {
  if (!text?.trim()) return []
  const refs: ParsedErrorLine[] = []

  for (const m of text.matchAll(/File\s+"[^"]*",\s*line\s+(\d+)/gi)) {
    refs.push({ line: parseInt(m[1], 10), hint: m[0].trim() })
  }

  for (const m of text.matchAll(
    /([A-Za-z0-9_.\\/:-]+\.(?:go|py|js|ts))\s*:\s*(\d+)(?::(\d+))?\s*:/gi
  )) {
    refs.push({ line: parseInt(m[2], 10), hint: m[0].trim() })
  }

  for (const m of text.matchAll(/(?:^|\n)\s*(?:line|строка)\s+(\d+)\b/gi)) {
    refs.push({ line: parseInt(m[1], 10) })
  }

  return uniqLines(refs).slice(0, 8)
}

export type TaskCheckPresentation = {
  passed: boolean
  headline: string
  explanation: string
  /** Для подсказок в UI. */
  errorLines: ParsedErrorLine[]
  /** Доп. блоки «Вывод», «Ошибка компилятора» и т.д. */
  sections: Array<{ title: string; body: string }>
  failureKind: string
}

function kindLabel(kind: string): { headline: string; explanation: string } {
  switch (kind) {
    case 'wrong_answer':
      return {
        headline: 'Тест не пройден',
        explanation:
          'Программа выполнилась, но вывод не совпал с ожидаемым ответом. Сравните ваш stdout с эталоном (см. блок «Вывод программы»).',
      }
    case 'compile_error':
      return {
        headline: 'Ошибка компиляции',
        explanation:
          'Код не скомпилировался. Ниже — сообщение компилятора; по номеру строки можно найти место в редакторе.',
      }
    case 'syntax_error':
      return {
        headline: 'Синтаксическая ошибка',
        explanation:
          'Интерпретатор сообщил о синтаксисе (часто в traceback указана строка). Исправьте опечатки, скобки или отступы.',
      }
    case 'runtime_error':
      return {
        headline: 'Ошибка во время выполнения',
        explanation:
          'Программа упала при запуске (исключение, деление на ноль и т.д.). Разберите traceback или сообщение ниже.',
      }
    case 'time_limit':
      return {
        headline: 'Превышен лимит времени',
        explanation: 'Решение работает слишком долго для ограничений песочницы. Оптимизируйте алгоритм или уберите бесконечные циклы.',
      }
    case 'memory_limit':
      return {
        headline: 'Превышен лимит памяти',
        explanation: 'Процесс использовал слишком много памяти. Проверьте большие структуры данных и утечки.',
      }
    case 'execution_failed':
    default:
      return {
        headline: 'Проверка не пройдена',
        explanation: 'Среда выполнения вернула ошибку. Текст ниже поможет понять причину.',
      }
  }
}

function asRichResponse(r: TaskCheckResponse): TaskCheckResponse & {
  failure_kind?: string
  stderr?: string
  compile_output?: string
  judge_status?: string
} {
  return r as TaskCheckResponse & {
    failure_kind?: string
    stderr?: string
    compile_output?: string
    judge_status?: string
  }
}

export function presentTaskCheckResult(r: TaskCheckResponse): TaskCheckPresentation {
  const x = asRichResponse(r)
  if (r.status === 'success' && r.execution_status === 'success') {
    const sections: Array<{ title: string; body: string }> = []
    if (r.console?.trim()) {
      sections.push({ title: 'Вывод программы (stdout)', body: r.console })
    }
    if (r.already_solved) {
      return {
        passed: true,
        headline: 'Тест уже был засчитан',
        explanation: 'Решение верное; повторная отправка не меняет прогресс.',
        errorLines: [],
        sections,
        failureKind: '',
      }
    }
    return {
      passed: true,
      headline: 'Тест пройден',
      explanation: `Задача засчитана.${r.score ? ` Начислено очков: ${r.score}.` : ''}`,
      errorLines: [],
      sections,
      failureKind: '',
    }
  }

  const kind = (x.failure_kind || '').trim() || inferFailureKind(r, x)
  const { headline, explanation } = kindLabel(kind)

  const technical = [x.compile_output, x.stderr, r.error].filter(Boolean).join('\n\n')
  const errorLines = extractErrorLinesFromLog(technical)

  const sections: Array<{ title: string; body: string }> = []
  if (x.compile_output?.trim()) {
    sections.push({ title: 'Компилятор', body: x.compile_output.trim() })
  }
  if (x.stderr?.trim()) {
    sections.push({ title: 'Stderr / traceback', body: x.stderr.trim() })
  }
  if (r.error?.trim() && kind !== 'wrong_answer') {
    sections.push({ title: 'Краткое сообщение', body: r.error.trim() })
  }
  if (kind === 'wrong_answer' && r.console?.trim()) {
    sections.push({
      title: 'Вывод программы (не совпал с эталоном)',
      body: r.console.trim(),
    })
  }
  if (x.judge_status?.trim()) {
    sections.push({ title: 'Статус Judge0', body: x.judge_status.trim() })
  }

  return {
    passed: false,
    headline,
    explanation,
    errorLines,
    sections,
    failureKind: kind,
  }
}

function inferFailureKind(
  r: TaskCheckResponse,
  x: { compile_output?: string; stderr?: string; judge_status?: string }
): string {
  if (r.error === 'output does not match expected answer') return 'wrong_answer'
  const blob = `${x.compile_output || ''}\n${x.stderr || ''}\n${r.error || ''}\n${x.judge_status || ''}`.toLowerCase()
  if (x.compile_output?.trim()) return 'compile_error'
  if (blob.includes('syntaxerror') || blob.includes('syntax error')) return 'syntax_error'
  if (blob.includes('traceback') || blob.includes('runtime error')) return 'runtime_error'
  if (blob.includes('time limit')) return 'time_limit'
  if (blob.includes('memory limit')) return 'memory_limit'
  return 'execution_failed'
}
