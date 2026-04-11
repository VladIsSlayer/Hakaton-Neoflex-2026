import { Col, Row, Space, Statistic, Typography } from 'antd'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { MatrixCourseAxis } from '@/shared/api/catalog'

const FILL = { stroke: '#6b1cc8', fill: '#6b1cc8' }

function truncLabel(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

type Props = {
  matrixCourses: MatrixCourseAxis[]
  /** Показаны курсы с витрины — прогресс только там, где есть запись. */
  catalogFallbackHint?: boolean
  competencyCount: number
  averageLevel: number
  totalInCatalog: number
}

export function CompetencyMatrixCharts({
  matrixCourses,
  catalogFallbackHint,
  competencyCount,
  averageLevel,
  totalInCatalog,
}: Props) {
  const rows = matrixCourses.map((c) => ({
    axis: truncLabel(c.courseTitle, 22),
    full: c.courseTitle,
    value: Math.round(c.progressPercent),
  }))

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Statistic title="Средний уровень компетенций (по вашим навыкам в БД)" value={averageLevel} suffix="/ 100" />
        </Col>
        <Col xs={24} sm={12}>
          <Statistic title="Компетенций в каталоге платформы" value={totalInCatalog} />
          {competencyCount > 0 ? (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              У вас в матрице: {competencyCount}
            </Typography.Text>
          ) : null}
        </Col>
      </Row>

      <div className="competency-radar-wrap competency-radar-wrap--single">
        {catalogFallbackHint ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
            Нет записей на курсы в снимке профиля — показаны до шести курсов с витрины. Прогресс отображается только для
            курсов, на которые вы записаны; остальные оси — 0%.
          </Typography.Paragraph>
        ) : null}
        {rows.length === 0 ? (
          <Typography.Text type="secondary">
            Нет опубликованных курсов в каталоге и нет записей — матрица нечего показать.
          </Typography.Text>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="58%"
              data={rows}
              margin={{ top: 36, right: 64, bottom: 36, left: 64 }}
            >
              <PolarGrid stroke="rgba(30, 8, 77, 0.15)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: '#260743', fontSize: 11 }}
                tickLine={false}
              />
              <PolarRadiusAxis angle={45} domain={[0, 100]} tickCount={5} tick={{ fontSize: 10 }} />
              <Radar
                name="Прогресс"
                dataKey="value"
                stroke={FILL.stroke}
                fill={FILL.fill}
                fillOpacity={0.38}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0].payload as { full?: string; value?: number }
                  return (
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(30,8,77,0.12)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 13,
                        maxWidth: 320,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{row.full}</div>
                      <div>Прогресс по курсу: {row.value}%</div>
                    </div>
                  )
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Space>
  )
}
