import React, { useId } from 'react'

// Minh hoạ vector riêng cho lì xì, co giãn sắc nét và chuyển động từng phần.
export default function Envelope({ mini = false }) {
  const id = useId().replace(/:/g, '')
  return <svg className={`lr-envelope${mini ? ' lr-envelope--mini' : ''}`} viewBox='0 0 240 290' fill='none' aria-hidden='true'>
    <defs>
      <linearGradient id={`${id}-red`} x1='40' y1='45' x2='216' y2='264' gradientUnits='userSpaceOnUse'>
        <stop stopColor='#ee5753' /><stop offset='.48' stopColor='#c7273c' /><stop offset='1' stopColor='#7e102a' />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1='70' y1='95' x2='160' y2='195' gradientUnits='userSpaceOnUse'>
        <stop stopColor='#fff2bc' /><stop offset='.45' stopColor='#efc76e' /><stop offset='1' stopColor='#ab692b' />
      </linearGradient>
      <linearGradient id={`${id}-flap`} x1='120' y1='31' x2='120' y2='116' gradientUnits='userSpaceOnUse'>
        <stop stopColor='#fa7770' /><stop offset='1' stopColor='#cf3044' />
      </linearGradient>
    </defs>
    <g className='lr-envelope__body'>
      <rect x='30' y='34' width='180' height='228' rx='21' fill={`url(#${id}-red)`} />
      <rect x='39' y='43' width='162' height='210' rx='15' stroke='#ffdc91' strokeOpacity='.55' />
      <path d='M40 234L89 190M200 234L151 190M40 72L74 100M200 72L166 100' stroke='#ffbd75' strokeOpacity='.2' />
      <path d='M47 217v23h23M193 217v23h-23M47 67V55h23M193 67V55h-23' stroke={`url(#${id}-gold)`} strokeWidth='2' />
      <path d='M65 150c-18 8-12 34 4 28-22 26 4 31 9 13M175 150c18 8 12 34-4 28 22 26-4 31-9 13' stroke='#ffcf88' strokeOpacity='.4' strokeWidth='1.5' />
      <path d='M99 230h42M110 237h20' stroke='#eabe74' strokeOpacity='.55' strokeLinecap='round' />
      <g className='lr-envelope__seal'>
        <path d='M120 108l43 43-43 43-43-43z' fill={`url(#${id}-gold)`} />
        <path d='M120 115l36 36-36 36-36-36z' stroke='#8f3c26' strokeOpacity='.6' />
        <text x='120' y='163' fill='#8f292a' textAnchor='middle' fontSize='30' fontFamily='Georgia, serif' fontWeight='bold'>lộc</text>
      </g>
    </g>
    <g className='lr-envelope__flap'>
      <path d='M30 55c0-12 9-21 21-21h138c12 0 21 9 21 21v5l-78 47c-7 4-17 4-24 0L30 60z' fill={`url(#${id}-flap)`} />
      <path d='M38 56l75 45c4 2 10 2 14 0l75-45' stroke='#f6cf93' strokeWidth='1.5' />
      <path d='M108 49h24M114 55h12' stroke='#ffd9a3' strokeOpacity='.7' strokeLinecap='round' />
    </g>
  </svg>
}
