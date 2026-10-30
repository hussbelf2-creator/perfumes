import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import { CImg } from "@/creatives/components/ui";
import { isPdf, storeProjectFile } from "@/creatives/images";
import { validationText } from "@/creatives/messages";
import { FileGrid } from "@/projects/components";
import { CONTRACT_STATUS_LABELS, LIMITS, totalsByUnit, type Contract, type ContractDraft, type ContractParty, type SpecItem } from "./types";

const field =
  "w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-3 py-2.5 text-sm text-ink-900 placeholder:text-paper-400 outline-none transition-colors";
const sid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export function ContractStatusBadge({ c }: { c: Pick<Contract, "status"> }) {
  const { pick } = useI18n();
  const tone =
    c.status === "signed" ? "bg-[#E6F2EC] text-[#1F6B4F]" : c.status === "void" ? "bg-paper-100 text-paper-500 line-through" : c.status === "changes" ? "bg-[#FBEFE6] text-[#9A4B12]" : c.status === "draft" ? "bg-paper-100 text-paper-600" : "bg-[#EAF0FA] text-[#2B4C7E]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${tone}`} data-testid="contract-status">{pick(CONTRACT_STATUS_LABELS[c.status])}</span>;
}

// ─── العقد كما يُقرأ ويُطبع ────────────────────────────────────────
function Party({ label, p }: { label: string; p: ContractParty }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-paper-200 p-4 text-sm leading-[1.9]">
      <p className="text-xs text-paper-500">{label}</p>
      <p className="font-medium text-ink-900" dir="auto">{p.name || "—"}</p>
      {p.idNumber && <p className="text-paper-600" dir="auto">{p.idLabel || t("رقم الهوية/السجل", "ID / CR")}: <span dir="ltr">{p.idNumber}</span></p>}
      {p.address && <p className="text-paper-600" dir="auto">{p.address}</p>}
      {p.representative && <p className="text-paper-600" dir="auto">{t("يمثّله:", "Represented by:")} {p.representative}</p>}
    </div>
  );
}

