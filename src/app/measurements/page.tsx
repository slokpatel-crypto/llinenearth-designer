import { AppShell } from "@/components/AppShell";
import { MeasurementStudio } from "@/components/MeasurementStudio";
import "./measurements.css";
import "./scale-selector.css";

// Standalone measurement experience: blueprint guidance replaces the previous Measurements page without changing the Designer sequence.

export default function MeasurementsPage(){
  return <AppShell>
    <main className="measurementPage">
      <section className="measurementIntro wrap">
        <div className="measurementIntroCopy">
          <p className="eyebrow">LINEN EARTH · MEASUREMENT STUDIO</p>
          <h1>Measure the garment.<br/><em>See exactly where.</em></h1>
          <p>Choose a shirt or trouser measurement and the drafting model highlights the exact line to measure. The visual behaves like a tailoring blueprint: technical, dimensional and clear—without the weight of a real 3D engine.</p>
          <div className="measurementIntroSteps">
            <span><b>01</b> Choose garment</span>
            <span><b>02</b> Select measurement</span>
            <span><b>03</b> Follow the white guide</span>
            <span><b>04</b> Enter & save</span>
          </div>
        </div>
        <div className="measurementIntroBlueprint" aria-hidden="true">
          <div className="blueprintGrid" />
          <svg viewBox="0 0 520 360" preserveAspectRatio="xMidYMid meet">
            <g className="blueprintGhost">
              <path d="M132 104 L198 72 L322 72 L388 104 L422 164 L388 192 L363 151 L352 300 L168 300 L157 151 L132 192 L98 164 Z"/>
              <path d="M198 72 L210 104 L260 124 L310 104 L322 72"/>
              <path d="M260 124 V300"/>
              <path d="M157 151 L120 222 L103 294"/>
              <path d="M363 151 L400 222 L417 294"/>
              <path d="M168 300 Q260 322 352 300"/>
              <path d="M214 102 Q260 122 306 102"/>
            </g>
            <g className="blueprintDepth">
              <path d="M144 96 L210 64 L334 64 L400 96"/>
              <path d="M400 96 L434 156"/>
              <path d="M334 64 L322 72 M210 64 L198 72 M400 96 L388 104 M434 156 L422 164"/>
              <path d="M352 300 L364 292 L375 143"/>
            </g>
            <g className="blueprintMeasure">
              <ellipse cx="260" cy="95" rx="47" ry="17"/>
              <path d="M198 143 H322"/>
              <path d="M168 246 H352"/>
            </g>
            <text x="34" y="40">GARMENT DRAFT / FIT SYSTEM</text>
            <text x="366" y="333">NOT TO SCALE</text>
          </svg>
          <div className="blueprintCaption"><span>WHITE LINE = ACTIVE MEASUREMENT</span><b>TECHNICAL GARMENT VIEW</b></div>
        </div>
      </section>

      <div className="wrap">
        <MeasurementStudio />
      </div>
    </main>
  </AppShell>;
}
