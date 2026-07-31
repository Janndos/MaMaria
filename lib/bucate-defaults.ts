/* Default descriptions for the standard "Bucate la comandă" catalogue, keyed by
 * the exact product name. Used to backfill existing rows (idempotently — only
 * when a product has no description yet) so the menu ships with copy out of the
 * box; the admin can still edit any of them afterwards. */
export const STABLE_DESCRIPTIONS: Record<string, string> = {
  "GĂINĂ MARINATĂ COAPTĂ LA CUPTOR":
    "O mâncare tradițională, suculentă și aromată, ideală pentru o masă festivă sau un prânz în familie.",
  "IEPURE CU LEGUME ȘI MIRODENII LA CUPTOR":
    "Un preparat rafinat și aromat, perfect pentru o cină specială și plină de savoare.",
  "BĂTUTE DE PORC SAU PUI":
    "Suculente și aromate, perfecte pentru o experiență culinară îmbelșugată și savuroasă.",
  "PÂRJOALE DE CASĂ DIN CARNE DE PORC ȘI VITĂ":
    "Suculente și pline de gust, ideale pentru o masă tradițională și sățioasă.",
  "MICI COPȚI DIN AMESTEC DE VITĂ ȘI PORC":
    "Suculenți și aromatizați, perfecți pentru un grătar tradițional și savuros.",
  "CÂRNĂCIORI DIN AMESTEC DE VITĂ ȘI PORC":
    "Suculenți și plini de aromă, ideali pentru o zi de grătar în aer liber.",
  "LEBERKASE":
    "Denumit și cozonac german din carne tocată, are la bază rețetele de plăcinte de carne din Austria și unele regiuni din Elveția.",
  "PIEPT DE PUI LA CUPTOR CU CAȘCAVAL DORBLUE":
    "Gata copt, cu o crustă aurie de pesmet și cașcaval Dorblue fin.",
  "BABA NEAGRĂ":
    "Un desert opulent și aromat, cu o textură bogată și umedă, îmbibată în sirop aromat, adesea cu nuanțe de rom sau cacao, pentru o indulgență decadentă.",
};
