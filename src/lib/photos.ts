// صور فوتوغرافية واقعية تُولَّد عند الطلب (نفس خدمة الصور المستخدمة في الموقع الأصلي).
// كل صورة لها seq ثابت، فتبقى نفسها في كل زيارة. استبدلها بصورك الحقيقية متى توفرت.
const STYLE = "editorial product photography, natural window daylight, muted warm neutral tones, shallow depth of field, realistic, high detail";

export function aiPhoto(subject: string, seq: string, width = 1200, height = 1500) {
  const orientation = width > height ? "landscape" : width < height ? "portrait" : "squarish";
  const query = encodeURIComponent(`${subject}, ${STYLE}`);
  return `https://readdy.ai/api/search-image?query=${query}&width=${width}&height=${height}&seq=${seq}&orientation=${orientation}`;
}

export const PHOTOS = {
  hero: aiPhoto("clear glass niche perfume bottle with minimal white typewriter label standing on raw travertine stone block, soft long shadow, bone white background", "niche-v3-hero", 1000, 1250),
  heroDetail: aiPhoto("close up of perfume atomizer misting in soft backlight, fine droplets visible, beige background", "niche-v3-mist", 600, 600),
  lab: aiPhoto("perfumer hands holding glass pipette above small amber vials in a bright minimal perfume laboratory, white bench", "niche-v3-lab", 1200, 900),
  brief: aiPhoto("handwritten fragrance brief notebook with pencil, dried flowers and paper smelling strips on linen table", "niche-v3-brief", 900, 1100),
  samples: aiPhoto("row of numbered glass sample vials with kraft tags on white marble, perfume development", "niche-v3-samples", 900, 1100),
  packaging: aiPhoto("minimal perfume box prototype and label proofs with pantone swatches on designer desk", "niche-v3-pack", 900, 1100),
  production: aiPhoto("perfume bottles on filling line in clean small batch factory, stainless steel, soft light", "niche-v3-prod", 900, 1100),
  shelf: aiPhoto("three minimalist perfume bottles on light oak shelf in a quiet concept store, linen backdrop", "niche-v3-shelf", 1600, 900),
  atlas: aiPhoto("amber glass perfume bottle with plain kraft paper label on raw travertine stone, cedar wood chips", "niche-v3-atlas", 800, 1000),
  thamar: aiPhoto("frosted glass niche perfume bottle beside a single fresh fig on linen cloth", "niche-v3-thamar", 800, 1000),
  sahm: aiPhoto("matte black square perfume bottle and white box with debossed typography on off white paper", "niche-v3-sahm", 800, 1000),
  identity: aiPhoto("perfume brand identity guidelines book open with logo, typography and color swatches on light desk", "niche-v3-identity", 900, 1100),
  print: aiPhoto("close up of gold foil hot stamping on luxury white perfume box in print workshop", "niche-v3-print", 900, 1100),
  consult: aiPhoto("two people discussing perfume brand moodboard with fragrance samples on a bright studio table", "niche-v3-consult", 1200, 800),
  noor: aiPhoto("slim clear glass perfume bottle with white floral petals and morning light on pale stone", "niche-v3-noor", 800, 1000),
  qahwa: aiPhoto("dark brown glass perfume bottle beside roasted coffee beans and cardamom on linen", "niche-v3-qahwa", 800, 1000),
  bahr: aiPhoto("pale blue frosted perfume bottle with sea salt crystals and driftwood on white sand", "niche-v3-bahr", 800, 1000),
  // صور لوحة التحكم — مخرجات المشروع
  deliverableVials: aiPhoto("four numbered perfume sample vials labeled R1 R2 R3 R4 on white tray, studio light", "niche-v3-d-vials", 800, 600),
  deliverableLabel: aiPhoto("minimal perfume label design proof printed on textured cotton paper, typography Atlas", "niche-v3-d-label", 800, 600),
  deliverableBox: aiPhoto("white perfume box prototype with debossed logo, partially open, on stone surface", "niche-v3-d-box", 800, 600),
  deliverableBottle: aiPhoto("amber glass perfume bottle prototype with matte black cap, front view, seamless beige background", "niche-v3-d-bottle", 800, 600),
};
