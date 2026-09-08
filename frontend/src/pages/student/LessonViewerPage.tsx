import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getLesson, getLessonFileSignedUrl } from '@/services/lessons'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import { useEffect, useState } from 'react'
import type { LessonFile } from '@/types'

function FileViewer({ file }: { file: LessonFile }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getLessonFileSignedUrl(file.file_path)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [file.file_path])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!url) return <Skeleton className="h-48 w-full" />

  const type = file.file_type.toLowerCase()
  if (['mp4', 'webm'].includes(type)) {
    return <video className="max-h-[70vh] w-full rounded-xl bg-ink-950" controls controlsList="nodownload" src={url} />
  }
  if (['mp3', 'wav'].includes(type)) {
    return <audio className="w-full" controls controlsList="nodownload" src={url} />
  }
  if (['jpg', 'jpeg', 'png'].includes(type)) {
    return <img src={url} alt={file.file_name} className="max-h-[70vh] w-full rounded-xl object-contain" draggable={false} />
  }
  if (type === 'pdf') {
    return <iframe title={file.file_name} src={url} className="h-[70vh] w-full rounded-xl border border-ink-200 dark:border-ink-700" />
  }
  return (
    <Card>
      <p className="text-sm font-medium">{file.file_name}</p>
      <p className="mt-1 text-xs text-ink-500">This file type can be viewed via the school platform stream only. Download is disabled.</p>
      <iframe title={file.file_name} src={url} className="mt-3 h-96 w-full rounded-xl border" />
    </Card>
  )
}

export function StudentLessonViewerPage() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => getLesson(id!),
    enabled: !!id,
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!data) return <p>Lesson not found</p>

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <div className="mb-4">
        <Link to="/student/lessons">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
        </Link>
      </div>
      <PageHeader title={data.title} description={`${data.subject?.name ?? ''} · ${formatDate(data.lesson_date)}`} />
      {data.description && <Card className="mb-4"><p className="whitespace-pre-wrap text-sm">{data.description}</p></Card>}
      <div className="space-y-6">
        {(data.files ?? []).map((f) => (
          <div key={f.id}>
            <p className="mb-2 text-sm font-semibold">{f.file_name}</p>
            <FileViewer file={f} />
          </div>
        ))}
        {!data.files?.length && <Card><p className="text-sm text-ink-500">No files attached.</p></Card>}
      </div>
    </div>
  )
}
