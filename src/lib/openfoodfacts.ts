/**
 * OpenFoodFacts: autocompletado de productos por código de barras.
 *
 * Es una API pública y gratuita. No debe bloquear el alta: si falla o no
 * encuentra el código, el formulario sigue funcionando a mano.
 */

export type OpenFoodFactsProduct = {
  codigo: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  imagen: string | null;
  cantidad: string | null;
};

type OffResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_es?: string;
    brands?: string;
    categories?: string;
    quantity?: string;
    image_front_small_url?: string;
    image_url?: string;
  };
};

const FIELDS = [
  'product_name',
  'product_name_es',
  'brands',
  'categories',
  'quantity',
  'image_front_small_url',
  'image_url',
].join(',');

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function firstCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first ? titleCase(first).slice(0, 60) : null;
}

export function normalizeBarcodeForLookup(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 14);
}

export async function fetchOpenFoodFacts(
  rawCode: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsProduct | null> {
  const codigo = normalizeBarcodeForLookup(rawCode);
  if (codigo.length < 8) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${FIELDS}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as OffResponse;
  if (json.status !== 1 || !json.product) return null;

  const baseName = (json.product.product_name_es || json.product.product_name || '').trim();
  if (!baseName) return null;

  const marca = json.product.brands?.split(',')[0]?.trim() || null;
  const nombre =
    marca && !baseName.toLowerCase().includes(marca.toLowerCase())
      ? `${baseName} (${marca})`.slice(0, 120)
      : baseName.slice(0, 120);

  return {
    codigo,
    nombre,
    marca,
    categoria: firstCategory(json.product.categories),
    imagen: json.product.image_front_small_url || json.product.image_url || null,
    cantidad: json.product.quantity?.trim() || null,
  };
}
