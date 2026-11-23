import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card } from '../components/ui'
import { CARD_TEMPLATES } from '../lib/card/catalog'
import { generateCard } from '../lib/card/generator'
import { cardDocToPaperV2 } from '../lib/paper/backendV2'
import { templatesApi, errorText } from '../m/api'
import { useToast } from '../components/Toast'

/** 把本地 18 份官方模板替换到后端：删除旧模板 → 上传新模板 */
export default function TemplateSyncPage() {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')

  async function sync() {
    if (!window.confirm('会先删除后端当前全部模板，再上传 18 份官方模板。确认继续？')) return
    setRunning(true)
    setError('')
    setLog([])
    try {
      const old = await templatesApi.list()
      setLog((xs) => [...xs, `读取到后端 ${old.length} 份模板`])
      for (const t of old) {
        await templatesApi.remove(t.id)
        setLog((xs) => [...xs, `删除 #${t.id} ${t.name}`])
      }
      let ok = 0
      for (const tpl of CARD_TEMPLATES) {
        const generated = generateCard(tpl.spec)
        const paper = cardDocToPaperV2(generated.doc)
        await templatesApi.createDirect(tpl.name, paper)
        ok += 1
        setLog((xs) => [...xs, `上传 ${tpl.name}`])
      }
      toast(`官方模板同步完成：删除 ${old.length} 份，上传 ${ok} 份`, 'ok')
    } catch (e) {
      setError(errorText(e))
      toast('同步失败，请检查后端与 Token', 'err')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="官方模板同步"
        desc="删除后端旧模板，上传本地 18 份高考官方模板；模板来自统一版式生成器。"
        crumb={[{ label: '试卷库', to: '/papers' }, { label: '模板同步' }]}
        extra={<Badge tone="brand">{CARD_TEMPLATES.length} 份</Badge>}
      />

      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-bold text-ink">
            会先调用 <code className="rounded bg-brand-50 px-1">DELETE /templates/&#123;id&#125;</code> 删除旧模板，
            再用 <code className="rounded bg-brand-50 px-1">POST /templates</code> 上传新模板。
          </p>
          <Button className="ml-auto" onClick={() => void sync()} disabled={running}>
            {running ? '同步中…' : `删除旧模板并上传 ${CARD_TEMPLATES.length} 份`}
          </Button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-bold text-red-600">{error}</p>}
        {log.length > 0 && (
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-neutral-900 p-3 text-[10.5px] leading-relaxed text-neutral-200">
            {log.join('\n')}
          </pre>
        )}
      </Card>
    </div>
  )
}
