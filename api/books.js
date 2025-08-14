export default async function handler(req, res) {
  const { q, lang } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

  const apiKey = process.env.GOOGLE_BOOKS_KEY;
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=24&key=${apiKey}`;
  if (lang) url += `&langRestrict=${lang}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados da API' });
  }
}
