export type FutureGarmentOption={
  id:string;
  group:
    |"blazer.type"|"blazer.lapel"|"blazer.vent"|"blazer.pocket"|"blazer.shoulder"
    |"suit.type"|"suit.waistcoat"|"suit.jacket"|"suit.trouser";
  label:string;
  status:"planned";
  note:string;
};

export const FUTURE_GARMENT_OPTION_LIBRARY:readonly FutureGarmentOption[]=[
  {id:"blazer_single_breasted_2b",group:"blazer.type",label:"Single-Breasted 2-Button",status:"planned",note:"Core tailored blazer direction."},
  {id:"blazer_double_breasted_6x2",group:"blazer.type",label:"Double-Breasted 6×2",status:"planned",note:"Broader formal silhouette."},
  {id:"blazer_unstructured",group:"blazer.type",label:"Unstructured Blazer",status:"planned",note:"Softer linen-led construction."},
  {id:"blazer_notch_lapel",group:"blazer.lapel",label:"Notch Lapel",status:"planned",note:"Balanced everyday tailoring."},
  {id:"blazer_peak_lapel",group:"blazer.lapel",label:"Peak Lapel",status:"planned",note:"Sharper formal direction."},
  {id:"blazer_double_vent",group:"blazer.vent",label:"Double Vent",status:"planned",note:"Tailored rear movement."},
  {id:"blazer_single_vent",group:"blazer.vent",label:"Single Vent",status:"planned",note:"Simple rear construction."},
  {id:"blazer_patch_pocket",group:"blazer.pocket",label:"Patch Pocket",status:"planned",note:"Relaxed linen blazer language."},
  {id:"blazer_flap_pocket",group:"blazer.pocket",label:"Flap Pocket",status:"planned",note:"Classic tailored pocket."},
  {id:"blazer_natural_shoulder",group:"blazer.shoulder",label:"Natural Shoulder",status:"planned",note:"Soft shoulder expression."},
  {id:"blazer_structured_shoulder",group:"blazer.shoulder",label:"Structured Shoulder",status:"planned",note:"Sharper formal line."},

  {id:"suit_two_piece",group:"suit.type",label:"2-Piece Suit",status:"planned",note:"Jacket + matching trouser."},
  {id:"suit_three_piece",group:"suit.type",label:"3-Piece Suit",status:"planned",note:"Jacket + waistcoat + matching trouser."},
  {id:"suit_double_breasted",group:"suit.type",label:"Double-Breasted Suit",status:"planned",note:"Coordinated DB jacket + trouser."},
  {id:"suit_evening",group:"suit.type",label:"Evening Suit",status:"planned",note:"Higher-formality coordinated system."},
  {id:"waistcoat_single_breasted",group:"suit.waistcoat",label:"Single-Breasted Waistcoat",status:"planned",note:"Future 3-piece layer."},
  {id:"suit_jacket_single_breasted",group:"suit.jacket",label:"Single-Breasted Jacket",status:"planned",note:"Core suit jacket block."},
  {id:"suit_jacket_double_breasted",group:"suit.jacket",label:"Double-Breasted Jacket",status:"planned",note:"Alternative suit jacket block."},
  {id:"suit_trouser_flat_front",group:"suit.trouser",label:"Flat-Front Trouser",status:"planned",note:"Clean coordinated trouser."},
  {id:"suit_trouser_pleated",group:"suit.trouser",label:"Pleated Trouser",status:"planned",note:"Tailored coordinated trouser."},
];

export function futureGarmentOptionsFor(group:FutureGarmentOption["group"]) {
  return FUTURE_GARMENT_OPTION_LIBRARY.filter((option)=>option.group===group);
}
