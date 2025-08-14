// /api/books.js
export default async function handler(req, res) {
  const { q, lang, orderBy = 'relevance', startIndex = '0', maxResults = '24' } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

  const apiKey = process.env.GOOGLE_BOOKS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_BOOKS_KEY não configurada' });

  const params = new URLSearchParams({
    q,
    orderBy,
    printType: 'books',
    startIndex,
    maxResults,
    key: apiKey,
  });
  if (lang) params.set('langRestrict', lang);

  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar dados da API' });
  }
}
