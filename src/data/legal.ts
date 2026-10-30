// النصوص القانونية الافتراضية (الخصوصية، الشروط، الاسترجاع). تُعدَّل من لوحة الإدارة ← محتوى الموقع ← الصفحات القانونية.
// صياغة مبدئية متوافقة مع نظام حماية البيانات الشخصية ونظام التجارة الإلكترونية السعوديين ومتطلبات بوابة الدفع —
// يجب أن يراجعها مستشار قانوني قبل الإطلاق.
//
// صيغة النص: فقرات تفصلها سطر فارغ، والسطر الذي يبدأ بـ«- » بند في قائمة.
// المتغيرات تُملأ من «التواصل والحسابات» وقت العرض: {legalName} {cr} {vat} {email} {phone} {address} {kitCreditDays}

import type { Bi } from "@/i18n/context";

export const LEGAL_KINDS = ["privacy", "terms", "refund"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export interface LegalSection {
  id: string;
  title: Bi;
  body: Bi;
}

export interface LegalPageDoc {
  title: Bi;
  intro: Bi;
  sections: LegalSection[];
}

export const LEGAL_PATHS: Record<LegalKind, string> = { privacy: "/privacy", terms: "/terms", refund: "/refund" };

export const LEGAL_VARS = ["legalName", "cr", "vat", "email", "phone", "address", "kitCreditDays"] as const;

const s = (id: string, ar: string, en: string, bodyAr: string, bodyEn: string): LegalSection => ({ id, title: { ar, en }, body: { ar: bodyAr.trim(), en: bodyEn.trim() } });

export const DEFAULT_LEGAL: Record<LegalKind, LegalPageDoc> = {
  privacy: {
    title: { ar: "سياسة الخصوصية", en: "Privacy policy" },
    intro: {
      ar: "توضح هذه السياسة كيف تجمع {legalName} بياناتك الشخصية وتستخدمها وتحميها عند استخدامك المنصة، وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية ولوائحه.",
      en: "This policy explains how {legalName} collects, uses and protects your personal data when you use the platform, in line with Saudi Arabia's Personal Data Protection Law (PDPL) and its regulations.",
    },
    sections: [
      s("controller", "جهة التحكم", "Data controller", `
جهة التحكم في بياناتك هي {legalName}، سجل تجاري رقم {cr}، وعنوانها {address}. للتواصل في كل ما يخص بياناتك: {email}.
`, `
The controller of your data is {legalName}, commercial registration {cr}, located at {address}. For anything about your data, contact {email}.
`),
      s("collect", "البيانات التي نجمعها", "Data we collect", `
نجمع ما تقدّمه بنفسك وما يلزم لتقديم الخدمة فقط:
- بيانات التواصل: الاسم، البريد الإلكتروني، رقم الجوال، اسم الشركة أو البراند.
- بيانات المشروع: إجابات «ابدأ مسارك»، الملفات والصور التي ترفعها، الملاحظات والاعتمادات.
- بيانات الطلب والدفع: عنوان الشحن، مبالغ العروض والمدفوعات ومراجعها. لا نخزّن بيانات بطاقتك: تُدخلها مباشرة في صفحة بوابة الدفع.
- بيانات تقنية: عنوان IP ونوع المتصفح وسجلات الأمان، لحماية المنصة من إساءة الاستخدام.
`, `
We collect only what you provide and what we need to deliver the service:
- Contact data: name, email, mobile number, company or brand name.
- Project data: your “Start your track” answers, files and images you upload, comments and approvals.
- Order and payment data: shipping address, quote and payment amounts and references. We never store your card details: you enter them directly on the payment gateway's form.
- Technical data: IP address, browser type and security logs, to protect the platform from abuse.
`),
      s("purpose", "لماذا نستخدمها", "Why we use it", `
- تنفيذ طلبك: إعداد العروض، إدارة المشروع، التصنيع والشحن (أساس نظامي: تنفيذ العقد).
- التواصل معك بشأن مشروعك عبر البريد أو واتساب أو الهاتف (تنفيذ العقد).
- الفوترة والالتزامات الضريبية والمحاسبية (التزام نظامي).
- حماية المنصة ومنع الاحتيال والرسائل المزعجة (مصلحة مشروعة).
- الرسائل التسويقية والنشرة البريدية فقط بموافقتك، ويمكنك إلغاؤها في أي وقت.
`, `
- Fulfilling your order: preparing quotes, managing the project, production and shipping (legal basis: performance of a contract).
- Contacting you about your project by email, WhatsApp or phone (performance of a contract).
- Invoicing and tax and accounting obligations (legal obligation).
- Protecting the platform and preventing fraud and spam (legitimate interest).
- Marketing messages and the newsletter only with your consent, which you can withdraw at any time.
`),
      s("share", "مع من نشاركها", "Who we share it with", `
لا نبيع بياناتك. نشاركها بالقدر اللازم فقط مع مزوّدين يعملون بالنيابة عنا وبالتزامات حماية مكافئة:
- بوابة الدفع (ميسّر) لمعالجة المدفوعات.
- مزوّد الاستضافة وقاعدة البيانات لتخزين الحساب والمشروع.
- مزوّدو الرسائل (البريد الإلكتروني وواتساب للأعمال) لإرسال إشعارات مشروعك.
- شركاء التصنيع والطباعة والشحن، بما يلزم لتنفيذ طلبك فقط.
- الجهات الحكومية عند طلب نظامي.
`, `
We don't sell your data. We share only what's necessary with providers acting on our behalf under equivalent protection obligations:
- The payment gateway (Moyasar) to process payments.
- Our hosting and database provider to store your account and project.
- Messaging providers (email and WhatsApp Business) to send your project notifications.
- Manufacturing, printing and shipping partners, only as needed to fulfil your order.
- Government authorities when legally required.
`),
      s("transfer", "النقل خارج المملكة", "Transfers outside the Kingdom", `
قد تُستضاف بعض الخدمات التقنية (الاستضافة، البريد) خارج المملكة. لا ننقل البيانات إلا وفق الضوابط النظامية للنقل خارج المملكة وبالحد الأدنى اللازم وبضمانات حماية مناسبة.
`, `
Some technical services (hosting, email) may be located outside the Kingdom. We transfer data only under the regulatory controls for cross-border transfer, limited to what's necessary and with appropriate safeguards.
`),
      s("retention", "مدة الاحتفاظ", "Retention", `
نحتفظ ببيانات حسابك ومشاريعك طالما الحساب نشط، وبسجلات الفوترة المدة التي تفرضها الأنظمة الضريبية. الطلبات التي لم تتحول إلى مشروع تُحذف أو تُجهّل بعد 24 شهراً. بعد انتهاء الغرض نتلف البيانات أو نجهّلها بطريقة آمنة.
`, `
We keep your account and project data while your account is active, and billing records for as long as tax regulations require. Requests that never became a project are deleted or anonymised after 24 months. Once the purpose ends, we securely destroy or anonymise the data.
`),
      s("rights", "حقوقك", "Your rights", `
لك بموجب النظام:
- أن تُبلَّغ بكيفية جمع بياناتك واستخدامها (هذه السياسة).
- الوصول إلى بياناتك والحصول على نسخة منها بصيغة مقروءة.
- تصحيح بياناتك أو استكمالها أو تحديثها.
- طلب إتلاف بياناتك متى انتهت الحاجة إليها، ما لم يلزمنا نظام بالاحتفاظ بها.
- سحب موافقتك على المعالجة القائمة على الموافقة في أي وقت.

راسلنا على {email} وسنرد خلال 30 يوماً. ولك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).
`, `
Under the law you have the right to:
- Be informed about how your data is collected and used (this policy).
- Access your data and obtain a copy in a readable format.
- Correct, complete or update your data.
- Request destruction of your data once it is no longer needed, unless the law requires us to keep it.
- Withdraw consent for consent-based processing at any time.

Email us at {email} and we will respond within 30 days. You may also file a complaint with the Saudi Data & AI Authority (SDAIA).
`),
      s("security", "أمن البيانات", "Security", `
نحمي بياناتك بالتشفير أثناء النقل، وصلاحيات وصول لكل دور في الفريق، وسجل تدقيق للعمليات الحساسة، وملفات خاصة لا تُفتح إلا بروابط مؤقتة. وإن وقع تسرب يمس بياناتك نُبلغ الجهة المختصة ونُبلغك وفق المدد النظامية.
`, `
We protect your data with encryption in transit, role-based access for our team, an audit log for sensitive operations, and private files only reachable through temporary links. If a breach affects your data, we notify the competent authority and you within the statutory timelines.
`),
      s("storage", "التخزين في المتصفح", "Browser storage", `
نستخدم تخزين المتصفح لحفظ تسجيل دخولك واللغة ومسودات النماذج قبل إرسالها. لا نستخدم ملفات تتبّع إعلانية دون موافقتك.
`, `
We use browser storage to keep you signed in and remember your language and unsent form drafts. We don't use advertising trackers without your consent.
`),
      s("changes", "تحديث السياسة", "Changes", `
قد نحدّث هذه السياسة، وسنبين تاريخ آخر تحديث أعلى الصفحة ونُبلغك بالتغييرات الجوهرية عبر البريد أو حسابك.
`, `
We may update this policy. The date of the latest update is shown at the top, and we'll tell you about material changes by email or in your account.
`),
    ],
  },

  terms: {
    title: { ar: "الشروط والأحكام", en: "Terms & conditions" },
    intro: {
      ar: "تحكم هذه الشروط استخدامك منصة {legalName} وطلب خدماتها. باستخدامك المنصة أو اعتمادك عرض سعر أو دفعك العربون فأنت توافق عليها.",
      en: "These terms govern your use of the {legalName} platform and its services. By using the platform, approving a quote or paying a deposit, you agree to them.",
    },
    sections: [
      s("who", "مقدّم الخدمة", "Provider", `
{legalName}، سجل تجاري رقم {cr}، الرقم الضريبي {vat}، العنوان: {address}. التواصل: {email} — {phone}.
`, `
{legalName}, commercial registration {cr}, VAT number {vat}, address: {address}. Contact: {email} — {phone}.
`),
      s("service", "الخدمة", "The service", `
نقدّم خدمات بناء البراندات العطرية: تطوير التركيبات، الهوية البصرية، تصميم العبوات، التصنيع والطباعة، وفق المسار الذي تختاره. نطاق كل مشروع ومخرجاته ومدته وسعره يحددها عرض السعر المعتمد، ولا يُلزمنا ما يرد في الموقع من أمثلة أو تقديرات.
`, `
We provide fragrance brand-building services: formula development, visual identity, packaging design, manufacturing and printing, according to the track you choose. Each project's scope, deliverables, timeline and price are set by the approved quote; examples and estimates on the site are not binding.
`),
      s("account", "الحساب", "Your account", `
- تلتزم بصحة البيانات التي تقدّمها وتحديثها.
- أنت مسؤول عن سرية كلمة المرور وعن كل ما يتم عبر حسابك.
- يجب أن يكون عمرك 18 سنة أو أكثر، أو أن تمثل منشأة نظامية.
`, `
- You must provide accurate data and keep it up to date.
- You're responsible for keeping your password secret and for all activity under your account.
- You must be 18 or older, or represent a registered business.
`),
      s("quotes", "العروض والدفع", "Quotes and payment", `
- عرض السعر صالح حتى التاريخ المذكور فيه، والأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة 15٪ كما يوضح العرض.
- يبدأ العمل بعد اعتماد العرض ودفع العربون المحدد فيه، ويُستحق الباقي وفق جدول الدفعات في العرض قبل التسليم أو الشحن.
- تتم المدفوعات الإلكترونية عبر بوابة دفع مرخّصة، أو بالتحويل البنكي إلى حساب المنشأة الموضح في العرض.
- أي تعديل جوهري في النطاق بعد الاعتماد يصدر له عرض محدّث.
`, `
- A quote is valid until the date it states. Prices are in Saudi riyals and include 15% VAT as shown in the quote.
- Work starts after you approve the quote and pay its deposit; the balance is due per the quote's payment schedule before delivery or shipping.
- Online payments go through a licensed payment gateway, or by bank transfer to the business account shown in the quote.
- Any material change of scope after approval is issued as an updated quote.
`),
      s("approvals", "الاعتمادات والمدد", "Approvals and timelines", `
تمر المشاريع بمراحل يعتمد فيها العميل كل مخرج من حسابه. المدد المذكورة تقديرية وتبدأ من دفع العربون واكتمال المدخلات، وتتوقف أثناء انتظار ملاحظاتك أو اعتمادك. جولات التعديل المشمولة يحددها العرض، وما زاد عنها يُسعّر منفصلاً. اعتمادك لمرحلة يعني موافقتك على الانتقال للمرحلة التالية على أساسها.
`, `
Projects move through stages where you approve each deliverable from your account. Stated timelines are estimates, start once the deposit is paid and inputs are complete, and pause while we await your feedback or approval. Included revision rounds are set by the quote; extra rounds are priced separately. Approving a stage means you agree to proceed to the next stage on that basis.
`),
      s("ip", "الملكية الفكرية", "Intellectual property", `
- تنتقل إليك ملكية المخرجات النهائية المعتمدة (التركيبة المعتمدة لبراندك، الهوية، تصاميم العبوة) بعد سداد كامل قيمة المشروع.
- المسودات والبدائل غير المعتمدة والأدوات والقوالب العامة تبقى ملكاً لنا.
- تضمن أن ما تقدّمه من أسماء وشعارات ومواد لا يتعدى على حقوق الغير، وأنت مسؤول عن تسجيل علامتك التجارية.
- يحق لنا عرض أعمال مشروعك في معرض أعمالنا بعد الإطلاق ما لم تطلب خلاف ذلك كتابياً.
`, `
- Ownership of the final approved deliverables (your brand's approved formula, identity and packaging designs) transfers to you once the project is paid in full.
- Drafts, unapproved alternatives, and general tools and templates remain ours.
- You warrant that names, logos and materials you provide don't infringe third-party rights, and you're responsible for registering your trademark.
- We may show your project in our portfolio after launch unless you ask otherwise in writing.
`),
      s("compliance", "المطابقة والاستخدام", "Compliance and use", `
نصنّع وفق المواصفات المعتمدة ومتطلبات الجهات المختصة. أنت مسؤول عن الادعاءات التسويقية على منتجك وعن تسجيله لدى الجهات المختصة عند البيع، ونساعدك بالوثائق الفنية المتاحة لدينا.
`, `
We manufacture to the approved specifications and the relevant regulatory requirements. You're responsible for the marketing claims on your product and for registering it with the relevant authorities when selling, and we support you with the technical documents we hold.
`),
      s("liability", "حدود المسؤولية", "Limitation of liability", `
لا تتجاوز مسؤوليتنا في أي مشروع المبالغ التي دفعتها عنه، ولا نتحمل الأضرار غير المباشرة أو الأرباح الفائتة، وذلك في الحدود التي يسمح بها النظام. لا نتحمل التأخير الناتج عن ظروف خارجة عن إرادتنا أو عن تأخر مدخلاتك.
`, `
Our liability for any project doesn't exceed the amounts you paid for it, and we aren't liable for indirect damages or lost profits, to the extent permitted by law. We aren't responsible for delays caused by circumstances beyond our control or by late inputs from you.
`),
      s("law", "النظام والنزاعات", "Governing law", `
تخضع هذه الشروط لأنظمة المملكة العربية السعودية. نسعى لحل أي خلاف ودياً خلال 30 يوماً، وإلا فالاختصاص للجهات القضائية المختصة في المملكة. النص العربي هو المعتمد عند الاختلاف.
`, `
These terms are governed by the laws of the Kingdom of Saudi Arabia. We aim to settle any dispute amicably within 30 days; otherwise the competent courts in the Kingdom have jurisdiction. The Arabic text prevails in case of any discrepancy.
`),
    ],
  },

  refund: {
    title: { ar: "سياسة الإلغاء والاسترجاع", en: "Cancellation & refund policy" },
    intro: {
      ar: "نوضح هنا متى يحق لك الإلغاء واسترداد ما دفعته، وكيف ومتى يصلك المبلغ، وفق نظام التجارة الإلكترونية في المملكة.",
      en: "This page explains when you can cancel and get your money back, and how and when you receive it, in line with the Saudi E-Commerce Law.",
    },
    sections: [
      s("kit", "عينة الاكتشاف", "Discovery kit", `
- يحق لك إلغاء الطلب قبل الشحن واسترداد المبلغ كاملاً.
- لأسباب صحية لا تُسترجع العينات بعد فتح عبواتها، ويحق لك إرجاع الطلب غير المفتوح خلال 7 أيام من استلامه.
- إن وصلت العينة تالفة أو مختلفة عن الطلب فأبلغنا خلال 3 أيام من الاستلام مع صورة، ونستبدلها أو نرد المبلغ كاملاً شاملاً الشحن.
- قيمة العينة تُخصم من أول مشروع تبدؤه معنا خلال {kitCreditDays} يوماً من الشراء.
`, `
- You can cancel before shipping for a full refund.
- For hygiene reasons, samples can't be returned once opened; unopened orders can be returned within 7 days of delivery.
- If the kit arrives damaged or different from your order, tell us within 3 days of delivery with a photo and we'll replace it or refund in full, including shipping.
- The kit price is credited to the first project you start with us within {kitCreditDays} days of purchase.
`),
      s("deposit", "عربون المشاريع", "Project deposits", `
- قبل بدء العمل: إن ألغيت قبل أن نبدأ العمل أو نسلّم أي مخرج، نرد العربون كاملاً.
- بعد بدء العمل: نرد العربون بعد خصم قيمة ما أُنجز فعلاً حتى تاريخ الإلغاء، ونسلّمك ما أُنجز.
- بعد اعتماد الإنتاج: المنتجات والمواد المطبوعة أو المصنّعة خصيصاً لبراندك لا تُسترجع لأنها صُنعت بمواصفاتك، إلا إن كان بها عيب تصنيع.
`, `
- Before work starts: if you cancel before we start work or deliver anything, we refund the deposit in full.
- After work starts: we refund the deposit minus the value of work actually completed up to cancellation, and hand over that work.
- After production approval: products and printed or manufactured items made specifically for your brand can't be returned because they were made to your specifications, unless they have a manufacturing defect.
`),
      s("defects", "العيوب والمطابقة", "Defects", `
إن خالف المنتج المسلَّم المواصفات المعتمدة أو كان به عيب تصنيع، فأبلغنا خلال 7 أيام من الاستلام مع صور. نعيد التصنيع أو نصلح الكمية المعيبة على نفقتنا، أو نرد قيمتها إن تعذر ذلك.
`, `
If a delivered product deviates from the approved specification or has a manufacturing defect, tell us within 7 days of delivery with photos. We remake or fix the defective quantity at our cost, or refund its value if that isn't possible.
`),
      s("how", "طريقة الاسترداد ومدته", "How refunds are paid", `
- يُرد المبلغ بطريقة الدفع الأصلية: إلى البطاقة للمدفوعات الإلكترونية، أو إلى حسابك البنكي للتحويلات.
- نعالج الطلب خلال 5 أيام عمل من قبوله، وقد يستغرق ظهوره في حسابك من 5 إلى 14 يوم عمل حسب البنك.
- تُرد ضريبة القيمة المضافة بنسبة المبلغ المسترد، ونصدر إشعاراً دائناً بذلك.
`, `
- Refunds go to the original payment method: back to your card for online payments, or to your bank account for transfers.
- We process an approved refund within 5 business days; it may take 5–14 business days to show in your account, depending on your bank.
- VAT is refunded in proportion to the refunded amount, and we issue a credit note.
`),
      s("request", "تقديم الطلب", "How to request", `
راسلنا على {email} أو {phone} مع رقم الطلب أو مرجع العرض (QT-…) وسبب الإلغاء. نرد خلال يومي عمل.
`, `
Email {email} or call {phone} with your order number or quote reference (QT-…) and the reason. We reply within two business days.
`),
    ],
  },
};
