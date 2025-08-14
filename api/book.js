export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parâmetro id é obrigatório' });

  const apiKey = process.env.GOOGLE_BOOKS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_BOOKS_KEY não configurada' });

  const url = `https://www.googleapis.com/books/v1/volumes/${id}?key=${apiKey}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar detalhes do livro' });
  }
}
