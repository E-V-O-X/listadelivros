export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parâmetro id é obrigatório' });

  const apiKey = process.env.GOOGLE_BOOKS_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes/${id}?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados da API' });
  }
}
