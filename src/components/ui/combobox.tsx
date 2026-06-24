'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  value: string
  label: string
  sublabel?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Combobox({ options, value, onChange, placeholder = 'Search…', className, disabled }: ComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim() === ''
    ? options
    : options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(opt: ComboboxOption) {
    onChange(opt.value)
    setQuery('')
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer select-none',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-2 ring-blue-500 border-transparent'
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            className="flex-1 outline-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400"
            placeholder="Type to search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={cn('flex-1 truncate', selected ? 'text-gray-800' : 'text-gray-400')}>
            {selected ? selected.label : placeholder}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
              tabIndex={-1}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">No results found</div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt.value}
                onMouseDown={() => handleSelect(opt)}
                className={cn(
                  'px-3 py-2.5 cursor-pointer hover:bg-blue-50 flex items-center justify-between gap-2',
                  opt.value === value && 'bg-blue-50'
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{opt.label}</p>
                  {opt.sublabel && <p className="text-xs text-gray-500 truncate">{opt.sublabel}</p>}
                </div>
                {opt.value === value && (
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
