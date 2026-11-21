import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ConfirmProvider } from './components/Confirm'
import { Layout } from './components/Layout'
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const FilesPage = lazy(() => import('./pages/FilesPage'))
const PapersPage = lazy(() => import('./pages/PapersPage'))
const PaperPrintPage = lazy(() => import('./pages/PaperPrintPage'))
const CardStudioPage = lazy(() => import('./pages/CardStudioPage'))
const BarcodeStudioPage = lazy(() => import('./pages/BarcodeStudioPage'))
const DslStudioPage = lazy(() => import('./pages/DslStudioPage'))
const CardEditorPage = lazy(() => import('./pages/CardEditorPage'))
import { Splash } from './components/Splash'
import { ServerDownDialog } from './components/ServerDownDialog'
import { ToastProvider } from './components/Toast'
const AboutPage = lazy(() => import('./pages/AboutPage'))
const AdvancedPage = lazy(() => import('./pages/AdvancedPage'))
const ThemePage = lazy(() => import('./pages/ThemePage'))
const CheckGuidePage = lazy(() => import('./pages/CheckGuidePage'))
const CheckHistoryPage = lazy(() => import('./pages/CheckHistoryPage'))
const CheckPage = lazy(() => import('./pages/CheckPage'))
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const ExamsPage = lazy(() => import('./pages/ExamsPage'))
const NewExamPage = lazy(() => import('./pages/NewExamPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const StudentsImportPage = lazy(() => import('./pages/StudentsImportPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const LogsPage = lazy(() => import('./pages/LogsPage'))
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'))
const BatchesPage = lazy(() => import('./pages/BatchesPage'))
const ExamListPage = lazy(() => import('./pages/ExamListPage'))
const ExamOverviewPage = lazy(() => import('./pages/ExamOverviewPage'))

import MobileShell from './m/shell'
const MHome = lazy(() => import('./m/pages/Home'))
const MExams = lazy(() => import('./m/pages/Exams'))
const MExamNew = lazy(() => import('./m/pages/ExamNew'))
const MExamDetail = lazy(() => import('./m/pages/ExamDetail'))
const MPapers = lazy(() => import('./m/pages/Papers'))
const MPaperDetail = lazy(() => import('./m/pages/PaperDetail'))
const MCardEdit = lazy(() => import('./m/pages/CardEdit'))
const MResults = lazy(() => import('./m/pages/Results'))
const MResultDetail = lazy(() => import('./m/pages/ResultDetail'))
const MCapture = lazy(() => import('./m/pages/Capture'))
const MHistory = lazy(() => import('./m/pages/History'))
const MFiles = lazy(() => import('./m/pages/Files'))
const MStudents = lazy(() => import('./m/pages/Students'))
const MSettings = lazy(() => import('./m/pages/Settings'))
const MMine = lazy(() => import('./m/pages/Mine'))
const MTheme = lazy(() => import('./m/pages/Theme'))
const MBatches = lazy(() => import('./m/pages/Batches'))
const MReviews = lazy(() => import('./m/pages/Reviews'))
const MReviewDetail = lazy(() => import('./m/pages/ReviewDetail'))
const MLogs = lazy(() => import('./m/pages/Logs'))

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Splash />
        <ServerDownDialog />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/exams" replace />} />

            {/* 考试：一次批改活动，创建时绑定试卷 */}
            <Route path="exams" element={<ExamListPage />} />
            <Route path="exams/new" element={<NewExamPage />} />
            <Route path="exams/batches" element={<BatchesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="exams/:id" element={<ExamOverviewPage />} />

            {/* 试卷：版式与答案键，独立于考试存在 */}
            <Route path="exams/templates" element={<Navigate to="/papers/templates" replace />} />

            {/* 旧版卡片式版式编辑器，仅留作回退 */}
            <Route path="cards" element={<ExamsPage />} />
            <Route path="cards/:id" element={<EditorPage />} />

            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="reviews/:id" element={<ReviewDetailPage />} />
            <Route path="logs" element={<LogsPage />} />

            <Route path="check" element={<CheckPage />} />
            <Route path="check/history" element={<CheckHistoryPage />} />
            <Route path="check/guide" element={<CheckGuidePage />} />

            <Route path="results" element={<ResultsPage />} />
            <Route path="files" element={<FilesPage />} />

            <Route path="papers" element={<PapersPage />} />
            <Route path="papers/studio" element={<CardStudioPage />} />
            <Route path="papers/dsl" element={<DslStudioPage />} />
            <Route path="papers/templates" element={<BarcodeStudioPage />} />
            <Route path="papers/barcode" element={<BarcodeStudioPage />} />
            <Route path="papers/local/edit" element={<CardEditorPage />} />
            <Route path="papers/:id/edit" element={<CardEditorPage />} />

            <Route path="students" element={<StudentsPage />} />
            <Route path="students/import" element={<StudentsImportPage />} />

            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/diagnostics" element={<DiagnosticsPage />} />
            <Route path="settings/advanced" element={<AdvancedPage />} />
            <Route path="settings/theme" element={<ThemePage />} />
            <Route path="settings/about" element={<AboutPage />} />
          </Route>

          <Route path="papers/print" element={<PaperPrintPage />} />
          <Route path="papers/:id/print" element={<PaperPrintPage />} />

          {/* 移动端 v2 /m */}
          <Route path="m" element={<MobileShell />}>
            <Route index element={<MHome />} />
            <Route path="exams" element={<MExams />} />
            <Route path="exams/new" element={<MExamNew />} />
            <Route path="exams/:id" element={<MExamDetail />} />
            <Route path="papers" element={<MPapers />} />
            <Route path="papers/:id" element={<MPaperDetail />} />
            <Route path="papers/:id/edit" element={<MCardEdit />} />
            <Route path="results" element={<MResults />} />
            <Route path="results/:id" element={<MResultDetail />} />
            <Route path="capture" element={<MCapture />} />
            <Route path="history" element={<MHistory />} />
            <Route path="files" element={<MFiles />} />
            <Route path="students" element={<MStudents />} />
            <Route path="settings" element={<MSettings />} />
            <Route path="mine" element={<MMine />} />
            <Route path="theme" element={<MTheme />} />
            <Route path="batches" element={<MBatches />} />
            <Route path="reviews" element={<MReviews />} />
            <Route path="reviews/:id" element={<MReviewDetail />} />
            <Route path="logs" element={<MLogs />} />
          </Route>

          <Route path="*" element={<Navigate to="/exams" replace />} />
        </Routes>
        </Suspense>
      </ConfirmProvider>
    </ToastProvider>
  )
}

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-[12px] font-bold text-ink-soft shadow-soft">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
        正在加载…
      </div>
    </div>
  )
}
