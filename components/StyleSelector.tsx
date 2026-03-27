'use client';

import { useState } from 'react';
import {
  ART_STYLE_OPTIONS,
  ORIENTATION_OPTIONS,
  type ArtStyle,
  type DesignOptions,
  type Orientation,
} from '@/lib/ai';

interface StyleSelectorProps {
  hasPhoto: boolean;
  onSubmit: (options: DesignOptions) => void;
  isProcessing?: boolean;
}

export default function StyleSelector({
  hasPhoto,
  onSubmit,
  isProcessing = false,
}: StyleSelectorProps) {
  const [artStyle, setArtStyle] = useState<ArtStyle>('caricature');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [partnerName1, setPartnerName1] = useState('');
  const [partnerName2, setPartnerName2] = useState('');
  const [specialDate, setSpecialDate] = useState('');
  const [extraNote, setExtraNote] = useState('');

  function handleSubmit() {
    if (!hasPhoto || isProcessing) return;
    onSubmit({
      artStyle,
      orientation,
      partnerName1: partnerName1.trim() || undefined,
      partnerName2: partnerName2.trim() || undefined,
      specialDate: specialDate.trim() || undefined,
      extraNote: extraNote.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
          Art Style
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ART_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setArtStyle(option.value)}
              className={`
                text-left p-3 rounded-lg border transition-all
                ${artStyle === option.value
                  ? 'border-violet-500 bg-violet-500/10 text-white'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
                }
              `}
            >
              <span className="text-base">{option.emoji}</span>
              <p className="text-sm font-medium mt-1">{option.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
          Orientation
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ORIENTATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setOrientation(option.value)}
              className={`
                text-left p-3 rounded-lg border transition-all
                ${orientation === option.value
                  ? 'border-violet-500 bg-violet-500/10 text-white'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
                }
              `}
            >
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-700" />

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
          Personalisation{' '}
          <span className="normal-case text-zinc-600 font-normal">
            optional
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Partner 1 name"
              value={partnerName1}
              onChange={(e) => setPartnerName1(e.target.value)}
              className="
                bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:outline-none focus:border-violet-500
                transition-colors
              "
            />
            <input
              type="text"
              placeholder="Partner 2 name"
              value={partnerName2}
              onChange={(e) => setPartnerName2(e.target.value)}
              className="
                bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:outline-none focus:border-violet-500
                transition-colors
              "
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Special date e.g. June 6, 2025"
              value={specialDate}
              onChange={(e) => setSpecialDate(e.target.value)}
              className="
                bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:outline-none focus:border-violet-500
                transition-colors
              "
            />
            <input
              type="text"
              placeholder="Short message e.g. Forever yours"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              className="
                bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:outline-none focus:border-violet-500
                transition-colors
              "
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!hasPhoto || isProcessing}
        className={`
          w-full py-3 rounded-lg text-sm font-medium transition-all
          ${!hasPhoto || isProcessing
            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
          }
        `}
      >
        {isProcessing
          ? 'Creating your portrait...'
          : !hasPhoto
          ? 'Upload a photo first'
          : 'Create my portrait'
        }
      </button>

    </div>
  );
}