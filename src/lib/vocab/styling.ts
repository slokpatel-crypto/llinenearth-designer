import type { VocabId } from "./types.ts";

export const garmentUses=[
  {id:"shirt",label:"Shirt",aliases:["dress shirt","business shirt","casual shirt","resort shirt"]},
  {id:"overshirt",label:"Overshirt",aliases:["shirt jacket"]},
  {id:"trouser",label:"Trouser",aliases:["trousers","pant","pants","formal trouser","casual trouser"]},
  {id:"chino",label:"Chino",aliases:["chinos"]},
  {id:"jeans",label:"Jeans",aliases:["denim trouser"]},
  {id:"suit",label:"Suit",aliases:["summer suit","tailored suit","matching suit"]},
  {id:"blazer",label:"Blazer",aliases:["sport coat","sports jacket","sport jacket"]},
  {id:"jacket",label:"Jacket",aliases:["casual jacket","technical outerwear"]},
  {id:"dinner_jacket",label:"Dinner jacket",aliases:["tuxedo jacket"]},
  {id:"waistcoat",label:"Waistcoat",aliases:["vest"]},
  {id:"overcoat",label:"Overcoat",aliases:["coat"]},
  {id:"knitwear",label:"Knitwear",aliases:["knit"]},
  {id:"polo",label:"Polo",aliases:["polo shirt"]},
  {id:"t_shirt",label:"T-shirt",aliases:["tee","t shirt"]},
  {id:"tie",label:"Tie",aliases:["necktie"]},
  {id:"pocket_square",label:"Pocket square",aliases:["handkerchief"]},
] as const;
export type GarmentUseId=VocabId<typeof garmentUses>;

export const occasions=[
  {id:"boardroom_business_formal",label:"Boardroom / business formal",aliases:["boardroom","business formal","formal business"]},
  {id:"office_business",label:"Office / business",aliases:["office","business","work"]},
  {id:"interview",label:"Interview",aliases:["job interview"]},
  {id:"wedding",label:"Wedding",aliases:["day wedding","formal wedding"]},
  {id:"reception",label:"Reception",aliases:["wedding reception"]},
  {id:"festive",label:"Festive",aliases:["festival","festive event"]},
  {id:"cocktail_evening",label:"Cocktail / evening",aliases:["cocktail","evening","formal evening"]},
  {id:"smart_casual_dinner",label:"Smart-casual dinner",aliases:["smart casual","dinner"]},
  {id:"date",label:"Date",aliases:["date night"]},
  {id:"brunch",label:"Brunch",aliases:["day brunch"]},
  {id:"resort_holiday",label:"Resort / holiday",aliases:["resort","holiday","beach"]},
  {id:"travel",label:"Travel",aliases:["travelling","airport"]},
  {id:"weekend_casual",label:"Weekend casual",aliases:["weekend","casual","relaxed"]},
  {id:"summer_event",label:"Summer event",aliases:["summer","summer wedding"]},
  {id:"black_tie_evening",label:"Black tie / evening formal",aliases:["black tie","gala","evening formal"]},
] as const;
export type OccasionId=VocabId<typeof occasions>;

export const climateTags=[
  {id:"hot_humid",label:"Hot / humid",aliases:["hot","humid","summer","warm humid"]},
  {id:"hot_dry",label:"Hot / dry",aliases:["hot dry","dry heat"]},
  {id:"warm",label:"Warm",aliases:["warm weather"]},
  {id:"mild",label:"Mild",aliases:["temperate"]},
  {id:"cool",label:"Cool",aliases:["cold","winter"]},
  {id:"air_conditioned",label:"Air-conditioned",aliases:["indoor","air conditioned","air-conditioned"]},
  {id:"all_season",label:"All season",aliases:["all-season","all season"]},
] as const;
export type ClimateTagId=VocabId<typeof climateTags>;
