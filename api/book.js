// /api/book.js — Detalhes via Open Library (aceita OLID de edição: OL...M ou de obra: OL...W)

function coverFrom(covers, isbn) {
  if (Array.isArray(covers) && covers.length) {
    return `https://covers.openlibrary.org/b/id/${covers[0]}-L.jpg`;
  }
  if (isbn && isbn.length) {
    return `https://covers.openlibrary.org/b/isbn/${isbn[0]}-L.jpg`;
  }
  return null;
}
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}
async function getAuthorNames(authorRefs = []) {
  const names = [];
  for (const a of authorRefs) {
    const key = a?.author?.key || a?.key; // edição traz { author: { key } }, obra traz { key }
    if (!key) continue;
    try {
      const data = await fetchJson(`https://openlibrary.org${key}.json`);
      if (data?.name) names.push(data.name);
    } catch {}
  }
  return names;
}
function normalizeDescription(desc) {
  if (!desc) return undefined;
  if (typeof desc === "string") return desc;
  if (typeof desc === "object" && desc.value) return desc.value;
  return undefined;
}
function isPt(langs = []) {
  return langs.some(l => typeof l?.key === "string" && /\/languages\/por$/.test(l.key));
}

module.exports = async (req, res) => {
  try {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: "Parâmetro id é obrigatório" });

    const isEdition = /OL\d+M$/i.test(id);
    const isWork = /OL\d+W$/i.test(id);

    let edition = null;
    let work = null;

    if (isEdition) {
      edition = await fetchJson(`https://openlibrary.org/books/${id}.json`);
      // Muitas edições apontam para a obra
      const workKey = edition?.works?.[0]?.key;
      if (workKey) work = await fetchJson(`https://openlibrary.org${workKey}.json`);
    } else if (isWork) {
      work = await fetchJson(`https://openlibrary.org/works/${id}.json`);
      // Se não houver edição, tudo bem — usamos dados da obra
    } else {
      // fallback: tentar como edição
      try { edition = await fetchJson(`https://openlibrary.org/books/${id}.json`); } catch {}
      if (!edition) work = await fetchJson(`https://openlibrary.org/works/${id}.json`);
    }

    // Título/autores
    const title = edition?.title || work?.title || "Sem título";
    const authorRefs = edition?.authors || work?.authors || [];
    const authors = await getAuthorNames(authorRefs);

    // Metadados
    const publishers = edition?.publishers || work?.publishers || [];
    const publisher = Array.isArray(publishers) ? publishers[0] : publishers;
    const publishedDate = edition?.publish_date || work?.created?.value?.slice(0, 10);
    const pageCount = edition?.number_of_pages || work?.number_of_pages;
    const categories = work?.subjects || edition?.subjects || [];
    const description = normalizeDescription(edition?.description || work?.description);
    const langPt = isPt(edition?.languages || work?.languages || []);
    const isbnList = edition?.isbn_13 || edition?.isbn_10 || [];

    const cover = coverFrom(edition?.covers || work?.covers, isbnList);

    const response = {
      id: id,
      volumeInfo: {
        title,
        authors,
        publisher,
        publishedDate,
        language: langPt ? "pt" : "pt", // mantemos "pt" para o front, mesmo que faltarem metadados
        categories,
        pageCount,
        imageLinks: cover ? { thumbnail: cover, smallThumbnail: cover } : undefined,
        description,
        // averageRating não disponível pela OL por padrão
      },
      saleInfo: { country: "BR" }, // mantém formato esperado pelo front
    };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(response);
  } catch (e) {
    console.error("book.js error:", e);
    return res.status(500).json({ error: "Erro ao buscar detalhes", details: String(e) });
  }
};
