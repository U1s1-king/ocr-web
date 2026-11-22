import { useNavigate } from 'react-router-dom'
import { Btn, Card, Page } from '../ui'

/** 移动端识别指南 */
export default function CheckGuide() {
  const nav = useNavigate()
  return (
    <Page title="识别指南" sub="拍照与定位要求" back>
      <Card className="!p-3">
        <p className="text-[12px] font-extrabold">拍摄要求</p>
        <ul className="mo-muted mt-2 space-y-1.5">
          <li>· 四角定位块要完整入镜，不要裁切</li>
          <li>· 尽量正对拍摄，避免明显倾斜和反光</li>
          <li>· 光线均匀，避免阴影盖住涂卡区域</li>
          <li>· 手机拍照后可在识别页旋转/裁剪</li>
        </ul>
      </Card>
      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">识别流程</p>
        <ol className="mo-muted mt-2 list-decimal space-y-1.5 pl-4">
          <li>先创建试卷和考试</li>
          <li>在试卷里配置题目区域和四角定位块</li>
          <li>设置标准答案键</li>
          <li>上传/拍摄答题卡并识别</li>
          <li>识别结果可进入人工复核</li>
        </ol>
      </Card>
      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">常见失败</p>
        <ul className="mo-muted mt-2 space-y-1.5">
          <li>· 未找到四个角定位块：重新拍全整张卡</li>
          <li>· 试卷还没有配置内容：先编辑题目区域</li>
          <li>· 答案键为空：先设置标准答案</li>
        </ul>
      </Card>
      <Btn block onClick={() => nav('/m/capture')}>去拍照识别</Btn>
      <Btn block variant="ghost" onClick={() => nav('/m/mine')}>返回我的</Btn>
    </Page>
  )
}
