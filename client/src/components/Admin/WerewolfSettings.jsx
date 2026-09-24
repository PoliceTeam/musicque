import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card, InputNumber, Popconfirm, Space, Typography, message } from 'antd'
import { getWerewolfSettings, updateWerewolfSettings } from '../../services/api'

const { Text } = Typography

// Chỉnh các mốc thời gian Ma Sói. Server lưu theo ms; ở đây nhập theo giây.
const WerewolfSettings = () => {
  const [fields, setFields] = useState([])
  const [draft, setDraft] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const accept = useCallback((data) => {
    const seconds = Object.fromEntries(Object.entries(data.timings).map(([key, ms]) => [key, ms / 1000]))
    setFields(data.fields)
    setDraft(seconds)
    setSaved(seconds)
  }, [])

  useEffect(() => {
    getWerewolfSettings()
      .then(({ data }) => accept(data))
      .catch(() => message.error('Không tải được cấu hình Ma Sói'))
      .finally(() => setLoading(false))
  }, [accept])

  const save = async (payload, successText) => {
    setSaving(true)
    try {
      const { data } = await updateWerewolfSettings(payload)
      accept(data)
      message.success(successText)
    } catch (error) {
      message.error(error.response?.data?.message || 'Không lưu được cấu hình')
    } finally {
      setSaving(false)
    }
  }

  const dirty = fields.some((field) => draft[field.key] !== saved[field.key])
  const valid = fields.every((field) => Number.isFinite(draft[field.key]))
  const roundSeconds = ['nightMs', 'dayMs', 'voteMs'].reduce((sum, key) => sum + (saved[key] || 0), 0)

  const submit = () => {
    const timings = Object.fromEntries(fields.map((field) => [field.key, Math.round(draft[field.key] * 1000)]))
    save({ timings }, 'Đã lưu. Áp dụng từ pha tiếp theo.')
  }

  return (
    <Card
      title='🐺 Ma Sói · thời gian'
      loading={loading}
      extra={<Text type='secondary' style={{ fontSize: 12 }}>Một vòng đêm → ngày → phiếu: {Math.floor(roundSeconds / 60)} phút {roundSeconds % 60}s</Text>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
        {fields.map((field) => (
          <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text strong>{field.label}</Text>
            <InputNumber
              value={draft[field.key]}
              min={field.min / 1000}
              max={field.max / 1000}
              step={5}
              addonAfter='giây'
              style={{ width: '100%' }}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            />
            <Text type='secondary' style={{ fontSize: 12 }}>
              Mặc định {field.defaultMs / 1000}s · cho phép {field.min / 1000}–{field.max / 1000}s
            </Text>
          </label>
        ))}
      </div>
      <Space style={{ marginTop: 16 }}>
        <Button type='primary' loading={saving} disabled={!dirty || !valid} onClick={submit}>
          Lưu thay đổi
        </Button>
        <Button disabled={!dirty || saving} onClick={() => setDraft(saved)}>Huỷ</Button>
        <Popconfirm title='Đưa tất cả về giá trị mặc định?' onConfirm={() => save({ reset: true }, 'Đã khôi phục mặc định')}>
          <Button type='link' disabled={saving}>Khôi phục mặc định</Button>
        </Popconfirm>
      </Space>
      <Text type='secondary' style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
        Ván đang chơi vẫn giữ nguyên giờ kết thúc của pha hiện tại; thời gian mới áp dụng từ pha kế tiếp.
      </Text>
    </Card>
  )
}

export default WerewolfSettings
