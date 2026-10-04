/** Original brand artwork: abstract threads, never a fabric or scale preview. */
const THREAD_COLOURS = ["#b99460", "#678073", "#58738b", "#b7aa95"];

export function BrandThreadwork() {
  return <svg className="brandThreadwork" viewBox="0 0 1200 300" fill="none" aria-hidden="true" focusable="false">
    {Array.from({ length: 18 }, (_, index) => {
      const shift = (index - 8.5) * 5;
      return <path key={index} data-brand-thread pathLength="100" stroke={THREAD_COLOURS[index % THREAD_COLOURS.length]} strokeWidth={index % 5 === 0 ? 1.4 : .7}
        d={`M -40 ${170 + shift} C 200 ${170 + shift}, 250 ${28 + shift}, 420 ${70 + shift} S 600 ${230 - shift}, 780 ${194 - shift} S 980 ${40 + shift}, 1240 ${96 + shift}`} />;
    })}
    {Array.from({ length: 8 }, (_, index) => {
      const shift = index * 8;
      return <path key={`cross-${index}`} data-brand-thread pathLength="100" stroke="#b99460" strokeWidth=".65"
        d={`M ${370 + shift} -20 C ${300 + shift} 100, ${630 - shift} 165, ${730 + shift} 320`} />;
    })}
  </svg>;
}