function SignatureSlot({ label, image, name, at }: { label: string; image: string | null; name: string | null; at: string | null }) {
  const { t, date } = useI18n();
  return (
    <div className="rounded-xl border border-paper-200 p-4 min-h-[9rem] flex flex-col">
      <p className="text-xs text-paper-500">{label}</p>
      {image ? (
        <>
          <CImg src={image} alt={t(`توقيع ${name ?? ""}`, `Signature of ${name ?? ""}`)} className="h-20 mt-2 !bg-white" imgClassName="!transition-none" fit="contain" eager />
          <p className="mt-2 text-sm text-ink-900" dir="auto">{name}</p>
          {at && <p className="text-xs text-paper-500">{date(new Date(at), { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
        </>
      ) : (
        <p className="m-auto text-sm text-paper-400">{t("لم يوقّع بعد", "Not signed yet")}</p>
      )}
    </div>
  );
}

export function ContractDocument({ c, actions }: { c: Contract | (ContractDraft & Partial<Contract>); actions?: ReactNode }) {
  const { t, num, date } = useI18n();
  const totals = totalsByUnit(c.specs);
  return (
    <article className="contract-doc rounded-2xl bg-white border border-paper-200 p-5 md:p-8 text-ink-900" aria-label={c.title}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-paper-200 pb-5">
        <div className="min-w-0">
          <h2 className="font-display text-2xl md:text-3xl leading-snug" dir="auto">{c.title}</h2>
          <p className="mt-1 text-sm text-paper-500">
            {c.ref ? <span className="font-mono" dir="ltr">{c.ref}</span> : t("مسودة جديدة", "New draft")}
            {c.sentAt && <> · {t("أُرسل", "Sent")} {date(new Date(c.sentAt), { day: "numeric", month: "long", year: "numeric" })}</>}
          </p>
        </div>
        {c.status && <ContractStatusBadge c={c as Contract} />}
      </header>

      <section className="mt-5 grid sm:grid-cols-2 gap-3" aria-label={t("أطراف العقد", "Parties")}>
        <Party label={t("الطرف الأول (المصنع)", "First party (manufacturer)")} p={c.company} />
        <Party label={t("الطرف الثاني (العميل)", "Second party (client)")} p={c.client} />
      </section>

      <ol className="mt-6 space-y-5">
        {c.sections.map((s, i) => (
          <li key={i}>
            <h3 className="font-medium" dir="auto">{num(i + 1)}. {s.title}</h3>
            <p className="mt-1.5 text-sm leading-[1.9] text-paper-700 whitespace-pre-line" dir="auto">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-8 break-inside-avoid" aria-labelledby="ct-annex">
        <h3 id="ct-annex" className="font-display text-xl">{t("ملحق المواصفات والكميات", "Annex: specifications & quantities")}</h3>
        {c.specs.length ? (
          <>
            <ol className="mt-3 space-y-3" data-testid="contract-specs">
              {c.specs.map((x, i) => (
                <li key={x.id} className="rounded-xl border border-paper-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium" dir="auto">{num(i + 1)}. {x.name}</p>
                    <p className="text-sm font-mono" dir="auto">{num(x.qty, x.qty % 1 ? 2 : 0)} {x.unit}</p>
                  </div>
                  {x.description && <p className="mt-1.5 text-sm text-paper-600 whitespace-pre-line" dir="auto">{x.description}</p>}
                  {(x.images.length > 0 || x.files.length > 0) && <div className="mt-3"><FileGrid files={[...x.images, ...x.files]} title={x.name} eager /></div>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-paper-600">
              {t("إجمالي الكميات:", "Total quantities:")} {totals.map((x) => `${num(x.qty, x.qty % 1 ? 2 : 0)} ${x.unit}`).join(" · ")}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-paper-500">{t("لا أصناف في الملحق بعد.", "No items in the annex yet.")}</p>
        )}
      </section>

      <section className="mt-8 grid sm:grid-cols-2 gap-3 break-inside-avoid" aria-label={t("التوقيعات", "Signatures")}>
        <SignatureSlot label={t("توقيع الطرف الأول (المصنع)", "First party (manufacturer)")} image={c.companySignature ?? null} name={c.companySignedName ?? null} at={c.companySignedAt ?? null} />
        <SignatureSlot label={t("توقيع الطرف الثاني (العميل)", "Second party (client)")} image={c.clientSignature ?? null} name={c.clientSignedName ?? null} at={c.clientSignedAt ?? null} />
      </section>
      {c.contentHash && (
        <p className="mt-4 text-[11px] text-paper-400 leading-relaxed">
          {t("بصمة النص الموقّع (SHA-256):", "Fingerprint of the signed text (SHA-256):")} <span className="font-mono break-all" dir="ltr">{c.contentHash}</span>
          <br />
          {t("وُقّع إلكترونياً عبر المنصة؛ كل توقيع مربوط بهذه البصمة، وأي تغيير في النص يغيّرها.", "Signed electronically on the platform; each signature is bound to this fingerprint, and any change to the text changes it.")}
        </p>
      )}
      {actions && <div className="mt-6 border-t border-paper-200 pt-5 print:hidden">{actions}</div>}
    </article>
  );
}

// ─── لوحة التوقيع: رسم بالإصبع أو الفأرة، أو رفع صورة التوقيع ────────
export function SignaturePad({ onChange }: { onChange: (b: Blob | null) => void }) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [hasInk, setHasInk] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileId = useId();

  useEffect(() => {
    const c = canvas.current;
    if (!c || mode !== "draw") return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, [mode]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const done = () => {
    if (!drawing.current) return;
    drawing.current = false;
    canvas.current?.toBlob((b) => onChange(b), "image/png");
  };
  const clear = () => {
    const c = canvas.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="inline-flex rounded-full border border-paper-200 bg-white p-1 text-sm" role="group" aria-label={t("طريقة التوقيع", "Signature method")}>
        {(["draw", "upload"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHasInk(false); setPreview(null); onChange(null); }} className={`rounded-full px-3.5 py-1.5 ${mode === m ? "bg-ink-900 text-white" : "text-paper-600"}`}>
            {m === "draw" ? t("ارسم التوقيع", "Draw") : t("ارفع صورة التوقيع", "Upload image")}
          </button>
        ))}
      </div>
      {mode === "draw" ? (
        <div className="mt-3">
          <canvas
            ref={canvas}
            className="w-full h-40 rounded-xl border border-dashed border-paper-300 bg-white touch-none cursor-crosshair"
            aria-label={t("مساحة التوقيع: ارسم توقيعك هنا", "Signature area: draw your signature here")}
            data-testid="signature-canvas"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const ctx = e.currentTarget.getContext("2d")!;
              const [x, y] = point(e);
              ctx.beginPath();
              ctx.moveTo(x, y);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = e.currentTarget.getContext("2d")!;
              const [x, y] = point(e);
              ctx.lineTo(x, y);
              ctx.stroke();
              setHasInk(true);
            }}
            onPointerUp={done}
            onPointerLeave={done}
          />
          <div className="mt-1 flex justify-between text-xs text-paper-500">
            <span>{hasInk ? t("تم الرسم", "Signature drawn") : t("ارسم بإصبعك أو بالفأرة", "Draw with your finger or mouse")}</span>
            <button type="button" onClick={clear} className="underline underline-offset-4">{t("امسح", "Clear")}</button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <label htmlFor={fileId} className="block text-sm text-paper-600 mb-1.5">{t("صورة التوقيع (PNG أو JPG، خلفية فاتحة)", "Signature image (PNG or JPG, light background)")}</label>
          <input
            id={fileId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setPreview(f ? URL.createObjectURL(f) : null);
              onChange(f);
            }}
            className="block w-full text-sm"
          />
          {preview && <img src={preview} alt={t("معاينة التوقيع", "Signature preview")} className="mt-3 h-24 object-contain rounded-xl border border-paper-200 bg-white" />}
        </div>
      )}
    </div>
  );
}

/** نموذج التوقيع لطرف واحد: الاسم + الإقرار + التوقيع، ثم يرفع الصورة لمجلد المشروع ويوقّع */
export function SignBox({ c, side, defaultName, onSign }: { c: Contract; side: "client" | "company"; defaultName: string; onSign: (signature: string, name: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameId = useId();
  const submit = async () => {
    setError("");
    if (!sig) return setError(validationText("signature_file", t));
    if (name.trim().length < 2) return setError(validationText("signer_name", t));
    setBusy(true);
    try {
      const file = sig instanceof File ? sig : new File([sig], "signature.png", { type: "image/png" });
      const path = await storeProjectFile(file, c.projectId);
      await onSign(path, name.trim());
    } catch (e) {
      setError(e instanceof Error && e.message === "too_large" ? t("الصورة كبيرة جداً.", "The image is too large.") : t("تعذّر رفع التوقيع. حاول مرة أخرى.", "Couldn't upload the signature. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4" data-testid={`sign-${side}`}>
      <div>
        <label htmlFor={nameId} className="block text-sm text-paper-600 mb-1.5">{side === "client" ? t("اسمك الكامل كما في الهوية", "Your full legal name") : t("اسم الموقّع عن المنشأة", "Signatory for the company")}</label>
        <input id={nameId} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
      </div>
      <SignaturePad onChange={setSig} />
      <label className="flex items-start gap-2 text-sm text-ink-900 leading-[1.7]">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 w-4 h-4 accent-ink-900 shrink-0" />
        {side === "client"
          ? t("قرأت العقد وملحق المواصفات والكميات، وأوافق عليهما، وأقرّ بأن توقيعي الإلكتروني ملزم لي.", "I have read the contract and its specifications annex, I agree to them, and I accept that my electronic signature binds me.")
          : t("أوقّع باسم المنشأة وأملك صلاحية إلزامها بهذا العقد.", "I sign on behalf of the company and am authorised to bind it to this contract.")}
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" disabled={!agree || busy} onClick={submit} className="rounded-full bg-[#1F6B4F] text-white px-5 py-2.5 text-sm disabled:opacity-50">
        {busy ? t("جارٍ التوقيع…", "Signing…") : t("وقّع العقد", "Sign the contract")}
      </button>
    </div>
  );
}

// ─── محرر العقد (الفريق) ────────────────────────────────────────────
function PartyEditor({ label, v, set }: { label: string; v: ContractParty; set: (p: ContractParty) => void }) {
  const { t } = useI18n();
  const f = (k: keyof ContractParty, l: string, ltr = false) => (
    <label className="block">
      <span className="block text-xs text-paper-500 mb-1">{l}</span>
      <input value={v[k]} maxLength={k === "address" ? 200 : 120} dir={ltr ? "ltr" : "auto"} onChange={(e) => set({ ...v, [k]: e.target.value })} className={field} />
    </label>
  );
  return (
    <fieldset className="rounded-xl border border-paper-200 p-4 space-y-3">
      <legend className="px-1 text-sm text-ink-900">{label}</legend>
      {f("name", t("الاسم النظامي / اسم العميل", "Legal name / client name"))}
      <div className="grid grid-cols-2 gap-2">
        {f("idLabel", t("نوع المعرّف", "ID type"))}
        {f("idNumber", t("رقمه", "Number"), true)}
      </div>
      {f("address", t("العنوان", "Address"))}
      {f("representative", t("يمثّله في التوقيع", "Signatory"))}
    </fieldset>
  );
}

function SpecEditor({ x, i, projectId, set, remove, move, count }: { x: SpecItem; i: number; projectId: string; set: (s: SpecItem) => void; remove: () => void; move: (d: number) => void; count: number }) {
  const { t, num } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileId = useId();
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    setUploading(true);
    let next = x;
    try {
      for (const f of [...files]) {
        const pdf = f.type === "application/pdf";
        if (pdf ? next.files.length >= LIMITS.files : next.images.length >= LIMITS.images) continue;
        const path = await storeProjectFile(f, projectId);
        next = pdf ? { ...next, files: [...next.files, path] } : { ...next, images: [...next.images, path] };
        set(next);
      }
    } catch (e) {
      setErr(e instanceof Error && e.message === "not_image" ? t("صور أو PDF فقط.", "Images or PDF only.") : e instanceof Error && e.message === "too_large" ? t("الملف كبير جداً.", "The file is too large.") : t("تعذّر الرفع.", "Upload failed."));
    } finally {
      setUploading(false);
    }
  };
  return (
    <li className="rounded-xl border border-paper-200 bg-white p-4 space-y-3" data-testid="spec-editor">
      <div className="flex items-center gap-2">
        <span className="w-6 text-center font-mono text-xs text-paper-400">{num(i + 1)}</span>
        <input value={x.name} maxLength={LIMITS.name} onChange={(e) => set({ ...x, name: e.target.value })} className={`${field} flex-1`} placeholder={t("الصنف (مثال: زجاجة 50 مل شفافة)", "Item (e.g. 50 ml clear bottle)")} aria-label={t(`اسم الصنف ${num(i + 1)}`, `Item ${i + 1} name`)} />
        <button type="button" onClick={() => move(-1)} disabled={i === 0} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t("للأعلى", "Move up")}><i className="ri-arrow-up-s-line" aria-hidden="true"></i></button>
        <button type="button" onClick={() => move(1)} disabled={i === count - 1} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t("للأسفل", "Move down")}><i className="ri-arrow-down-s-line" aria-hidden="true"></i></button>
        <button type="button" onClick={remove} className="w-8 h-8 rounded-full hover:bg-red-50 text-red-700" aria-label={t(`احذف الصنف ${num(i + 1)}`, `Delete item ${i + 1}`)}><i className="ri-delete-bin-line" aria-hidden="true"></i></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1">{t("الكمية", "Quantity")}</span>
          <input type="number" min={0.01} step="any" value={x.qty} onChange={(e) => set({ ...x, qty: Number(e.target.value) })} className={field} aria-label={t(`كمية الصنف ${num(i + 1)}`, `Item ${i + 1} quantity`)} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1">{t("الوحدة", "Unit")}</span>
          <input value={x.unit} maxLength={LIMITS.unit} onChange={(e) => set({ ...x, unit: e.target.value })} className={field} placeholder={t("قطعة، لتر، كرتون…", "pcs, litre, carton…")} />
        </label>
        <label className="block col-span-2">
          <span className="block text-xs text-paper-500 mb-1">{t("المواصفات", "Specifications")}</span>
          <textarea value={x.description} maxLength={LIMITS.description} rows={2} onChange={(e) => set({ ...x, description: e.target.value })} className={`${field} resize-y`} placeholder={t("الخامة، اللون، المقاس، التركيز، التشطيب…", "Material, colour, size, concentration, finish…")} />
        </label>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={fileId} className={`inline-flex items-center gap-2 rounded-full border border-paper-300 px-3.5 py-1.5 text-sm cursor-pointer hover:border-ink-900 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <i className="ri-attachment-2" aria-hidden="true"></i>
            {uploading ? t("جارٍ الرفع…", "Uploading…") : t("أرفق صوراً أو ملفات PDF", "Attach images or PDFs")}
          </label>
          <input id={fileId} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          <span className="text-xs text-paper-500">{t(`${num(x.images.length)}/${num(LIMITS.images)} صور · ${num(x.files.length)}/${num(LIMITS.files)} ملفات`, `${x.images.length}/${LIMITS.images} images · ${x.files.length}/${LIMITS.files} files`)}</span>
        </div>
        {err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}
        {(x.images.length > 0 || x.files.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...x.images, ...x.files].map((f) => (
              <li key={f} className="relative w-16 h-16">
                {isPdf(f) ? <span className="w-full h-full rounded-lg border border-paper-200 bg-paper-50 flex items-center justify-center"><i className="ri-file-pdf-2-line text-xl" aria-hidden="true"></i></span> : <CImg src={f} alt="" className="w-full h-full rounded-lg" />}
                <button type="button" onClick={() => set({ ...x, images: x.images.filter((y) => y !== f), files: x.files.filter((y) => y !== f) })} className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full bg-ink-900 text-white text-xs" aria-label={t("أزل المرفق", "Remove attachment")}>
                  <i className="ri-close-line" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function ContractEditor({ v, set }: { v: ContractDraft; set: (d: ContractDraft) => void }) {
  const { t, num } = useI18n();
  const swap = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const n = [...arr];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  };
  return (
    <div className="space-y-6">
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1">{t("عنوان العقد", "Contract title")}</span>
        <input value={v.title} maxLength={LIMITS.title} onChange={(e) => set({ ...v, title: e.target.value })} className={field} />
      </label>
      <div className="grid md:grid-cols-2 gap-3">
        <PartyEditor label={t("الطرف الأول (المصنع)", "First party (manufacturer)")} v={v.company} set={(company) => set({ ...v, company })} />
        <PartyEditor label={t("الطرف الثاني (العميل)", "Second party (client)")} v={v.client} set={(client) => set({ ...v, client })} />
      </div>

      <section aria-labelledby="ce-sections">
        <h3 id="ce-sections" className="text-sm text-ink-900 mb-2">{t("البنود", "Clauses")}</h3>
        <ol className="space-y-2">
          {v.sections.map((s, i) => (
            <li key={i} className="rounded-xl border border-paper-200 bg-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-mono text-xs text-paper-400">{num(i + 1)}</span>
                <input value={s.title} maxLength={LIMITS.sectionTitle} onChange={(e) => set({ ...v, sections: v.sections.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} className={`${field} flex-1`} aria-label={t(`عنوان البند ${num(i + 1)}`, `Clause ${i + 1} title`)} />
                <button type="button" onClick={() => set({ ...v, sections: swap(v.sections, i, -1) })} disabled={i === 0} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t("للأعلى", "Move up")}><i className="ri-arrow-up-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => set({ ...v, sections: swap(v.sections, i, 1) })} disabled={i === v.sections.length - 1} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t("للأسفل", "Move down")}><i className="ri-arrow-down-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => set({ ...v, sections: v.sections.filter((_, k) => k !== i) })} className="w-8 h-8 rounded-full hover:bg-red-50 text-red-700" aria-label={t(`احذف البند ${num(i + 1)}`, `Delete clause ${i + 1}`)}><i className="ri-delete-bin-line" aria-hidden="true"></i></button>
              </div>
              <textarea value={s.body} maxLength={LIMITS.sectionBody} rows={4} onChange={(e) => set({ ...v, sections: v.sections.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)) })} className={`${field} resize-y leading-[1.8]`} aria-label={t(`نص البند ${num(i + 1)}`, `Clause ${i + 1} text`)} />
            </li>
          ))}
        </ol>
        <button type="button" disabled={v.sections.length >= LIMITS.sections} onClick={() => set({ ...v, sections: [...v.sections, { title: "", body: "" }] })} className="mt-2 inline-flex items-center gap-2 rounded-full border border-paper-300 px-4 py-2 text-sm hover:border-ink-900 disabled:opacity-40">
          <i className="ri-add-line" aria-hidden="true"></i>{t("بند جديد", "New clause")}
        </button>
      </section>

      <section aria-labelledby="ce-specs">
        <h3 id="ce-specs" className="text-sm text-ink-900">{t("ملحق المواصفات والكميات", "Annex: specifications & quantities")}</h3>
        <p className="text-xs text-paper-500 mb-2">{t("لكل صنف: الكمية والوحدة والمواصفات، وصور وملفات فنية يراها العميل قبل التوقيع.", "For each item: quantity, unit and specifications, with images and technical files the client sees before signing.")}</p>
        <ol className="space-y-2">
          {v.specs.map((x, i) => (
            <SpecEditor key={x.id} x={x} i={i} count={v.specs.length} projectId={v.projectId} set={(s) => set({ ...v, specs: v.specs.map((y) => (y.id === x.id ? s : y)) })} remove={() => set({ ...v, specs: v.specs.filter((y) => y.id !== x.id) })} move={(d) => set({ ...v, specs: swap(v.specs, i, d) })} />
          ))}
        </ol>
        <button type="button" disabled={v.specs.length >= LIMITS.specs} onClick={() => set({ ...v, specs: [...v.specs, { id: sid(), name: "", description: "", qty: 1, unit: "قطعة", images: [], files: [] }] })} className="mt-2 inline-flex items-center gap-2 rounded-full border border-paper-300 px-4 py-2 text-sm hover:border-ink-900 disabled:opacity-40">
          <i className="ri-add-line" aria-hidden="true"></i>{t("صنف جديد", "New item")}
        </button>
      </section>
    </div>
  );
}
