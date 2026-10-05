export type FutureGarmentOption={
  id:string;
  group:
    |"blazer.type"|"blazer.lapel"|"blazer.vent"|"blazer.pocket"|"blazer.shoulder"|"blazer.button_stance"|"blazer.length"
    |"suit.type"|"suit.waistcoat"|"suit.jacket"|"suit.trouser"|"suit.lapel"|"suit.vent"|"suit.button_stance";
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
  {id:"blazer_button_stance_two",group:"blazer.button_stance",label:"2-Button Standard Stance",status:"planned",note:"Balanced single-breasted button position."},
  {id:"blazer_button_stance_one",group:"blazer.button_stance",label:"1-Button Low Stance",status:"planned",note:"Cleaner modern front with a lower closure point."},
  {id:"blazer_length_classic",group:"blazer.length",label:"Classic Blazer Length",status:"planned",note:"Traditional seat-covering tailored length."},
  {id:"blazer_length_short",group:"blazer.length",label:"Short Contemporary Length",status:"planned",note:"Shorter proportion for a modern linen-led silhouette."},
  {id:"blazer_length_long",group:"blazer.length",label:"Long Blazer Length",status:"planned",note:"Extended tailored proportion."},

  {id:"suit_two_piece",group:"suit.type",label:"2-Piece Suit",status:"planned",note:"Jacket + matching trouser."},
  {id:"suit_three_piece",group:"suit.type",label:"3-Piece Suit",status:"planned",note:"Jacket + waistcoat + matching trouser."},
  {id:"suit_double_breasted",group:"suit.type",label:"Double-Breasted Suit",status:"planned",note:"Coordinated DB jacket + trouser."},
  {id:"suit_evening",group:"suit.type",label:"Evening Suit",status:"planned",note:"Higher-formality coordinated system."},
  {id:"waistcoat_single_breasted",group:"suit.waistcoat",label:"Single-Breasted Waistcoat",status:"planned",note:"Future 3-piece layer."},
  {id:"suit_jacket_single_breasted",group:"suit.jacket",label:"Single-Breasted Jacket",status:"planned",note:"Core suit jacket block."},
  {id:"suit_jacket_double_breasted",group:"suit.jacket",label:"Double-Breasted Jacket",status:"planned",note:"Alternative suit jacket block."},
  {id:"suit_trouser_flat_front",group:"suit.trouser",label:"Flat-Front Trouser",status:"planned",note:"Clean coordinated trouser."},
  {id:"suit_trouser_pleated",group:"suit.trouser",label:"Pleated Trouser",status:"planned",note:"Tailored coordinated trouser."},
  {id:"suit_lapel_notch",group:"suit.lapel",label:"Notch Lapel",status:"planned",note:"Core business suit lapel."},
  {id:"suit_lapel_peak",group:"suit.lapel",label:"Peak Lapel",status:"planned",note:"Sharper formal or double-breasted direction."},
  {id:"suit_lapel_shawl",group:"suit.lapel",label:"Shawl Lapel",status:"planned",note:"Evening and occasion tailoring direction."},
  {id:"suit_vent_double",group:"suit.vent",label:"Double Vent",status:"planned",note:"Balanced tailored rear movement."},
  {id:"suit_vent_single",group:"suit.vent",label:"Single Vent",status:"planned",note:"Simpler classic rear construction."},
  {id:"suit_vent_none",group:"suit.vent",label:"Ventless",status:"planned",note:"Clean formal rear line."},
  {id:"suit_button_stance_two",group:"suit.button_stance",label:"2-Button Standard Stance",status:"planned",note:"Core single-breasted suit closure."},
  {id:"suit_button_stance_one",group:"suit.button_stance",label:"1-Button Evening Stance",status:"planned",note:"Lower single-button formal closure."},
  {id:"suit_button_stance_db_6x2",group:"suit.button_stance",label:"Double-Breasted 6×2 Stance",status:"planned",note:"Classic double-breasted closure geometry."},
];

export function futureGarmentOptionsFor(group:FutureGarmentOption["group"]) {
  return FUTURE_GARMENT_OPTION_LIBRARY.filter((option)=>option.group===group);
}
