'use client'

const FONT = "'Source Sans 3', sans-serif"

export default function WaterfallDiagram() {
  return (
    <div style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '24px 0', fontFamily: FONT }}>
      <style>{`
        @keyframes wf-rising { 0% { opacity:0.6; transform:translateY(0); } 100% { opacity:0; transform:translateY(-20px); } }
        @keyframes wf-leaking { 0% { opacity:0.5; transform:translateX(0); } 100% { opacity:0; transform:translateX(18px); } }
        @keyframes wf-pouring { 0% { opacity:0; transform:translateX(0); } 30% { opacity:0.5; } 100% { opacity:0; transform:translateX(-16px); } }
        @keyframes wf-bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-1px); } }
        @media (prefers-reduced-motion: reduce) {
          .wf-rise, .wf-rise2, .wf-rise3, .wf-leak, .wf-leak2, .wf-pour, .wf-pour2, .wf-surf { animation: none !important; }
        }
        .wf-rise  { animation: wf-rising  1.4s linear   infinite; }
        .wf-rise2 { animation: wf-rising  1.4s linear   infinite 0.5s; }
        .wf-rise3 { animation: wf-rising  1.4s linear   infinite 0.9s; }
        .wf-leak  { animation: wf-leaking 1.6s ease-out infinite; }
        .wf-leak2 { animation: wf-leaking 1.6s ease-out infinite 0.6s; }
        .wf-pour  { animation: wf-pouring 1.8s ease-in  infinite; }
        .wf-pour2 { animation: wf-pouring 1.8s ease-in  infinite 0.5s; }
        .wf-surf  { animation: wf-bob     3s   ease-in-out infinite; }
        .wf-svg text { font-family: 'Source Sans 3', sans-serif; }
        .wf-svg .th { font-size: 14px; font-weight: 500; }
        .wf-svg .ts { font-size: 12px; font-weight: 400; }
      `}</style>

      <svg className="wf-svg" width="100%" viewBox="0 0 680 1060">
        <defs>
          <linearGradient id="wf-w1" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#85B7EB" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#85B7EB" stopOpacity="0.2"/>
          </linearGradient>
          <linearGradient id="wf-w2" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#85B7EB" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#85B7EB" stopOpacity="0.15"/>
          </linearGradient>
          <linearGradient id="wf-w3" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#85B7EB" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#85B7EB" stopOpacity="0.08"/>
          </linearGradient>
        </defs>

        {/* Legend */}
        <rect x="130" y="20" width="420" height="82" rx="10" fill="#FFFFFF" stroke="#E8E4DC" strokeWidth="0.5"/>
        <text className="th" x="340" y="44" textAnchor="middle" fill="#2D2A26">The waterfall</text>
        <text className="ts" x="340" y="62" textAnchor="middle" fill="#8A857D">Each pool must reach 1.0 before it overflows upward.</text>
        <text className="ts" x="340" y="78" textAnchor="middle" fill="#8A857D">Left: what fills each pool. Right: what drains it.</text>
        <text className="ts" x="340" y="94" textAnchor="middle" fill="#8A857D">Green flows in. Red flows out.</text>

        {/* Ground */}
        <rect x="100" y="990" width="480" height="10" rx="5" fill="#2D2A26" opacity="0.06"/>
        <text className="ts" x="340" y="1020" textAnchor="middle" fill="#8A857D" opacity="0.25">Attention enters as effort, time, focus — and rises</text>

        {/* Rising bubbles from ground */}
        <circle cx="310" cy="978" r="2.5" fill="#85B7EB" opacity="0.4" className="wf-rise"/>
        <circle cx="340" cy="974" r="2"   fill="#85B7EB" opacity="0.35" className="wf-rise2"/>
        <circle cx="365" cy="980" r="1.8" fill="#85B7EB" opacity="0.3"  className="wf-rise3"/>

        {/* ═══ POOL 1: SAFETY ═══ */}
        <path d="M170 990 L170 855 Q170 838 188 838 L492 838 Q510 838 510 855 L510 990" fill="none" stroke="#E24B4A" strokeWidth="1.2" opacity="0.35"/>
        <rect x="172" y="866" width="336" height="122" fill="url(#wf-w1)"/>
        <path d="M174 866 Q270 863 340 866 Q410 869 506 866" fill="none" stroke="#85B7EB" strokeWidth="1.2" opacity="0.45" className="wf-surf"/>
        <line x1="172" y1="908" x2="506" y2="908" stroke="#E24B4A" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3"/>
        <text className="ts" x="514" y="911" fill="#A32D2D" opacity="0.4">1.0</text>
        <text className="th" x="340" y="856" textAnchor="middle" fill="#791F1F">Safety</text>
        <text className="ts" x="250" y="930" textAnchor="middle" fill="#0C447C">Body</text>
        <text className="ts" x="340" y="930" textAnchor="middle" fill="#0C447C">Health</text>
        <text className="ts" x="430" y="930" textAnchor="middle" fill="#0C447C">Shelter</text>
        <text className="ts" x="340" y="968" textAnchor="middle" fill="#0C447C" opacity="0.5">1.4 — overflowing ↑</text>
        <text className="ts" x="156" y="876" textAnchor="end" fill="#0F6E56">Exercise →</text>
        <text className="ts" x="156" y="892" textAnchor="end" fill="#0F6E56">Doctor visits →</text>
        <text className="ts" x="156" y="908" textAnchor="end" fill="#0F6E56">Good sleep →</text>
        <text className="ts" x="156" y="924" textAnchor="end" fill="#0F6E56">Home maintenance →</text>
        <text className="ts" x="156" y="940" textAnchor="end" fill="#0F6E56">Car maintenance →</text>
        <circle cx="172" cy="900" r="3"   fill="#5DCAA5" opacity="0.4"/>
        <circle cx="166" cy="897" r="2"   fill="#85B7EB" opacity="0.35" className="wf-pour"/>
        <circle cx="164" cy="903" r="1.5" fill="#85B7EB" opacity="0.3"  className="wf-pour2"/>
        <text className="ts" x="524" y="892" textAnchor="start" fill="#A32D2D">← Accident</text>
        <text className="ts" x="524" y="908" textAnchor="start" fill="#A32D2D">← Health scare</text>
        <text className="ts" x="524" y="924" textAnchor="start" fill="#A32D2D">← Violence</text>
        <circle cx="510" cy="940" r="4"   fill="#FCEBEB" stroke="#E24B4A" strokeWidth="0.8"/>
        <circle cx="520" cy="943" r="2"   fill="#85B7EB" opacity="0.4"  className="wf-leak"/>
        <circle cx="524" cy="940" r="1.5" fill="#85B7EB" opacity="0.3"  className="wf-leak2"/>

        {/* Overflow Safety → Security */}
        <line x1="340" y1="838" x2="340" y2="798" stroke="#85B7EB" strokeWidth="2.5" opacity="0.2"/>
        <circle cx="337" cy="818" r="2.5" fill="#85B7EB" opacity="0.4"  className="wf-rise"/>
        <circle cx="343" cy="822" r="2"   fill="#85B7EB" opacity="0.35" className="wf-rise2"/>

        {/* ═══ POOL 2: SECURITY ═══ */}
        <path d="M170 798 L170 655 Q170 638 188 638 L492 638 Q510 638 510 655 L510 798" fill="none" stroke="#BA7517" strokeWidth="1.2" opacity="0.35"/>
        <rect x="172" y="748" width="336" height="48" fill="url(#wf-w2)"/>
        <path d="M174 748 Q270 746 340 748 Q410 750 506 748" fill="none" stroke="#85B7EB" strokeWidth="1" opacity="0.3" className="wf-surf"/>
        <line x1="172" y1="710" x2="506" y2="710" stroke="#BA7517" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3"/>
        <text className="ts" x="514" y="713" fill="#BA7517" opacity="0.4">1.0</text>
        <text className="th" x="340" y="656" textAnchor="middle" fill="#633806">Security</text>
        <text className="ts" x="220" y="682" textAnchor="middle" fill="#854F0B" opacity="0.5">Money</text>
        <text className="ts" x="310" y="682" textAnchor="middle" fill="#854F0B" opacity="0.5">Home</text>
        <text className="ts" x="396" y="682" textAnchor="middle" fill="#854F0B" opacity="0.5">Insurance</text>
        <text className="ts" x="472" y="682" textAnchor="middle" fill="#854F0B" opacity="0.5">Connection</text>
        <text className="ts" x="340" y="780" textAnchor="middle" fill="#A32D2D" opacity="0.5">0.43 — absorbing everything</text>
        <text className="ts" x="156" y="672" textAnchor="end" fill="#0F6E56">Earning income →</text>
        <text className="ts" x="156" y="688" textAnchor="end" fill="#0F6E56">Budgeting →</text>
        <text className="ts" x="156" y="704" textAnchor="end" fill="#0F6E56">Paying bills →</text>
        <text className="ts" x="156" y="720" textAnchor="end" fill="#0F6E56">Insurance renewal →</text>
        <text className="ts" x="156" y="736" textAnchor="end" fill="#0F6E56">Family dinners →</text>
        <text className="ts" x="156" y="752" textAnchor="end" fill="#0F6E56">Saving →</text>
        <circle cx="172" cy="710" r="3"   fill="#5DCAA5" opacity="0.4"/>
        <circle cx="166" cy="707" r="2"   fill="#85B7EB" opacity="0.35" className="wf-pour"/>
        <circle cx="164" cy="713" r="1.5" fill="#85B7EB" opacity="0.3"  className="wf-pour2"/>
        <text className="ts" x="524" y="700" textAnchor="start" fill="#A32D2D">← Job loss</text>
        <text className="ts" x="524" y="716" textAnchor="start" fill="#A32D2D">← Divorce</text>
        <text className="ts" x="524" y="732" textAnchor="start" fill="#A32D2D">← Theft</text>
        <text className="ts" x="524" y="748" textAnchor="start" fill="#A32D2D">← Market crash</text>
        <circle cx="510" cy="760" r="4"   fill="#FAEEDA" stroke="#E24B4A" strokeWidth="0.8"/>
        <circle cx="520" cy="763" r="2"   fill="#85B7EB" opacity="0.4"  className="wf-leak"/>
        <circle cx="524" cy="760" r="1.5" fill="#85B7EB" opacity="0.3"  className="wf-leak2"/>

        {/* No overflow — dry gap */}
        <line x1="340" y1="638" x2="340" y2="600" stroke="#85B7EB" strokeWidth="1" opacity="0.06" strokeDasharray="3 5"/>
        <text className="ts" x="362" y="620" fill="#8A857D" opacity="0.18">dry</text>

        {/* ═══ POOL 3: FREEDOM ═══ */}
        <path d="M170 600 L170 460 Q170 443 188 443 L492 443 Q510 443 510 460 L510 600" fill="none" stroke="#1D9E75" strokeWidth="1.2" opacity="0.35"/>
        <rect x="172" y="584" width="336" height="14" fill="url(#wf-w3)"/>
        <path d="M174 584 Q270 583 340 584 Q410 585 506 584" fill="none" stroke="#85B7EB" strokeWidth="0.6" opacity="0.15"/>
        <line x1="172" y1="528" x2="506" y2="528" stroke="#1D9E75" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25"/>
        <text className="ts" x="514" y="531" fill="#1D9E75" opacity="0.35">1.0</text>
        <text className="th" x="340" y="462" textAnchor="middle" fill="#085041">Freedom</text>
        <text className="ts" x="230" y="490" textAnchor="middle" fill="#085041" opacity="0.4">Autonomy</text>
        <text className="ts" x="340" y="490" textAnchor="middle" fill="#085041" opacity="0.4">Time sovereignty</text>
        <text className="ts" x="458" y="490" textAnchor="middle" fill="#085041" opacity="0.4">Mobility</text>
        <text className="ts" x="340" y="560" textAnchor="middle" fill="#085041" opacity="0.3">Starved. Waiting on Security.</text>
        <text className="ts" x="156" y="490" textAnchor="end" fill="#0F6E56">Saying no →</text>
        <text className="ts" x="156" y="506" textAnchor="end" fill="#0F6E56">Delegating →</text>
        <text className="ts" x="156" y="522" textAnchor="end" fill="#0F6E56">Protecting 0-time →</text>
        <text className="ts" x="156" y="538" textAnchor="end" fill="#0F6E56">Reducing obligations →</text>
        <circle cx="172" cy="516" r="3"   fill="#5DCAA5" opacity="0.25"/>
        <text className="ts" x="524" y="500" textAnchor="start" fill="#A32D2D">← Overcommitment</text>
        <text className="ts" x="524" y="516" textAnchor="start" fill="#A32D2D">← Legal restriction</text>
        <text className="ts" x="524" y="532" textAnchor="start" fill="#A32D2D">← Controlling partner</text>
        <text className="ts" x="524" y="548" textAnchor="start" fill="#A32D2D">← Debt obligations</text>

        {/* Dry gap */}
        <line x1="340" y1="443" x2="340" y2="408" stroke="#85B7EB" strokeWidth="0.8" opacity="0.04" strokeDasharray="3 5"/>

        {/* ═══ POOL 4: OPPORTUNITY ═══ */}
        <path d="M170 408 L170 268 Q170 251 188 251 L492 251 Q510 251 510 268 L510 408" fill="none" stroke="#7F77DD" strokeWidth="1.2" opacity="0.35"/>
        <rect x="172" y="396" width="336" height="10" fill="url(#wf-w3)"/>
        <line x1="172" y1="336" x2="506" y2="336" stroke="#7F77DD" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.2"/>
        <text className="ts" x="514" y="339" fill="#7F77DD" opacity="0.3">1.0</text>
        <text className="th" x="340" y="272" textAnchor="middle" fill="#3C3489">Opportunity</text>
        <text className="ts" x="220" y="300" textAnchor="middle" fill="#534AB7" opacity="0.35">Purpose</text>
        <text className="ts" x="340" y="300" textAnchor="middle" fill="#534AB7" opacity="0.35">Creative</text>
        <text className="ts" x="450" y="300" textAnchor="middle" fill="#534AB7" opacity="0.35">Adventure</text>
        <text className="ts" x="340" y="375" textAnchor="middle" fill="#534AB7" opacity="0.25">Dry. Nothing reaching here yet.</text>
        <text className="ts" x="156" y="300" textAnchor="end" fill="#0F6E56">Creative practice →</text>
        <text className="ts" x="156" y="316" textAnchor="end" fill="#0F6E56">Mission planning →</text>
        <text className="ts" x="156" y="332" textAnchor="end" fill="#0F6E56">Learning →</text>
        <text className="ts" x="156" y="348" textAnchor="end" fill="#0F6E56">Travel →</text>
        <text className="ts" x="156" y="364" textAnchor="end" fill="#0F6E56">Building WS →</text>
        <circle cx="172" cy="334" r="3"   fill="#5DCAA5" opacity="0.15"/>
        <text className="ts" x="524" y="320" textAnchor="start" fill="#A32D2D">← Burnout</text>
        <text className="ts" x="524" y="336" textAnchor="start" fill="#A32D2D">← Loss of meaning</text>
        <text className="ts" x="524" y="352" textAnchor="start" fill="#A32D2D">← Perfectionism</text>

        {/* Top */}
        <text className="ts" x="340" y="236" textAnchor="middle" fill="#8A857D" opacity="0.25">↑ Full expression: free attention, creation, meaning</text>
      </svg>
    </div>
  )
}
