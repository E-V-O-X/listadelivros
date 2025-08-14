// /api/books.js  — Somente PT-BR
module.exports = async (req, res) => {
  try {
    const {
      q,
      orderBy = 'relevance',
      startIndex = '0',
      maxResults = '24',
    } = req.query || {};

    if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

    const apiKey = process.env.GOOGLE_BOOKS_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_BOOKS_KEY não configurada' });

    // Sempre força PT + BR
    const params = new URLSearchParams({
      q,
      orderBy,
      printType: 'books',
      startIndex,
      maxResults,
      key: apiKey,
      langRestrict: 'pt',
      country: 'BR',
    });

    const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || 'Erro Google Books',
        status: r.status,
      });
    }

    // --- Filtro e priorização PT-BR ---
    const PT_PUBLISHERS_PT = /(porto\s+editora|bertrand|rel[oó]gio d.?[’']?água|tinta[-\s]?da[-\s]?china|dom\s+quixote|quasi|cotovia|ant[ií]gona|asa\b)/i;
    const BR_HINT_PUBLISHERS = /(brasil|editora|intr[ií]nseca|rocco|companhia das letras|arqueiro|suma|record|galera|harpercollins\s*brasil|globo livros|planeta.*brasil|darkside|novo s[eé]culo|pipoca|martins fontes|paz e terra|leya\s*brasil)/i;

    function isPortugalISBN(isbns) {
      const s = (isbns || []).map(ii => (ii.identifier || '').replace(/-/g, '')).join(' ');
      return /(^|\s)(978972|978989|972|989)(\d|\s|$)/.test(s);
    }
    function isBrazilISBN(isbns) {
      const s = (isbns || []).map(ii => (ii.identifier || '').replace(/-/g, '')).join(' ');
      return /(^|\s)(97885|97965)(\d|\s|$)/.test(s);
    }

    let items = (data.items || [])
      // 1) Só language pt (defensivo — já vem filtrado pelo langRestrict)
      .filter(it => String(it.volumeInfo?.language || '').toLowerCase().startsWith('pt'))
      // 2) Remove edições de Portugal por ISBN/editoras
      .filter(it => {
        const v = it.volumeInfo || {};
        const fromPT = isPortugalISBN(v.industryIdentifiers) || PT_PUBLISHERS_PT.test(String(v.publisher || '').toLowerCase());
        return !fromPT;
      });

    // 3) Ordena favorecendo edições do Brasil
    const scored = items.map(it => {
      const v = it.volumeInfo || {};
      let score = 0;
      if ((it.saleInfo?.country || '').toUpperCase() === 'BR') score += 3;
      if (isBrazilISBN(v.industryIdentifiers)) score += 4;
      if (BR_HINT_PUBLISHERS.test(String(v.publisher || '').toLowerCase())) score += 2;
      return { it, score };
    }).sort((a,b) => b.score - a.score).map(x => x.it);

    // Mantém totalItems original (do Google)
    const payload = { ...data, items: scored };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('books.js error:', e);
    return res.status(500).json({ error: 'Erro ao buscar dados da API', details: String(e) });
  }
};
