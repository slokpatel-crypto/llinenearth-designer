export type LabColor={l:number;a:number;b:number};

function deg2rad(value:number){return value*Math.PI/180;}
function rad2deg(value:number){return value*180/Math.PI;}

export function deltaE2000(x:LabColor,y:LabColor) {
  const avgL=(x.l+y.l)/2;
  const c1=Math.sqrt(x.a*x.a+x.b*x.b);
  const c2=Math.sqrt(y.a*y.a+y.b*y.b);
  const avgC=(c1+c2)/2;
  const g=.5*(1-Math.sqrt((avgC**7)/(avgC**7+25**7)));
  const a1p=(1+g)*x.a;
  const a2p=(1+g)*y.a;
  const c1p=Math.sqrt(a1p*a1p+x.b*x.b);
  const c2p=Math.sqrt(a2p*a2p+y.b*y.b);
  const h1p=(rad2deg(Math.atan2(x.b,a1p))+360)%360;
  const h2p=(rad2deg(Math.atan2(y.b,a2p))+360)%360;
  const dLp=y.l-x.l;
  const dCp=c2p-c1p;
  let dhp=h2p-h1p;
  if(c1p*c2p===0) dhp=0;
  else if(dhp>180) dhp-=360;
  else if(dhp<-180) dhp+=360;
  const dHp=2*Math.sqrt(c1p*c2p)*Math.sin(deg2rad(dhp/2));
  const avgLp=(x.l+y.l)/2;
  const avgCp=(c1p+c2p)/2;
  let avgHp=h1p+h2p;
  if(c1p*c2p===0) avgHp=h1p+h2p;
  else if(Math.abs(h1p-h2p)<=180) avgHp=(h1p+h2p)/2;
  else if(h1p+h2p<360) avgHp=(h1p+h2p+360)/2;
  else avgHp=(h1p+h2p-360)/2;
  const t=1-.17*Math.cos(deg2rad(avgHp-30))+.24*Math.cos(deg2rad(2*avgHp))
    +.32*Math.cos(deg2rad(3*avgHp+6))-.20*Math.cos(deg2rad(4*avgHp-63));
  const dTheta=30*Math.exp(-(((avgHp-275)/25)**2));
  const rc=2*Math.sqrt((avgCp**7)/(avgCp**7+25**7));
  const sl=1+(.015*((avgLp-50)**2))/Math.sqrt(20+((avgLp-50)**2));
  const sc=1+.045*avgCp;
  const sh=1+.015*avgCp*t;
  const rt=-Math.sin(deg2rad(2*dTheta))*rc;
  const l=dLp/sl;
  const c=dCp/sc;
  const h=dHp/sh;
  return Math.sqrt(l*l+c*c+h*h+rt*c*h);
}

export function srgbHexToLab(hex:string):LabColor|null {
  const clean=hex.trim().replace(/^#/,"");
  if(!/^[0-9a-f]{6}$/i.test(clean)) return null;
  const rgb=[0,2,4].map((i)=>Number.parseInt(clean.slice(i,i+2),16)/255)
    .map((v)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const [r,g,b]=rgb;
  let x=(r*.4124564+g*.3575761+b*.1804375)/.95047;
  let y=(r*.2126729+g*.7151522+b*.0721750);
  let z=(r*.0193339+g*.1191920+b*.9503041)/1.08883;
  const f=(v:number)=>v>.008856?Math.cbrt(v):(7.787*v)+(16/116);
  x=f(x);y=f(y);z=f(z);
  return {l:116*y-16,a:500*(x-y),b:200*(y-z)};
}
