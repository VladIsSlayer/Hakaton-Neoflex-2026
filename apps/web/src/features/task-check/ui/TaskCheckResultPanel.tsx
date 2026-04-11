import { Alert, Collapse, Space, Typography } from 'antd'
import type { TaskCheckResponse } from '@/shared/api/catalog'
import { presentTaskCheckResult } from '@/features/task-check/lib/taskCheckPresentation'

type Props = {
  response: TaskCheckResponse
  /** Полный JSON для режима «для отладки». */
  rawJson?: string
}

export function TaskCheckResultPanel({ response, rawJson }: Props) {
  const p = presentTaskCheckResult(response)

  const alertType = p.passed ? 'success' : p.failureKind === 'wrong_answer' ? 'warning' : 'error'

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type={alertType}
        showIcon
        message={p.headline}
        description={
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{p.explanation}</Typography.Paragraph>
            {!p.passed && p.errorLines.length > 0 ? (
              <div>
                <Typography.Text strong>Упоминания строк в логе:</Typography.Text>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {p.errorLines.map((ref) => (
                    <li key={ref.line}>
                      <Typography.Text code>строка {ref.line}</Typography.Text>
                      {ref.hint ? (
                        <Typography.Text type="secondary">
                          {' '}
                          — {ref.hint}
                        </Typography.Text>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Space>
        }
      />

      {p.sections.map((s) => (
        <div key={s.title}>
          <Typography.Text strong>{s.title}</Typography.Text>
          <pre className="course-json-preview task-check-section-pre">{s.body}</pre>
        </div>
      ))}

      {rawJson ? (
        <Collapse
          size="small"
          items={[
            {
              key: 'raw',
              label: 'Технический ответ (JSON)',
              children: <pre className="course-json-preview">{rawJson}</pre>,
            },
          ]}
        />
      ) : null}
    </Space>
  )
}
