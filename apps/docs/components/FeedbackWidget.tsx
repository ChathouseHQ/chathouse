'use client'
import { ThumbsUpIcon, ThumbsDownIcon } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import * as Swetrix from 'swetrix'

const FEEDBACK_TTL_DAYS = 7
const FEEDBACK_TTL_MS = FEEDBACK_TTL_DAYS * 24 * 60 * 60 * 1000

const NEGATIVE_REASONS = [
  'Content is out of date',
  'Missing information',
  'Code examples not working as expected',
  'Other',
]

const getNowMs = () => {
  return Date.now()
}

const storageKeyForPath = (pathname: string) => {
  return `docs.feedback:${pathname}`
}

const hasRecentFeedback = (pathname: string) => {
  if (typeof window === 'undefined') return false
  try {
    const key = storageKeyForPath(pathname)
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && typeof data.ts === 'number' && getNowMs() - data.ts < FEEDBACK_TTL_MS) {
        return true
      }
    }
  } catch (reason) {
    console.error('Error checking recent feedback:', reason)
  }

  return false
}

const persistFeedback = (pathname: string, answer: string, reason: string) => {
  if (typeof window !== 'undefined') {
    try {
      const key = storageKeyForPath(pathname)
      const value = JSON.stringify({ answer, reason, ts: getNowMs() })
      window.localStorage.setItem(key, value)
    } catch (errorReason) {
      console.error('Error persisting feedback:', errorReason)
    }
  }
}

const trackFeedback = async (answer: string, pathname: string, reason: string) => {
  try {
    await Swetrix.track({
      ev: 'DOCS_FEEDBACK',
      meta: {
        answer,
        path: pathname,
        ...(reason ? { reason } : {}),
      },
    })
  } catch (errorReason) {
    console.error('Error tracking feedback:', errorReason)
  }
}

export function FeedbackWidget() {
  const pathname = usePathname()
  const [submitted, setSubmitted] = useState(false)
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [reason, setReason] = useState('')
  const suppressed = useMemo(() => hasRecentFeedback(pathname), [pathname])

  useEffect(() => {
    setSubmitted(false)
    setShowReasonForm(false)
    setReason('')
  }, [pathname])

  const onClickYes = async () => {
    await trackFeedback('Yes', pathname, '')
    persistFeedback(pathname, 'Yes', '')
    setSubmitted(true)
  }

  const onClickNo = () => {
    setShowReasonForm(true)
  }

  const onSubmitReason = async (event: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault?.()
    if (!reason) return
    await trackFeedback('No', pathname, reason)
    persistFeedback(pathname, 'No', reason)
    setSubmitted(true)
    setShowReasonForm(false)
  }

  return (
    <section
      className="relative mt-8 hidden overflow-hidden rounded-xl bg-transparent p-6 ring-1 ring-gray-300 sm:block dark:ring-slate-800/80"
      aria-label="Docs feedback widget"
    >
      <div
        className="pointer-events-none absolute -top-4 right-0 h-[140px] w-[140px] opacity-10 dark:opacity-5"
        aria-hidden="true"
      >
        <img
          src="https://swetrix.com/logo512.png"
          alt=""
          className="h-full w-full -rotate-10 object-contain"
        />
      </div>
      <h2 className="mt-2 mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Help us improve Chathouse
      </h2>
      {submitted || suppressed ? (
        <p aria-live="polite" className="m-0 mb-12 text-lg text-slate-700 dark:text-slate-300">
          Thank you for your feedback ❤️
        </p>
      ) : (
        <>
          {showReasonForm ? (
            <form className="mt-4" onSubmit={onSubmitReason}>
              <p className="mb-4 text-lg text-slate-700 dark:text-slate-300">
                Why was this page not helpful to you?
              </p>
              <div
                role="group"
                aria-label="Choose a reason"
                className="relative z-10 mb-5 grid gap-3"
              >
                {NEGATIVE_REASONS.map((label) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-3 text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    <input
                      type="radio"
                      name="feedback-reason"
                      value={label}
                      checked={reason === label}
                      onChange={() => setReason(label)}
                      className="h-4 w-4 border-gray-300 bg-transparent text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-slate-300"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="relative z-10 rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={!reason}
                aria-disabled={!reason}
              >
                Submit
              </button>
            </form>
          ) : (
            <>
              <p className="mb-4 text-lg text-slate-700 dark:text-slate-300">
                Was this page helpful to you?
              </p>
              <div role="group" className="relative z-10 mb-6 flex gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500 bg-transparent px-5 py-2 font-medium text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white dark:text-emerald-500 dark:hover:bg-emerald-600 dark:hover:text-white"
                  onClick={onClickYes}
                  aria-label="Yes, this page was helpful"
                >
                  <ThumbsUpIcon width={20} height={20} weight="duotone" />
                  Yes
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500 bg-transparent px-5 py-2 font-medium text-red-600 transition-colors hover:bg-red-500 hover:text-white dark:text-red-500 dark:hover:bg-red-600 dark:hover:text-white"
                  onClick={onClickNo}
                  aria-label="No, this page was not helpful"
                >
                  <ThumbsDownIcon width={20} height={20} weight="duotone" />
                  No
                </button>
              </div>
            </>
          )}
        </>
      )}
      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <Link
          className="font-medium transition-colors hover:text-slate-900 dark:hover:text-white"
          href="/contribute"
        >
          Learn how to contribute
        </Link>
        <span className="opacity-40">•</span>
        <Link
          className="font-medium transition-colors hover:text-slate-900 dark:hover:text-white"
          href="https://github.com/Swetrix/swetrix/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report a problem with this content
        </Link>
      </div>
    </section>
  )
}
