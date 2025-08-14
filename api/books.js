// /api/books.js — Busca via Open Library (PT apenas) e prioriza edições BR
// Compatível com Vercel (Node >=18 com fetch global)

const BR_ISBN = /(^|\s)(97885|97965)\d*/; // BR: 978-85... e 979-65...
const BR_PUBLISHERS = /(intr[ií]nseca|rocco|companhia das letras|arqueiro|suma|record|galera|harpercollins\s*brasil|globo livros|planeta.*brasil|darkside|novo s[eé]culo|pipoca|martins fontes|paz e terra|leya\s*brasil|todavia|aut[eô]ntica|editora 34|cia das letras|cia\.? das letras|seguinte|rocco jovem)/i;

function coverFromDoc(doc, size = "M") {
  if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
  // como fallback, tenta por ISBN se vier
  const isbn = (doc.isbn && doc.isbn[0]) || null;
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg` : null;
}
function isBrazilEdition(ed) {
  const allIsbns = (ed.isbn || []).join(" ");
  const pub = (Array.isArray(ed.publisher) ? ed.publisher[0] : ed.publisher) || "";
  return BR_ISBN.test(allIsbns.replace(/-/g, "")) || BR_PUBLISHERS.test(pub);
}
function pickBestEdition(doc) {
  const eds = doc.editions?.docs || [];
  // 1) edições em português
  const ptEds = eds.filter(e => (e.language || []).includes("por"));
  // 2) prioriza BR
  const brFirst = [...ptEds].sort((a, b) => (isBrazilEdition(b) ? 1 : 0) - (isBrazilEdition(a) ? 1 : 0));
  return brFirst[0] || ptEds[0] || null;
}
function toGoogleishItem(doc) {
  const edition = pickBestEdition(doc) || doc;
  const id = (edition.key || doc.key || "").replace(/^\/books\//, "").replace(/^\/works\//, "");
  const title = edition.title || doc.title || "Sem título";
  const authors = doc.author_name || [];
  const publisher = Array.isArray(edition.publisher) ? edition.publisher[0] : edition.publisher;
  const publishedDate = edition.publish_date || (doc.first_publish_year ? String(doc.first_publish_year) : undefined);
  const image = coverFromDoc(edition) || coverFromDoc(doc);
  const subjects = doc.subject ? doc.subject.slice(0, 6) : [];

  return {
    id,
    volumeInfo: {
      title,
      authors,
      publisher,
      publishedDate,
      language: "pt",
      categories: subjects,
      imageLinks: image ? { thumbnail: image, smallThumbnail: image } : undefined,
      // Campos que o front usa; rating/descrição vêm no /api/book
    },
  };
}

module.exports = async (req, res) => {
  try {
    const {
      q,
      orderBy = "relevance", // ignorado pela OL (mantido p/ compat), mapear para sort=new
      startIndex = "0",
      maxResults = "24",
    } = req.query || {};

    if (!q) return res.status(400).json({ error: "Parâmetro q é obrigatório" });

    // Força língua portuguesa (excludente) e preferência de UI em pt
    const enforcePt = q.includes("language:") ? q : `${q} language:por`;

    const fields = [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "cover_i",
      "subject",
      "isbn",
      "publisher",
      // pedimos algumas infos de edições para escolher a melhor em PT-BR
      "editions",
      "editions.key",
      "editions.title",
      "editions.language",
      "editions.isbn",
      "editions.publisher",
      "editions.publish_date",
      "editions.number_of_pages_median",
    ].join(",");

    const params = new URLSearchParams({
      q: enforcePt,
      fields,
      limit: String(maxResults),
      offset: String(startIndex),
      lang: "pt", // influencia o destaque de edições PT na resposta
      // sort: orderBy === "newest" ? "new" : "relevance", // opcional
    });

    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: "Falha na Open Library" });
    const data = await r.json();

    const docs = Array.isArray(data.docs) ? data.docs : [];
    const items = docs.map(toGoogleishItem);

    // Empacota com a mesma forma que o front já espera (Google Books-like)
    const payload = {
      kind: "openlibrary#volumes",
      totalItems: Number(data.num_found || 0),
      items,
    };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(payload);
  } catch (e) {
    console.error("books.js error:", e);
    return res.status(500).json({ error: "Erro ao buscar dados", details: String(e) });
  }
};
