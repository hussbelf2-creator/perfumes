import { useEffect, useState } from "react";
import { creativesRepo, type Catalog } from "./repo";

/** الكتالوج المنشور (المصممون وأعمالهم) */
export function useCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    creativesRepo
      .listPublished()
      .then((c) => live && setData(c))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}
