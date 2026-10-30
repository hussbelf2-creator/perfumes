// يُحمَّل قبل jiti/register: الاسم المستعار @ → src كما في Vite
import { fileURLToPath } from "node:url";
process.env.JITI_ALIAS = JSON.stringify({ "@": fileURLToPath(new URL("../../src", import.meta.url)) });
