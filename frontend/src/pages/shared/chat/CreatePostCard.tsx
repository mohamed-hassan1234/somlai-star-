import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { createChatPost, uploadPostImage, uploadPostVideo } from '@/services/chatFeed'
import { getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'

export function CreatePostCard({ queryKey }: { queryKey: string[] }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile

  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const createPost = useMutation({
    mutationFn: async () => {
      let mediaUrl: string | null = null
      let mediaType: 'image' | 'video' | null = null
      if (file) {
        mediaType = fileType ?? (file.type.startsWith('video/') ? 'video' : 'image')
        mediaUrl = mediaType === 'video' ? await uploadPostVideo(file) : await uploadPostImage(file)
      }
      await createChatPost(profile.id, body, mediaUrl, mediaType ?? 'image')
    },
    onSuccess: () => {
      setBody('')
      setFile(null)
      setFileType(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      void qc.invalidateQueries({ queryKey })
      toast.success('Post published')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pickFile = (f: File | null) => {
    if (!f) return
    const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : null
    if (!kind) {
      toast.error('Only images or videos are supported')
      return
    }
    if (f.size > (kind === 'image' ? 5 : 100) * 1024 * 1024) {
      toast.error(kind === 'image' ? 'Images must be 5MB or smaller' : 'Videos must be 100MB or smaller')
      return
    }
    setFile(f)
    setFileType(kind)
    setPreview(URL.createObjectURL(f))
  }

  const canPost = (body.trim().length > 0 || file !== null) && !createPost.isPending

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-surface-elevated p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900/80 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar profile={profile} size="md" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share a post or a video with the academy…"
          rows={2}
          maxLength={1000}
          className="min-h-[56px] w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
        />
      </div>

      {preview && (
        <div className="relative mt-3 overflow-hidden rounded-xl">
          {fileType === 'video' ? (
            <video src={preview} controls playsInline className="max-h-80 w-full object-cover" />
          ) : (
            <img src={preview} alt="Post preview" className="max-h-72 w-full object-cover" />
          )}
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => {
              setFile(null)
              setFileType(null)
              setPreview(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink-950/70 text-white transition hover:bg-ink-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              fileRef.current!.accept = 'image/*'
              fileRef.current?.click()
            }}
            disabled={createPost.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 disabled:opacity-50 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="hidden sm:inline">Photo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              fileRef.current!.accept = 'video/*'
              fileRef.current?.click()
            }}
            disabled={createPost.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 disabled:opacity-50 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <Video className="h-5 w-5" />
            <span className="hidden sm:inline">Video</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          aria-label="Upload a photo or video"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => createPost.mutate()}
          disabled={!canPost}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {createPost.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Post
        </button>
      </div>
    </div>
  )
}
